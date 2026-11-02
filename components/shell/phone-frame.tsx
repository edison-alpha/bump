import type { ReactNode } from "react";
import { ConsoleDeck } from "@/components/console/console-deck";

/**
 * The handheld console: screen on top, hardware deck below. The page never scrolls; only the LCD does.
 * Phones / installed PWA: full-bleed, edge to edge and under the status bar + home indicator (safe-area padding).
 * Pinned with fixed top-0, not h-dvh: in an iOS standalone PWA 100dvh (and the fixed containing block) comes up a status bar
 * short, leaving a gap at the bottom. Its height is --app-h (the screen height, set by <StandaloneHeight>) when that happens.
 * Larger screens: a centered, rounded, floating device, shrunk to fit short windows.
 * touch-none: the bezel and deck can't be pinched or dragged; the LCD opts back into vertical panning.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 flex h-[var(--app-h,100%)] flex-col md:static md:h-auto md:mx-auto md:w-full md:max-w-[430px] md:py-6">
      <div className="console md:console-device flex min-h-0 flex-1 touch-none flex-col pt-[env(safe-area-inset-top)] md:h-[min(880px,calc(100dvh-48px))] md:min-h-[640px] md:flex-none md:pt-0">
        {children}
        <ConsoleDeck />
      </div>
    </div>
  );
}
