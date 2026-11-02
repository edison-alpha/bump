"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { roundPrice } from "@/lib/format";
import { makeSeries } from "@/lib/seeded";
import { MARKETS } from "./data";
import type { LiveMarket } from "./types";

/** One tick per second, so the chart's finest timeframe is 1s. */
export const TICK_MS = 1000;
/** One hour of ticks, the longest chart timeframe. */
export const MAX_TICKS = 3_600_000 / TICK_MS;
/** Points shown by sparklines. */
const SPARK_POINTS = 60;
/** Same size as a live tick (±0.05%) so the backfilled hour looks like the feed that follows it. */
const TICK_VOLATILITY = 0.0005;
/** Backfill drift per tick, toward the market's 24h direction. */
const TICK_TREND = 0.000004;

type Feed = {
  /** Ticks produced since the start of the backfill; gives every point a stable absolute index. */
  count: number;
  history: Record<string, number[]>;
};

const initialFeed = (): Feed => ({
  count: MAX_TICKS,
  history: Object.fromEntries(
    MARKETS.map((m) => [m.id, makeSeries(m.seed, m.basePrice, MAX_TICKS, TICK_VOLATILITY, m.change24h < 0 ? -TICK_TREND : TICK_TREND)]),
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
            const next = roundPrice(points[points.length - 1] * (1 + (Math.random() - 0.5) * TICK_VOLATILITY * 2));
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

/** Ceiling for the simulated move per point on very long timeframes (days, weeks, months). */
const MAX_POINT_VOLATILITY = 0.05;

/**
 * `points` prices of a market, one per `intervalMs` (the chart timeframe), ending on the latest price.
 * Samples sit on a fixed grid of absolute tick indexes so the line doesn't wobble as new ticks arrive.
 * The feed only keeps the last hour, so longer timeframes put simulated history in front of the live part,
 * ending exactly on its oldest sample. Swap that for real candles when the market feed has them.
 */
export function useSeries(id: string, intervalMs: number, points = 60): number[] {
  const { count, history } = useFeed();
  return useMemo(() => {
    const market = MARKETS.find((m) => m.id === id) ?? MARKETS[0];
    const all = history[market.id];
    const step = Math.max(1, Math.round(intervalMs / TICK_MS));

    // live part: every `step`-th tick on the absolute grid, oldest first, plus the latest price
    const live: number[] = [];
    const firstIndex = count - all.length;
    for (let i = 0; i < all.length; i++) if ((firstIndex + i) % step === 0) live.push(all[i]);
    if ((count - 1) % step !== 0) live.push(all[all.length - 1]);
    if (live.length >= points) return live.slice(-points);

    // older part: random walk sized for this interval, deterministic per market + timeframe
    const missing = points - live.length;
    const volatility = Math.min(MAX_POINT_VOLATILITY, TICK_VOLATILITY * Math.sqrt(step));
    const trend = (market.change24h < 0 ? -1 : 1) * volatility * 0.05;
    const older = makeSeries(market.seed * 7919 + step, live[0], missing + 1, volatility, trend);
    return [...older.slice(0, -1), ...live];
  }, [count, history, id, intervalMs, points]);
}
