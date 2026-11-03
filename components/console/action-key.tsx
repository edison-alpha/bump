"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { useMarket } from "@/modules/market/price-provider";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { useConsole } from "./console-provider";
import { Keycap } from "./keycap";
import { haptic } from "@/lib/haptics";

/** How long the key must be held to place or close a trade. */
const HOLD_MS = 600;
/** Screens where a held key places the draft; elsewhere the key takes you to Build first. */
const PLACE_FROM = ["/trade/build", "/trade/review"];

/**
 * The big bump key is the trade trigger, and the only key that trades.
 * - No position: on Build / Review, hold it to place the trade. Anywhere else a press goes to Build.
 * - Open position: hold it to close (on Close Position: the chosen amount, anywhere else: all of it).
 *   A short press opens Close Position to pick an amount.
 * Holding instead of a double press: a stray tap never trades, and there's no extra screen in the way.
 * Signed out: starts sign-in.
 */
export function ActionKey() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { position, blocker, closePosition } = useTrade();
  const market = useMarket(position?.marketId ?? "btc");
  const { action, flash, coachKey } = useConsole();
  const signedIn = session.status !== "signed-out";
  const mode = position ? "close" : "open";
  const placing = pathname === "/trade/progress";
  const holdable = signedIn && !placing && (mode === "close" || PLACE_FROM.includes(pathname));

  const [charge, setCharge] = useState(0);
  const [shakeId, setShakeId] = useState(0);
  const hold = useRef<{ start: number; frame: number; fired: boolean; lastStep: number } | null>(null);

  const deny = (text: string) => {
    sfx.deny();
    haptic([20, 40, 20]);
    setShakeId(Date.now());
    flash(text, "warn");
  };

  const fire = () => {
    if (mode === "open") {
      if (blocker) return deny(blocker);
      router.push("/trade/progress");
      return;
    }
    if (pathname === "/position/close") {
      action?.current?.onPress?.();
      return;
    }
    // on chain the order has to fill before there is anything to show; a failure keeps the trade open and says why
    void closePosition(100, market.price)
      .then((closed) => closed && router.replace("/position/closed"))
      .catch((error: Error) => deny(error.message));
  };

  /** A short press: never trades, only navigates or explains. */
  const tap = () => {
    if (!signedIn) return router.push("/sign-in");
    if (placing) return deny("Your order is on its way.");
    if (mode === "open") {
      if (PLACE_FROM.includes(pathname)) return flash(blocker ?? "Hold BUMP to place it.", blocker ? "warn" : "info");
      router.push("/trade/build");
      return;
    }
    if (pathname === "/position/close") return flash("Hold BUMP to close it.");
    router.push("/position/close");
  };

  const cancel = () => {
    if (hold.current) cancelAnimationFrame(hold.current.frame);
    hold.current = null;
    setCharge(0);
  };

  const start = () => {
    if (hold.current) return;
    const h = { start: performance.now(), frame: 0, fired: false, lastStep: -1 };
    hold.current = h;
    if (!holdable) return;
    const loop = (now: number) => {
      const p = Math.min(1, (now - h.start) / HOLD_MS);
      setCharge(p);
      const step = Math.floor(p * 6);
      if (step !== h.lastStep) {
        h.lastStep = step;
        sfx.charge(p);
        haptic(5);
      }
      if (p >= 1) {
        h.fired = true;
        haptic(30);
        setCharge(0);
        fire();
        return;
      }
      h.frame = requestAnimationFrame(loop);
    };
    h.frame = requestAnimationFrame(loop);
  };

  const end = () => {
    const h = hold.current;
    if (!h) return;
    const fired = h.fired;
    cancel();
    if (!fired) tap();
  };

  useEffect(() => cancel, []);

  const legend = !signedIn ? "START" : mode === "open" ? "OPEN" : "CLOSE";
  const label = !signedIn
    ? "Sign in"
    : mode === "open"
      ? holdable
        ? "Hold to place the trade"
        : "Plan a trade"
      : "Hold to close the position. Press to pick an amount";

  return (
    <div className="relative">
      <Keycap
        key={shakeId}
        tone="action"
        aria-label={label}
        title={label}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={end}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") end();
        }}
        className={cn(
          "relative grid size-[80px] touch-none place-items-center rounded-[20px]",
          shakeId > 0 && "animate-shake",
          coachKey === "bump" && "coach-pulse",
        )}
      >
        <span className="flex flex-col items-center">
          <BumpStamp size={42} />
          <span className="mt-0.5 text-[9px] leading-none tracking-[0.16em] text-[#8a5200]">{legend}</span>
        </span>
        <ChargeBorder progress={charge} />
      </Keycap>
    </div>
  );
}

/**
 * The key's own rounded edge filling up while it's held. Inside the key, so it travels down with the press;
 * the rect matches the key's 80px size and 20px corners.
 */
function ChargeBorder({ progress }: { progress: number }) {
  if (progress <= 0) return null;
  return (
    <svg aria-hidden viewBox="0 0 80 80" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <rect x="2" y="2" width="76" height="76" rx="18" fill="none" stroke="rgb(140 70 0 / 0.35)" strokeWidth="4" />
      <rect
        x="2"
        y="2"
        width="76"
        height="76"
        rx="18"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 * (1 - progress)}
        style={{ filter: "drop-shadow(0 0 3px rgb(255 255 255 / 0.9))" }}
      />
    </svg>
  );
}

/** The bump "b" mark pressed into the key face: sunk fill, shadow along the top edge, light catching the bottom lip. */
function BumpStamp({ size }: { size: number }) {
  const id = useId();
  return (
    <svg aria-hidden width={size} height={size} viewBox="270 225 720 820" className="translate-x-[2px]">
      <defs>
        <mask id={`${id}-eyes`}>
          <rect x="270" y="225" width="720" height="820" fill="#fff" />
          <rect x="522" y="663" width="108" height="194" rx="54" fill="#000" />
          <rect x="693" y="663" width="108" height="194" rx="54" fill="#000" />
        </mask>
        <filter id={`${id}-deboss`} x="-10%" y="-10%" width="120%" height="120%">
          {/* light lip below the cut */}
          <feOffset in="SourceAlpha" dy="14" result="lipOffset" />
          <feComposite in="lipOffset" in2="SourceAlpha" operator="out" result="lipEdge" />
          <feFlood floodColor="#fff4cf" floodOpacity="0.85" />
          <feComposite in2="lipEdge" operator="in" result="lip" />
          {/* shadow cast inside the cut from its top edge */}
          <feFlood floodColor="#6b3d00" floodOpacity="0.75" />
          <feComposite in2="SourceAlpha" operator="out" result="outside" />
          <feOffset in="outside" dy="22" result="shadowOffset" />
          <feGaussianBlur in="shadowOffset" stdDeviation="9" result="shadowBlur" />
          <feComposite in="shadowBlur" in2="SourceAlpha" operator="in" result="inner" />
          <feMerge>
            <feMergeNode in="lip" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="inner" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id}-deboss)`}>
        <g mask={`url(#${id}-eyes)`} fill="#d98a00">
          <path d="M300 381a139 139 0 0 1 278 0v642H460a160 160 0 0 1-160-160Z" />
          <ellipse cx="630" cy="745" rx="330" ry="282" />
        </g>
      </g>
    </svg>
  );
}
