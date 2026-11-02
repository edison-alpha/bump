import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatRowProps = {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "positive" | "negative";
  className?: string;
};

const toneClass = { default: "text-white", positive: "text-mint", negative: "text-coral" } as const;

export function StatRow({ label, value, tone = "default", className }: StatRowProps) {
  return (
    <div className={cn("flex min-h-9 items-center justify-between gap-3 py-1.5", className)}>
      <span className="flex items-center text-[15px] text-white">{label}</span>
      <span className={cn("font-display text-[17px] font-bold tabular-nums", toneClass[tone])}>{value}</span>
    </div>
  );
}
