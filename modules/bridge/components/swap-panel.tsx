"use client";

import { useWallets } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createWalletClient, custom, formatUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortError } from "@/lib/bump/dreamdex";
import { GAS_ENVELOPE_STT, SIDES, switchTo, type BridgeSide } from "@/lib/chain/bridge";
import { exchangeOn } from "@/lib/chain/exchange";
import { buyFrom, floorDp, HEADROOM, pairOf, sellInto, TOKEN_LOGO, type Level, type SpotPair } from "@/lib/chain/swap";
import { useTrade } from "@/modules/trade/trade-provider";

const amountOf = (value: number, max = 4) => value.toLocaleString("en-US", { maximumFractionDigits: max });

function TokenPill({ symbol }: { symbol: string }) {
  const logo = TOKEN_LOGO[symbol];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 font-display text-[16px] font-bold">
      {logo ? (
        <img src={logo} alt="" width={26} height={26} className="size-[26px] rounded-full object-contain" aria-hidden />
      ) : (
        <span aria-hidden className="grid size-[26px] place-items-center rounded-full bg-white/15 text-[12px]">
          {symbol.slice(0, 1)}
        </span>
      )}
      {symbol}
    </span>
  );
}

function Box({ label, trailing, children }: { label: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 px-3 py-2.5">
      <span className="text-[13px] text-white/70">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
      {trailing}
    </Card>
  );
}

/**
 * Swap between any two tokens that share a spot order book on Hideki (STT, USDso, WBTC, WETH), as a market order against
 * the live book: the chain fills what the book has within a 1% limit and returns the rest. The tokens arrive in the
 * wallet that signs the swap.
 */
