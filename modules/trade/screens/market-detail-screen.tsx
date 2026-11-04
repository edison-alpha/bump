"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUnits } from "viem";
import { useConsole, useDial, useSideKeys } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Segmented } from "@/components/ui/segmented";
import { StatRow } from "@/components/ui/stat-row";
import { cn } from "@/lib/cn";
import { humanPrice } from "@/lib/bump/dreamdex";
import { useChainMarkets } from "@/lib/chain/markets";
import { signedPct, usdPrice } from "@/lib/format";
import { useMarket, useSeries } from "@/modules/market/price-provider";
import { PriceNotice } from "@/modules/market/components/price-notice";
import { PriceChart } from "../components/price-chart";
import { useTrade } from "../trade-provider";
import type { Side } from "../types";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Chart timeframes: each point is one `ms` wide, 60 points per chart. */
const FRAMES = [
  { label: "1m", ms: MIN, span: "1 hour" },
  { label: "5m", ms: 5 * MIN, span: "5 hours" },
  { label: "15m", ms: 15 * MIN, span: "15 hours" },
  { label: "1h", ms: HOUR, span: "2.5 days" },
  { label: "4h", ms: 4 * HOUR, span: "10 days" },
  { label: "1D", ms: 24 * HOUR, span: "2 months" },
] as const;
type Frame = (typeof FRAMES)[number]["label"];

const POINTS = 60;

/** One market in full: price, a chart you can zoom, and the exchange's own limits for it. */
export function MarketDetailScreen({ marketId }: { marketId: string }) {
  const router = useRouter();
  const { patchDraft, position } = useTrade();
  const { flash } = useConsole();
  const market = useMarket(marketId);
  const { data: rows } = useChainMarkets();
  const row = rows?.[market.id];
  const [frame, setFrame] = useState<Frame>("15m");
  const active = FRAMES.find((f) => f.label === frame) ?? FRAMES[2];
  const series = useSeries(market.id, active.ms, POINTS);
  const up = market.change >= 0;

  const high = series.length > 1 ? Math.max(...series) : NaN;
  const low = series.length > 1 ? Math.min(...series) : NaN;
  const move = series.length > 1 ? ((series[series.length - 1] as number) / (series[0] as number) - 1) * 100 : NaN;

  const choose = (side: Side) => {
    // the keys are the only way to pick a direction, so they say why when they cannot
    if (position) return flash("Close your current trade first, then pick a direction.", "warn");
    if (market.priceStatus !== "live") return flash("Waiting for a live dreamDEX price.", "warn");
    patchDraft({ marketId: market.id, side });
    router.push("/trade/build");
  };
  useSideKeys({ selected: null, onPress: (key) => choose(key === "buy" ? "long" : "short") });
  useDial("timeframe", {
    label: "Chart timeframe",
    onStep: (dir) =>
      setFrame((current) => {
        const i = FRAMES.findIndex((f) => f.label === current);
        return (FRAMES[Math.min(FRAMES.length - 1, Math.max(0, i + dir))] as (typeof FRAMES)[number]).label;
      }),
    readout: { tag: "CHART", value: active.label, sub: active.span },
  });

  return (
    <Screen title={market.name} className="[&>*]:shrink-0">
      <PriceNotice market={market} />
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={market.symbol} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] leading-none font-bold tabular-nums">{usdPrice(market.price)}</p>
          <p className="text-[13px] text-white/80">{market.symbol} perpetual</p>
        </div>
        <span className={cn("font-display text-[18px] font-bold tabular-nums", up ? "text-mint" : "text-coral")}>{signedPct(market.change, 2)}</span>
      </div>

      <Card className="flex flex-col gap-2 px-2.5 py-2">
        <PriceChart series={series} />
        <Segmented
          label="Chart timeframe"
          size="md"
          options={FRAMES.map((f) => ({ value: f.label, label: f.label }))}
          value={frame}
          onChange={setFrame}
        />
        <p className="text-center text-[12px] text-white/70">
          Exchange history · up to {active.span}: <span className={cn("font-semibold", move >= 0 ? "text-mint" : "text-coral")}>{signedPct(move, 2)}</span>
        </p>
      </Card>

      <Card className="divide-y divide-white/10 px-3 py-0.5">
        <StatRow label="24h change (approx.)" value={signedPct(market.change, 2)} tone={up ? "positive" : "negative"} />
        <StatRow label={`High · ${active.span}`} value={usdPrice(high)} />
        <StatRow label={`Low · ${active.span}`} value={usdPrice(low)} />
        <StatRow label="Max leverage" value={`${market.maxLeverage}x`} />
        {row && <StatRow label="Price step" value={usdPrice(humanPrice(row.tickSize, row))} />}
        {row && <StatRow label="Smallest order" value={`${Number(formatUnits(BigInt(row.minQuantity), row.baseDecimals))} ${market.symbol}`} />}
      </Card>
    </Screen>
  );
}
