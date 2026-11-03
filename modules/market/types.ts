export type Market = {
  id: string;
  symbol: string;
  name: string;
};

export type PriceStatus = "loading" | "live" | "stale" | "unavailable";

/** Missing prices/changes are NaN, never zero or a different asset's price. Check priceStatus before trading. */
export type LiveMarket = Market & {
  price: number;
  change: number;
  series: number[];
  maxLeverage: number;
  priceStatus: PriceStatus;
  updatedAt: number | null;
};
