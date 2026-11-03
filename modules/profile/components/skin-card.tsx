"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { currentSkin, setSkin, SKINS, type SkinId } from "@/lib/skins";

/** Picks the console's body colour. Saved on this device. */
export function SkinCard() {
  const [skin, setCurrent] = useState<SkinId>("blue");
  useEffect(() => setCurrent(currentSkin()), []);

  const pick = (id: SkinId) => {
    setSkin(id);
    setCurrent(id);
  };

  return (
    <Card className="flex flex-col gap-2 px-3 py-2">
      <p className="flex items-baseline justify-between text-[14px]">
        Console color
        <span className="text-[12px] text-white/70">{SKINS.find((s) => s.id === skin)?.label}</span>
      </p>
      <div role="radiogroup" aria-label="Console color" className="grid grid-cols-5 gap-2">
        {SKINS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={skin === s.id}
            aria-label={s.label}
            onClick={() => pick(s.id)}
            style={{ background: `linear-gradient(160deg, ${s.swatch[0]}, ${s.swatch[1]})` }}
            className={cn(
              "aspect-square rounded-[12px] shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.35)] active:translate-y-px",
              skin === s.id && "ring-2 ring-cyan ring-offset-2 ring-offset-navy-900",
            )}
          />
        ))}
      </div>
    </Card>
  );
}
