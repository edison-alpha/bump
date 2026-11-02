import { CoinIcon } from "@/components/ui/coin-icon";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { shortDate, signedUsd } from "@/lib/format";
import { MARKETS } from "@/modules/market/data";
import type { ClosedTrade } from "../types";

export function TradeHistoryItem({ trade }: { trade: ClosedTrade }) {
  const symbol = MARKETS.find((m) => m.id === trade.marketId)?.symbol ?? trade.marketId.toUpperCase();
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <CoinIcon symbol={symbol} size={32} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] leading-tight font-semibold">
          {symbol}
          <span className="ml-3 font-sans text-[13px] font-semibold">Closed</span>
        </p>
        <p className="text-[12px] text-white/85">
          {trade.side === "long" ? "Long" : "Short"} · {trade.leverage}x · {shortDate(trade.closedAt)}
        </p>
      </div>
      <span className={cn("font-display text-[16px] font-bold tabular-nums", trade.pnl >= 0 ? "text-mint" : "text-coral")}>
        {signedUsd(trade.pnl)}
      </span>
      <Icon name="chevron" size={20} className="text-white" />
    </li>
  );
}
