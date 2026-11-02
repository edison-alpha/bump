"use client";

import Link from "next/link";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { signedPct, signedUsd, usd } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { pnlOnMarginPct, priceMovePct, stopPrice, targetPrice, unrealizedPnl } from "../calc";
import { PositionChart } from "../components/position-chart";
import { SideChip } from "../components/trade-header";
import { useRequirePosition } from "../use-require-position";

function LiveChip() {
  return (
    <Chip tone="live" className="h-8 rounded-full px-3 text-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)]">
      <span className="size-2.5 rounded-full bg-mint shadow-[0_0_8px_#3fe0a6]" />
      Live
    </Chip>
  );
}

export function LivePositionScreen() {
  const position = useRequirePosition();
  const market = useMarket(position?.marketId ?? "btc");
  usePrimaryAction(position ? { label: "Close position", href: "/position/close" } : null);
  if (!position) return <Screen title="Your position">{null}</Screen>;

  const pnl = unrealizedPnl(position, position.entry, market.price);
  const tone = pnl >= 0 ? "text-mint" : "text-coral";

  return (
    <Screen title="Your position" right={<LiveChip />}>
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={market.symbol} size={42} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[17px] font-semibold">{market.name}</span>
            <SideChip side={position.side} />
            <Chip className="text-[13px]">{position.leverage}x</Chip>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-pop font-display text-[28px] leading-tight font-bold tabular-nums">{usd(market.price)}</span>
            <span className={cn("font-display text-[17px] font-semibold", tone)}>
              {signedPct(priceMovePct(position.side, position.entry, market.price), 1)}
            </span>
          </div>
        </div>
        <Link
          href="/position/limits"
          aria-label="Edit limits"
          className="gloss ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-b from-white to-[#f1e9da] text-navy-900 shadow-[inset_0_-3px_0_rgba(120,100,60,0.2),0_2px_6px_rgba(0,0,0,0.2)] active:translate-y-0.5"
        >
          <Icon name="settings" size={22} />
        </Link>
      </div>

      <PositionChart
        series={market.series}
        entry={position.entry}
        target={targetPrice(position.entry, position)}
        stop={stopPrice(position.entry, position)}
      />

      {/* closing is the console's action key (CLOSE), so the P&L card sits at the bottom of the LCD */}
      <Card className="relative mt-auto px-3 py-2">
        <p className="flex items-center text-[15px]">
          Unrealized profit
          <InfoTip text="Profit or loss if you closed right now, before funding and costs." />
        </p>
        <p className={cn("font-display text-[32px] leading-none font-bold tabular-nums", tone)}>{signedUsd(pnl)}</p>
        <p className={cn("mt-0.5 font-display text-[16px] leading-tight font-bold", tone)}>
          ({signedPct(pnlOnMarginPct(pnl, position.margin), 1)} on margin)
        </p>
        <p className="text-[12px] text-white/85">Before funding and costs.</p>
        <Mascot size={78} sparkles="right" className="absolute top-2 right-5" />
      </Card>
    </Screen>
  );
}
