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

const STEPS = [
  { title: "Request sent", hint: "We’ve sent your order." },
  { title: "Order accepted", hint: "Your order is in the market." },
  { title: "Waiting to fill", hint: "Your trade will open soon." },
] as const;

/** Mock order lifecycle: each step resolves on a timer, the last one opens the position. */
const STEP_DELAYS_MS = [700, 1500, 3200];
/** How long "Your trade is live!" stays up before the position screen takes over. */
const LIVE_HOLD_MS = 900;

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
  const { draft, position, openPosition, ready } = useTrade();
  const market = useMarket(draft.marketId);
  const [done, setDone] = useState(0);
  const opened = useRef(false);
  const filled = done >= STEPS.length && !!position;
  usePrimaryAction({ label: "View order", href: "/position", disabled: !filled });

  useEffect(() => {
    const timers = STEP_DELAYS_MS.map((ms, i) => setTimeout(() => setDone(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (done >= STEPS.length && ready && !opened.current) {
      opened.current = true;
      openPosition(market.price);
    }
  }, [done, ready, openPosition, market.price]);

  // filled: go straight to the live position (replace, so Back doesn't land on this screen again)
  useEffect(() => {
    if (!filled) return;
    const id = setTimeout(() => router.replace("/position"), LIVE_HOLD_MS);
    return () => clearTimeout(id);
  }, [filled, router]);

  return (
    <Screen title="Order progress">
      <div className="relative -mx-3 -mt-3 flex flex-col items-center overflow-hidden px-3 pt-2">
        {/* night hill + clouds behind the mascot */}
        <div className="absolute inset-x-0 top-[40%] h-20 rounded-t-[50%] bg-linear-to-b from-[#123056] to-transparent" />
        <Clouds className="absolute inset-x-0 top-[30%] h-10 opacity-80" />
        <Mascot size={118} sparkles="both" className="relative" />
        <h2 className="text-pop relative mt-1 text-center font-display text-[27px] leading-[1.05] font-bold">
          {filled ? "Your trade is live!" : "Getting your trade ready."}
        </h2>
      </div>

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

      <p className="flex items-center gap-2.5 px-1 text-[13px] leading-snug text-white">
        <InfoDot size={22} />
        Your position opens only when the order fills.
      </p>

      <Button variant="light" size="sm" className="mt-auto" leading={<Icon name="help" size={20} />}>
        Need help?
      </Button>
    </Screen>
  );
}
