import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Sparkline } from "@/components/ui/sparkline";
import { signedPct, usd, usdPrice } from "@/lib/format";
import type { LiveMarket } from "@/modules/market/types";
import type { Side } from "../types";

type TradeHeaderProps = { market: LiveMarket; side: Side; leverage: number };

/** Market summary card at the top of Build / Review. */
export function TradeHeader({ market, side, leverage }: TradeHeaderProps) {
  const up = market.change >= 0;
  return (
    <Card className="flex shrink-0 items-center gap-2.5 px-2.5 py-2">
      <CoinIcon symbol={market.symbol} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[17px] font-semibold">{market.name}</span>
          <SideChip side={side} />
          <Chip className="text-[13px]">{leverage}x</Chip>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[16px] font-semibold tabular-nums">{usdPrice(market.price)}</span>
          <span className={up ? "font-display text-[13px] font-semibold text-mint" : "font-display text-[13px] font-semibold text-coral"}>
            {signedPct(market.change)}
          </span>
        </div>
      </div>
      <Sparkline data={market.series} className="h-8 w-[64px]" />
    </Card>
  );
}

export function SideChip({ side }: { side: Side }) {
  return (
    <Chip tone={side === "long" ? "long" : "short"} className="text-[13px]">
      {side === "long" ? "Long" : "Short"}
    </Chip>
  );
}
