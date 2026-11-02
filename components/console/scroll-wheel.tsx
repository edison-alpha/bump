"use client";

import { useRef, useState } from "react";
import { useConsole } from "./console-provider";

const RIB_DEG = 20; // angle between ribs on the cylinder; one detent turns exactly one rib
const DETENT_PX = 16; // drag distance per detent
const SCROLL_GAIN = 2.4; // LCD px scrolled per px dragged (no dial)
const RIB_MAX = 9; // rib thickness (px) when facing the viewer

/**
 * A real thumbwheel: a ribbed cylinder in a recessed slot. Ribs are projected onto the cylinder
 * (thin + dark near the edges, thick + lit in the middle) so it visibly rolls.
 * With a dial selected on screen it turns that value one detent at a time; otherwise it scrolls the LCD.
 */
export function ScrollWheel() {
  const { screenEl, activeDial } = useConsole();
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ y: number; acc: number } | null>(null);

  const tick = (dir: 1 | -1) => {
    activeDial?.ref.current.onStep(dir);
    navigator.vibrate?.(4);
  };

  const stepOnce = (dir: 1 | -1) => {
    tick(dir);
    setAngle((a) => a + dir * RIB_DEG);
  };

  const scroll = (dy: number) => {
    screenEl?.scrollBy({ top: dy });
    setAngle((a) => a - (dy / SCROLL_GAIN) * (RIB_DEG / DETENT_PX));
  };

  // Visible ribs on the front half of the cylinder (-90°..90°).
  const offset = ((angle % RIB_DEG) + RIB_DEG) % RIB_DEG;
  const ribs = Array.from({ length: Math.ceil(180 / RIB_DEG) + 1 }, (_, k) => -90 + offset + k * RIB_DEG).filter(
    (deg) => deg > -88 && deg < 88,
  );

  const label = activeDial ? `Adjust ${activeDial.ref.current.label}` : "Scroll screen";

  return (
    <div className="relative">
      {/* slot bevel cut into the bezel */}
      <div className="h-full rounded-[16px] bg-linear-to-b from-[#0a3c80] to-[#0e5bb8] p-[3px] shadow-[inset_0_2px_3px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.45)]">
        <div
          role="slider"
          aria-label={label}
          aria-orientation="vertical"
          aria-valuetext={activeDial ? activeDial.ref.current.label : undefined}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { y: e.clientY, acc: 0 };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dy = e.clientY - drag.current.y;
            drag.current.y = e.clientY;
            if (!activeDial) return scroll(-dy * SCROLL_GAIN);
            setAngle((a) => a - dy * (RIB_DEG / DETENT_PX));
            drag.current.acc -= dy;
            while (Math.abs(drag.current.acc) >= DETENT_PX) {
              const dir = drag.current.acc > 0 ? 1 : -1;
              drag.current.acc -= dir * DETENT_PX;
              tick(dir);
            }
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => (activeDial ? stepOnce(e.deltaY < 0 ? 1 : -1) : scroll(e.deltaY))}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            if (activeDial) stepOnce(dir);
            else scroll(-dir * 80);
          }}
          className="relative h-full w-[42px] cursor-ns-resize touch-none overflow-hidden rounded-[12px] bg-[#101215] focus-visible:outline-2 focus-visible:outline-white"
        >
          {/* wheel body inset from the slot walls */}
          <div className="absolute inset-x-[5px] inset-y-0 bg-linear-to-r from-[#1b1d21] via-[#2a2d33] to-[#16181b]">
            {ribs.map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const facing = Math.cos(rad); // 1 = facing viewer, 0 = edge
              return (
                <span
                  key={deg.toFixed(3)}
                  className="absolute inset-x-0 rounded-[2px]"
                  style={{
                    top: `${50 - 50 * Math.sin(rad)}%`,
                    height: Math.max(1, RIB_MAX * facing),
                    transform: "translateY(-50%)",
                    filter: `brightness(${0.35 + 0.75 * facing})`,
                    background: "linear-gradient(180deg, #9aa0a8 0%, #5d626a 22%, #3a3e45 60%, #1a1c20 100%)",
                    boxShadow: `0 ${1 + facing * 2}px ${2 + facing * 2}px rgba(0,0,0,0.65)`,
                  }}
                />
              );
            })}
          </div>
          {/* cylinder shading: dark top/bottom, specular band in the middle, walls on the sides */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.15)_28%,rgba(255,255,255,0.07)_46%,rgba(255,255,255,0.07)_54%,rgba(0,0,0,0.15)_72%,rgba(0,0,0,0.85)_100%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[inset_5px_0_6px_rgba(0,0,0,0.7),inset_-5px_0_6px_rgba(0,0,0,0.7),inset_0_2px_3px_rgba(0,0,0,0.8)]"
          />
        </div>
      </div>
      {/* LED: lit when the wheel is driving a value */}
      <span
        aria-hidden
        className={
          activeDial
            ? "absolute -top-2.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_6px_#4cc9ff]"
            : "absolute -top-2.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/25"
        }
      />
    </div>
  );
}
