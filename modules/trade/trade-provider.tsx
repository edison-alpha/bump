"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { round2, usd } from "@/lib/format";
import { newId } from "@/lib/id";
import { sfx } from "@/lib/sound";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { unrealizedPnl } from "./calc";
import type { CloseReason, ClosedTrade, Draft, Position } from "./types";

const STARTING_BALANCE = 1000;
/** Smallest stake; below it the player can't open anything and is offered a refill. */
export const MIN_STAKE = 1;

/** Starts on the Chill style (2x, +1% / -0.5%) with a stake big enough for the result to feel like something. */
const DEFAULT_DRAFT: Draft = { marketId: "btc", side: "long", margin: 50, leverage: 2, targetPct: 1, stopPct: 0.5 };

type TradeState = {
  draft: Draft;
  position: Position | null;
  history: ClosedTrade[];
  /** Practice money added by refills, so the balance never gets stuck at zero. */
  topUps: number;
};

const INITIAL: TradeState = { draft: DEFAULT_DRAFT, position: null, history: [], topUps: 0 };

type TradeContextValue = TradeState & {
  ready: boolean;
  balance: number;
  /** Balance not held as margin by the open position: the most a new stake can be. */
  available: number;
  /** True when the balance is too low to open any trade; `refill` is then allowed. */
  broke: boolean;
  /** Why the current draft can't be placed, or null when it can. */
  blocker: string | null;
  lastClosed: ClosedTrade | null;
  /** Accepts a patch, or a function of the latest draft (for rapid wheel steps). */
  patchDraft: (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) => void;
  /** Opens the draft at `entry`. Returns false (and opens nothing) when the draft is blocked. */
  openPosition: (entry: number) => boolean;
  /** Tops the practice balance back up to the starting amount. Only works when broke. */
  refill: () => void;
  updateLimits: (limits: Pick<Position, "targetPct" | "stopPct">) => void;
  /** Closes `percent` (1-100) of the open position at `exit`, returns the receipt. */
  closePosition: (percent: number, exit: number, reason?: CloseReason) => ClosedTrade | null;
};

const TradeContext = createContext<TradeContextValue | null>(null);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [state, setState, ready] = useLocalStorageState<TradeState>("bump:trade", INITIAL);

  const patchDraft = useCallback(
    (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) =>
      setState((s) => ({ ...s, draft: { ...s.draft, ...(typeof patch === "function" ? patch(s.draft) : patch) } })),
    [setState],
  );

  const balance = round2(STARTING_BALANCE + state.topUps + state.history.reduce((sum, t) => sum + t.pnl, 0));
  const available = round2(Math.max(0, balance - (state.position?.margin ?? 0)));
  const broke = !state.position && balance < MIN_STAKE;
  const blocker = state.position
    ? "Close your trade first."
    : broke
      ? "Out of practice money. Refill to keep playing."
      : state.draft.margin < MIN_STAKE
        ? "Pick a stake first."
        : state.draft.margin > available
          ? `Your stake is more than your ${usd(available)} balance.`
          : null;

  const openPosition = useCallback(
    (entry: number) => {
      if (blocker) return false;
      sfx.open();
      setState((s) =>
        s.position
          ? s
          : { ...s, position: { ...s.draft, id: newId(), entry, openedAt: Date.now() } },
      );
      return true;
    },
    [blocker, setState],
  );

  const refill = useCallback(() => {
    if (!broke) return;
    setState((s) => ({ ...s, topUps: round2(s.topUps + STARTING_BALANCE - balance) }));
  }, [broke, balance, setState]);

  const updateLimits = useCallback(
    (limits: Pick<Position, "targetPct" | "stopPct">) =>
      setState((s) => (s.position ? { ...s, position: { ...s.position, ...limits } } : s)),
    [setState],
  );

  const closePosition = useCallback(
    (percent: number, exit: number, reason: CloseReason = "manual") => {
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
        // a practice trade can't lose more than its stake (a real exchange would liquidate it there)
        pnl: Math.max(-closedMargin, unrealizedPnl({ ...position, margin: closedMargin }, position.entry, exit)),
        closedAt: Date.now(),
        reason,
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
      balance,
      available,
      broke,
      blocker,
      lastClosed: state.history[0] ?? null,
      patchDraft,
      openPosition,
      refill,
      updateLimits,
      closePosition,
    }),
    [state, ready, balance, available, broke, blocker, patchDraft, openPosition, refill, updateLimits, closePosition],
  );

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}

export function useTrade() {
  const ctx = useContext(TradeContext);
  if (!ctx) throw new Error("useTrade must be used inside <TradeProvider>");
  return ctx;
}
