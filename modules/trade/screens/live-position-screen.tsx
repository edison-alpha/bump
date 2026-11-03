"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConsole, useDial, usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { cn } from "@/lib/cn";
import { signedPct, signedUsd, usdPrice } from "@/lib/format";
import { sfx } from "@/lib/sound";
import { useMarket, useSeries } from "@/modules/market/price-provider";
import { Coach, KeyName } from "@/modules/progress/components/coach";
import { pnlOnMarginPct, priceMovePct, stopPrice, targetPrice, targetProgress, unrealizedPnl } from "../calc";
import { KeyHint } from "../components/key-hint";
import { PositionChart } from "../components/position-chart";
import { SideChip } from "../components/trade-header";
import { useRequirePosition } from "../use-require-position";
import { haptic } from "@/lib/haptics";

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

/** A few chart timeframes, picked with the wheel: the live tick view plus three zoom levels. */
const TIMEFRAMES = [
  { label: "1s", ms: S },
  { label: "1m", ms: MIN },
  { label: "15m", ms: 15 * MIN },
  { label: "1h", ms: HOUR },
] as const;
const CHART_POINTS = 60;

type Timeframe = (typeof TIMEFRAMES)[number]["label"];

/** How far back the chart's left edge is, e.g. "60 min ago". */
function agoLabel(ms: number) {
  const hours = ms / HOUR;
  if (hours >= 1) return `${Math.round(hours)} hour${hours >= 2 ? "s" : ""} ago`;
  return `${Math.round(ms / MIN)} min ago`;
}

/** What the mascot says as the trade moves; `p` is -1 (stop) .. 1 (target). */
function mood(p: number) {
  if (p >= 0.7) return "So close to the target!";
  if (p >= 0.3) return "Looking good!";
  if (p > -0.3) return "Steady… let it work.";
  if (p > -0.7) return "Hang in there.";
  return "Near the stop! Close it or ride it?";
}

/** -1 / 0 / 1: past halfway to the stop, in between, past halfway to the target. Changes trigger a cue. */
const zoneOf = (p: number) => (p >= 0.5 ? 1 : p <= -0.5 ? -1 : 0);

export function LivePositionScreen() {
  const position = useRequirePosition();
  const market = useMarket(position?.marketId ?? "btc");
  const { flash } = useConsole();
  const [timeframe, setTimeframe] = useState<Timeframe>("1s");
  const frame = TIMEFRAMES.find((t) => t.label === timeframe) ?? TIMEFRAMES[0];
  const series = useSeries(market.id, frame.ms, CHART_POINTS);
  usePrimaryAction(position ? { label: "Close options", href: "/position/close" } : null);

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

  const progress = position ? targetProgress(position.side, position.entry, market.price, position.targetPct, position.stopPct) : 0;

  // a ping (and a buzz) when the trade passes halfway to its target, a warning halfway to its stop
  const zone = zoneOf(progress);
  const lastZone = useRef(zone);
  useEffect(() => {
    if (zone === lastZone.current) return;
    lastZone.current = zone;
    if (zone === 1) {
      sfx.ping();
      haptic([15, 60, 15]);
      flash("Halfway to your target!", "good");
    } else if (zone === -1) {
      sfx.warn();
      haptic(40);
      flash("Getting close to your stop.", "warn");
    }
  }, [zone, flash]);

  if (!position) return <Screen title="Your position">{null}</Screen>;

  const pnl = unrealizedPnl(position, position.entry, market.price);
  const tone = pnl >= 0 ? "text-mint" : "text-coral";

  return (
    <Screen title="Your position" right={<LiveChip />}>
      <Coach step={3} points={null}>
        You’re in! Price hits the green line = you win, the red line = the stop saves you. Or hold{" "}
        <KeyName tone="gold">BUMP</KeyName> to close anytime.
      </Coach>

      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={market.symbol} size={42} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[17px] font-semibold">{market.name}</span>
            <SideChip side={position.side} />
            <Chip className="text-[13px]">{position.leverage}x</Chip>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-pop font-display text-[26px] leading-tight font-bold tabular-nums">{usdPrice(market.price)}</span>
            <span className={cn("font-display text-[16px] font-semibold", tone)}>
              {signedPct(priceMovePct(position.side, position.entry, market.price), 1)}
            </span>
          </div>
        </div>
        <Link
          href="/position/limits"
          aria-label="Edit target and stop"
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

      <Card className="relative mt-1 flex items-center gap-2 px-3 py-2">
        <div className="flex-1">
          <p className="text-[14px]">Right now</p>
          <p className={cn("font-display text-[32px] leading-none font-bold tabular-nums", tone)}>{signedUsd(pnl)}</p>
          <p className={cn("mt-0.5 font-display text-[14px] leading-tight font-bold", tone)}>
            {signedPct(pnlOnMarginPct(pnl, position.margin), 1)} on your stake
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SpeechBubble tail="bottom-left" className="max-w-[140px] text-[12px]">
            {mood(progress)}
          </SpeechBubble>
          <Mascot size={64} sparkles={progress >= 0.3 ? "right" : undefined} bob={progress > -0.3} />
        </div>
      </Card>

      <KeyHint action="close" />
    </Screen>
  );
}
