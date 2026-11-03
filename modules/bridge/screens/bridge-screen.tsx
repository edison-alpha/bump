"use client";

import { useWallets } from "@privy-io/react-auth";
import { DEFAULT_FEES } from "@somnia-chain/markets-sdk";
import { BridgeToken, ChainId, createBridgeTransfer, getBridgeToken, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, numberToHex, parseAbi, parseUnits, type Address, type Hex } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortError } from "@/lib/bump/dreamdex";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets } from "@/lib/chain/markets";
import { BridgeProgress, type BridgeRun } from "../components/bridge-progress";
import { useTrade } from "@/modules/trade/trade-provider";

/** The SDK's fixed gas ceiling; the wallet needs gas × max fee (0.6 STT) on hand, though unused gas is never charged. */
const BRIDGE_GAS = 10_000_000n;
const origin = getBridgeToken(BridgeToken.USDso, ChainId.somniaShannon);
const originClient = createPublicClient({ chain: somniaShannon, transport: http() });

/** Logos are the projects' own marks, stored in public/tokens (sources in SOURCES.md). */
const SOMNIA = { name: "Somnia Testnet", logo: "/tokens/somnia.png", plate: "bg-white" };
const HIDEKI = { name: "Hideki Testnet", logo: "/tokens/dreamdex.png", plate: "bg-navy-950" };
const USDSO_LOGO = "/tokens/usdso.png";

const routerAbi = parseAbi(["function quoteGasPayment(uint32 destinationDomain) view returns (uint256)"]);
const ROUTE_DOWN = "The USDso bridge route is down on Somnia's side right now (its gas hook reverts). Nothing was sent, and your USDso is safe.";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const amountOf = (value: string, max = 4) => Number(value).toLocaleString("en-US", { maximumFractionDigits: max });

