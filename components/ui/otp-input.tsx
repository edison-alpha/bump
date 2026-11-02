"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

type OtpInputProps = { value: string; onChange: (value: string) => void; length?: number; label?: string };

/** One real (transparent) input drives N visual boxes, so paste, autofill and backspace just work. */
export function OtpInput({ value, onChange, length = 6, label = "Verification code" }: OtpInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={label}
        maxLength={length}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        className="peer absolute inset-0 z-10 size-full cursor-text opacity-0"
      />
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn(
              "recess grid h-14 place-items-center rounded-[12px] font-display text-[26px] font-bold text-white",
              i === Math.min(value.length, length - 1) && "border-cyan",
            )}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
