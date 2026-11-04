"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPublicClient, createWalletClient, custom, erc20Abi, formatEther, parseUnits, type Address } from "viem";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/query";
import type { CloseTradeResponse, OpenTradeResponse, Trade, TradesResponse } from "@/lib/api/types";
import { closeToOrder, draftToOrder, HIDEKI, humanPrice, limitsToStops, maxLeverageX, OrderError, shortError } from "@/lib/bump/dreamdex";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets } from "@/lib/chain/markets";
import { round2, usd } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { useMarket } from "@/modules/market/price-provider";
import { DEFAULT_DRAFT, MIN_STAKE, TradeContext, type ChainSetup, type PendingTrade, type TradeContextValue } from "./trade-context";
import type { CloseReason, ClosedTrade, Draft, Position } from "./types";

/** STT a member needs on hand: the TP/SL pair pre-pays 0.15 per stop, and every transaction pays gas. */
const GAS_NEEDED_STT = 0.4;

const usdOf = (raw: bigint, m: Parameters<typeof humanPrice>[1]) => (raw < 0n ? -humanPrice(-raw, m) : humanPrice(raw, m));

/** Retries a call to bump-backend through network failures and 5xx. A 4xx is an answer, so it is not retried. */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
      if (!retryable || i >= tries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

const toPosition = (t: Trade): Position => ({
  id: t.id,
  marketId: t.marketId,
  side: t.side,
  entry: t.entry,
  margin: round2(t.margin * t.openFraction),
  leverage: t.leverage,
  targetPct: t.targetPct,
  stopPct: t.stopPct,
  openedAt: t.openedAt,
});

const toClosed = (t: Trade): ClosedTrade => ({
  id: t.id,
  marketId: t.marketId,
  side: t.side,
  leverage: t.leverage,
  margin: t.margin,
  entry: t.entry,
  exit: t.exit ?? t.entry,
  pnl: t.pnl ?? t.realizedPnl,
  closedAt: t.closedAt ?? t.openedAt,
  reason: t.reason ?? "manual",
});

/** TP/SL ids the app armed, per wallet, so they can be cancelled when the trade closes or its limits change. */
const stopsKey = (address: string) => `bump:stops:${address.toLowerCase()}`;
/** An open fill the backend has not confirmed yet (network died after the order filled). Retried on the next load. */
const unloggedKey = (address: string) => `bump:unlogged:${address.toLowerCase()}`;

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the indexer listing is the fallback for stop ids
  }
}

/**
 * Member trading on dreamDEX (Somnia Tokyo (Hideki)). The member's embedded wallet signs every order, so holding BUMP really
 * trades: an IOC market order sized stake × leverage, a linked TP/SL pair armed on the stop registry, and each fill logged
 * to bump-backend, which re-reads it from the receipt before anything counts. Position, history, XP and the leaderboard
 * all come from that log; the balance and every limit come from the exchange itself.
 */
