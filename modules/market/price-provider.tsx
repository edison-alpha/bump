"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { humanPrice, maxLeverageX } from "@/lib/bump/dreamdex";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets, type ChainMarkets } from "@/lib/chain/markets";
import { roundPrice } from "@/lib/format";
import { makeSeries } from "@/lib/seeded";
import { bySymbolOrder, coinName, MARKETS, PRACTICE_MAX_LEVERAGE } from "./data";
import type { LiveMarket, Market } from "./types";

/** One tick per second, so the chart's finest timeframe is 1s. */
export const TICK_MS = 1000;
/** One hour of ticks, the longest chart timeframe kept in memory. */
export const MAX_TICKS = 3_600_000 / TICK_MS;
/** Points shown by sparklines. */
const SPARK_POINTS = 60;
/** Same size as a live tick (±0.05%) so the backfilled hour looks like the feed that follows it. */
const TICK_VOLATILITY = 0.0005;
/** Backfill drift per tick, toward the market's 24h direction. */
const TICK_TREND = 0.000004;
/** How often mark prices are read from dreamDEX. Ticks in between repeat the last mark. */
const MARK_POLL_MS = 4000;
/** dreamDEX candle sizes, in seconds. */
const CANDLE_BUCKETS = [60, 300, 900, 3600, 14400, 86400] as const;

type Feed = {
  /** Ticks produced since the start of the backfill; gives every point a stable absolute index. */
  count: number;
  history: Record<string, number[]>;
  /** Price 24h ago per market, once candles have loaded; the 24h change is measured from it. */
  base: Record<string, number>;
  /** True once real dreamDEX prices are flowing. Until then (or if dreamDEX is unreachable) prices are simulated. */
  live: boolean;
};

const initialFeed = (): Feed => ({
  count: MAX_TICKS,
  history: Object.fromEntries(
    MARKETS.map((m) => [m.id, makeSeries(m.seed, m.basePrice, MAX_TICKS, TICK_VOLATILITY, m.change24h < 0 ? -TICK_TREND : TICK_TREND)]),
  ),
  base: {},
  live: false,
});

type Candle = { bucketStart: string; openPrice: string; closePrice: string };
const byTime = (a: Candle, b: Candle) => Number(a.bucketStart) - Number(b.bucketStart);

/** The last hour as one price per second, interpolated open → close inside each 1-minute candle. */
function ticksFromMinutes(candles: Candle[], toHuman: (raw: string) => number): number[] | null {
  if (candles.length === 0) return null;
  const sorted = [...candles].sort(byTime).slice(-60);
  const ticks: number[] = [];
  for (const c of sorted) {
    const open = toHuman(c.openPrice);
    const close = toHuman(c.closePrice);
    for (let s = 0; s < 60; s++) ticks.push(roundPrice(open + ((close - open) * (s + 1)) / 60));
  }
  // an hour with gaps (thin testnet markets) is padded with its first price
  while (ticks.length < MAX_TICKS) ticks.unshift(ticks[0] as number);
  return ticks.slice(-MAX_TICKS);
}

const flat = (price: number) => Array.from({ length: MAX_TICKS }, () => price);

/** Marks (and, failing that, last fills) for every market, as human prices. */
async function readMarks(rows: ChainMarkets): Promise<Record<string, number>> {
  const client = exchange().client;
  const out: Record<string, number> = {};
  await Promise.all(
    Object.entries(rows).map(async ([id, m]) => {
      try {
        const state = await client.getPerpState(m.poolAddress);
        if (state.markPriceOk) {
          out[id] = roundPrice(humanPrice(state.markPrice, m));
          return;
        }
      } catch {
        // fall through to the last fill
      }
      if (m.lastPrice) out[id] = roundPrice(humanPrice(m.lastPrice, m));
    }),
  );
  return out;
}

const PriceContext = createContext<Feed | null>(null);

