"use client";

import { cn } from "@/lib/cn";

type ToggleProps = { checked: boolean; onChange: (checked: boolean) => void; label: string };

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-[50px] shrink-0 rounded-full transition-colors",
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
        checked ? "bg-linear-to-b from-[#2cd396] to-[#17a571]" : "bg-[#3a4a60]",
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-5 rounded-full bg-linear-to-b from-white to-[#e4e9f0] shadow-[0_2px_3px_rgba(0,0,0,0.35)] transition-transform",
          checked && "translate-x-[22px]",
        )}
      />
    </button>
  );
}
