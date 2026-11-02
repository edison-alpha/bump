"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { DialField } from "@/components/console/dial-field";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { StatRow } from "@/components/ui/stat-row";
import { round2, signedUsd, usd } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { positionSize, stepClosePct, unrealizedPnl } from "../calc";
import { SideChip } from "../components/trade-header";
import { useTrade } from "../trade-provider";
import { useRequirePosition } from "../use-require-position";

const PERCENTS = [25, 50, 100] as const;

export function ClosePositionScreen() {
  const router = useRouter();
  const closing = useRef(false);
  const position = useRequirePosition(!closing.current);
  const { closePosition } = useTrade();
  const market = useMarket(position?.marketId ?? "btc");
  const [percent, setPercent] = useState<number>(100);

  const confirm = () => {
    closing.current = true;
    closePosition(percent, market.price);
    router.replace("/position/closed");
  };
  usePrimaryAction(position ? { label: `Close ${percent}%`, onPress: confirm } : null);

  if (!position) return <Screen title="Close Position">{null}</Screen>;

  const grossProfit = round2(unrealizedPnl(position, position.entry, market.price) * (percent / 100));

  return (
    <Screen title="Close Position">
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={market.symbol} size={40} />
        <span className="text-pop font-display text-[24px] font-bold">{market.name}</span>
        <SideChip side={position.side} />
      </div>

      <div className="flex items-end">
        <div className="flex-1">
          <p className="text-[14px]">Entry price</p>
          <p className="text-pop font-display text-[26px] leading-tight font-bold tabular-nums">{usd(position.entry)}</p>
        </div>
        <div className="border-l border-white/25 pl-4">
          <p className="text-[14px]">Leverage</p>
          <p className="text-pop font-display text-[26px] leading-tight font-bold">{position.leverage}x</p>
        </div>
      </div>

      <Card className="grid grid-cols-2 px-3 py-2">
        <div className="border-r border-white/20">
          <p className="text-[13px]">Practice margin</p>
          <p className="font-display text-[19px] font-bold tabular-nums">{usd(position.margin)}</p>
        </div>
        <div className="pl-3">
          <p className="text-[13px]">Position size</p>
          <p className="font-display text-[19px] font-bold tabular-nums">{usd(positionSize(position))}</p>
        </div>
      </Card>

      <DialField
        id="close-amount"
        label="Close amount"
        onStep={(dir) => setPercent((p) => stepClosePct(p, dir))}
        className="-mx-1 flex flex-col gap-1.5 p-1"
      >
        <h2 className="flex items-baseline justify-between font-display text-[16px] font-semibold">
          Close amount
          <span className="text-[15px] text-cyan tabular-nums">{percent}%</span>
        </h2>
        <Segmented
          size="lg"
          label="Close amount"
          options={PERCENTS.map((p) => ({ value: p, label: `${p}%` }))}
          value={percent}
          onChange={setPercent}
        />
      </DialField>

      <Card className="divide-y divide-white/15 px-3">
        <StatRow label="Estimated exit price" value={usd(market.price)} />
        <StatRow
          label={
            <>
              Estimated gross profit
              <InfoTip text="Profit before funding and costs. The final result depends on the fill." />
            </>
          }
          value={<span className="text-[20px]">{signedUsd(grossProfit)}</span>}
          tone={grossProfit >= 0 ? "positive" : "negative"}
        />
      </Card>
      <p className="text-center text-[12px] text-white/90">Final result depends on fill and costs.</p>

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="danger" size="lg" className="rounded-[18px] text-[20px]" onClick={confirm}>
          Close trade
        </Button>
        <Button variant="light" size="lg" className="rounded-[18px] text-[20px] font-bold" onClick={() => router.back()}>
          Keep open
        </Button>
      </div>
    </Screen>
  );
}
