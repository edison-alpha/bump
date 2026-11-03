"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import type { MarketCandlesResponse, MarketPricesResponse } from "@/lib/api/types";
import { HIDEKI, maxLeverageX } from "@/lib/bump/dreamdex";
import { useChainMarkets, type ChainMarkets } from "@/lib/chain/markets";
import { bySymbolOrder, coinName, MARKETS, PRACTICE_MAX_LEVERAGE } from "./data";
import { pricesInWindow, priceStatus, validPrice, type MarkQuote, type PriceSample } from "./price-data";
import type { LiveMarket } from "./types";

const MARK_POLL_MS = 4000;
const MAX_SAMPLES = 3600;
const CANDLE_BUCKETS = [60, 300, 900, 3600, 14400, 86400] as const;
type Quote = MarkQuote & { symbol: string; change24h: number | null };
type Feed = { quotes: Record<string, Quote>; history: Record<string, PriceSample[]>; now: number; loading: boolean };
const PriceContext = createContext<Feed | null>(null);

/** The backend reads and validates dreamDEX marks once for all users. No local price simulations. */
export function PriceProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Feed["quotes"]>({});
  const [history, setHistory] = useState<Feed["history"]>({});
  const [now, setNow] = useState(Date.now);
  const marks = useQuery({
    queryKey: ["bump", "mark-prices", HIDEKI.chainId],
    queryFn: async () => {
      const result = await api<MarketPricesResponse>("/api/prices");
      if (result.source !== "dreamdex" || result.chainId !== HIDEKI.chainId || !Array.isArray(result.prices)) throw new ApiError("Unexpected market price source.", 502);
      return result;
    },
    refetchInterval: MARK_POLL_MS,
    staleTime: MARK_POLL_MS,
    retry: false,
  });

  useEffect(() => {
    if (!marks.data) return;
    const next: Feed["quotes"] = {};
    for (const quote of marks.data.prices) {
      const at = quote.updatedAt ?? 0;
      const price = quote.price ?? NaN;
      next[quote.id] = { symbol: quote.symbol, price, at, ok: quote.status === "live" && validPrice(price) && at > 0 && at <= Date.now() + 1000, change24h: quote.change24h };
    }
    setQuotes(next);
    setHistory((previous) => {
      const result = { ...previous };
      for (const [id, quote] of Object.entries(next)) {
        const points = previous[id] ?? [];
        // A cached response is the same observation, not another chart point.
        if (quote.ok && quote.at > (points.at(-1)?.at ?? 0)) result[id] = [...points, { at: quote.at, price: quote.price }].slice(-MAX_SAMPLES);
      }
      return result;
    });
  }, [marks.data, marks.dataUpdatedAt]);

  useEffect(() => {
    // Only expires stale observations; it never changes prices or generates chart points.
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <PriceContext.Provider value={{ quotes, history, now, loading: marks.isPending }}>{children}</PriceContext.Provider>;
}

function useFeed() {
  const feed = useContext(PriceContext);
  if (!feed) throw new Error("usePrices must be used inside <PriceProvider>");
  return feed;
}

export function usePricesLive() {
  return useMarkets().every((market) => market.priceStatus === "live");
}

function marketFor(id: string, rows: ChainMarkets | undefined, feed: Feed): LiveMarket {
  const row = rows?.[id];
  const quote = feed.quotes[id];
  const symbol = row?.baseSymbol ?? quote?.symbol ?? MARKETS.find((market) => market.id === id)?.symbol ?? id.toUpperCase();
  return {
    id, symbol, name: coinName(symbol), price: quote?.price ?? NaN,
    priceStatus: priceStatus(quote, feed.now, feed.loading),
    updatedAt: quote && validPrice(quote.price) ? quote.at : null,
    change: quote?.change24h ?? NaN,
    series: pricesInWindow(feed.history[id] ?? [], feed.now, 60_000, 60),
    maxLeverage: row ? maxLeverageX(row) : PRACTICE_MAX_LEVERAGE,
  };
}

export function useMarkets(): LiveMarket[] {
  const feed = useFeed();
  const { data: rows } = useChainMarkets();
  return useMemo(() => {
    const ids = rows && Object.keys(rows).length ? Object.keys(rows) : Object.keys(feed.quotes).length ? Object.keys(feed.quotes) : MARKETS.map((market) => market.id);
    return ids.map((id) => marketFor(id, rows, feed)).sort((a, b) => bySymbolOrder(a.symbol, b.symbol));
  }, [feed, rows]);
}

export function useMarket(id: string): LiveMarket {
  const feed = useFeed();
  const { data: rows } = useChainMarkets();
  return marketFor(id, rows, feed);
}

/** Actual mark observations or exchange trade candles. No interpolation, random walk, or history padding. */
export function useSeries(id: string, intervalMs: number, points = 60): number[] {
  const { history, quotes, now } = useFeed();
  const bucket = CANDLE_BUCKETS.find((value) => value * 1000 >= intervalMs) ?? 86400;
  const candles = useQuery({
    queryKey: ["bump", "candles", id, bucket, points],
    enabled: intervalMs >= 60_000,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const result = await api<MarketCandlesResponse>(`/api/markets/${encodeURIComponent(id)}/candles?bucket=${bucket}&limit=${points}`);
      if (result.source !== "dreamdex" || result.marketId !== id || result.bucket !== bucket || !Array.isArray(result.samples)) throw new ApiError("Unexpected chart source.", 502);
      return result.samples.filter((sample) => Number.isFinite(sample.at) && validPrice(sample.price)).sort((a, b) => a.at - b.at);
    },
  });
  if (intervalMs < 60_000) return pricesInWindow(history[id] ?? [], now, intervalMs, points);
  const samples = [...(candles.data?.length ? candles.data : history[id] ?? [])];
  const quote = quotes[id];
  if (quote && validPrice(quote.price) && quote.at > (samples.at(-1)?.at ?? 0)) samples.push(quote);
  return pricesInWindow(samples, now, intervalMs, points);
}
