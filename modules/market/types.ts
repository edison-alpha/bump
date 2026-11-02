export type Market = {
  id: string;
  symbol: string;
  name: string;
  basePrice: number;
  /** Sample 24h change in percent at the base price. */
  change24h: number;
  seed: number;
};

export type LiveMarket = Market & { price: number; change: number; series: number[] };
