import type { ReactNode } from "react";
import { ConsoleDeck } from "@/components/console/console-deck";

/** A countersunk screw: bright pin-light on top, dark slot, a shadow ring where it sits in the plastic. */
function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute hidden size-2.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.85),rgb(var(--bz-shade)/0.55)_70%)] shadow-[0_0_0_1.5px_rgb(var(--bz-shade)/0.4),0_1px_1px_rgb(255_255_255/0.5)] md:block ${className}`}
    >
      <span className="absolute inset-x-[2px] top-1/2 h-px -translate-y-1/2 rotate-45 bg-[rgb(var(--bz-shade)/0.8)]" />
    </span>
  );
}

/** Speaker slits cut into the top edge of the shell. */
function Vents({ className }: { className: string }) {
  return (
    <span aria-hidden className={`absolute hidden gap-[3px] md:flex ${className}`}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="h-[3px] w-4 rounded-full bg-[rgb(var(--bz-shade)/0.55)] shadow-[0_1px_0_rgb(255_255_255/0.55),inset_0_1px_1px_rgb(0_0_0/0.45)]" />
      ))}
    </span>
  );
}

/**
 * The handheld console: screen on top, hardware deck below. The page never scrolls; only the LCD does.
 * Phones / installed PWA: full-bleed, edge to edge and under the status bar + home indicator (safe-area padding).
 * Fixed to the available viewport; iOS uses the default status bar so it does not subtract its height twice.
 * Larger screens: a centered, rounded, floating device, shrunk to fit short windows, with screws and speaker slits.
 * touch-none: the bezel and deck can't be pinched or dragged; the LCD opts back into vertical panning.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col md:static md:mx-auto md:w-full md:max-w-[430px] md:py-6">
      <div className="console md:console-device relative flex min-h-0 flex-1 touch-none flex-col pt-[env(safe-area-inset-top)] md:h-[min(880px,calc(100dvh-48px))] md:min-h-[640px] md:flex-none md:pt-0">
        {children}
        {/* the parting line where the screen half meets the key deck */}
        <span aria-hidden className="mx-5 h-[3px] shrink-0 rounded-full bg-[rgb(var(--bz-shade)/0.35)] shadow-[0_1px_0_rgb(255_255_255/0.55),inset_0_1px_1px_rgb(0_0_0/0.25)]" />
        <ConsoleDeck />
        <Screw className="top-3 left-3" />
        <Screw className="top-3 right-3" />
        <Screw className="bottom-3 left-3" />
        <Screw className="right-3 bottom-3" />
        <Vents className="top-[5px] left-1/2 -translate-x-1/2" />
      </div>
    </div>
  );
}
