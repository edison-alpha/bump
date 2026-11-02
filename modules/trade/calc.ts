import { round2 } from "@/lib/format";
import type { Side } from "./types";

type Plan = { side: Side; margin: number; leverage: number; targetPct: number; stopPct: number };

export const MARGIN_PRESETS = [10, 20, 50] as const;
export const LEVERAGE_OPTIONS = [1, 2, 3, 5] as const;
export const TARGET_PRESETS = [1, 2, 3, 5, 10] as const;
export const STOP_PRESETS = [0.5, 1, 2, 3, 5] as const;

const direction = (side: Side) => (side === "long" ? 1 : -1);

/* ---- wheel steps (one detent each) ---- */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** $1 per detent, 1..1000. */
export const stepMargin = (margin: number, dir: 1 | -1) => clamp(Math.round(margin) + dir, 1, 1000);

/** Next / previous entry of a fixed option list (leverage). */
export const stepOption = <T extends number>(options: readonly T[], value: T, dir: 1 | -1) => {
  const i = options.indexOf(value);
  return options[clamp((i < 0 ? 0 : i) + dir, 0, options.length - 1)];
};

/** 0.5% per detent within [min, max]. */
export const stepPct = (pct: number, dir: 1 | -1, min = 0.5, max = 20) => clamp(Math.round((pct + dir * 0.5) * 2) / 2, min, max);

/** Close amount: 5% per detent, 5..100. */
export const stepClosePct = (pct: number, dir: 1 | -1) => clamp(Math.round(pct / 5) * 5 + dir * 5, 5, 100);

export const positionSize = (p: Pick<Plan, "margin" | "leverage">) => p.margin * p.leverage;

/** Price at which the profit target triggers. */
export const targetPrice = (entry: number, p: Pick<Plan, "side" | "targetPct">) =>
  round2(entry * (1 + (direction(p.side) * p.targetPct) / 100));

/** Price at which the stop loss triggers. */
export const stopPrice = (entry: number, p: Pick<Plan, "side" | "stopPct">) =>
  round2(entry * (1 - (direction(p.side) * p.stopPct) / 100));

export const profitAtTarget = (p: Plan) => round2((positionSize(p) * p.targetPct) / 100);
export const lossAtStop = (p: Plan) => round2((positionSize(p) * p.stopPct) / 100);

/** Gross unrealized profit of an open position at `price`. */
export const unrealizedPnl = (
  p: Pick<Plan, "side" | "margin" | "leverage">,
  entry: number,
  price: number,
) => round2(positionSize(p) * (price / entry - 1) * direction(p.side));

export const pnlOnMarginPct = (pnl: number, margin: number) => (margin ? (pnl / margin) * 100 : 0);

export const priceMovePct = (side: Side, entry: number, price: number) =>
  (price / entry - 1) * 100 * direction(side);
