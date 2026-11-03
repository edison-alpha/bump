"use client";

import { createContext, useContext } from "react";
import type { CloseReason, ClosedTrade, Draft, Position } from "./types";

/** Smallest stake; below it the player can't open anything and is offered a refill. */
export const MIN_STAKE = 1;

/** Starts on the Chill style (2x, +1% / -0.5%) with a stake big enough for the result to feel like something. */
export const DEFAULT_DRAFT: Draft = { marketId: "btc", side: "long", margin: 50, leverage: 2, targetPct: 1, stopPct: 0.5 };

/**
 * Where an on-chain action is: the wallet signs and the order fills in one call ("fill"), bump-backend checks the
 * receipt and logs it ("log"), then the TP/SL pair is armed ("stops"). Practice trades never set this.
 */
export type TradeStep = "fill" | "log" | "stops" | "done";

export type PendingTrade = {
  kind: "open" | "close" | "limits" | "refill";
  step: TradeStep;
  txHash: string | null;
  /** Set when the action stopped: what to tell the player. */
  error: string | null;
  /** Set when the action succeeded with a caveat (the trade opened but its TP/SL did not arm). */
  warning: string | null;
};

/** What a member still needs before trading on chain. Null in practice mode. */
export type ChainSetup = {
  /** The sign-in wallet: signs and pays gas, so STT goes here. */
  address: string;
  /** Where the balance and positions live: the linked dreamDEX smart account, or the wallet itself. USDso goes here. */
  account: string;
  /** Trading through a linked dreamDEX smart account. */
  linked: boolean;
  /** STT in the wallet, for gas and the TP/SL trigger fee. */
  gas: number;
  gasNeeded: number;
  /** Prices and the wallet are connected; false while either is still loading. */
  connected: boolean;
};

export type TradeContextValue = {
  /** "practice": local play money (guests). "chain": dreamDEX on Somnia Tokyo (Hideki), signed by the member's wallet. */
  mode: "practice" | "chain";
  draft: Draft;
  position: Position | null;
  history: ClosedTrade[];
  ready: boolean;
  balance: number;
  /** Balance not held as margin by the open position: the most a new stake can be. */
  available: number;
  /** True when the balance is too low to open any trade; `refill` is then allowed. */
  broke: boolean;
  /** Why the current draft can't be placed, or null when it can. */
  blocker: string | null;
  /** Most leverage the draft's market allows this player (its own cap, lowered for a voucher account). */
  maxLeverage: number;
  lastClosed: ClosedTrade | null;
  pending: PendingTrade | null;
  setup: ChainSetup | null;
  /** Label of the refill action ("Refill to $1,000" / "Add USDso to trade"). */
  refillLabel: string;
  /** Accepts a patch, or a function of the latest draft (for rapid wheel steps). */
  patchDraft: (patch: Partial<Draft> | ((draft: Draft) => Partial<Draft>)) => void;
  /** Opens the draft at about `entry`. Resolves false (and opens nothing) when blocked or rejected. */
  openPosition: (entry: number) => Promise<boolean>;
  /** Practice: tops the balance back up. Chain: re-reads the balance and says where to send USDso. Only when broke. */
  refill: () => Promise<void>;
  /** Chain: moves free USDso out of the margin account (decimal string). Null in practice mode. */
  withdraw: ((amount: string) => Promise<void>) | null;
  updateLimits: (limits: Pick<Position, "targetPct" | "stopPct">) => Promise<boolean>;
  /** Closes `percent` (1-100) of the open position at about `exit`, resolves the receipt. */
  closePosition: (percent: number, exit: number, reason?: CloseReason) => Promise<ClosedTrade | null>;
  /** What closing `percent` would pay after funding and fees, from the exchange. Null when only an estimate exists. */
  previewClose: (percent: number) => Promise<number | null>;
  dismissPending: () => void;
};

export const TradeContext = createContext<TradeContextValue | null>(null);

export function useTrade() {
  const ctx = useContext(TradeContext);
  if (!ctx) throw new Error("useTrade must be used inside <TradeProvider>");
  return ctx;
}