export function ChainTradeProvider({ address, tradingAccount, children }: { address: string; tradingAccount: string | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const { wallets } = useWallets();
  const { data: markets } = useChainMarkets();
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [pending, setPending] = useState<PendingTrade | null>(null);
  const [receipt, setReceipt] = useState<ClosedTrade | null>(null);
  const busy = useRef(false);
  /** The sign-in wallet: signs, sends, and pays gas. */
  const wallet = address as Address;
  /** Whose balance and positions these are: the player's dreamDEX smart account when linked, else the wallet itself. */
  const account = (tradingAccount ?? address) as Address;
  const bank = markets ? (Object.values(markets)[0]?.marginBank as Address | undefined) : undefined;

  const trades = useQuery({
    queryKey: qk.trades(address),
    queryFn: () => api<TradesResponse>("/api/trades"),
    refetchInterval: (q) => (q.state.data?.open ? 5_000 : 30_000),
  });
  const open = trades.data?.open ?? null;
  const position = useMemo(() => (open ? toPosition(open) : null), [open]);
  const history = useMemo(() => (trades.data?.history ?? []).map(toClosed), [trades.data?.history]);

  /** The perps collateral (USDso) is the market row's quote token, not the SDK address set's `collateral` entry. */
  const collateral = markets ? (Object.values(markets)[0]?.quoteToken as Address | undefined) : undefined;
  /** USDso sitting in the account itself, not yet deposited. The bank's equity read never counts it. */
  const heldCollateral = useCallback(async () => {
    if (!collateral) return 0n;
    const [held] = await exchange().client.getBalances([{ token: collateral }], account);
    return held ?? 0n;
  }, [collateral, account]);

  // exchange reads: free collateral + equity (bank plus USDso still in the account), gas money, the house-money voucher
  const equity = useQuery({
    queryKey: ["bump", "chain", "equity", account, collateral],
    enabled: !!bank && !!collateral,
    refetchInterval: 10_000,
    queryFn: async () => {
      const client = exchange().client;
      const held = await heldCollateral();
      try {
        const e = await client.getAccountEquity(account, { scope: "perps", marginBank: bank as Address });
        return { total: e.totalEquity + held, free: e.equity + held };
      } catch {
        // one stale mark makes the full read throw; the bank's own answer still says what the account holds
        const total = await client.tryGetPerpAccountEquity(bank as Address, account);
        if (total === null) throw new Error("equity unavailable");
        return { total: total + held, free: total + held };
      }
    },
  });
  const gas = useQuery({
    queryKey: ["bump", "chain", "gas", address],
    refetchInterval: 15_000,
    // gas is paid by the wallet that sends the transactions, even when the trades live on a smart account
    queryFn: async () => Number(formatEther(await exchange().client.getNativeBalance(wallet))),
  });

  const row = markets?.[draft.marketId];
  const scale = row ?? (markets ? (Object.values(markets)[0] as NonNullable<typeof row>) : undefined);
  const balance = scale && equity.data ? round2(usdOf(equity.data.total, scale)) : 0;
  const available = scale && equity.data ? round2(Math.max(0, usdOf(equity.data.free, scale))) : 0;
  const broke = !position && !!equity.data && available < MIN_STAKE;

  // the market's own cap, held lower for an account living on a voucher (its cap replaces the market's)
  const leverage = useQuery({
    queryKey: ["bump", "chain", "leverage", account, draft.marketId],
    enabled: !!row,
    staleTime: 60_000,
    queryFn: async () => {
      const r = row as NonNullable<typeof row>;
      const l = (await exchange().client.getPerpLeverage({ marginBank: r.marginBank as Address, account, pool: r.poolAddress })) as unknown as {
        creditFloor: bigint;
        voucherLeverageCapX: bigint | number;
        voucherMarketAllowed: boolean;
      };
      return { onVoucher: l.creditFloor > 0n, cap: Number(l.voucherLeverageCapX), allowed: l.voucherMarketAllowed };
    },
  });
  const marketCap = row ? maxLeverageX(row) : 1;
  const voucherLimited = !!leverage.data?.onVoucher;
  const maxLeverage = voucherLimited ? (leverage.data?.allowed && leverage.data.cap > 0 ? Math.min(marketCap, leverage.data.cap) : 0) : marketCap;

  // would the exchange take this order? (margin, position limits, lot size), judged on its own sizing rules
  const live = useMarket(draft.marketId);
  const priceBucket = Number(live.price.toPrecision(3));
  const check = useQuery({
    queryKey: ["bump", "chain", "check", account, draft.marketId, draft.side, draft.margin, draft.leverage, priceBucket],
    enabled: !!row && !position && live.priceStatus === "live" && maxLeverage >= draft.leverage && draft.margin >= MIN_STAKE,
    staleTime: 4_000,
    queryFn: async (): Promise<{ error: string | null }> => {
      const r = row as NonNullable<typeof row>;
      try {
        const order = draftToOrder(draft, r, live.price);
        // autoPull: the account sends its own orders, so the pool tops the bank up from its USDso
        const max = await exchange().client.getMaxPerpOrderSize({ pool: r.poolAddress, marginBank: r.marginBank as Address, account, isBid: order.isBid, price: order.price, autoPull: true });
        if (!max.priceable) return { error: "Price feed paused, try again." };
        // an allowance short of the balance is not a blocker: opening deposits the held USDso, which approves the bank
        if (order.quantity > max.maxQuantity && max.limitedBy !== "walletAllowance") return { error: `Not enough balance for ${usd(draft.margin)} at ${draft.leverage}x. You have ${usd(available)} free.` };
        return { error: null };
      } catch (error) {
        return { error: error instanceof OrderError ? `${error.message}.` : null };
      }
    },
  });

  const blocker = position
    ? "Close your trade first."
    : trades.isError && !trades.data
      ? "Can't reach bump right now. Try again in a moment."
      : !markets
        ? "Loading dreamDEX markets…"
        : !row
          ? `${draft.marketId.toUpperCase()} isn't listed right now.`
          : draft.margin < MIN_STAKE
            ? "Pick a stake first."
            : gas.data !== undefined && gas.data < GAS_NEEDED_STT
              ? `Needs ${GAS_NEEDED_STT} STT for gas and TP/SL. You have ${gas.data.toFixed(2)}.`
              : broke
                ? "No USDso to trade. Add USDso to your account first."
                : maxLeverage === 0
                  ? `Your voucher can't trade ${draft.marketId.toUpperCase()}.`
                  : draft.leverage > maxLeverage
                    ? `${draft.marketId.toUpperCase()} allows up to ${maxLeverage}x for you.`
                    : live.priceStatus !== "live"
                      ? "Waiting for a live dreamDEX price."
                      : (check.data?.error ?? null);

  const setup = useMemo<ChainSetup>(
    () => ({
      address,
      account,
      linked: !!tradingAccount,
      gas: gas.data ?? 0,
      gasNeeded: GAS_NEEDED_STT,
      connected: !!markets && gas.isSuccess,
      balanceLoading: equity.isPending,
      balanceError: equity.isError,
    }),
    [address, account, tradingAccount, gas.data, gas.isSuccess, markets, equity.isPending, equity.isError],
  );

  const patchDraft = useCallback(
    (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) })),
    [],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.trades(address) }),
      queryClient.invalidateQueries({ queryKey: qk.progress(address) }),
      queryClient.invalidateQueries({ queryKey: qk.leaderboards }),
      queryClient.invalidateQueries({ queryKey: ["bump", "chain"] }),
    ]);
  }, [queryClient, address]);

  /**
   * The trader for this member. Their embedded wallet signs without a popup; with a linked dreamDEX smart account the
   * wallet is an owner that sends the account's transactions (nothing else signs), so the account is the one trading.
   */
  const signer = useCallback(async () => {
    const privy = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
    if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
    await privy.switchChain(HIDEKI.chainId);
    const provider = await privy.getEthereumProvider();
    const walletClient = createWalletClient({ account: wallet, chain: HIDEKI.chain, transport: custom(provider) });
    if (!tradingAccount) {
      exchange().setSigner({ walletClient });
      return exchange().trader;
    }
    const { client } = exchange();
    const owner = client.createExecutor({ walletClient });
    return client.createTrader({ executor: client.createExecutor({ smartAccount: account, inner: owner }) });
  }, [wallets, address, wallet, account, tradingAccount]);

  const markOf = useCallback(async (r: NonNullable<typeof row>) => {
    // the feed read survives a dead oracle (getPerpState reverts instead), and an "ok" zero mark is not a price
    const feed = await exchange().client.getPerpFeedStatus(r.poolAddress);
    if (!feed.markPriceOk || feed.markPrice <= 0n) throw new Error("Price feed paused, try again.");
    return humanPrice(feed.markPrice, r);
  }, []);

  /** Arms a TP/SL pair for `t` and remembers the stop ids. Resolves their ids. */
  const armStops = useCallback(
    async (trader: Awaited<ReturnType<typeof signer>>, r: NonNullable<typeof row>, t: Pick<Trade, "id" | "side" | "entry">, targetPct: number, stopPct: number) => {
      const result = await trader.placePerpStopOrder(limitsToStops(t.side, t.entry, targetPct, stopPct, r));
      const ids = [result.stopOrderId, result.pairedStopOrderId].filter((id): id is bigint => id !== undefined).map(String);
      writeJson(stopsKey(address), { tradeId: t.id, ids });
      return ids;
    },
    [address],
  );

  /** Cancels the trade's pending stops (refunding their STT). Best effort: a stop that already fired is gone. */
  const cancelStops = useCallback(
    async (trader: Awaited<ReturnType<typeof signer>>, r: NonNullable<typeof row>) => {
      if (!r.stopRegistry) return;
      const stored = readJson<{ ids: string[] }>(stopsKey(address))?.ids ?? [];
      let listed: string[] = [];
      try {
        listed = (await exchange().client.listPerpStopOrders({ account, pool: r.poolAddress, status: ["PENDING"] })).map((s) => s.orderIdRaw);
      } catch {
        // indexer down: the stored ids still cover this device's stops
      }
      const ids = [...new Set([...stored, ...listed])].map((id) => BigInt(id));
      if (ids.length === 0) return;
      try {
        await trader.cancelPerpStopOrders({ registry: r.stopRegistry as Address, orderIds: ids });
      } catch {
        // already triggered or cancelled
      }
      writeJson(stopsKey(address), null);
    },
    [address, account],
  );

  const step = useCallback((kind: PendingTrade["kind"], patch: Partial<PendingTrade>) => setPending((p) => ({ kind, step: "fill", txHash: null, error: null, warning: null, ...(p?.kind === kind ? p : {}), ...patch })), []);

  const openPosition = useCallback(
    async (_entryHint: number) => {
      if (blocker || busy.current || !row) return false;
      busy.current = true;
      setPending({ kind: "open", step: "fill", txHash: null, error: null, warning: null });
      try {
        const trader = await signer();
        // USDso still in the account goes into the MarginBank first; the deposit also approves the bank, so later orders can pull
        const held = await heldCollateral();
        if (held > 0n) await trader.depositMargin({ marginBank: row.marginBank as Address, amount: held });
        const order = draftToOrder(draft, row, await markOf(row));
        const placed = await trader.placePerpOrder(order);
        if (placed.fills.length === 0) throw new Error("No fill at this price. Nothing was opened, try again.");
        step("open", { step: "log", txHash: placed.hash });

        // the order filled: from here the position exists on chain whatever happens next, so the log is retried
        writeJson(unloggedKey(address), { txHash: placed.hash, draft });
        let logged: OpenTradeResponse;
        try {
          logged = await withRetry(() => api<OpenTradeResponse>("/api/trades", { body: { ...draft, txHash: placed.hash } }));
        } catch (error) {
          step("open", { step: "done", warning: "Your trade is open, but bump couldn't record it yet. We'll keep trying." });
          void refresh();
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) writeJson(unloggedKey(address), null);
          return true;
        }
        writeJson(unloggedKey(address), null);

        step("open", { step: "stops" });
        let warning: string | null = null;
        try {
          await armStops(trader, row, logged.trade, draft.targetPct, draft.stopPct);
        } catch (error) {
          warning = `Your trade is open, but TP/SL couldn't be set (${shortError(error)}). Edit limits to try again.`;
        }
        step("open", { step: "done", warning });
        sfx.open();
        queryClient.setQueryData<TradesResponse>(qk.trades(address), (prev) => ({ open: logged.trade, history: prev?.history ?? [] }));
        void refresh();
        return true;
      } catch (error) {
        step("open", { step: "fill", error: shortError(error) });
        return false;
      } finally {
        busy.current = false;
      }
    },
    [blocker, row, draft, signer, heldCollateral, markOf, armStops, address, queryClient, refresh, step],
  );

  const closePosition = useCallback(
    async (percent: number, _exitHint: number, _reason: CloseReason = "manual"): Promise<ClosedTrade | null> => {
      const t = open;
      const r = t ? markets?.[t.marketId] : undefined;
      if (!t || !r || busy.current) return null;
      busy.current = true;
      setPending({ kind: "close", step: "fill", txHash: null, error: null, warning: null });
      try {
        const trader = await signer();
        const onChain = await exchange().client.getPerpPosition({ marginBank: r.marginBank as Address, account, pool: r.poolAddress });
        if (onChain.size === 0n) {
          void refresh();
          throw new Error("Your trade already closed.");
        }
        const order = closeToOrder({ side: t.side, sizeRaw: onChain.size }, percent, r, await markOf(r));
        const placed = await trader.placePerpOrder(order);
        if (placed.fills.length === 0) throw new Error("No fill at this price. Nothing was closed, try again.");
        step("close", { step: "log", txHash: placed.hash });

        const logged = await withRetry(() => api<CloseTradeResponse>(`/api/trades/${t.id}/close`, { body: { txHash: placed.hash } }));
        const done = logged.trade.closedAt !== null;
        if (done) await cancelStops(trader, r);
        const closed: ClosedTrade = {
          id: done ? logged.trade.id : `${logged.trade.id}:${placed.hash.slice(2, 10)}`,
          marketId: t.marketId,
          side: t.side,
          leverage: t.leverage,
          margin: round2(t.margin * (done ? t.openFraction : t.openFraction - logged.trade.openFraction)),
          entry: t.entry,
          exit: logged.trade.exit ?? humanPrice(order.price, r),
          pnl: round2((done ? (logged.trade.pnl ?? logged.trade.realizedPnl) : logged.trade.realizedPnl) - t.realizedPnl),
          closedAt: logged.trade.closedAt ?? Date.now(),
          reason: "manual",
        };
        sfx.close(closed.pnl);
        setReceipt(closed);
        step("close", { step: "done" });
        queryClient.setQueryData<TradesResponse>(qk.trades(address), (prev) => ({
          open: done ? null : logged.trade,
          history: done ? [logged.trade, ...(prev?.history ?? [])] : (prev?.history ?? []),
        }));
        void refresh();
        return closed;
      } catch (error) {
        const message = error instanceof Error && !(error as { errorName?: string }).errorName && error.message.length < 90 ? error.message : shortError(error);
        step("close", { error: message });
        throw new Error(message);
      } finally {
        busy.current = false;
      }
    },
    [open, markets, signer, account, markOf, cancelStops, address, queryClient, refresh, step],
  );

  const updateLimits = useCallback(
    async (limits: Pick<Position, "targetPct" | "stopPct">) => {
      const t = open;
      const r = t ? markets?.[t.marketId] : undefined;
      if (!t || !r || busy.current) return false;
      busy.current = true;
      setPending({ kind: "limits", step: "stops", txHash: null, error: null, warning: null });
      try {
        const trader = await signer();
        await cancelStops(trader, r);
        try {
          await armStops(trader, r, t, limits.targetPct, limits.stopPct);
        } catch (error) {
          // never leave the trade bare: put the old limits back before reporting the failure
          await armStops(trader, r, t, t.targetPct, t.stopPct).catch(() => undefined);
          throw error;
        }
        await withRetry(() => api(`/api/trades/${t.id}/limits`, { body: limits }));
        step("limits", { step: "done" });
        void refresh();
        return true;
      } catch (error) {
        const message = shortError(error);
        step("limits", { error: message });
        throw new Error(message);
      } finally {
        busy.current = false;
      }
    },
    [open, markets, signer, cancelStops, armStops, refresh, step],
  );

  /** Pulls free collateral out of the MarginBank back to the trading account. `amount` is a decimal string of USDso. */
  const withdraw = useCallback(
    async (amount: string) => {
      if (!bank || !scale || busy.current) return;
      busy.current = true;
      try {
        const raw = parseUnits(amount, scale.quoteDecimals);
        if (raw <= 0n) throw new Error("Enter an amount to withdraw.");
        const { withdrawable } = await exchange().client.getMarginAccount(bank, account);
        if (raw > withdrawable) throw new Error(`You can withdraw up to ${usd(round2(usdOf(withdrawable, scale)))} right now.`);
        const trader = await signer();
        await trader.withdrawMargin({ marginBank: bank, amount: raw });
        await refresh();
      } catch (error) {
        throw new Error(shortError(error));
      } finally {
        busy.current = false;
      }
    },
    [bank, scale, account, signer, refresh],
  );

  /**
   * Moves USDso held by the sign-in wallet into the linked dreamDEX smart account, the one that trades. A plain ERC-20
   * transfer signed by the wallet itself (not through the smart account). `amount` is a decimal string of USDso.
   */
  const moveToAccount = useCallback(
    async (amount: string) => {
      if (!tradingAccount || !collateral || !scale || busy.current) return;
      busy.current = true;
      try {
        const raw = parseUnits(amount, scale.quoteDecimals);
        if (raw <= 0n) throw new Error("Enter an amount to move.");
        const [held] = await exchange().client.getBalances([{ token: collateral }], wallet);
        if (raw > (held ?? 0n)) throw new Error(`Your wallet holds ${usd(round2(usdOf(held ?? 0n, scale)))} USDso.`);
        const privy = wallets.find((w) => w.address.toLowerCase() === address.toLowerCase());
        if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
        await privy.switchChain(HIDEKI.chainId);
        const provider = await privy.getEthereumProvider();
        const walletClient = createWalletClient({ account: wallet, chain: HIDEKI.chain, transport: custom(provider) });
        const hash = await walletClient.writeContract({ address: collateral, abi: erc20Abi, functionName: "transfer", args: [tradingAccount as Address, raw] });
        await createPublicClient({ chain: HIDEKI.chain, transport: custom(provider) }).waitForTransactionReceipt({ hash });
        await refresh();
      } catch (error) {
        throw new Error(shortError(error));
      } finally {
        busy.current = false;
      }
    },
    [tradingAccount, collateral, scale, wallet, wallets, address, refresh],
  );

  // "Refill" re-reads the balance, so USDso just sent shows up at once. An account that never claimed dreamDEX's one-time
  // 1,000 USDso voucher claims it here (it must be flat; the chain says why when it can't).
  const refill = useCallback(async () => {
    await refresh();
    if (bank && !busy.current) {
      const eligibility = await exchange().client.getPerpVoucherEligibility(bank, account).catch(() => null);
      if (eligibility?.eligible) {
        busy.current = true;
        try {
          const trader = await signer();
          await trader.claimPerpVoucher({ marginBank: bank });
          await refresh();
          return;
        } catch (error) {
          throw new Error(shortError(error));
        } finally {
          busy.current = false;
        }
      }
      const why: Record<string, string> = {
        alreadyClaimed: "This account already claimed its voucher.",
        notFlat: "Close your open positions and orders to claim the voucher.",
        mainFunded: "This account is funded by a main wallet, so it can't claim the voucher.",
        budgetExhausted: "The voucher budget is used up.",
        notStarted: "The voucher campaign hasn't started.",
        ended: "The voucher campaign has ended.",
      };
      const reasonText = eligibility && "reason" in eligibility ? why[String(eligibility.reason)] : undefined;
      if (reasonText) throw new Error(`${reasonText} Send USDso (Somnia Tokyo testnet) to ${account} to trade.`);
    }
    throw new Error(`Send USDso (Somnia Tokyo testnet) to ${account} to trade.`);
  }, [refresh, account, bank, signer]);

  const previewClose = useCallback(
    async (percent: number): Promise<number | null> => {
      const t = open;
      const r = t ? markets?.[t.marketId] : undefined;
      if (!t || !r) return null;
      try {
        const onChain = await exchange().client.getPerpPosition({ marginBank: r.marginBank as Address, account, pool: r.poolAddress });
        if (onChain.size === 0n) return null;
        const size = onChain.size < 0n ? -onChain.size : onChain.size;
        const lot = BigInt(r.lotSize);
        const quantity = percent >= 100 ? undefined : ((size * BigInt(Math.round(percent * 100))) / 10_000n / lot) * lot;
        const p = await exchange().client.previewPerpClosePnl({ pool: r.poolAddress, marginBank: r.marginBank as Address, account, ...(quantity ? { quantity } : {}) });
        return p.priceable ? round2(usdOf(p.netProceeds, r)) : null;
      } catch {
        return null;
      }
    },
    [open, markets, account],
  );

  const dismissPending = useCallback(() => setPending(null), []);

  // a fill the backend never confirmed (the network died right after the order): confirm it now
  useEffect(() => {
    if (!trades.isSuccess || trades.data.open) return;
    const lost = readJson<{ txHash: string; draft: Draft }>(unloggedKey(address));
    if (!lost) return;
    void api<OpenTradeResponse>("/api/trades", { body: { ...lost.draft, txHash: lost.txHash } })
      .then(() => {
        writeJson(unloggedKey(address), null);
        void refresh();
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) writeJson(unloggedKey(address), null);
      });
  }, [trades.isSuccess, trades.data?.open, address, refresh]);

  // a closed trade's receipt is only needed until the history carries it
  const lastClosed = receipt && receipt.closedAt >= (history[0]?.closedAt ?? 0) ? receipt : (history[0] ?? null);

  const value = useMemo<TradeContextValue>(
    () => ({
      mode: "chain",
      draft,
      position,
      history,
      ready: !trades.isPending,
      balance,
      available,
      broke,
      blocker,
      maxLeverage,
      lastClosed,
      pending,
      setup,
      refillLabel: "Add USDso to trade",
      patchDraft,
      openPosition,
      refill,
      withdraw,
      moveToAccount: tradingAccount ? moveToAccount : null,
      updateLimits,
      closePosition,
      previewClose,
      dismissPending,
    }),
    [draft, position, history, trades.isPending, balance, available, broke, blocker, maxLeverage, lastClosed, pending, setup, patchDraft, openPosition, refill, withdraw, moveToAccount, tradingAccount, updateLimits, closePosition, previewClose, dismissPending],
  );

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}
