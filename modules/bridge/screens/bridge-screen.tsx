"use client";

import { useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { DEFAULT_FEES } from "@somnia-chain/markets-sdk";
import { createBridgeTransfer } from "@somnia-chain/markets-sdk/chains";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { createWalletClient, custom, erc20Abi, formatUnits, numberToHex, parseUnits, type Address, type Hex, type TransactionReceipt } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortError } from "@/lib/bump/dreamdex";
import { ASSETS, bridgeClient, GAS_ENVELOPE_STT, hookAnswers, isDelivered, messageIdOf, otherSide, routeOf, SIDES, stepWouldSucceed, switchTo, type BridgeAsset, type BridgeSide } from "@/lib/chain/bridge";
import { exchange } from "@/lib/chain/exchange";
import { BridgeProgress, type BridgeRun } from "../components/bridge-progress";
import { SwapPanel } from "../components/swap-panel";
import { useTrade } from "@/modules/trade/trade-provider";

/** The SDK's fixed gas ceiling; the wallet needs gas × max fee (0.6 STT) on hand, though unused gas is never charged. */
const BRIDGE_GAS = 10_000_000n;

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const amountOf = (value: string, max = 4) => Number(value).toLocaleString("en-US", { maximumFractionDigits: max });

function Logo({ src, size, plate }: { src: string; size: number; plate?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.4)] ${plate ?? ""}`} style={{ width: size, height: size }}>
      <img src={src} alt="" width={size} height={size} className="size-full object-contain" />
    </span>
  );
}

function NetworkPill({ side }: { side: BridgeSide }) {
  const network = SIDES[side];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 text-[13px] font-semibold">
      <Logo src={network.logo} size={20} plate={network.plate} />
      {network.name}
    </span>
  );
}

function TokenPill({ asset }: { asset: BridgeAsset }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 font-display text-[16px] font-bold">
      <Logo src={ASSETS[asset].logo} size={26} />
      {asset}
    </span>
  );
}

function Side({ label, side, trailing, children }: { label: string; side: BridgeSide; trailing?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white/70">{label}</span>
        <NetworkPill side={side} />
      </div>
      <div className="flex items-center gap-2">{children}</div>
      {trailing}
    </Card>
  );
}

/**
 * Move USDso or STT between Somnia Testnet and Hideki over Somnia's Hyperlane lane, the same bridge as the Somnia
 * explorer's. Going in, the funds land in the account that trades. Going out, they leave that account (the wallet itself,
 * or the linked dreamDEX smart account) and arrive in the wallet. Delivery is tracked by the transfer's own Hyperlane
 * message id, not by watching a balance.
 */
export function BridgeScreen() {
  const { setup, mode } = useTrade();
  const { wallets } = useWallets();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [asset, setAsset] = useState<BridgeAsset>("USDso");
  const [from, setFrom] = useState<BridgeSide>("somnia");
  const [tab, setTab] = useState<"bridge" | "swap">("bridge");
  const to = otherSide(from);

  const wallet = setup?.address as Address | undefined;
  const account = setup?.account as Address | undefined;
  /** Who holds the funds being sent: the wallet on Somnia, the trading account on Hideki. */
  const sender = from === "somnia" ? wallet : account;
  const recipient = to === "hideki" ? account : wallet;
  const viaAccount = from === "hideki" && !!setup?.linked;
  const { origin, destination, mailbox, originMailbox } = routeOf(asset, from);
  const decimals = origin?.decimals ?? 18;
  const native = origin?.model === "native";

  const held = useQuery({
    queryKey: ["bump", "bridge", "balance", asset, from, sender],
    enabled: !!sender && !!origin,
    refetchInterval: 10_000,
    queryFn: async () => {
      const client = bridgeClient(from);
      const raw = native ? await client.getBalance({ address: sender as Address }) : await client.readContract({ address: origin?.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [sender as Address] });
      return raw.toString();
    },
  });
  const rawBalance = BigInt(held.data ?? "0");
  const balance = formatUnits(rawBalance, decimals);

  // the wallet signs and pays gas on the origin network; Somnia's mempool wants gas × max fee (0.6 STT) on hand
  const gasHeld = useQuery({
    queryKey: ["bump", "bridge", "gas", from, wallet],
    enabled: !!wallet,
    refetchInterval: 10_000,
    queryFn: async () => (await bridgeClient(from).getBalance({ address: wallet as Address })).toString(),
  });
  const reserve = parseUnits(String(GAS_ENVELOPE_STT), 18);
  // sending STT from the wallet itself: its gas envelope comes out of the same balance
  const spendable = native && sender === wallet ? (rawBalance > reserve ? rawBalance - reserve : 0n) : rawBalance;
  const spendableText = formatUnits(spendable, decimals);

  // the bridge in flight, kept in localStorage once it is sent so a reload keeps watching for the delivery
  const storeKey = `bump:bridge:${wallet}`;
  const [run, setRun] = useState<BridgeRun | null>(null);
  const update = (patch: Partial<BridgeRun> | null) => {
    setRun((current) => {
      const next = patch === null || !current ? null : { ...current, ...patch };
      try {
        if (next && (next.stage === "deliver" || next.stage === "done")) localStorage.setItem(storeKey, JSON.stringify(next));
        else localStorage.removeItem(storeKey);
      } catch {
        // storage unavailable: a reload just forgets the progress card, the funds are unaffected
      }
      return next;
    });
  };
  useEffect(() => {
    if (!wallet) return;
    try {
      const saved = localStorage.getItem(storeKey);
      if (!saved) return;
      const stored = JSON.parse(saved) as Partial<BridgeRun>;
      // a bridge saved before routes had two directions can't be tracked by message id: forget it
      if (!stored.from || !stored.asset) {
        localStorage.removeItem(storeKey);
        return;
      }
      setRun(stored as BridgeRun);
      // a saved bridge is only believed once its transaction is confirmed as successful on its origin network
      if (stored.stage === "deliver" && stored.bridgeHash) {
        bridgeClient(stored.from)
          .getTransactionReceipt({ hash: stored.bridgeHash as Hex })
          .then((receipt) => {
            if (receipt.status !== "success") update({ stage: "failed", failedAt: "send", error: `Bridging: the transaction reverted on ${stored.fromName}, nothing moved.` });
          })
          .catch(() => undefined);
      }
    } catch {
      // see above
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, storeKey]);

  const delivering = run?.stage === "deliver";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!delivering) return;
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [delivering]);

  // delivery: the destination Mailbox reports the message as processed
  const runTo = run ? otherSide(run.from) : to;
  const runMailbox = run ? routeOf(run.asset as BridgeAsset, run.from).mailbox : null;
  const arrived = useQuery({
    queryKey: ["bump", "bridge", "delivered", run?.messageId],
    enabled: delivering && !!run?.messageId && !!runMailbox,
    refetchInterval: 3_000,
    queryFn: () => isDelivered(runTo, runMailbox as Address, run?.messageId as Hex),
  });
  useEffect(() => {
    if (!run || run.stage !== "deliver" || arrived.data !== true) return;
    update({ stage: "done" });
    void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
    void held.refetch();
    flash(`Your ${run.asset} arrived on ${run.toName}.`, "good");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrived.data, run]);

  const bridge = useMutation({
    mutationFn: async (amount: string) => {
      if (!setup || !wallet || !account || !recipient || !origin || !destination || !originMailbox) throw new Error("Your wallet isn't ready yet.");
      const raw = parseUnits(amount, decimals);
      if (raw <= 0n) throw new Error("Enter an amount to bridge.");
      if (raw > rawBalance) throw new Error(`${from === "hideki" && viaAccount ? "Your dreamDEX account holds" : "Your wallet holds"} ${amountOf(balance)} ${asset} on ${SIDES[from].name}.`);
      if (raw > spendable) throw new Error(`Keep ${GAS_ENVELOPE_STT} STT in your wallet for gas. You can bridge up to ${amountOf(spendableText)} ${asset}.`);
      const gas = BigInt(gasHeld.data ?? "0");
      if (gas < reserve + (native && sender === wallet ? raw : 0n)) throw new Error(`Your wallet needs at least ${GAS_ENVELOPE_STT} STT on ${SIDES[from].name} to send this. Top it up and try again.`);
      const privy = wallets.find((w) => w.address.toLowerCase() === wallet.toLowerCase());
      if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");

      const plan = createBridgeTransfer({ token: ASSETS[asset].token, from: SIDES[from].chainId, to: SIDES[to].chainId, amount: raw, recipient });
      // an STT transfer is paid out of the destination router's own balance: when it is short, the transfer would stall
      if (plan.destination.requiresDestinationLiquidity) {
        const liquidity = await bridgeClient(to).getBalance({ address: plan.destination.router });
        if (liquidity < raw) throw new Error(`The bridge is short on STT on ${SIDES[to].name} right now, so this would stall. Nothing was sent; try a smaller amount later.`);
      }
      // a router whose hook isn't a real Hyperlane hook reverts every transfer after pulling the tokens: the gas is spent for
      // nothing. Both checks below are free reads, and run before anything is signed.
      if (!(await hookAnswers(from, origin.router))) {
        throw new Error(`The ${asset} bridge from ${SIDES[from].short} is misconfigured on Somnia's side right now: its dispatch hook isn't a valid Hyperlane hook, so every transfer reverts. Nothing was sent and your ${asset} is safe.`);
      }
      if (!plan.approveStep && !(await stepWouldSucceed(from, sender as Address, plan.bridgeStep, BRIDGE_GAS))) {
        throw new Error(`The chain would reject this transfer. Nothing was sent and your ${asset} is safe.`);
      }
      setRun({ stage: "switch", amount, asset, from, fromName: SIDES[from].name, toName: SIDES[to].name, recipient, needsApproval: !!plan.approveStep, startedAt: Date.now() });

      // each phase names itself in the error, so a node or wallet failure says where it happened
      const phase = async <T,>(stage: "switch" | "approve" | "send", name: string, work: () => Promise<T>): Promise<T> => {
        update({ stage });
        try {
          return await work();
        } catch (error) {
          // shortError turns anything it doesn't know into a generic retry line; for a bridge the node's own words matter
          const known = shortError(error);
          const detail = error as { shortMessage?: string; message?: string };
          const message = `${name}: ${known === "Cancelled" ? known : (detail.shortMessage ?? detail.message ?? known).slice(0, 140)}`;
          update({ stage: "failed", failedAt: stage, error: message });
          throw new Error(message);
        }
      };
      const provider = await phase("switch", "Switching network", () => switchTo(privy, SIDES[from].chainId, SIDES[from].name));
      const walletClient = createWalletClient({ account: wallet, chain: SIDES[from].chain, transport: custom(provider) });
      const finish = (hash: Hex, receipt: TransactionReceipt) => {
        if (receipt.status !== "success") throw new Error(`the transaction reverted on ${SIDES[from].name}, nothing moved`);
        // no id means the receipt held no single Dispatch from this router; the card then just waits, and can be dismissed
        update({ stage: "deliver", bridgeHash: hash, messageId: messageIdOf(receipt, originMailbox, origin.router) ?? undefined });
      };

      if (viaAccount) {
        // the USDso/STT sits in the dreamDEX smart account: it sends the transfer, the wallet only signs and pays gas
        const { client } = exchange();
        const act = client.createExecutor({ smartAccount: account, inner: client.createExecutor({ walletClient }) });
        const steps = [plan.approveStep, plan.bridgeStep].filter((s): s is NonNullable<typeof s> => !!s);
        await phase("send", "Checking", async () => {
          if (!(await stepWouldSucceed(from, account, plan.bridgeStep, BRIDGE_GAS))) throw new Error("the chain would reject this transfer, so nothing was sent");
        });
        const done = await phase("send", "Bridging", () => act.execute(steps));
        finish(done.hash, done.receipt);
        return;
      }

      // the approval has to land before the bridge call, or the transfer reverts
      for (const [stage, name, step] of [["approve", "Approving", plan.approveStep], ["send", "Bridging", plan.bridgeStep]] as const) {
        if (!step) continue;
        // once the approval has landed, dry-run the bridge call itself: a revert costs gas, a dry run costs nothing
        if (stage === "send") {
          await phase("send", "Checking", async () => {
            if (!(await stepWouldSucceed(from, wallet, step, BRIDGE_GAS))) throw new Error("the chain would reject this transfer, so nothing was sent");
          });
        }
        // gas and fees are fixed, like the SDK's own writes, so the wallet has nothing to estimate
        const hash = await phase(stage, name, () => walletClient.sendTransaction({ to: step.to, data: step.data, value: step.value, gas: BRIDGE_GAS, ...DEFAULT_FEES }));
        const receipt = await phase(stage, `${name} (confirming)`, () => bridgeClient(from).waitForTransactionReceipt({ hash }));
        // a reverted transaction still comes back as a receipt; only "success" means the step happened
        if (stage === "send") finish(hash, receipt);
        else if (receipt.status !== "success") {
          const message = `${name} (confirming): the transaction reverted on ${SIDES[from].name}, nothing moved`;
          update({ stage: "failed", failedAt: stage, error: message });
          throw new Error(message);
        }
      }
    },
    onSuccess: () => {
      setValue("");
      void held.refetch();
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });

  if (mode !== "chain" || !setup) {
    return (
      <Screen title="Bridge">
        <Card className="px-3 py-3 text-[14px]">Bridging is for real dreamDEX trading. Sign in to use it.</Card>
      </Screen>
    );
  }

  const entered = Number(value) || 0;
  const tooMuch = entered > Number(spendableText);
  const runFrom = run ? SIDES[run.from] : null;
  const explorer = runFrom?.chain.blockExplorers?.default.url;
  const busy = bridge.isPending || run?.stage === "deliver";
  const label = bridge.isPending ? "Bridging…" : entered <= 0 ? "Enter an amount" : tooMuch ? `Not enough ${asset}` : "Bridge";
  const pick = (next: BridgeAsset) => {
    if (busy) return;
    setAsset(next);
    setValue("");
  };
  const flip = () => {
    if (busy) return;
    setFrom(to);
    setValue("");
  };

  return (
    <Screen title="Bridge">
      <div className="flex gap-2" role="tablist" aria-label="Bridge or swap">
        {(["bridge", "swap"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[14px] font-semibold capitalize ${tab === t ? "bg-white/20" : "bg-white/5 text-white/60"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "swap" && <SwapPanel />}
      {tab === "bridge" && run && <BridgeProgress run={run} now={now} explorerTx={run.bridgeHash && explorer ? `${explorer}/tx/${run.bridgeHash}` : undefined} onDismiss={() => update(null)} />}
      {tab === "bridge" && (
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          bridge.mutate(value.trim());
        }}
      >
        <div className="flex gap-2" role="group" aria-label="Token to bridge">
          {(["USDso", "STT"] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={asset === a}
              disabled={busy}
              onClick={() => pick(a)}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${asset === a ? "bg-white/20" : "bg-white/5 text-white/60"}`}
            >
              {a}
            </button>
          ))}
        </div>

        <Side
          label="From"
          side={from}
          trailing={
            <div className="flex items-center justify-between text-[12px] text-white/70">
              <span>
                {viaAccount ? "dreamDEX account" : "Balance"} {held.isPending ? "…" : amountOf(balance)}
              </span>
              <button type="button" className="font-semibold text-cyan" onClick={() => setValue(spendableText)}>
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
            aria-label={`Amount of ${asset} to bridge`}
            className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
          />
          <TokenPill asset={asset} />
        </Side>

        <div className="-my-3.5 z-10 flex justify-center">
          <button
            type="button"
            onClick={flip}
            disabled={busy}
            aria-label="Switch direction"
            className="grid size-8 place-items-center rounded-full border-2 border-navy-950 bg-linear-to-b from-[#48bfff] to-[#128af6] text-white disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </button>
        </div>

        <Side
          label="To"
          side={to}
          trailing={<span className="text-[12px] text-white/70">{to === "hideki" ? (setup.linked ? "Your dreamDEX account" : "Your wallet") : "Your wallet"} {short(recipient ?? setup.account)}</span>}
        >
          <span className={`min-w-0 flex-1 truncate font-display text-[28px] font-bold tabular-nums ${entered > 0 ? "" : "text-white/30"}`}>{entered > 0 ? amountOf(value, 6) : "0.0"}</span>
          <TokenPill asset={asset} />
        </Side>

        <Card className="flex flex-col gap-1 px-3 py-2 text-[12px] text-white/80">
          <p className="flex justify-between"><span>Rate</span><span>1 {asset} = 1 {asset}</span></p>
          <p className="flex justify-between"><span>Bridge fee</span><span>Free</span></p>
          <p className="flex justify-between"><span>Arrives in</span><span>a few seconds</span></p>
          <p className="flex justify-between"><span>Network gas</span><span>STT on {SIDES[from].name}</span></p>
        </Card>

        <Button type="submit" disabled={busy || entered <= 0 || tooMuch}>
          {label}
        </Button>
        <p className="text-center text-[11px] leading-snug text-white/50">A test bridge with one validator. Testnet funds only.</p>
      </form>
      )}
    </Screen>
  );
}
