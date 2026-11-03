"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clouds } from "@/components/ui/decor";
import { InfoDot } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { useMarket } from "@/modules/market/price-provider";
import { useTrade } from "../trade-provider";

const PRACTICE_STEPS = [
  { title: "Request sent", hint: "We’ve sent your order." },
  { title: "Order accepted", hint: "Your order is in the market." },
  { title: "Waiting to fill", hint: "Your trade will open soon." },
] as const;

/** The real lifecycle of a dreamDEX order, driven by what the wallet, the exchange and bump-backend actually did. */
const CHAIN_STEPS = [
  { title: "Signing & filling", hint: "Your wallet signs, dreamDEX fills it." },
  { title: "Checking the fill", hint: "bump confirms it on chain." },
  { title: "Setting target & stop", hint: "Your TP and SL go live." },
] as const;

const CHAIN_DONE = { fill: 0, log: 1, stops: 2, done: 3 } as const;

/** Mock order lifecycle: each step resolves on a timer, the last one opens the position. Short: waiting isn't fun. */
const STEP_DELAYS_MS = [350, 800, 1400];
/** How long "Your trade is live!" stays up before the position screen takes over. */
const LIVE_HOLD_MS = 700;

function StepMark({ state }: { state: "done" | "active" | "todo" }) {
  if (state === "done") {
    return (
      <span className="gloss grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-b from-[#62f6be] to-[#17a571] text-white shadow-[0_2px_4px_rgba(0,0,0,0.35)]">
        <Icon name="check" size={20} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "size-8 shrink-0 rounded-full border-4 border-[#1d4f86]",
        state === "active" && "animate-spin border-t-cyan border-r-cyan",
      )}
    />
  );
}

export function OrderProgressScreen() {
  const router = useRouter();
  const { draft, position, openPosition, blocker, ready, mode, pending, dismissPending } = useTrade();
  const market = useMarket(draft.marketId);
  const chain = mode === "chain";
  const STEPS = chain ? CHAIN_STEPS : PRACTICE_STEPS;
  const [fakeDone, setFakeDone] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const opened = useRef(false);
  const mine = pending?.kind === "open" ? pending : null;
  const done = chain ? (mine ? CHAIN_DONE[mine.step] : 0) : fakeDone;
  const rejected = mine?.error ?? blocked;
  const warning = mine?.warning ?? null;
  const filled = done >= STEPS.length && !!position && !rejected;
  usePrimaryAction(
    rejected ? { label: "Fix my trade", href: "/trade/build" } : { label: "View trade", href: "/position", disabled: !filled },
  );

  // practice play: the steps resolve on a timer
  useEffect(() => {
    if (chain) return;
    const timers = STEP_DELAYS_MS.map((ms, i) => setTimeout(() => setFakeDone(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [chain]);

  // practice waits for its timer; on chain the order goes out at once and the steps follow the real progress
  useEffect(() => {
    if (!ready || opened.current || (!chain && fakeDone < STEPS.length)) return;
    opened.current = true;
    dismissPending();
    void openPosition(market.price).then((ok) => {
      if (!ok) setBlocked(blocker ?? null);
    });
  }, [ready, chain, fakeDone, STEPS.length, openPosition, market.price, blocker, dismissPending]);

  // filled: go straight to the live position (replace, so Back doesn't land on this screen again); a TP/SL warning stays up to be read
  useEffect(() => {
    if (!filled || warning) return;
    const id = setTimeout(() => router.replace("/position"), LIVE_HOLD_MS);
    return () => clearTimeout(id);
  }, [filled, warning, router]);

  return (
    <Screen title="Order progress">
      <div className="relative -mx-3 -mt-3 flex flex-col items-center overflow-hidden px-3 pt-2">
        {/* night hill + clouds behind the mascot */}
        <div className="absolute inset-x-0 top-[40%] h-20 rounded-t-[50%] bg-linear-to-b from-[#123056] to-transparent" />
        <Clouds className="absolute inset-x-0 top-[30%] h-10 opacity-80" />
        <Mascot size={118} sparkles="both" className="relative" />
        <h2 className="text-pop relative mt-1 text-center font-display text-[27px] leading-[1.05] font-bold">
          {rejected ? "Order not placed" : filled ? "Your trade is live!" : "Getting your trade ready."}
        </h2>
      </div>

      {rejected ? (
        <Card className="flex flex-col gap-2 px-3 py-3 text-center">
          <p className="font-display text-[16px] font-semibold text-coral">{rejected ?? "The order couldn’t be placed."}</p>
          <Button href="/trade/build">Fix my trade</Button>
        </Card>
      ) : (
      <Card className="px-3 py-0.5">
        <ol aria-live="polite">
          {STEPS.map((step, i) => {
            const state = i < done ? "done" : i === done ? "active" : "todo";
            return (
              <li key={step.title} className="relative flex items-center gap-3 py-1.5">
                {i < STEPS.length - 1 && (
                  <span className="absolute top-[calc(50%+16px)] left-[15px] h-[calc(100%-32px)] w-0.5 bg-white/40" aria-hidden />
                )}
                <StepMark state={state} />
                <div>
                  <p className="font-display text-[16px] leading-tight font-semibold">{step.title}</p>
                  <p className="text-[12px] text-white/80">{step.hint}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
      )}

      {warning && (
        <p role="alert" className="glass rounded-[14px] px-3 py-2 text-[13px] leading-snug font-semibold text-gold">
          {warning}
        </p>
      )}
      {chain && mine?.txHash && (
        <p className="px-1 text-center text-[12px] text-white/70 tabular-nums">
          tx {mine.txHash.slice(0, 10)}…{mine.txHash.slice(-6)}
        </p>
      )}

      <p className="flex items-center gap-2.5 px-1 text-[13px] leading-snug text-white">
        <InfoDot size={22} />
        Your trade opens when the order fills. It closes itself at your target or stop.
      </p>
    </Screen>
  );
}