export function SwapPanel() {
  const { setup } = useTrade();
  const { wallets } = useWallets();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [chain, setChain] = useState<BridgeSide>("hideki");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [side, setSide] = useState<"sell" | "buy">("sell");

  const wallet = setup?.address as Address | undefined;

  // every spot pair on Hideki, read off the chain's own market list
  const pairs = useQuery({
    queryKey: ["bump", "swap", "pairs", chain],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SpotPair[]> => {
      const ex = exchangeOn(chain);
      await ex.loadMarkets();
      return Object.values(ex.markets)
        .filter((m) => m.type === "spot")
        .map(pairOf);
    },
  });
  const pair = pairs.data?.find((p) => p.symbol === symbol) ?? pairs.data?.find((p) => p.quote === "USDso" && p.baseIsNative) ?? pairs.data?.[0];
  const fromSymbol = pair ? (side === "sell" ? pair.base : pair.quote) : "";
  const toSymbol = pair ? (side === "sell" ? pair.quote : pair.base) : "";
  const fromDecimals = pair ? (side === "sell" ? pair.baseDecimals : pair.quoteDecimals) : 18;
  const fromNative = !!pair && side === "sell" && pair.baseIsNative;

  const held = useQuery({
    queryKey: ["bump", "swap", "balance", chain, wallet, pair?.symbol, side],
    enabled: !!wallet && !!pair,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { client } = exchangeOn(chain);
      const gas = await client.getNativeBalance(wallet as Address);
      const raw = fromNative ? gas : ((await client.getBalances([{ token: (side === "sell" ? pair?.baseToken : pair?.quoteToken) as Address }], wallet as Address))[0] ?? 0n);
      return { raw: raw.toString(), gas: gas.toString() };
    },
  });
  const balance = Number(formatUnits(BigInt(held.data?.raw ?? "0"), fromDecimals));
  const gasBalance = Number(formatUnits(BigInt(held.data?.gas ?? "0"), 18));
  // swapping STT away keeps the gas envelope; buying keeps a sliver for the fee
  const spendable = fromNative ? Math.max(0, balance - GAS_ENVELOPE_STT) : side === "buy" ? balance * HEADROOM : balance;

  const book = useQuery({
    queryKey: ["bump", "swap", "book", chain, pair?.symbol],
    enabled: !!pair,
    refetchInterval: 5_000,
    queryFn: async () => {
      const b = await exchangeOn(chain).fetchOrderBook(pair?.symbol as string, 25);
      return { bids: b.bids as readonly Level[], asks: b.asks as readonly Level[] };
    },
  });

  const input = Number(value) || 0;
  let baseAmount = 0;
  let receive = 0;
  let enough = true;
  if (pair && book.data && input > 0) {
    if (side === "sell") {
      baseAmount = floorDp(input, pair.amountDp);
      const r = sellInto(book.data.bids, baseAmount);
      receive = r.out;
      enough = r.filled >= baseAmount - 1e-9;
    } else {
      const budget = input * HEADROOM;
      const r = buyFrom(book.data.asks, budget);
      baseAmount = floorDp(r.out, pair.amountDp);
      receive = baseAmount;
      enough = r.spent >= budget - 1e-9;
    }
  }
  const bestBid = book.data?.bids[0]?.[0];
  const bestAsk = book.data?.asks[0]?.[0];
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : undefined;
  const execPrice = receive > 0 && baseAmount > 0 ? (side === "sell" ? receive / baseAmount : input / baseAmount) : undefined;
  const impact = mid && execPrice ? Math.abs(execPrice / mid - 1) * 100 : undefined;

  const swap = useMutation({
    mutationFn: async () => {
      if (!wallet || !pair) throw new Error("Your wallet isn't ready yet.");
      if (baseAmount <= 0 || baseAmount < pair.minAmount) throw new Error(`The smallest swap here is ${pair.minAmount} ${pair.base}.`);
      if (!enough) throw new Error("The order book is too thin for that size right now. Try a smaller amount.");
      if (gasBalance < GAS_ENVELOPE_STT) throw new Error(`Your wallet needs at least ${GAS_ENVELOPE_STT} STT on ${SIDES[chain].name} to send this. Top it up and try again.`);
      const privy = wallets.find((w) => w.address.toLowerCase() === wallet.toLowerCase());
      if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      const provider = await switchTo(privy, SIDES[chain].chainId, SIDES[chain].name);
      const walletClient = createWalletClient({ account: wallet, chain: SIDES[chain].chain, transport: custom(provider) });
      const ex = exchangeOn(chain);
      ex.setSigner({ walletClient });
      return ex.createOrder(pair.symbol, "market", side, baseAmount);
    },
    onSuccess: (order) => {
      if (!pair) return;
      if (!(order.filled > 0)) {
        flash("Nothing filled: the price moved. Try again.", "warn");
        return;
      }
      setValue("");
      flash(`Swapped ${amountOf(order.filled)} ${pair.base} ${side === "sell" ? "for" : "bought with"} ${pair.quote}.`, "good");
      void held.refetch();
      void book.refetch();
      void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
    },
    onError: (error) => flash(error instanceof Error && error.message.length < 140 && /^(The|Your|Nothing)/.test(error.message) ? error.message : shortError(error), "warn"),
  });

  if (!setup) return <Card className="px-3 py-3 text-[14px]">Swapping is for real dreamDEX trading. Sign in to use it.</Card>;
  if (pairs.isPending) return <Card className="px-3 py-3 text-[14px]">Loading markets…</Card>;
  if (pairs.isError || !pair) return <Card className="px-3 py-3 text-[14px]">Couldn&apos;t load the swap markets. Try again in a moment.</Card>;

  const tooMuch = input > spendable + 1e-9;
  const label = swap.isPending
    ? "Swapping…"
    : input <= 0
      ? "Enter an amount"
      : tooMuch
        ? `Not enough ${fromSymbol}`
        : baseAmount < pair.minAmount
          ? `Minimum ${pair.minAmount} ${pair.base}`
          : !enough
            ? "Not enough liquidity"
            : "Swap";
  const pickChain = (next: BridgeSide) => {
    if (swap.isPending || next === chain) return;
    setChain(next);
    setSymbol(null);
    setSide("sell");
    setValue("");
  };
  const pickPair = (next: string) => {
    if (swap.isPending) return;
    setSymbol(next);
    setValue("");
  };
  const flip = () => {
    if (swap.isPending) return;
    setSide((s) => (s === "sell" ? "buy" : "sell"));
    setValue("");
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        swap.mutate();
      }}
    >
      <div className="flex gap-2" role="group" aria-label="Network">
        {(["somnia", "hideki"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={chain === c}
            disabled={swap.isPending}
            onClick={() => pickChain(c)}
            className={`flex-1 rounded-full px-3 py-1 text-[13px] font-semibold ${chain === c ? "bg-white/20" : "bg-white/5 text-white/60"}`}
          >
            {SIDES[c].name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pair">
        {pairs.data?.map((p) => (
          <button
            key={p.symbol}
            type="button"
            aria-pressed={p.symbol === pair.symbol}
            disabled={swap.isPending}
            onClick={() => pickPair(p.symbol)}
            className={`rounded-full px-3 py-1 text-[13px] font-semibold ${p.symbol === pair.symbol ? "bg-white/20" : "bg-white/5 text-white/60"}`}
          >
            {p.base}/{p.quote}
          </button>
        ))}
      </div>

      <Box
        label="From"
        trailing={
          <div className="flex items-center justify-between text-[12px] text-white/70">
            <span>Balance {held.isPending ? "…" : amountOf(balance)}</span>
            <button type="button" className="font-semibold text-cyan" onClick={() => setValue(String(floorDp(spendable, 6)))}>
              Max
            </button>
          </div>
        }
      >
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.0"
          aria-label={`Amount of ${fromSymbol} to swap`}
          className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
        />
        <TokenPill symbol={fromSymbol} />
      </Box>

      <div className="-my-3.5 z-10 flex justify-center">
        <button
          type="button"
          onClick={flip}
          disabled={swap.isPending}
          aria-label="Switch direction"
          className="grid size-8 place-items-center rounded-full border-2 border-navy-950 bg-linear-to-b from-[#48bfff] to-[#128af6] text-white disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </button>
      </div>

      <Box label="To (estimated)" trailing={<span className="text-[12px] text-white/70">Arrives in your wallet {setup.address.slice(0, 6)}…{setup.address.slice(-4)}</span>}>
        <span className={`min-w-0 flex-1 truncate font-display text-[28px] font-bold tabular-nums ${receive > 0 ? "" : "text-white/30"}`}>{receive > 0 ? amountOf(receive, 6) : "0.0"}</span>
        <TokenPill symbol={toSymbol} />
      </Box>

      <Card className="flex flex-col gap-1 px-3 py-2 text-[12px] text-white/80">
        <p className="flex justify-between">
          <span>Price</span>
          <span>{mid ? `1 ${pair.base} ≈ ${amountOf(mid, 6)} ${pair.quote}` : "…"}</span>
        </p>
        <p className="flex justify-between">
          <span>Price impact</span>
          <span>{impact === undefined ? "–" : `${impact < 0.01 ? "<0.01" : impact.toFixed(2)}%`}</span>
        </p>
        <p className="flex justify-between">
          <span>Max slippage</span>
          <span>1%</span>
        </p>
        <p className="flex justify-between">
          <span>Network gas</span>
          <span>STT on {SIDES[chain].name}</span>
        </p>
      </Card>

      {setup.linked && chain === "hideki" && <p className="text-[12px] leading-snug text-white/60">You trade through a dreamDEX account: swapped USDso lands in your wallet. Move it to the account from Profile.</p>}
      <Button type="submit" disabled={swap.isPending || input <= 0 || tooMuch || !enough || baseAmount < pair.minAmount}>
        {label}
      </Button>
      <p className="text-center text-[11px] leading-snug text-white/50">Market orders on dreamDEX testnet books. Testnet funds only.</p>
    </form>
  );
}