function Logo({ src, size, plate }: { src: string; size: number; plate?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 overflow-hidden rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.4)] ${plate ?? ""}`} style={{ width: size, height: size }}>
      <img src={src} alt="" width={size} height={size} className="size-full object-contain" />
    </span>
  );
}

function NetworkPill({ network }: { network: typeof SOMNIA }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 text-[13px] font-semibold">
      <Logo src={network.logo} size={20} plate={network.plate} />
      {network.name}
    </span>
  );
}

function TokenPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 py-1 pr-3 pl-1 font-display text-[16px] font-bold">
      <Logo src={USDSO_LOGO} size={26} />
      USDso
    </span>
  );
}

function Side({ label, network, trailing, children }: { label: string; network: typeof SOMNIA; trailing?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white/70">{label}</span>
        <NetworkPill network={network} />
      </div>
      <div className="flex items-center gap-2">{children}</div>
      {trailing}
    </Card>
  );
}

/**
 * Bridge USDso from the general-purpose Somnia Testnet to Hideki, where bump trades, shaped like a swap: you pay on one
 * side, you receive on the other. This is the SDK's Hyperlane bridge; dreamDEX's "withdraw to Somnia" lands on the
 * Somnia side, so this is how that money comes back. The USDso goes straight to the account that trades.
 */
export function BridgeScreen() {
  const { setup, mode } = useTrade();
  const { wallets } = useWallets();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");

  const wallet = setup?.address as Address | undefined;

  const held = useQuery({
    queryKey: ["bump", "bridge", "somnia-usdso", wallet],
    enabled: !!wallet && !!origin?.address,
    refetchInterval: 10_000,
    queryFn: async () => {
      const raw = await originClient.readContract({ address: origin?.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [wallet as Address] });
      return formatUnits(raw, origin?.decimals ?? 18);
    },
  });
  const balance = held.data ?? "0";

  // The USDso router's gas hook decides whether transferRemote can run at all. When it reverts, so does every bridge
  // (the STT router has no hook and quotes 0), and the approval would be gas spent for nothing. Asking it is free.
  const route = useQuery({
    queryKey: ["bump", "bridge", "route", origin?.router],
    enabled: !!origin,
    refetchInterval: 60_000,
    queryFn: async () => {
      try {
        await originClient.readContract({ address: origin?.router as Address, abi: routerAbi, functionName: "quoteGasPayment", args: [ChainId.hidekiTestnet] });
        return true;
      } catch {
        return false;
      }
    },
  });
  const routeDown = route.data === false;

  // the bridge in flight, kept in localStorage once it is sent so a reload keeps watching for the delivery
  const storeKey = `bump:bridge:${wallet}`;
  const [run, setRun] = useState<BridgeRun | null>(null);
  useEffect(() => {
    if (!wallet) return;
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) {
        const stored = JSON.parse(saved) as BridgeRun;
        setRun(stored);
        // a saved bridge is only believed once its transaction is confirmed as successful on Somnia Testnet; earlier
        // versions saved reverted ones as "sent", and those must not keep showing a delivery that can never come
        if (stored.stage === "deliver" && stored.bridgeHash) {
          originClient
            .getTransactionReceipt({ hash: stored.bridgeHash as Hex })
            .then((receipt) => {
              if (receipt.status !== "success") update({ stage: "failed", failedAt: "send", error: "Bridging: the transaction reverted on Somnia Testnet, no USDso moved." });
            })
            .catch(() => undefined);
        }
      }
    } catch {
      // storage unavailable: a reload just forgets the progress card, the funds are unaffected
    }
  }, [wallet, storeKey]);
  const update = (patch: Partial<BridgeRun> | null) => {
    setRun((current) => {
      const next = patch === null || !current ? null : { ...current, ...patch };
      try {
        if (next && (next.stage === "deliver" || next.stage === "done")) localStorage.setItem(storeKey, JSON.stringify(next));
        else localStorage.removeItem(storeKey);
      } catch {
        // see above
      }
      return next;
    });
  };

  const { data: markets } = useChainMarkets();
  const hidekiToken = (markets ? Object.values(markets)[0]?.quoteToken : undefined) as Address | undefined;
  const delivering = run?.stage === "deliver";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!delivering) return;
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [delivering]);

  // delivery: the relayer mints USDso to the recipient on Hideki, so its balance there rises by the amount
  const arrived = useQuery({
    queryKey: ["bump", "bridge", "hideki-usdso", run?.recipient, hidekiToken],
    enabled: delivering && !!hidekiToken && !!run,
    refetchInterval: 3_000,
    queryFn: async () => {
      const [raw] = await exchange().client.getBalances([{ token: hidekiToken as Address }], run?.recipient as Address);
      return (raw ?? 0n).toString();
    },
  });
  useEffect(() => {
    if (!run || run.stage !== "deliver" || arrived.data === undefined || !origin) return;
    if (BigInt(arrived.data) < BigInt(run.before) + parseUnits(run.amount, origin.decimals)) return;
    update({ stage: "done" });
    void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
    flash("Your USDso arrived on Hideki.", "good");
  }, [arrived.data, run]);

  const bridge = useMutation({
    mutationFn: async (amount: string) => {
      if (!setup || !wallet || !origin || !hidekiToken) throw new Error("Your wallet isn't ready yet.");
      if (routeDown) throw new Error(ROUTE_DOWN);
      const raw = parseUnits(amount, origin.decimals);
      if (raw <= 0n) throw new Error("Enter an amount to bridge.");
      if (raw > parseUnits(balance, origin.decimals)) throw new Error(`Your wallet holds ${amountOf(balance)} USDso on Somnia Testnet.`);
      const privy = wallets.find((w) => w.address.toLowerCase() === wallet.toLowerCase());
      if (!privy) throw new Error("Your wallet isn't ready yet. Try again in a moment.");
      const recipient = setup.account as Address;
      const plan = createBridgeTransfer({ token: BridgeToken.USDso, from: ChainId.somniaShannon, to: ChainId.hidekiTestnet, amount: raw, recipient });
      const [before] = await exchange().client.getBalances([{ token: hidekiToken }], recipient);
      setRun({ stage: "switch", amount, recipient, before: (before ?? 0n).toString(), needsApproval: !!plan.approveStep, startedAt: Date.now() });

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
      // switchChain can resolve while the provider still reports the old chain, and the transaction is then refused.
      // Ask the provider itself too, and wait until it really answers with Somnia Testnet before anything is signed.
      const provider = await privy.getEthereumProvider();
      await phase("switch", "Switching network", async () => {
        const chainIdOf = async () => Number(await provider.request({ method: "eth_chainId" }));
        await privy.switchChain(ChainId.somniaShannon);
        if ((await chainIdOf()) !== ChainId.somniaShannon) {
          await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: numberToHex(ChainId.somniaShannon) }] });
        }
        for (let i = 0; i < 20 && (await chainIdOf()) !== ChainId.somniaShannon; i++) await new Promise((resolve) => setTimeout(resolve, 250));
        const now = await chainIdOf();
        if (now !== ChainId.somniaShannon) throw new Error(`Your wallet stayed on chain ${now}. Switch it to Somnia Testnet (${ChainId.somniaShannon}) and try again.`);
      });
      const walletClient = createWalletClient({ account: wallet, chain: somniaShannon, transport: custom(provider) });
      // the approval has to land before the bridge call, or the transfer reverts
      for (const [stage, name, step] of [["approve", "Approving", plan.approveStep], ["send", "Bridging", plan.bridgeStep]] as const) {
        if (!step) continue;
        // gas and fees are fixed, like the SDK's own writes, so the wallet has nothing to estimate
        const hash = await phase(stage, name, () => walletClient.sendTransaction({ to: step.to, data: step.data, value: step.value, gas: BRIDGE_GAS, ...DEFAULT_FEES }));
        await phase(stage, `${name} (confirming)`, async () => {
          // a reverted transaction still comes back as a receipt; only "success" means the step happened
          const receipt = await originClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") throw new Error("the transaction reverted on Somnia Testnet, no USDso moved");
        });
        if (stage === "send") update({ stage: "deliver", bridgeHash: hash });
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
  const tooMuch = entered > Number(balance);
  const explorer = somniaShannon.blockExplorers?.default.url;
  const busy = bridge.isPending || run?.stage === "deliver";
  const label = bridge.isPending ? "Bridging…" : entered <= 0 ? "Enter an amount" : tooMuch ? "Not enough USDso" : "Bridge";

  return (
    <Screen title="Bridge">
      {run && <BridgeProgress run={run} now={now} explorerTx={run.bridgeHash && explorer ? `${explorer}/tx/${run.bridgeHash}` : undefined} onDismiss={() => update(null)} />}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          bridge.mutate(value.trim());
        }}
      >
        <Side
          label="From"
          network={SOMNIA}
          trailing={
            <div className="flex items-center justify-between text-[12px] text-white/70">
              <span>Balance {held.isPending ? "…" : amountOf(balance)}</span>
              <button type="button" className="font-semibold text-cyan" onClick={() => setValue(balance)}>
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
            aria-label="Amount of USDso to bridge"
            className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
          />
          <TokenPill />
        </Side>

        <div className="-my-3.5 z-10 flex justify-center" aria-hidden>
          <span className="grid size-8 place-items-center rounded-full border-2 border-navy-950 bg-linear-to-b from-[#48bfff] to-[#128af6] text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </span>
        </div>

        <Side
          label="To"
          network={HIDEKI}
          trailing={<span className="text-[12px] text-white/70">{setup.linked ? "Your dreamDEX account" : "Your wallet"} {short(setup.account)}</span>}
        >
          <span className={`min-w-0 flex-1 truncate font-display text-[28px] font-bold tabular-nums ${entered > 0 ? "" : "text-white/30"}`}>{entered > 0 ? amountOf(value, 6) : "0.0"}</span>
          <TokenPill />
        </Side>

        <Card className="flex flex-col gap-1 px-3 py-2 text-[12px] text-white/80">
          <p className="flex justify-between"><span>Rate</span><span>1 USDso = 1 USDso</span></p>
          <p className="flex justify-between"><span>Bridge fee</span><span>Free</span></p>
          <p className="flex justify-between"><span>Arrives in</span><span>a few seconds</span></p>
          <p className="flex justify-between"><span>Network gas</span><span>STT on Somnia Testnet</span></p>
        </Card>

        {routeDown && <p className="rounded-xl bg-coral/15 px-3 py-2 text-[12px] leading-snug text-coral">{ROUTE_DOWN}</p>}
        <Button type="submit" disabled={busy || routeDown || entered <= 0 || tooMuch}>
          {label}
        </Button>
        <p className="text-center text-[11px] leading-snug text-white/50">A test bridge with one validator. Testnet funds only.</p>
      </form>
    </Screen>
  );
}
