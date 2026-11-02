"use client";

import { cn } from "@/lib/cn";

type Option<T extends string | number> = { value: T; label: string };

type SegmentedProps<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /**
   * buttons: separate outlined buttons (amount presets, close amount, periods).
   * group: one outlined track with dividers (leverage).
   */
  tone?: "buttons" | "group";
  size?: "md" | "lg";
  className?: string;
};

const activeCandy =
  "gloss bg-linear-to-b from-[#48bfff] to-[#128af6] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(0,60,160,0.35),0_0_0_1.5px_#7fd3ff,0_0_14px_rgba(60,180,255,0.45)]";

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tone = "buttons",
  size = "md",
  className,
}: SegmentedProps<T>) {
  const height = size === "lg" ? "h-11 text-lg" : "h-9 text-[15px]";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid auto-cols-fr grid-flow-col",
        tone === "buttons" ? "gap-1.5" : "recess gap-0 rounded-[12px] p-0.5",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const prevActive = options[i - 1]?.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative font-display font-semibold transition",
              height,
              tone === "buttons" && "rounded-[12px]",
              tone === "buttons" && !active && "glass text-white",
              tone === "group" && "rounded-[11px] text-white",
              tone === "group" && !active && i > 0 && !prevActive && "before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-white/20",
              active && activeCandy,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
