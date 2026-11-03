"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { round2, usd } from "@/lib/format";
import { useMarketMaxLeverage } from "@/lib/chain/markets";
import { useMarket } from "@/modules/market/price-provider";
import { newId } from "@/lib/id";
import { sfx } from "@/lib/sound";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { unrealizedPnl } from "./calc";
import { DEFAULT_DRAFT, MIN_STAKE, TradeContext, type TradeContextValue } from "./trade-context";
import type { CloseReason, ClosedTrade, Draft, Position } from "./types";

const STARTING_BALANCE = 1000;

type TradeState = {
  draft: Draft;
  position: Position | null;
  history: ClosedTrade[];
  /** Practice money added by refills, so the balance never gets stuck at zero. */
  topUps: number;
};

const INITIAL: TradeState = { draft: DEFAULT_DRAFT, position: null, history: [], topUps: 0 };

/** Guest play: practice money in localStorage, filled at the live price. Limits are watched by <LimitWatcher />. */
export function LocalTradeProvider({ children }: { children: ReactNode }) {
  const [state, setState, ready] = useLocalStorageState<TradeState>("bump:trade", INITIAL);

  const patchDraft = useCallback(
    (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) =>
      setState((s) => ({ ...s, draft: { ...s.draft, ...(typeof patch === "function" ? patch(s.draft) : patch) } })),
    [setState],
  );

  const balance = round2(STARTING_BALANCE + state.topUps + state.history.reduce((sum, t) => sum + t.pnl, 0));
  const available = round2(Math.max(0, balance - (state.position?.margin ?? 0)));
  const broke = !state.position && balance < MIN_STAKE;
  const maxLeverage = useMarketMaxLeverage(state.draft.marketId);
  const market = useMarket(state.draft.marketId);
  const positionMarket = useMarket(state.position?.marketId ?? state.draft.marketId);
  const blocker = state.position
    ? "Close your trade first."
    : broke
      ? "Out of practice money. Refill to keep playing."
      : state.draft.margin < MIN_STAKE
        ? "Pick a stake first."
        : state.draft.margin > available
          ? `Your stake is more than your ${usd(available)} balance.`
          : state.draft.leverage > maxLeverage
            ? `${state.draft.marketId.toUpperCase()} allows up to ${maxLeverage}x.`
            : market.priceStatus !== "live"
              ? "Waiting for a live dreamDEX price."
              : null;

  const openPosition = useCallback(
    async (entry: number) => {
      if (blocker || !Number.isFinite(entry) || entry <= 0) return false;
      sfx.open();
      setState((s) => (s.position ? s : { ...s, position: { ...s.draft, id: newId(), entry, openedAt: Date.now() } }));
      return true;
    },
    [blocker, setState],
  );

  const refill = useCallback(async () => {
    if (!broke) return;
    setState((s) => ({ ...s, topUps: round2(s.topUps + STARTING_BALANCE - balance) }));
  }, [broke, balance, setState]);

  const updateLimits = useCallback(
    async (limits: Pick<Position, "targetPct" | "stopPct">) => {
      setState((s) => (s.position ? { ...s, position: { ...s.position, ...limits } } : s));
      return true;
    },
    [setState],
  );

  const closePosition = useCallback(
    async (percent: number, exit: number, reason: CloseReason = "manual") => {
      const position = state.position;
      if (!position) return null;
      if (positionMarket.priceStatus !== "live" || !Number.isFinite(exit) || exit <= 0) throw new Error("Live dreamDEX price unavailable. Try again when the feed recovers.");
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
    [state.position, setState, positionMarket.priceStatus],
  );

  const previewClose = useCallback(async () => null, []);
  const dismissPending = useCallback(() => undefined, []);

  const value = useMemo<TradeContextValue>(
    () => ({
      mode: "practice",
      ...state,
      ready,
      balance,
      available,
      broke,
      blocker,
      maxLeverage,
      lastClosed: state.history[0] ?? null,
      pending: null,
      setup: null,
      refillLabel: `Refill to ${usd(STARTING_BALANCE)}`,
      patchDraft,
      openPosition,
      refill,
      withdraw: null,
      moveToAccount: null,
      updateLimits,
      closePosition,
      previewClose,
      dismissPending,
    }),
    [state, ready, balance, available, broke, blocker, maxLeverage, patchDraft, openPosition, refill, updateLimits, closePosition, previewClose, dismissPending],
  );

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}
