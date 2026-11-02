import { Sparkline } from "@/components/ui/sparkline";
import { CoinIcon } from "@/components/ui/coin-icon";
import { cn } from "@/lib/cn";
import { signedPct, usd, usdPrice } from "@/lib/format";
import type { LiveMarket } from "../types";

type MarketRowProps = {
  market: LiveMarket;
  /**
   * compact: Home list (small name, price below, change pill).
   * picker: Pick market list (big name + symbol, price + change on the right).
   */
  variant?: "compact" | "picker";
  selected?: boolean;
  onSelect?: () => void;
};

export function MarketRow({ market, variant = "picker", selected = false, onSelect }: MarketRowProps) {
  const up = market.change >= 0;
  const Tag = onSelect ? "button" : "div";
  const interactive = onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {};

  if (variant === "compact") {
    return (
      <Tag {...interactive} className="glass flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-1.5 text-left">
        <CoinIcon symbol={market.symbol} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] leading-tight font-semibold">{market.name}</span>
          <span className="block font-display text-[16px] leading-tight font-bold tabular-nums">{usdPrice(market.price)}</span>
        </span>
        <Sparkline data={market.series} className="h-7 w-[68px]" />
        <span
          className={cn(
            "gloss min-w-[56px] rounded-[9px] px-2 py-1 text-center font-display text-[14px] font-bold tabular-nums text-white",
            up ? "bg-linear-to-b from-[#1f9a68] to-[#11734c]" : "bg-linear-to-b from-[#e2475f] to-[#b62a41]",
          )}
        >
          {signedPct(market.change, 1)}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      {...interactive}
      className={cn(
        "glass flex w-full items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left",
        selected && "border-2 border-cyan shadow-[0_0_0_1px_rgba(76,201,255,0.4),0_0_18px_rgba(76,201,255,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]",
      )}
    >
      <CoinIcon symbol={market.symbol} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] leading-tight font-semibold">{market.name}</span>
        <span className="block text-[14px] text-white/85">{market.symbol}</span>
      </span>
      <Sparkline data={market.series} className="h-8 w-[70px]" />
      <span className="text-right">
        <span className="block font-display text-[15px] font-semibold tabular-nums">{usdPrice(market.price)}</span>
        <span className={cn("block font-display text-[15px] font-bold tabular-nums", up ? "text-mint" : "text-coral")}>
          {signedPct(market.change)}
        </span>
      </span>
    </Tag>
  );
}
