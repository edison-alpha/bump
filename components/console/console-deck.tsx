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

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * The hardware half of the console: PREV / NEXT keys, mode keys, the mascot action key and the
 * scroll wheel. Replaces a web tab bar.
 */
export function ConsoleDeck() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { action } = useConsole();
  const { position } = useTrade();
  const signedIn = session.status !== "signed-out";
  const next = action?.current ?? null;

  const pressNext = () => {
    const a = action?.current;
    if (!a || a.disabled) return;
    if (a.onPress) a.onPress();
    else if (a.href) router.push(a.href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") router.back();
      if (e.key === "ArrowRight") pressNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="shrink-0 px-4 pt-0.5 pb-[max(0.375rem,calc(env(safe-area-inset-bottom)-14px))] in-data-short-viewport:pb-2">
      <div className="flex items-stretch gap-3">
        <div className="flex flex-1 flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Keycap tone="dark" aria-label="Previous screen" onClick={() => router.back()} className="h-12 rounded-[13px] text-[16px]">
              PREV
            </Keycap>
            <Keycap
              tone="dark"
              aria-label={next ? `Next: ${next.label}` : "Next"}
              title={next?.label}
              disabled={!next || next.disabled}
              onClick={pressNext}
              className="h-12 rounded-[13px] text-[16px]"
            >
              NEXT
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 right-2.5 size-1.5 rounded-full",
                  next && !next.disabled ? "bg-mint shadow-[0_0_6px_#3fe0a6]" : "bg-white/15",
                )}
              />
            </Keycap>
          </div>

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
      <PoweredBy tone="dark" className="mt-1 text-[11px]" />
    </div>
  );
}
