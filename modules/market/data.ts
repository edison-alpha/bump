import type { Market } from "./types";

/** Practice markets: what guests and the offline fallback trade while dreamDEX's listing is not loaded. */
export const MARKETS: Market[] = [
  { id: "btc", symbol: "BTC", name: "Bitcoin", basePrice: 68240, change24h: 1.24, seed: 11 },
  { id: "eth", symbol: "ETH", name: "Ethereum", basePrice: 3245, change24h: 0.82, seed: 23 },
  { id: "sol", symbol: "SOL", name: "Solana", basePrice: 157, change24h: -0.36, seed: 37 },
  { id: "bnb", symbol: "BNB", name: "BNB", basePrice: 592, change24h: 0.54, seed: 41 },
  { id: "xrp", symbol: "XRP", name: "XRP", basePrice: 0.52, change24h: -0.71, seed: 53 },
];

/** Practice leverage cap, the highest of the old 1–10x choices. dreamDEX markets use their own caps. */
export const PRACTICE_MAX_LEVERAGE = 10;

/** Display names for dreamDEX symbols; a symbol missing here shows as itself. */
const NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  AVAX: "Avalanche",
  DOGE: "Dogecoin",
  LINK: "Chainlink",
  SUI: "Sui",
  XLM: "Stellar",
  NEAR: "NEAR Protocol",
  ZEC: "Zcash",
  TAO: "Bittensor",
  HYPE: "Hyperliquid",
  WLD: "Worldcoin",
  ZRO: "LayerZero",
  PUMP: "Pump.fun",
  VVV: "Venice",
  "1000PEPE": "Pepe",
};

export const coinName = (symbol: string) => NAMES[symbol.toUpperCase()] ?? symbol;

/** The biggest coins list first; the rest follow alphabetically. */
const FEATURED = ["BTC", "ETH", "SOL", "BNB", "XRP"];

export const bySymbolOrder = (a: string, b: string) => {
  const ia = FEATURED.indexOf(a.toUpperCase());
  const ib = FEATURED.indexOf(b.toUpperCase());
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b);
};
