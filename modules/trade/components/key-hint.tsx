import { cn } from "@/lib/cn";
import type { Side } from "../types";

function KeyCap({ side }: { side: Side }) {
  return (
    <span
      className={cn(
        "rounded-[6px] bg-navy-900 px-1.5 py-px font-display font-bold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_#05080c]",
        side === "long" ? "text-[#5dffc0]" : "text-[#ff8a9b]",
      )}
    >
      {side === "long" ? "BUY" : "SELL"}
    </span>
  );
}

/** Tells the player which hardware key moves them on, in place of an on-screen button. */
export function KeyHint({ side, next }: { side: Side; next: "review" | "place" }) {
  return (
    <p className="mt-auto text-center text-[13px] leading-relaxed text-white/80">
      Hit <KeyCap side={side} /> again {next === "review" ? "to review" : "to place it"}. Changed your mind? Hit{" "}
      <KeyCap side={side === "long" ? "short" : "long"} />.
    </p>
  );
}
