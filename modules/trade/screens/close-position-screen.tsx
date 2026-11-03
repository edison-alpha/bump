"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useConsole, usePrimaryAction } from "@/components/console/console-provider";
import { DialField } from "@/components/console/dial-field";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { StatRow } from "@/components/ui/stat-row";
import { round2, signedUsd, usd, usdPrice } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { positionSize, stepClosePct, unrealizedPnl } from "../calc";
import { KeyHint } from "../components/key-hint";
import { SideChip } from "../components/trade-header";
import { useTrade } from "../trade-provider";
import { useRequirePosition } from "../use-require-position";

const PERCENTS = [25, 50, 100] as const;

export function ClosePositionScreen() {
  const router = useRouter();
  const closing = useRef(false);
  const position = useRequirePosition(!closing.current);
  const { closePosition, previewClose, mode } = useTrade();
  const { flash } = useConsole();
  const market = useMarket(position?.marketId ?? "btc");
  const [percent, setPercent] = useState<number>(100);
  const [busy, setBusy] = useState(false);

  // on chain the exchange prices the close itself, funding and fees included
  const preview = useQuery({
    queryKey: ["bump", "chain", "preview", position?.id, percent],
    queryFn: () => previewClose(percent),
    enabled: mode === "chain" && !!position && !busy,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });

  const confirm = () => {
    if (busy) return;
    setBusy(true);
    closing.current = true;
    closePosition(percent, market.price)
      .then(() => router.replace("/position/closed"))
      .catch((error: Error) => {
        closing.current = false;
        setBusy(false);
        flash(error.message, "warn");
      });
  };
  usePrimaryAction(position ? { label: busy ? "Closing…" : `Close ${percent}%`, onPress: confirm, disabled: busy } : null);

  if (!position) return <Screen title="Close trade">{null}</Screen>;

  const estimate = round2(unrealizedPnl(position, position.entry, market.price) * (percent / 100));
  const exact = preview.data ?? null;
  const grossProfit = exact ?? estimate;

  return (
    <Screen title="Close trade">
      <div className="flex items-center gap-2.5">
        <CoinIcon symbol={market.symbol} size={40} />
        <span className="text-pop font-display text-[24px] font-bold">{market.name}</span>
        <SideChip side={position.side} />
      </div>

      <div className="flex items-end">
        <div className="flex-1">
          <p className="text-[14px]">Entry price</p>
          <p className="text-pop font-display text-[26px] leading-tight font-bold tabular-nums">{usdPrice(position.entry)}</p>
        </div>
        <div className="border-l border-white/25 pl-4">
          <p className="text-[14px]">Leverage</p>
          <p className="text-pop font-display text-[26px] leading-tight font-bold">{position.leverage}x</p>
        </div>
      </div>

      <Card className="grid grid-cols-2 px-3 py-2">
        <div className="border-r border-white/20">
          <p className="text-[13px]">Your stake</p>
          <p className="font-display text-[19px] font-bold tabular-nums">{usd(position.margin)}</p>
        </div>
        <div className="pl-3">
          <p className="text-[13px]">Amount traded</p>
          <p className="font-display text-[19px] font-bold tabular-nums">{usd(positionSize(position))}</p>
        </div>
      </Card>

      <DialField
        id="close-amount"
        label="Close amount"
        onStep={(dir) => setPercent((p) => stepClosePct(p, dir))}
        readout={{ tag: "CLOSE", value: `${percent}%`, sub: signedUsd(grossProfit), tone: grossProfit >= 0 ? "positive" : "negative" }}
        className="flex flex-col gap-1.5"
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
        <StatRow label="Price now" value={usdPrice(market.price)} />
        <StatRow
          label={
            <>
              {grossProfit >= 0 ? "You’d win" : "You’d lose"}
              <InfoTip text={exact !== null ? "What dreamDEX says you'd get after funding and fees. The fill can differ a little." : "If you closed at this price. The final number depends on the fill."} />
            </>
          }
          value={<span className="text-[20px]">{signedUsd(grossProfit)}</span>}
          tone={grossProfit >= 0 ? "positive" : "negative"}
        />
      </Card>

      <KeyHint action="close" />
      <div className="flex flex-col gap-2">
        <Button variant="danger" size="lg" className="rounded-[18px] text-[20px]" onClick={confirm} disabled={busy}>
          {busy ? "Closing…" : `Close ${percent}%`}
        </Button>
        <Button variant="light" size="lg" className="rounded-[18px] text-[20px] font-bold" onClick={() => router.back()}>
          Keep it running
        </Button>
      </div>
    </Screen>
  );
}
