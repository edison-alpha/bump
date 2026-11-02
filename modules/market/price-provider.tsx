"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { round2 } from "@/lib/format";
import { makeSeries } from "@/lib/seeded";
import { MARKETS } from "./data";
import type { LiveMarket } from "./types";

export const TICK_MS = 2500;
/** One hour of ticks, the longest chart timeframe. */
export const MAX_TICKS = 3_600_000 / TICK_MS;
/** Points shown by sparklines. */
const SPARK_POINTS = 60;
/** Same size as a live tick (±0.08%) so the backfilled hour looks like the feed that follows it. */
const TICK_VOLATILITY = 0.0008;

type Feed = {
  /** Ticks produced since the start of the backfill; gives every point a stable absolute index. */
  count: number;
  history: Record<string, number[]>;
};

const initialFeed = (): Feed => ({
  count: MAX_TICKS,
  history: Object.fromEntries(
    MARKETS.map((m) => [m.id, makeSeries(m.seed, m.basePrice, MAX_TICKS, TICK_VOLATILITY, m.change24h < 0 ? -0.00001 : 0.00001)]),
  ),
});

const PriceContext = createContext<Feed | null>(null);

/**
 * Simulated live prices (random walk). Replace the interval with the real market feed
 * (WebSocket) later; consumers only see `history` so nothing else has to change.
 */
export function PriceProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<Feed>(initialFeed);

  useEffect(() => {
    const id = setInterval(() => {
      setFeed((prev) => ({
        count: prev.count + 1,
        history: Object.fromEntries(
          Object.entries(prev.history).map(([marketId, points]) => {
            const next = round2(points[points.length - 1] * (1 + (Math.random() - 0.5) * 0.0016));
            return [marketId, [...points.slice(1 - MAX_TICKS), next]];
          }),
        ),
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return <PriceContext.Provider value={feed}>{children}</PriceContext.Provider>;
}

function useFeed() {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePrices must be used inside <PriceProvider>");
  return ctx;
}

export function useMarkets(): LiveMarket[] {
  const { history } = useFeed();
  return useMemo(
    () =>
      MARKETS.map((m) => {
        const all = history[m.id];
        const price = all[all.length - 1];
        return { ...m, price, series: all.slice(-SPARK_POINTS), change: m.change24h + (price / m.basePrice - 1) * 100 };
      }),
    [history],
  );
}

export function useMarket(id: string): LiveMarket {
  const markets = useMarkets();
  return markets.find((m) => m.id === id) ?? markets[0];
}

/**
 * The last `ticks` prices of a market, thinned to about `points` for long timeframes. Samples sit on a
 * fixed grid of absolute tick indexes so the line doesn't wobble as new ticks arrive; the latest price
 * is always the last point.
 */
export function useSeries(id: string, ticks: number, points = 60): number[] {
  const { count, history } = useFeed();
  return useMemo(() => {
    const all = history[id] ?? history[MARKETS[0].id];
    const recent = all.slice(-ticks);
    const step = Math.max(1, Math.ceil(recent.length / points));
    const firstIndex = count - recent.length;
    const out = recent.filter((_, i) => (firstIndex + i) % step === 0);
    if ((count - 1) % step !== 0) out.push(recent[recent.length - 1]);
    return out;
  }, [count, history, id, ticks, points]);
}
