import { cn } from "@/lib/cn";
import type { Side } from "../types";

/** Tells the player which hardware key moves them on, in place of an on-screen button. */
export function KeyHint({ side, next }: { side: Side; next: "review" | "place" }) {
  const key = side === "long" ? "BUY" : "SELL";
  return (
    <p className="mt-auto text-center text-[13px] text-white/80">
      Press{" "}
      <span
        className={cn(
          "rounded-[6px] bg-navy-900 px-1.5 py-px font-display font-bold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_0_#05080c]",
          side === "long" ? "text-[#5dffc0]" : "text-[#ff8a9b]",
        )}
      >
        {key}
      </span>{" "}
      again {next === "review" ? "to review" : "to place the trade"}, or the other key to switch.
    </p>
  );
}
