"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tones = {
  /** Charcoal keys (PREV / NEXT). */
  dark: "bg-linear-to-b from-[#3d434d] to-[#1b1e24] text-white/90 [--lip:#0a0c10] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.45),0_5px_0_var(--lip),0_8px_12px_rgba(0,30,80,0.45)]",
  /** Small mode keys. */
  pill: "bg-linear-to-b from-[#2d323a] to-[#16191e] text-white/80 [--lip:#07090c] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_3px_0_var(--lip),0_5px_8px_rgba(0,30,80,0.4)]",
  pillOn: "bg-linear-to-b from-white to-[#e9e0cf] text-navy-900 [--lip:#a99a7d] shadow-[inset_0_1px_0_#fff,0_3px_0_var(--lip),0_5px_8px_rgba(0,30,80,0.35)]",
  /** Big square action key. */
  action: "bg-linear-to-b from-[#ffd35c] to-[#f2a200] text-navy-900 [--lip:#b06f00] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(150,80,0,0.35),0_6px_0_var(--lip),0_10px_14px_rgba(0,30,80,0.45)]",
} as const;

type KeycapProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones };

/** A physical key: travels down when pressed, buzzes on devices that support it. */
export function Keycap({ tone = "dark", className, onClick, children, ...rest }: KeycapProps) {
  const lip = tone === "action" ? "active:translate-y-[5px]" : tone === "dark" ? "active:translate-y-[4px]" : "active:translate-y-[2px]";
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
      }}
      className={cn(
        "gloss relative select-none font-display font-bold tracking-wide transition-[translate,box-shadow] duration-75",
        // disabled = an unlit key: same body, dim legend (no translucent blue wash)
        "active:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_0_var(--lip)] disabled:text-white/30 disabled:active:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        tones[tone],
        lip,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
