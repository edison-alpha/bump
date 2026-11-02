"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { round2 } from "@/lib/format";
import { makeSeries } from "@/lib/seeded";
import { MARKETS } from "./data";
import type { LiveMarket } from "./types";

const TICK_MS = 2500;
const MAX_POINTS = 60;

type History = Record<string, number[]>;

const initialHistory = (): History =>
  Object.fromEntries(
    MARKETS.map((m) => [m.id, makeSeries(m.seed, m.basePrice, 40, m.change24h < 0 ? 0.003 : 0.004, m.change24h < 0 ? -0.0004 : 0.0004)]),
  );

const PriceContext = createContext<History | null>(null);

/**
 * Simulated live prices (random walk). Replace the interval with the real market feed
 * (WebSocket) later; consumers only see `history` so nothing else has to change.
 */
export function PriceProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<History>(initialHistory);

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([marketId, points]) => {
            const next = round2(points[points.length - 1] * (1 + (Math.random() - 0.5) * 0.0016));
            return [marketId, [...points, next].slice(-MAX_POINTS)];
          }),
        ),
      );
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return <PriceContext.Provider value={history}>{children}</PriceContext.Provider>;
}

function usePriceHistory() {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePrices must be used inside <PriceProvider>");
  return ctx;
}

export function useMarkets(): LiveMarket[] {
  const history = usePriceHistory();
  return useMemo(
    () =>
      MARKETS.map((m) => {
        const series = history[m.id];
        const price = series[series.length - 1];
        return { ...m, price, series, change: m.change24h + (price / m.basePrice - 1) * 100 };
      }),
    [history],
  );
}

export function useMarket(id: string): LiveMarket {
  const markets = useMarkets();
  return markets.find((m) => m.id === id) ?? markets[0];
}
