"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useConsole } from "@/components/console/console-provider";
import { MiniLcd, NOTCH_CLIP } from "@/components/console/mini-lcd";
import { Icon } from "@/components/ui/icon";

type ScreenProps = {
  title?: string;
  /** Show the round back button. Pass a path to navigate there instead of history back. */
  back?: boolean | string;
  right?: ReactNode;
  /** Replaces the default header (title + back) entirely. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function BackButton({ to }: { to?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (to ? router.push(to) : router.back())}
      className="gloss grid h-10 w-12 shrink-0 place-items-center rounded-full bg-linear-to-b from-white to-[#f1e9da] text-navy-900 shadow-[inset_0_-3px_0_rgba(120,100,60,0.2),0_2px_6px_rgba(0,0,0,0.15)] active:translate-y-0.5"
    >
      <Icon name="back" size={24} />
    </button>
  );
}

function Header({ title, back, right }: Pick<ScreenProps, "title" | "back" | "right">) {
  return (
    <header className="relative flex h-10 shrink-0 items-center justify-between">
      {back ? <BackButton to={typeof back === "string" ? back : undefined} /> : <span className="w-12" />}
      <h1 className="text-pop pointer-events-none absolute inset-x-14 text-center font-display text-[20px] font-bold tracking-tight text-white">
        {title}
      </h1>
      <span className="flex min-w-12 justify-end">{right}</span>
    </header>
  );
}

/**
 * The LCD: a recessed panel whose content scrolls inside it (the page itself never scrolls),
 * with a glass glare on top. The scroll element is handed to the console so the wheel drives it.
 * Its bottom-right corner is notched for the mini LCD over the wheel; pb-14 keeps the last content clear of it.
 */
function Lcd({ header, children, className }: { header?: ReactNode; children: ReactNode; className?: string }) {
  const { setScreenEl } = useConsole();
  return (
    <section className="screen-panel relative flex min-h-0 flex-1 flex-col overflow-hidden" style={{ clipPath: NOTCH_CLIP }}>
      <div
        ref={setScreenEl}
        className={cn(
          "flex min-h-0 flex-1 touch-pan-y flex-col gap-2 overflow-y-auto overscroll-contain px-3 pt-3 pb-14 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {header}
        {children}
      </div>
      {/* glass: inner depth + diagonal glare, above content but never interactive */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(125deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.02)_28%,transparent_42%)] shadow-[inset_0_10px_18px_rgba(0,0,0,0.45),inset_0_-8px_14px_rgba(0,0,0,0.3)]"
      />
    </section>
  );
}

/** Every page is built on this: the LCD fills the bezel and holds the header, so it is the same size on every page. */
export function Screen({ title, back = true, right, header, children, className }: ScreenProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-3 pt-3 pb-2.5">
      <Lcd header={header ?? <Header title={title} back={back} right={right} />} className={cn("px-3.5 pt-2.5", className)}>
        {children}
      </Lcd>
      {/* panel corner = this box's px-3 / pb-2.5 */}
      <MiniLcd right={12} bottom={10} />
    </div>
  );
}
