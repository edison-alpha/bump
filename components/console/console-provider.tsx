"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

/** What the hardware NEXT key does on the current screen. */
export type PrimaryAction = {
  label: string;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
};

/** A value the thumb wheel can turn (margin, leverage, limits …). */
export type Dial = {
  label: string;
  /** +1 = wheel rolled up (increase), -1 = down. */
  onStep: (direction: 1 | -1) => void;
};

type DialEntry = { id: string; ref: RefObject<Dial> };

type ConsoleContextValue = {
  /** The scrolling LCD area of the current screen (the wheel scrolls it when no dial is active). */
  screenEl: HTMLDivElement | null;
  setScreenEl: (el: HTMLDivElement | null) => void;
  action: RefObject<PrimaryAction | null> | null;
  registerAction: (action: RefObject<PrimaryAction | null> | null) => void;
  /** The dial the wheel currently drives, if any. */
  activeDial: DialEntry | null;
  activeDialId: string | null;
  activateDial: (id: string) => void;
  /** Selects the next dial on screen (wraps around). */
  cycleDial: () => void;
  registerDial: (entry: DialEntry) => () => void;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [screenEl, setScreenEl] = useState<HTMLDivElement | null>(null);
  // Wrapped so every registration is a new state value (re-renders the deck) while the ref stays live.
  const [slot, setSlot] = useState<{ ref: RefObject<PrimaryAction | null> } | null>(null);
  const registerAction = useCallback((next: RefObject<PrimaryAction | null> | null) => setSlot(next ? { ref: next } : null), []);

  const [dials, setDials] = useState<DialEntry[]>([]);
  const [activeDialId, setActiveDialId] = useState<string | null>(null);

  const registerDial = useCallback((entry: DialEntry) => {
    setDials((list) => [...list.filter((d) => d.id !== entry.id), entry]);
    return () => setDials((list) => list.filter((d) => d.id !== entry.id));
  }, []);

  // The first dial on a screen is selected by default; fall back when the active one unmounts.
  const activeDial = dials.find((d) => d.id === activeDialId) ?? dials[0] ?? null;

  const cycleDial = useCallback(() => {
    if (dials.length < 2) return;
    const i = dials.findIndex((d) => d.id === activeDial?.id);
    setActiveDialId(dials[(i + 1) % dials.length].id);
  }, [dials, activeDial]);

  const value = useMemo(
    () => ({
      screenEl,
      setScreenEl,
      action: slot?.ref ?? null,
      registerAction,
      activeDial,
      activeDialId: activeDial?.id ?? null,
      activateDial: setActiveDialId,
      cycleDial,
      registerDial,
    }),
    [screenEl, slot, registerAction, activeDial, cycleDial, registerDial],
  );
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return ctx;
}

/**
 * Binds the screen's main action to the NEXT key. The latest callback is always used; the key only
 * re-registers when label / href / disabled change.
 */
export function usePrimaryAction(action: PrimaryAction | null) {
  const { registerAction } = useConsole();
  const ref = useRef<PrimaryAction | null>(action);

  useEffect(() => {
    ref.current = action;
  });

  const signature = action ? `${action.label}|${action.href ?? ""}|${action.disabled ? 1 : 0}` : "";

  useEffect(() => {
    ref.current = action;
    registerAction(signature ? ref : null);
    return () => registerAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, registerAction]);
}

/** Makes a value turnable by the wheel. Returns whether it is the selected dial and a selector. */
export function useDial(id: string, dial: Dial) {
  const { registerDial, activeDialId, activateDial } = useConsole();
  const ref = useRef<Dial>(dial);

  useEffect(() => {
    ref.current = dial;
  });

  useEffect(() => registerDial({ id, ref }), [id, registerDial]);

  return { active: activeDialId === id, activate: () => activateDial(id) };
}
