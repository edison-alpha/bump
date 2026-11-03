"use client";

import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { useConsole } from "./console-provider";
import { haptic } from "@/lib/haptics";

const TONE = { positive: "text-[#5dffc0]", negative: "text-[#ff8a9b]" } as const;

/* The main LCD has a notch cut out of its bottom-right corner, right above the wheel; the bezel shows through it and
   the mini LCD sits inside. Sizes are from the panel's right / bottom edges and match the deck (wheel is 16px in, 48px wide). */
const NOTCH_W = 68;
const NOTCH_H = 50;
/** Corner radii: the notch's inner corner, and the panel's two new outside corners beside it. */
const R_IN = 16;
const R_OUT = 12;
const RING = 8;

/** Points along a quarter arc, as clip-path coordinates measured from the panel's bottom-right corner. */
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  return Array.from({ length: 9 }, (_, i) => {
    const t = ((from + ((to - from) * i) / 8) * Math.PI) / 180;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    return `calc(100% - ${(-x).toFixed(2)}px) calc(100% - ${(-y).toFixed(2)}px)`;
  });
}

/** clip-path for the screen panel: removes the rounded notch, keeps the panel's outer rings everywhere else. */
export const NOTCH_CLIP = `polygon(${[
  "-12px -12px",
  "calc(100% + 12px) -12px",
  `calc(100% + 12px) calc(100% - ${NOTCH_H + R_OUT}px)`,
  ...arc(-R_OUT, -NOTCH_H - R_OUT, R_OUT, 0, 90), // outside corner by the panel's right edge
  ...arc(-NOTCH_W + R_IN, -NOTCH_H + R_IN, R_IN, -90, -180), // the notch's inner corner
  ...arc(-NOTCH_W - R_OUT, -R_OUT, R_OUT, 0, 90), // outside corner on the panel's bottom edge
  `calc(100% - ${NOTCH_W + R_OUT}px) calc(100% + 12px)`,
  "-12px calc(100% + 12px)",
].join(", ")})`;

/** The panel's rim rings (groove, light rim, shade) as an inset shadow and as a ring around a rounded corner. */
const RINGS_INSET = "inset 0 0 0 3px #0a3f86, inset 0 0 0 6px rgb(150 222 255 / 0.75), inset 0 0 0 8px rgb(10 90 190 / 0.35)";
const RINGS_ARC = `radial-gradient(circle at 0 0, transparent ${R_OUT}px, #0a3f86 ${R_OUT}px ${R_OUT + 3}px, rgb(150 222 255 / 0.75) ${R_OUT + 3}px ${R_OUT + 6}px, rgb(10 90 190 / 0.35) ${R_OUT + 6}px ${R_OUT + RING}px, transparent ${R_OUT + RING}px)`;

/**
 * Mini LCD in the screen's corner notch: names the value the wheel turns and shows it live (for TP / SL the trigger
 * price too). The screen's rim runs around the notch, so the two read as one piece of glass in one bezel.
 * Pressing it moves to the next value, same as tapping the wheel. `right` / `bottom` place the panel's corner
 * inside the positioned parent.
 */
export function MiniLcd({ right, bottom }: { right: number; bottom: number }) {
  const { activeDial, activeReadout: readout, dialCount, cycleDial } = useConsole();

  const press = () => {
    cycleDial();
    sfx.click();
    haptic(8);
  };

  return (
    <>
      {/* rim along the notch's top and left edges and round its inner corner (its other sides are clipped away);
          it stops where the outside-corner arcs take over */}
      <span
        aria-hidden
        className="pointer-events-none absolute overflow-hidden"
        style={{ right: right + R_OUT, bottom: bottom + R_OUT, width: NOTCH_W - R_OUT, height: NOTCH_H - R_OUT }}
      >
        <span className="absolute top-0 left-0 size-[200%]" style={{ boxShadow: RINGS_INSET, borderTopLeftRadius: R_IN }} />
      </span>
      {/* the rim curving round the panel's two new outside corners */}
      {[
        { right: right - RING, bottom: bottom + NOTCH_H - RING },
        { right: right + NOTCH_W - RING, bottom: bottom - RING },
      ].map((pos) => (
        <span
          key={pos.right}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ ...pos, width: R_OUT + RING, height: R_OUT + RING, background: RINGS_ARC }}
        />
      ))}

      <button
        type="button"
        onClick={press}
        disabled={dialCount < 2}
        aria-label={
          readout ? `${readout.tag} ${readout.value}${readout.sub ? `, ${readout.sub}` : ""}. Next value` : "Wheel scrolls the screen"
        }
        // centred over the wheel: the wheel's middle is 28px in from the panel's right edge
        className="absolute z-10 w-[52px] rounded-[9px] bg-linear-to-b from-[#0a3c80] to-[#0e5bb8] p-[2px] shadow-[inset_0_2px_3px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.45)] active:translate-y-px disabled:active:translate-y-0"
        style={{ right: right + 2, bottom: bottom - 4 }}
      >
        <span className="relative flex h-[38px] flex-col items-center justify-center overflow-hidden rounded-[7px] bg-[radial-gradient(ellipse_at_50%_30%,#123a5e,#071628_75%)] font-display leading-none tabular-nums shadow-[inset_0_1px_4px_rgba(0,0,0,0.8)]">
          {/* LED: lit when the wheel is driving a value */}
          <span
            aria-hidden
            className={cn("absolute top-1 right-1 size-1 rounded-full", activeDial ? "bg-cyan shadow-[0_0_4px_#4cc9ff]" : "bg-white/20")}
          />
          {readout ? (
            <>
              <span className="text-[7px] font-bold tracking-[0.14em] text-cyan/80">{readout.tag}</span>
              <span className={cn("mt-[2px] text-[11px] font-bold text-white", readout.tone && TONE[readout.tone])}>{readout.value}</span>
              {readout.sub && <span className="mt-[2px] text-[7.5px] font-semibold text-white/75">{readout.sub}</span>}
            </>
          ) : (
            <span className="text-[7px] font-bold tracking-[0.14em] text-white/45">SCROLL</span>
          )}
          {/* glass glare */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/10 to-transparent" />
        </span>
      </button>
    </>
  );
}
