"use client";

import { useQuery } from "@tanstack/react-query";
import type { BridgeSide } from "@/lib/chain/bridge";
import { exchangeOn } from "@/lib/chain/exchange";
import { pairOf, type SpotPair } from "@/lib/chain/swap";

/** Every spot pair on one chain, read off the chain's own market list. Shared by Swap and Send (which lists the tokens). */
export function useSpotPairs(chain: BridgeSide) {
  return useQuery({
    queryKey: ["bump", "swap", "pairs", chain],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SpotPair[]> => {
      const ex = exchangeOn(chain);
      await ex.loadMarkets();
      return Object.values(ex.markets)
        .filter((m) => m.type === "spot")
        .map(pairOf);
    },
  });
}
