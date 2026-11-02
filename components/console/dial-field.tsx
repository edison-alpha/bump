"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDial, type Dial } from "./console-provider";

type DialFieldProps = Dial & {
  id: string;
  children: ReactNode;
  className?: string;
  /** No ring or DIAL tag: for a field whose own control already shows the value (e.g. a segmented picker). */
  quiet?: boolean;
};

/**
 * Wraps an adjustable value. Tapping it (or tapping the wheel) selects it for the hardware wheel; the selected one glows
 * and carries a small "DIAL" tag so it is obvious what the wheel will change.
 */
export function DialField({ id, label, onStep, children, className, quiet }: DialFieldProps) {
  const { active: selected, activate } = useDial(id, { label, onStep });
  const active = selected && !quiet;
  const el = useRef<HTMLDivElement>(null);

  // when the wheel tap moves the selection, bring the newly selected field into view
  useEffect(() => {
    if (active) el.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div
      ref={el}
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
