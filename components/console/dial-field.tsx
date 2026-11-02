"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDial, type Dial } from "./console-provider";

type DialFieldProps = Dial & {
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Wraps an adjustable value. Tapping it selects it for the hardware wheel; the selected one glows
 * and carries a small "DIAL" tag so it is obvious what the wheel will change.
 */
export function DialField({ id, label, onStep, children, className }: DialFieldProps) {
  const { active, activate } = useDial(id, { label, onStep });

  return (
    <div
      onPointerDownCapture={activate}
      onFocusCapture={activate}
      data-dial-active={active || undefined}
      className={cn(
        "relative rounded-[18px] transition-shadow",
        active && "shadow-[0_0_0_2px_#4cc9ff,0_0_18px_rgba(76,201,255,0.45)]",
        className,
      )}
    >
      {children}
      {active && (
        <span className="pointer-events-none absolute -top-2 right-3 z-10 flex items-center gap-1 rounded-full bg-cyan px-2 py-px font-display text-[10px] font-bold tracking-widest text-navy-950 shadow">
          <span aria-hidden>⇕</span> DIAL
        </span>
      )}
    </div>
  );
}
