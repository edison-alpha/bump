"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useDial, type Dial } from "./console-provider";

type DialFieldProps = Dial & {
  id: string;
  children: ReactNode;
  className?: string;
};

/**
 * Wraps an adjustable value. Tapping it (or tapping the wheel) selects it for the hardware wheel. No highlight on
 * screen: the mini LCD over the wheel names the selected value.
 */
export function DialField({ id, label, onStep, readout, children, className }: DialFieldProps) {
  const { active, activate } = useDial(id, { label, onStep, readout });
  const el = useRef<HTMLDivElement>(null);

  // when the wheel tap moves the selection, bring the newly selected field into view
  useEffect(() => {
    if (active) el.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div ref={el} onPointerDownCapture={activate} onFocusCapture={activate} className={className}>
      {children}
    </div>
  );
}
