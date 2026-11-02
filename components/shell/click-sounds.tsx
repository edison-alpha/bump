"use client";

import { useEffect } from "react";
import { sfx } from "@/lib/sound";

const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"]';

/** Plays the key-click sound for every button and link press (mouse, touch or keyboard). */
export function ClickSounds() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest(PRESSABLE);
      if (el && !el.matches(":disabled, [aria-disabled='true']")) sfx.click();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
