"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { PoweredBy } from "@/components/shell/powered-by";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { ActionKey } from "./action-key";
import { useConsole } from "./console-provider";
import { Keycap } from "./keycap";
import { ScrollWheel } from "./scroll-wheel";

const MODES = [
  { href: "/home", label: "Home", match: ["/home"] },
  { href: "/markets", label: "Trade", match: ["/markets", "/trade", "/position", "/history"] },
  { href: "/leaderboard", label: "Ranks", match: ["/leaderboard"] },
] as const;

/** Top-level screens: PREV has nowhere to go from these. */
const ROOTS: string[] = ["/", "/home", "/leaderboard"];

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Small second line on a key: what it does on this screen. */
function KeySub({ children }: { children: string }) {
  return (
    <span className="mt-1 max-w-[92%] truncate font-sans text-[9px] font-bold tracking-normal normal-case opacity-70">
      {children}
    </span>
  );
}

/** Corner LED of a SELL / BUY key: dim in its color, bright when that side is picked. */
function SideLed({ on, tone }: { on: boolean; tone: "sell" | "buy" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-2 right-2.5 size-1.5 rounded-full",
        tone === "buy"
          ? on
            ? "bg-mint shadow-[0_0_6px_#3fe0a6]"
            : "bg-mint/25"
          : on
            ? "bg-coral shadow-[0_0_6px_#ff6377]"
            : "bg-coral/25",
      )}
    />
  );
}

/**
 * The hardware half of the console: PREV / NEXT keys, mode keys, the mascot action key and the
 * scroll wheel. Replaces a web tab bar.
 */
export function ConsoleDeck() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { action, sideKeys, coachKey } = useConsole();
  const { position } = useTrade();
  const signedIn = session.status !== "signed-out";
  const next = action?.current ?? null;
  const sides = sideKeys?.current ?? null;
  // nothing to go back to from the top-level screens (history back would leave the app or land on sign-in)
  const canGoBack = !ROOTS.includes(pathname);

  const pressNext = () => {
    const a = action?.current;
    if (!a || a.disabled) return;
    if (a.onPress) a.onPress();
    else if (a.href) router.push(a.href);
  };

  // with SELL / BUY on the keys, left = sell and right = buy
  const pressLeft = () => (sideKeys?.current ? sideKeys.current.onPress("sell") : canGoBack && router.back());
  const pressRight = () => (sideKeys?.current ? sideKeys.current.onPress("buy") : pressNext());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") pressLeft();
      if (e.key === "ArrowRight") pressRight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="console-deck shrink-0 px-4 pt-0.5">
      <div className="flex items-stretch gap-3">
        <div className="flex flex-1 flex-col gap-2.5">
          {sides ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Keycap
                tone="dark"
                aria-label={sides.selected === "sell" ? "Sell (short), selected" : "Sell (short): bet the price drops"}
                aria-pressed={sides.selected === "sell"}
                onClick={pressLeft}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-[13px] text-[16px] leading-none text-[#ff8a9b]",
                  sides.selected === "sell" && "text-[#ffb3be]",
                  coachKey === "sides" && "coach-pulse",
                )}
              >
                SELL
                <KeySub>{sides.selected === "sell" ? "picked" : "price drops"}</KeySub>
                <SideLed on={sides.selected === "sell"} tone="sell" />
              </Keycap>
              <Keycap
                tone="dark"
                aria-label={sides.selected === "buy" ? "Buy (long), selected" : "Buy (long): bet the price climbs"}
                aria-pressed={sides.selected === "buy"}
                onClick={pressRight}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-[13px] text-[16px] leading-none text-[#5dffc0]",
                  sides.selected === "buy" && "text-[#a6ffdc]",
                  coachKey === "sides" && "coach-pulse",
                )}
              >
                BUY
                <KeySub>{sides.selected === "buy" ? "picked" : "price climbs"}</KeySub>
                <SideLed on={sides.selected === "buy"} tone="buy" />
              </Keycap>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Keycap
                tone="dark"
                aria-label="Previous screen"
                disabled={!canGoBack}
                onClick={pressLeft}
                className="h-12 rounded-[13px] text-[16px]"
              >
                PREV
              </Keycap>
              <Keycap
                tone="dark"
                aria-label={next ? `Next: ${next.label}` : "Next"}
                title={next?.label}
                disabled={!next || next.disabled}
                onClick={pressRight}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-[13px] text-[16px] leading-none",
                  coachKey === "next" && "coach-pulse",
                )}
              >
                NEXT
                {/* the key's legend changes with the screen, so say what it does */}
                {next && <KeySub>{next.label}</KeySub>}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-2 right-2.5 size-1.5 rounded-full",
                    next && !next.disabled ? "bg-mint shadow-[0_0_6px_#3fe0a6]" : "bg-white/15",
                  )}
                />
              </Keycap>
            </div>
          )}

          <nav aria-label="Modes" className="grid grid-cols-3 gap-2">
            {MODES.map(({ href, label, match }) => {
              const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
              return (
                <Keycap
                  key={href}
                  tone={active ? "pillOn" : "pill"}
                  aria-current={active ? "page" : undefined}
                  disabled={!signedIn}
                  // with a trade running, TRADE goes straight to it instead of the market list
                  onClick={() => router.push(href === "/markets" && position ? "/position" : href)}
                  className="h-8 w-full rounded-full pl-4 text-[11px] tracking-[0.06em] uppercase"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full",
                      active ? "bg-mint shadow-[0_0_6px_#3fe0a6]" : "bg-white/20",
                    )}
                  />
                  {label}
                </Keycap>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center">
          <ActionKey />
        </div>
        <ScrollWheel />
      </div>
      <PoweredBy tone="dark" className="mt-3 text-[11px] leading-5" />
    </div>
  );
}
