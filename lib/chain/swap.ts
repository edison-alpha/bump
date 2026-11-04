import type { Address } from "viem";

/** One spot order book on Hideki: a base token priced in a quote token. */
export type SpotPair = {
  symbol: string;
  base: string;
  quote: string;
  baseDecimals: number;
  quoteDecimals: number;
  baseToken: Address;
  quoteToken: Address;
  /** The base token is the chain's coin (STT), sent as value rather than approved. */
  baseIsNative: boolean;
  /** Decimals an order's base amount may carry (the lot size). */
  amountDp: number;
  /** Smallest base amount an order may carry. */
  minAmount: number;
};

/** The slice of the SDK's unified market row a swap reads; `info` is the raw indexer row. */
type MarketRow = { symbol: string; base: string; quote: string; precision?: { amount?: number }; limits?: { amount?: { min?: number } }; info?: unknown };

export function pairOf(market: MarketRow): SpotPair {
  const info = (market.info ?? {}) as { baseDecimals?: number; quoteDecimals?: number; baseToken?: Address; quoteToken?: Address; baseIsNative?: boolean };
  return {
    symbol: market.symbol,
    base: market.base,
    quote: market.quote,
    baseDecimals: info.baseDecimals ?? 18,
    quoteDecimals: info.quoteDecimals ?? 18,
    baseToken: (info.baseToken ?? "0x") as Address,
    quoteToken: (info.quoteToken ?? "0x") as Address,
    baseIsNative: !!info.baseIsNative,
    amountDp: market.precision?.amount ?? 2,
    minAmount: market.limits?.amount?.min ?? 0,
  };
}

/** A book level: [price in quote per base, size in base]. */
export type Level = readonly [number, number];

/** Rounds down to `dp` decimals (an order's amount must sit on the lot size). */
export const floorDp = (value: number, dp: number) => Math.floor(value * 10 ** dp + 1e-9) / 10 ** dp;

/** Selling `base` into the bids: what it brings in quote, and how much of it the book can absorb. */
export function sellInto(bids: readonly Level[], base: number): { out: number; filled: number } {
  let left = base;
  let out = 0;
  for (const [price, size] of bids) {
    if (left <= 0) break;
    const take = Math.min(left, size);
    out += take * price;
    left -= take;
  }
  return { out, filled: base - left };
}

/** Spending `quote` on the asks: how much base it buys, and how much of the quote the book can absorb. */
export function buyFrom(asks: readonly Level[], quote: number): { out: number; spent: number } {
  let left = quote;
  let out = 0;
  for (const [price, size] of asks) {
    if (left <= 0) break;
    const spend = Math.min(left, size * price);
    out += spend / price;
    left -= spend;
  }
  return { out, spent: quote - left };
}

/** A taker fee and the pool's escrow headroom: a buy never spends the last sliver of the balance. */
export const HEADROOM = 0.995;

export const TOKEN_LOGO: Record<string, string> = { STT: "/tokens/somnia.png", USDso: "/tokens/usdso.png" };
