"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

/** What the hardware NEXT key does on the current screen. */
export type PrimaryAction = {
  label: string;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * Trade screens turn PREV / NEXT into SELL / BUY. `selected` is the side currently picked (its key glows);
 * the screen decides what a press does (pick that side, or go on when it is already picked).
 */
export type TradeKey = "sell" | "buy";
export type SideKeys = {
  selected: TradeKey | null;
  onPress: (key: TradeKey) => void;
};

/** What the mini LCD above the wheel shows for a dial, e.g. TP · +2.0% · $69,605. */
export type Readout = {
  tag: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
};

/** A value the thumb wheel can turn (margin, leverage, limits …). */
export type Dial = {
  label: string;
  /** +1 = wheel rolled up (increase), -1 = down. */
  onStep: (direction: 1 | -1) => void;
  readout?: Readout;
};

type DialEntry = { id: string; ref: RefObject<Dial> };

type ConsoleContextValue = {
  /** The scrolling LCD area of the current screen (the wheel scrolls it when no dial is active). */
  screenEl: HTMLDivElement | null;
  setScreenEl: (el: HTMLDivElement | null) => void;
  action: RefObject<PrimaryAction | null> | null;
  registerAction: (action: RefObject<PrimaryAction | null> | null) => void;
  sideKeys: RefObject<SideKeys | null> | null;
  registerSideKeys: (keys: RefObject<SideKeys | null> | null) => void;
  /** The dial the wheel currently drives, if any. */
  activeDial: DialEntry | null;
  activeDialId: string | null;
  dialCount: number;
  activateDial: (id: string) => void;
  /** Selects the next dial on screen (wraps around). */
  cycleDial: () => void;
  registerDial: (entry: DialEntry) => () => void;
  /** Readout of the active dial, kept in state so the mini LCD follows on-screen edits and live prices too. */
  activeReadout: Readout | null;
  setReadout: (id: string, readout: Readout | null) => void;
  /** Short message across the top of the LCD, e.g. why a key press did nothing. */
  toast: Toast | null;
  flash: (text: string, tone?: Toast["tone"]) => void;
  /** Hardware key the tutorial points at; it pulses until the step is done. */
  coachKey: CoachKey | null;
  setCoachKey: (key: CoachKey | null) => void;
};

export type Toast = { id: number; text: string; tone: "info" | "warn" | "good" };
export type CoachKey = "bump" | "sides" | "next" | "wheel";

const TOAST_MS = 2200;

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [screenEl, setScreenEl] = useState<HTMLDivElement | null>(null);
  // Wrapped so every registration is a new state value (re-renders the deck) while the ref stays live.
  const [slot, setSlot] = useState<{ ref: RefObject<PrimaryAction | null> } | null>(null);
  const registerAction = useCallback((next: RefObject<PrimaryAction | null> | null) => setSlot(next ? { ref: next } : null), []);
  const [sideSlot, setSideSlot] = useState<{ ref: RefObject<SideKeys | null> } | null>(null);
  const registerSideKeys = useCallback((next: RefObject<SideKeys | null> | null) => setSideSlot(next ? { ref: next } : null), []);

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

  const [readouts, setReadouts] = useState<Record<string, Readout>>({});
  const setReadout = useCallback(
    (id: string, readout: Readout | null) =>
      setReadouts(({ [id]: _, ...rest }) => (readout ? { ...rest, [id]: readout } : rest)),
    [],
  );
  const activeReadout = (activeDial && readouts[activeDial.id]) ?? null;

  const [toast, setToast] = useState<Toast | null>(null);
  const flash = useCallback((text: string, tone: Toast["tone"] = "info") => setToast({ id: Date.now(), text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const [coachKey, setCoachKey] = useState<CoachKey | null>(null);

  const value = useMemo(
    () => ({
      screenEl,
      setScreenEl,
      action: slot?.ref ?? null,
      registerAction,
      sideKeys: sideSlot?.ref ?? null,
      registerSideKeys,
      activeDial,
      activeDialId: activeDial?.id ?? null,
      dialCount: dials.length,
      activateDial: setActiveDialId,
      cycleDial,
      registerDial,
      activeReadout,
      setReadout,
      toast,
      flash,
      coachKey,
      setCoachKey,
    }),
    [
      screenEl,
      slot,
      registerAction,
      sideSlot,
      registerSideKeys,
      activeDial,
      dials.length,
      cycleDial,
      registerDial,
      activeReadout,
      setReadout,
      toast,
      flash,
      coachKey,
    ],
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

/** Turns PREV / NEXT into SELL / BUY on this screen. Re-registers only when the selected side changes. */
export function useSideKeys(keys: SideKeys | null) {
  const { registerSideKeys } = useConsole();
  const ref = useRef<SideKeys | null>(keys);

  useEffect(() => {
    ref.current = keys;
  });

  const signature = keys ? (keys.selected ?? "none") : "";

  useEffect(() => {
    ref.current = keys;
    registerSideKeys(signature ? ref : null);
    return () => registerSideKeys(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, registerSideKeys]);
}

/** Makes a value turnable by the wheel. Returns whether it is the selected dial and a selector. */
export function useDial(id: string, dial: Dial) {
  const { registerDial, activeDialId, activateDial, setReadout } = useConsole();
  const ref = useRef<Dial>(dial);

  useEffect(() => {
    ref.current = dial;
  });

  useEffect(() => registerDial({ id, ref }), [id, registerDial]);

  const { tag, value, sub, tone } = dial.readout ?? {};
  useEffect(() => {
    setReadout(id, tag && value ? { tag, value, sub, tone } : null);
  }, [id, tag, value, sub, tone, setReadout]);
  useEffect(() => () => setReadout(id, null), [id, setReadout]);

  return { active: activeDialId === id, activate: () => activateDial(id) };
}

/** Makes `key` pulse on the deck while this screen is up (tutorial). Pass null for no pulse. */
export function useCoachKey(key: CoachKey | null) {
  const { setCoachKey } = useConsole();
  useEffect(() => {
    setCoachKey(key);
    return () => setCoachKey(null);
  }, [key, setCoachKey]);
}
