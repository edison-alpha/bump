"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import type { Readout } from "@/components/console/console-provider";
import { usdPriceShort } from "@/lib/format";
import { STOP_PRESETS, TARGET_PRESETS } from "../calc";

type LimitRowProps = {
  kind: "target" | "stop";
  /** Percent of position size, always positive. */
  value: number;
  onChange: (value: number) => void;
};

const COPY = {
  target: { label: "Profit target", sign: "+", color: "text-mint-deep", icon: "target", presets: TARGET_PRESETS },
  stop: { label: "Stop loss", sign: "-", color: "text-coral-deep", icon: "minus", presets: STOP_PRESETS },
} as const;

/** Cream candy row that expands into preset chips; used for profit target and stop loss. */
export function LimitRow({ kind, value, onChange }: LimitRowProps) {
  const [open, setOpen] = useState(false);
  const { label, sign, color, icon, presets } = COPY[kind];

  return (
    <div className="rounded-[14px] bg-linear-to-b from-white to-[#f1e9da] text-navy-900 shadow-[inset_0_-3px_0_rgba(120,100,60,0.2),0_3px_8px_rgba(0,0,0,0.3)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2.5 px-3"
      >
        <Icon name={icon} size={26} className={color} />
        <span className="flex-1 text-left font-display text-[16px] font-semibold">{label}</span>
        <span className={cn("font-display text-[16px] font-bold tabular-nums", color)}>
          {sign}
          {value.toFixed(1)}%
        </span>
        <Icon name="chevron" size={24} className={cn("transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="rounded-b-[14px] bg-navy-900 p-1.5">
          <Segmented
            label={label}
            options={presets.map((p) => ({ value: p, label: `${p}%` }))}
            value={value}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

/** Mini LCD readouts: the percent being dialled and the price it triggers at. */
export const targetReadout = (pct: number, price: number): Readout => ({
  tag: "TP",
  value: `+${pct.toFixed(1)}%`,
  sub: usdPriceShort(price),
  tone: "positive",
});

export const stopReadout = (pct: number, price: number): Readout => ({
  tag: "SL",
  value: `-${pct.toFixed(1)}%`,
  sub: usdPriceShort(price),
  tone: "negative",
});
