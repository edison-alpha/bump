import type { LiveMarket } from "../types";

export function priceStatusLabel(market: LiveMarket) {
  return { loading: "Loading price", live: "Live mark", stale: "Last known price", unavailable: "Feed unavailable" }[market.priceStatus];
}

export function PriceNotice({ market }: { market: LiveMarket }) {
  return <p role="status" className="shrink-0 text-[12px] text-white/75">dreamDEX testnet · {priceStatusLabel(market)}{market.priceStatus === "stale" && ". Waiting for a fresh mark."}</p>;
}
