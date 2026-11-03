import { isPerpMarket, type PerpMarket } from "@somnia-chain/markets-sdk";
import { useQuery } from "@tanstack/react-query";
import { bumpMarkets, maxLeverageX } from "@/lib/bump/dreamdex";
import { PRACTICE_MAX_LEVERAGE } from "@/modules/market/data";
import { exchange } from "./exchange";

/** Every dreamDEX perp bump can trade, keyed by bump id (the base symbol, lowercased). */
export type ChainMarkets = Record<string, PerpMarket>;

export const chainMarketsKey = ["bump", "chain", "markets"] as const;

/** dreamDEX perp rows (pool, grid, margin bank, stop registry). They change only when dreamDEX lists or retires a market. */
export function useChainMarkets() {
  return useQuery({
    queryKey: chainMarketsKey,
    queryFn: async (): Promise<ChainMarkets> => bumpMarkets((await exchange().client.listMarkets({ marketType: "PERP", limit: 200 })).filter(isPerpMarket)),
    staleTime: 10 * 60_000,
    retry: 3,
  });
}

/** The leverage cap for a market: its own on dreamDEX when the listing is loaded, the practice cap before that. */
export function useMarketMaxLeverage(marketId: string): number {
  const { data } = useChainMarkets();
  const row = data?.[marketId];
  return row ? maxLeverageX(row) : PRACTICE_MAX_LEVERAGE;
}
