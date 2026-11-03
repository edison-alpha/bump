import type { Market } from "./types";

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
  LIT: "Lighter",
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

/** Names only while the exchange listing loads. Prices always come from dreamDEX. */
export const MARKETS: Market[] = Object.entries(NAMES)
  .map(([symbol, name]) => ({ id: symbol.toLowerCase(), symbol, name }))
  .sort((a, b) => bySymbolOrder(a.symbol, b.symbol));
