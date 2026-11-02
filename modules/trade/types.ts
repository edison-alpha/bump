export type Side = "long" | "short";

/** The plan being built on the Build/Review screens. Percentages are of position size. */
export type Draft = {
  marketId: string;
  side: Side;
  margin: number;
  leverage: number;
  targetPct: number;
  stopPct: number;
};

export type Position = {
  id: string;
  marketId: string;
  side: Side;
  entry: number;
  margin: number;
  leverage: number;
  targetPct: number;
  stopPct: number;
  openedAt: number;
};

export type ClosedTrade = {
  id: string;
  marketId: string;
  side: Side;
  leverage: number;
  margin: number;
  entry: number;
  exit: number;
  /** Gross profit, before funding and costs. */
  pnl: number;
  closedAt: number;
};
