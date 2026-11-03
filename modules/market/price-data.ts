export const PRICE_MAX_AGE_MS = 20_000;
export type PriceSample = { at: number; price: number };
export type MarkQuote = PriceSample & { ok: boolean };

export const validPrice = (value: number) => Number.isFinite(value) && value > 0;

export function priceStatus(quote: MarkQuote | undefined, now: number, loading: boolean) {
  if (!quote || !validPrice(quote.price)) return loading ? "loading" : "unavailable";
  return quote.ok && quote.at > 0 && quote.at <= now + 1000 && now - quote.at <= PRICE_MAX_AGE_MS ? "live" : "stale";
}

/** Keep actual observations in the requested window, without interpolating or padding gaps. */
export function pricesInWindow(samples: PriceSample[], now: number, intervalMs: number, points: number): number[] {
  return samples.filter((sample) => sample.at >= now - intervalMs * points && sample.at <= now && validPrice(sample.price)).slice(-points).map((sample) => sample.price);
}