/**
 * Live dreamDEX prices for every listed perp: the mark price (what TP/SL triggers on) polled from the chain, the last hour
 * backfilled from 1-minute candles. Falls back to a simulated random walk on the practice markets while dreamDEX is
 * unreachable, so guests can always play. Consumers only see `history`, so screens never know which one they got.
 */
export function PriceProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<Feed>(initialFeed);
  const { data: rows } = useChainMarkets();
  const latest = useRef<Record<string, number>>({});
  const backfilled = useRef(new Set<string>());

  // every listed market gets a history at once, flat at its last fill, so the lists never wait on candles
  useEffect(() => {
    if (!rows) return;
    setFeed((prev) => {
      const history = { ...prev.history };
      let changed = false;
      for (const [id, m] of Object.entries(rows)) {
        if (history[id] || !m.lastPrice) continue;
        history[id] = flat(roundPrice(humanPrice(m.lastPrice, m)));
        changed = true;
      }
      return changed ? { ...prev, history } : prev;
    });
  }, [rows]);

  useEffect(() => {
    if (!rows) return;
    let stopped = false;
    const poll = async () => {
      const marks = await readMarks(rows);
      if (!stopped) Object.assign(latest.current, marks);
    };
    void poll();
    const id = setInterval(poll, MARK_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [rows]);

  // the last hour and the 24h reference from candles, once per market
  useEffect(() => {
    if (!rows) return;
    const todo = Object.entries(rows).filter(([id]) => !backfilled.current.has(id));
    if (todo.length === 0) return;
    for (const [id] of todo) backfilled.current.add(id);
    void (async () => {
      const client = exchange().client;
      const loaded = await Promise.all(
        todo.map(async ([id, m]) => {
          try {
            const [minutes, hours] = await Promise.all([client.getCandles(m.poolAddress, 60, { limit: 60 }), client.getCandles(m.poolAddress, 3600, { limit: 24 })]);
            const toHuman = (raw: string) => humanPrice(raw, m);
            const first = [...hours].sort(byTime)[0];
            return { id, ticks: ticksFromMinutes(minutes, toHuman), base: first ? toHuman(first.openPrice) : null };
          } catch {
            backfilled.current.delete(id);
            return null;
          }
        }),
      );
      setFeed((prev) => {
        const history = { ...prev.history };
        const base = { ...prev.base };
        for (const l of loaded) {
          if (!l) continue;
          if (l.ticks) history[l.id] = l.ticks;
          if (l.base) base[l.id] = l.base;
        }
        return { ...prev, history, base };
      });
    })();
  }, [rows]);

  useEffect(() => {
    const id = setInterval(() => {
      setFeed((prev) => {
        const marks = latest.current;
        const live = Object.keys(marks).length > 0;
        return {
          ...prev,
          live,
          count: prev.count + 1,
          history: Object.fromEntries(
            Object.entries(prev.history).map(([marketId, points]) => {
              const last = points[points.length - 1] as number;
              const next = marks[marketId] ?? (live ? last : roundPrice(last * (1 + (Math.random() - 0.5) * TICK_VOLATILITY * 2)));
              return [marketId, [...points.slice(1 - MAX_TICKS), next]];
            }),
          ),
        };
      });
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

/** True when prices come from dreamDEX, false while they are simulated. */
export const usePricesLive = () => useFeed().live;

const stringSeed = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Static facts about a market id: the practice entry when there is one, otherwise derived from the listing. */
function metaFor(id: string, rows: ChainMarkets | undefined, first: number): Market & { maxLeverage: number } {
  const row = rows?.[id];
  const practice = MARKETS.find((m) => m.id === id);
  const symbol = row?.baseSymbol ?? practice?.symbol ?? id.toUpperCase();
  return {
    id,
    symbol,
    name: coinName(symbol),
    basePrice: practice?.basePrice ?? first,
    change24h: practice?.change24h ?? 0,
    seed: practice?.seed ?? stringSeed(id),
    maxLeverage: row ? maxLeverageX(row) : PRACTICE_MAX_LEVERAGE,
  };
}

/** Every market the player can trade: dreamDEX's whole listing once loaded, the practice list before that. */
export function useMarkets(): LiveMarket[] {
  const { history, base } = useFeed();
  const { data: rows } = useChainMarkets();
  return useMemo(() => {
    const ids = rows ? Object.keys(rows).sort((a, b) => bySymbolOrder(rows[a]?.baseSymbol ?? a, rows[b]?.baseSymbol ?? b)) : MARKETS.map((m) => m.id);
    return ids
      .filter((id) => history[id])
      .map((id) => {
        const all = history[id] as number[];
        const price = all[all.length - 1] as number;
        const meta = metaFor(id, rows, all[0] as number);
        const dayAgo = base[id];
        const change = dayAgo ? (price / dayAgo - 1) * 100 : meta.change24h + (price / meta.basePrice - 1) * 100;
        return { ...meta, price, series: all.slice(-SPARK_POINTS), change };
      });
  }, [history, base, rows]);
}

export function useMarket(id: string): LiveMarket {
  const markets = useMarkets();
  return markets.find((m) => m.id === id) ?? (markets[0] as LiveMarket);
}

/** Ceiling for the simulated move per point on very long timeframes (days, weeks, months). */
const MAX_POINT_VOLATILITY = 0.05;

/**
 * `points` prices of a market, one per `intervalMs` (the chart timeframe), ending on the latest price.
 * Up to a minute per point it samples the in-memory ticks on a fixed grid of absolute indexes, so the line doesn't
 * wobble as new ticks arrive. Longer timeframes read dreamDEX candles of the nearest size; while those are missing,
 * simulated history sits in front of the live part, ending exactly on its oldest sample.
 */
export function useSeries(id: string, intervalMs: number, points = 60): number[] {
  const { count, history, live } = useFeed();
  const { data: rows } = useChainMarkets();
  const row = rows?.[id];
  const bucket = CANDLE_BUCKETS.find((b) => b * 1000 >= intervalMs) ?? 86400;
  const useCandles = intervalMs >= 60_000 && live && !!row;
  const candles = useQuery({
    queryKey: ["bump", "candles", id, bucket, points],
    queryFn: async () => {
      const r = row as NonNullable<typeof row>;
      const found = await exchange().client.getCandles(r.poolAddress, bucket, { limit: points });
      return [...found].sort(byTime).map((c) => humanPrice(c.closePrice, r));
    },
    enabled: useCandles,
    staleTime: Math.min(bucket * 500, 60_000),
    refetchInterval: Math.min(bucket * 1000, 60_000),
  });

  return useMemo(() => {
    const all = (history[id] ?? Object.values(history)[0]) as number[];
    const latestPrice = all[all.length - 1] as number;
    if (useCandles && candles.data && candles.data.length > 1) return [...candles.data.slice(1 - points), latestPrice];

    const step = Math.max(1, Math.round(intervalMs / TICK_MS));
    // live part: every `step`-th tick on the absolute grid, oldest first, plus the latest price
    const recent: number[] = [];
    const firstIndex = count - all.length;
    for (let i = 0; i < all.length; i++) if ((firstIndex + i) % step === 0) recent.push(all[i] as number);
    if ((count - 1) % step !== 0) recent.push(latestPrice);
    if (recent.length >= points) return recent.slice(-points);

    // older part: random walk sized for this interval, deterministic per market + timeframe
    const meta = metaFor(id, rows, all[0] as number);
    const missing = points - recent.length;
    const volatility = Math.min(MAX_POINT_VOLATILITY, TICK_VOLATILITY * Math.sqrt(step));
    const trend = (meta.change24h < 0 ? -1 : 1) * volatility * 0.05;
    const older = makeSeries(meta.seed * 7919 + step, recent[0] as number, missing + 1, volatility, trend);
    return [...older.slice(0, -1), ...recent];
  }, [count, history, id, intervalMs, points, useCandles, candles.data, rows]);
}
