"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { DialField } from "@/components/console/dial-field";
import { Screen } from "@/components/shell/screen";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { signedPct, signedUsd, usd } from "@/lib/format";
import { MAX_TICKS, TICK_MS, useMarket, useSeries } from "@/modules/market/price-provider";
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

const TIMEFRAMES = [
  { value: "1m", label: "1m", ago: "1 min ago", ms: 60_000 },
  { value: "5m", label: "5m", ago: "5 min ago", ms: 300_000 },
  { value: "15m", label: "15m", ago: "15 min ago", ms: 900_000 },
  { value: "1h", label: "1h", ago: "1 hour ago", ms: 3_600_000 },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

export function LivePositionScreen() {
  const position = useRequirePosition();
  const market = useMarket(position?.marketId ?? "btc");
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const frame = TIMEFRAMES.find((t) => t.value === timeframe) ?? TIMEFRAMES[0];
  const series = useSeries(market.id, Math.min(MAX_TICKS, frame.ms / TICK_MS));
  usePrimaryAction(position ? { label: "Close position", href: "/position/close" } : null);

  // wheel up = zoom out to a longer timeframe
  const stepTimeframe = (dir: 1 | -1) =>
    setTimeframe((tf) => {
      const i = TIMEFRAMES.findIndex((t) => t.value === tf);
      return TIMEFRAMES[Math.min(TIMEFRAMES.length - 1, Math.max(0, i + dir))].value;
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

      <DialField id="timeframe" label="Chart timeframe" onStep={stepTimeframe} quiet>
        <Segmented
          tone="group"
          label="Chart timeframe"
          options={TIMEFRAMES.map(({ value, label }) => ({ value, label }))}
          value={timeframe}
          onChange={setTimeframe}
        />
      </DialField>

      <PositionChart
        series={series}
        startLabel={frame.ago}
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
