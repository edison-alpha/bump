import type { Market } from "./types";

export const MARKETS: Market[] = [
  { id: "btc", symbol: "BTC", name: "Bitcoin", basePrice: 68240, change24h: 1.24, seed: 11 },
  { id: "eth", symbol: "ETH", name: "Ethereum", basePrice: 3245, change24h: 0.82, seed: 23 },
  { id: "sol", symbol: "SOL", name: "Solana", basePrice: 157, change24h: -0.36, seed: 37 },
  { id: "bnb", symbol: "BNB", name: "BNB", basePrice: 592, change24h: 0.54, seed: 41 },
  { id: "xrp", symbol: "XRP", name: "XRP", basePrice: 0.52, change24h: -0.71, seed: 53 },
];
