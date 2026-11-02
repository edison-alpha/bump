import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "border border-line bg-navy-800 text-white",
  long: "bg-linear-to-b from-[#62f6be] to-[#2cd396] text-navy-950",
  short: "bg-linear-to-b from-[#ffa3ad] to-[#f7717f] text-navy-950",
  info: "bg-linear-to-b from-[#48bfff] to-[#1a9dff] text-white",
  live: "bg-navy-900 text-white",
} as const;

type ChipProps = HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones };

export function Chip({ tone = "neutral", className, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "gloss inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-0.5 font-display text-[15px] font-semibold",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
