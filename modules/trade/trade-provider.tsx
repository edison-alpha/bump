"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { round2 } from "@/lib/format";
import { newId } from "@/lib/id";
import { sfx } from "@/lib/sound";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { unrealizedPnl } from "./calc";
import type { ClosedTrade, Draft, Position } from "./types";

const STARTING_BALANCE = 1000;

const DEFAULT_DRAFT: Draft = { marketId: "btc", side: "long", margin: 20, leverage: 2, targetPct: 2, stopPct: 1 };

type TradeState = {
  draft: Draft;
  position: Position | null;
  history: ClosedTrade[];
};

const INITIAL: TradeState = { draft: DEFAULT_DRAFT, position: null, history: [] };

type TradeContextValue = TradeState & {
  ready: boolean;
  balance: number;
  lastClosed: ClosedTrade | null;
  /** Accepts a patch, or a function of the latest draft (for rapid wheel steps). */
  patchDraft: (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) => void;
  openPosition: (entry: number) => void;
  updateLimits: (limits: Pick<Position, "targetPct" | "stopPct">) => void;
  /** Closes `percent` (1-100) of the open position at `exit`, returns the receipt. */
  closePosition: (percent: number, exit: number) => ClosedTrade | null;
};

const TradeContext = createContext<TradeContextValue | null>(null);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [state, setState, ready] = useLocalStorageState<TradeState>("bump:trade", INITIAL);

  const patchDraft = useCallback(
    (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) =>
      setState((s) => ({ ...s, draft: { ...s.draft, ...(typeof patch === "function" ? patch(s.draft) : patch) } })),
    [setState],
  );

  const openPosition = useCallback(
    (entry: number) => {
      if (state.position) return;
      sfx.open();
      setState((s) =>
        s.position
          ? s
          : { ...s, position: { ...s.draft, id: newId(), entry, openedAt: Date.now() } },
      );
    },
    [state.position, setState],
  );

  const updateLimits = useCallback(
    (limits: Pick<Position, "targetPct" | "stopPct">) =>
      setState((s) => (s.position ? { ...s, position: { ...s.position, ...limits } } : s)),
    [setState],
  );

  const closePosition = useCallback(
    (percent: number, exit: number) => {
      const position = state.position;
      if (!position) return null;
      const fraction = Math.min(percent, 100) / 100;
      const closedMargin = round2(position.margin * fraction);
      const receipt: ClosedTrade = {
        id: newId(),
        marketId: position.marketId,
        side: position.side,
        leverage: position.leverage,
        margin: closedMargin,
        entry: position.entry,
        exit,
        pnl: unrealizedPnl({ ...position, margin: closedMargin }, position.entry, exit),
        closedAt: Date.now(),
      };
      sfx.close(receipt.pnl);
      setState((s) => ({
        ...s,
        position: fraction >= 1 ? null : { ...position, margin: round2(position.margin - closedMargin) },
        history: [receipt, ...s.history],
      }));
      return receipt;
    },
    [state.position, setState],
  );

  const value = useMemo<TradeContextValue>(
    () => ({
      ...state,
      ready,
      balance: round2(STARTING_BALANCE + state.history.reduce((sum, t) => sum + t.pnl, 0)),
      lastClosed: state.history[0] ?? null,
      patchDraft,
      openPosition,
      updateLimits,
      closePosition,
    }),
    [state, ready, patchDraft, openPosition, updateLimits, closePosition],
  );

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}

export function useTrade() {
  const ctx = useContext(TradeContext);
  if (!ctx) throw new Error("useTrade must be used inside <TradeProvider>");
  return ctx;
}
