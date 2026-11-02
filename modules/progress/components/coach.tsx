"use client";

import type { ReactNode } from "react";
import { useCoachKey, type CoachKey } from "@/components/console/console-provider";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { useProgress } from "../progress-provider";

type CoachProps = {
  /** Step counter shown in the tag, e.g. 2 of 4. */
  step: number;
  /** The hardware key this step is about; it pulses on the deck. */
  points?: CoachKey | null;
  children: ReactNode;
  className?: string;
};

/** Pick a side, place it, watch it; the Closed screen then celebrates the finish. */
export const TUTORIAL_STEPS = 3;

/**
 * Tutorial bubble for the guided first trade. Renders nothing once the tutorial is done or skipped,
 * so screens can always include it.
 */
export function Coach({ step, points = null, children, className }: CoachProps) {
  const { tutorialActive, skipTutorial } = useProgress();
  useCoachKey(tutorialActive ? points : null);
  if (!tutorialActive) return null;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-[16px] border-2 border-cyan/70 bg-linear-to-b from-[#123a66] to-[#0c2547] py-1.5 pr-2.5 pl-1 shadow-[0_0_16px_rgba(76,201,255,0.35)]",
        className,
      )}
    >
      <Mascot size={58} bob={false} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[11px] font-bold tracking-[0.12em] text-cyan uppercase">
          First trade · {step}/{TUTORIAL_STEPS}
        </p>
        <p className="font-display text-[15px] leading-snug font-semibold">{children}</p>
      </div>
      <button type="button" onClick={skipTutorial} className="self-start px-1 text-[12px] font-semibold text-white/70 underline">
        Skip
      </button>
    </div>
  );
}

/** A key name styled like the printed legend on the deck. */
export function KeyName({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "buy" | "sell" | "gold" }) {
  return (
    <span
      className={cn(
        "rounded-[6px] px-1.5 py-px font-display font-bold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_#05080c]",
        tone === "gold" ? "bg-gold text-navy-900" : "bg-navy-900",
        tone === "buy" && "text-[#5dffc0]",
        tone === "sell" && "text-[#ff8a9b]",
      )}
    >
      {children}
    </span>
  );
}
