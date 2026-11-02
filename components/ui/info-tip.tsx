"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Filled (i) that opens a small popover with a plain-language explanation. */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span ref={ref} className="relative ml-1.5 inline-flex align-[-3px]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="More info">
        <InfoDot />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-6 left-1/2 z-20 w-56 -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-left text-sm font-normal text-navy-900 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** The static filled info icon used in captions. */
export function InfoDot({ size = 20, className }: { size?: number; className?: string }) {
  return <Icon name="info" size={size} className={cn("text-[#7cc8ff]", className)} />;
}
