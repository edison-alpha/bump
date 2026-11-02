"use client";

import Link from "next/link";
import { useState } from "react";
import { useDial, usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { signedPct, signedUsd, usd, usdPrice } from "@/lib/format";
import { useMarket, useSeries } from "@/modules/market/price-provider";
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

const S = 1000;
const MIN = 60 * S;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Chart timeframes as on TradingView: one point per interval, CHART_POINTS on screen. Picked with the wheel. */
const TIMEFRAMES = [
  { label: "1s", ms: S },
  { label: "5s", ms: 5 * S },
  { label: "15s", ms: 15 * S },
  { label: "30s", ms: 30 * S },
  { label: "1m", ms: MIN },
  { label: "3m", ms: 3 * MIN },
  { label: "5m", ms: 5 * MIN },
  { label: "15m", ms: 15 * MIN },
  { label: "30m", ms: 30 * MIN },
  { label: "1h", ms: HOUR },
  { label: "2h", ms: 2 * HOUR },
  { label: "4h", ms: 4 * HOUR },
  { label: "1D", ms: DAY },
  { label: "1W", ms: 7 * DAY },
  { label: "1M", ms: 30 * DAY },
] as const;
const CHART_POINTS = 60;

type Timeframe = (typeof TIMEFRAMES)[number]["label"];

/** How far back the chart's left edge is, e.g. "5 hours ago". */
function agoLabel(ms: number) {
  const units = [
    { ms: 365 * DAY, name: "year" },
    { ms: 30 * DAY, name: "month" },
    { ms: 7 * DAY, name: "week" },
    { ms: DAY, name: "day" },
    { ms: HOUR, name: "hour" },
    { ms: MIN, name: "min" },
  ];
  const unit = units.find((u) => ms >= u.ms) ?? units[units.length - 1];
  const n = Math.round(ms / unit.ms);
  return `${n} ${unit.name}${n > 1 && unit.name !== "min" ? "s" : ""} ago`;
}

export function LivePositionScreen() {
  const position = useRequirePosition();
  const market = useMarket(position?.marketId ?? "btc");
  const [timeframe, setTimeframe] = useState<Timeframe>("1s");
  const frame = TIMEFRAMES.find((t) => t.label === timeframe) ?? TIMEFRAMES[0];
  const series = useSeries(market.id, frame.ms, CHART_POINTS);
  usePrimaryAction(position ? { label: "Close position", href: "/position/close" } : null);

  // wheel up = zoom out to a longer timeframe
  const stepTimeframe = (dir: 1 | -1) =>
    setTimeframe((tf) => {
      const i = TIMEFRAMES.findIndex((t) => t.label === tf);
      return TIMEFRAMES[Math.min(TIMEFRAMES.length - 1, Math.max(0, i + dir))].label;
    });
  useDial("timeframe", {
    label: "Chart timeframe",
    onStep: stepTimeframe,
    readout: { tag: "CHART", value: frame.label, sub: agoLabel(frame.ms * CHART_POINTS).replace(" ago", "") },
  });
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
            <span className="text-pop font-display text-[28px] leading-tight font-bold tabular-nums">{usdPrice(market.price)}</span>
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
        series={series}
        startLabel={`${frame.label} · ${agoLabel(frame.ms * CHART_POINTS)}`}
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
