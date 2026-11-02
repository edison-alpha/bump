import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SpeechBubbleProps = {
  children: ReactNode;
  /** Where the tail points: towards the mascot on the left, or down-left. */
  tail?: "left" | "bottom-left";
  className?: string;
};

export function SpeechBubble({ children, tail = "left", className }: SpeechBubbleProps) {
  return (
    <div
      className={cn(
        "relative rounded-[18px] bg-linear-to-b from-white to-[#f1ede4] px-3.5 py-2 font-display text-[15px] leading-tight font-semibold text-navy-900",
        "shadow-[inset_0_-2px_0_rgba(120,100,60,0.15),0_4px_10px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className={cn(
          "absolute size-5 fill-[#f6f3ec]",
          tail === "left" && "top-1/2 -left-3 -translate-y-1/2",
          tail === "bottom-left" && "-bottom-3 left-5 rotate-[-90deg]",
        )}
      >
        <path d="M20 4 2 10l18 6Z" />
      </svg>
      <span className="relative">{children}</span>
    </div>
  );
}
