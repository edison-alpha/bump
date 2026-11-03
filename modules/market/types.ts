export type Market = {
  id: string;
  symbol: string;
  name: string;
  basePrice: number;
  /** Sample 24h change in percent at the base price. */
  change24h: number;
  seed: number;
};

/**
 * `maxLeverage` is the market's own cap on dreamDEX (5x, 10x or 20x from its initial margin); the practice fallback
 * list uses 10x. `price` is the mark price when live, simulated otherwise.
 */
export type LiveMarket = Market & { price: number; change: number; series: number[]; maxLeverage: number };
