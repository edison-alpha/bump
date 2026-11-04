import { isPerpMarket, type PerpMarket } from "@somnia-chain/markets-sdk";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { marketIdOf } from "@/lib/bump/dreamdex";
import { exchange } from "./exchange";

/** A stop armed on a position: a take-profit or a stop-loss, with the price that triggers it. */
export type ChainStop = { kind: "TP" | "SL"; trigger: number };

/** One perp position the account holds on dreamDEX, read from the chain. */
export type ChainPosition = {
  pool: string;
  symbol: string;
  /** bump's id for the market, or null when bump does not trade it. */
  marketId: string | null;
  side: "long" | "short";
  size: number;
  entry: number;
  /** The live mark, null when the oracle has no usable price. */
  mark: number | null;
  /** The leverage the account runs this position at. */
  leverage: number;
  stops: ChainStop[];
};

export const positionsKey = (account: string | undefined) => ["bump", "chain", "positions", account] as const;
const perpRowsKey = ["bump", "chain", "perp-rows"] as const;

/** Every dreamDEX perp row. They change only when dreamDEX lists or retires a market, so they are read once and kept. */
export function perpRows(queryClient: QueryClient): Promise<PerpMarket[]> {
  return queryClient.ensureQueryData({
    queryKey: perpRowsKey,
    staleTime: 10 * 60_000,
    queryFn: async () => (await exchange().client.listMarkets({ marketType: "PERP", limit: 200 })).filter(isPerpMarket),
  });
}

type Client = ReturnType<typeof exchange>["client"];

/** Reads the account's position on each of `rows` from the chain, which is the truth, and fills in mark, stops and leverage. */
export async function readPositions(client: Client, rows: readonly PerpMarket[], account: Address): Promise<ChainPosition[]> {
  const found = await Promise.all(
    rows.map(async (m): Promise<ChainPosition | null> => {
      try {
        const p = await client.getPerpPosition({ marginBank: m.marginBank as Address, account, pool: m.poolAddress as Address });
        if (p.size === 0n) return null;
        const long = p.size > 0n;
        const size = Number(formatUnits(long ? p.size : -p.size, m.baseDecimals));
        const entry = Number(formatUnits(p.avgEntryPrice, m.quoteDecimals));
        const [feed, pending, lev] = await Promise.all([
          client.getPerpFeedStatus(m.poolAddress as Address).catch(() => null),
          m.stopRegistry ? client.listPerpStopOrders({ account, pool: m.poolAddress as Address, status: ["PENDING"] }).catch(() => []) : Promise.resolve([]),
          client.getPerpLeverage({ marginBank: m.marginBank as Address, account, pool: m.poolAddress as Address }).catch(() => null),
        ]);
        const mark = feed && feed.markPriceOk && feed.markPrice > 0n ? Number(formatUnits(feed.markPrice, m.quoteDecimals)) : null;
        // a stop that fires above (operator 0) is the target of a long and the stop of a short; below (1) is the reverse
        const stops: ChainStop[] = pending
          .map((s): ChainStop => ({ kind: (s.triggerOperator === 0) === long ? "TP" : "SL", trigger: Number(formatUnits(BigInt(s.triggerPrice), m.quoteDecimals)) }))
          .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "TP" ? -1 : 1));
        const bps = Number((lev as unknown as { positionLeverageBps?: bigint | number } | null)?.positionLeverageBps ?? 0);
        return {
          pool: m.poolAddress,
          symbol: m.baseSymbol ?? "?",
          marketId: marketIdOf(m),
          side: long ? "long" : "short",
          size,
          entry,
          mark,
          leverage: Math.max(1, Math.round(bps / 10_000)),
          stops,
        };
      } catch {
        return null;
      }
    }),
  );
  return found.filter((p): p is ChainPosition => p !== null).sort((a, b) => b.size * b.entry - a.size * a.entry);
}

/** A full sweep of every market is the safety net; in between, one indexer request names the pools worth reading. */
const FULL_SWEEP_MS = 30_000;
const lastSweep = new Map<string, number>();

/**
 * The account's open positions, shared by everything that shows them (the Positions screen, the position screens, the
 * blocker), so one read serves all of them instead of each polling on its own.
 *
 * Like a trading app it asks for as little as it can: the indexer says which pools hold a position (one request) and only
 * those are read from the chain; a position the indexer has not seen yet is caught by a full sweep every 30 s. It polls
 * faster while something is open and slower while flat, and React Query pauses it while the tab is hidden. bump's own
 * actions invalidate it, so they show up at once.
 */
export function useChainPositions(account: Address | undefined, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: positionsKey(account),
    enabled: enabled && !!account,
    refetchInterval: (query) => (query.state.data?.length ? 8_000 : 20_000),
    queryFn: async (): Promise<ChainPosition[]> => {
      const { client } = exchange();
      const rows = await perpRows(queryClient);
      const key = (account as string).toLowerCase();
      const sweep = Date.now() - (lastSweep.get(key) ?? 0) >= FULL_SWEEP_MS;
      let pools: readonly PerpMarket[] = rows;
      if (sweep) {
        lastSweep.set(key, Date.now());
      } else {
        const indexed = await client.listPerpPositions(account as Address).catch(() => null);
        if (indexed) {
          const named = new Set(indexed.map((p) => p.pool.toLowerCase()));
          pools = rows.filter((r) => named.has(r.poolAddress.toLowerCase()));
        }
      }
      return readPositions(client, pools, account as Address);
    },
  });
}
