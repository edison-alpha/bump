"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { usePrimaryAction, useSideKeys } from "@/components/console/console-provider";
import { DialField } from "@/components/console/dial-field";
import { Screen } from "@/components/shell/screen";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { signedUsd, usd } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import {
  LEVERAGE_OPTIONS,
  lossAtStop,
  MARGIN_PRESETS,
  positionSize,
  profitAtTarget,
  stepMargin,
  stepOption,
  stepPct,
  stopPrice,
  targetPrice,
} from "../calc";
import { KeyHint } from "../components/key-hint";
import { LimitRow, stopReadout, targetReadout } from "../components/limit-row";
import { TradeHeader } from "../components/trade-header";
import { useTrade } from "../trade-provider";

type Leverage = (typeof LEVERAGE_OPTIONS)[number];

export function BuildTradeScreen() {
  const router = useRouter();
  const { draft, patchDraft } = useTrade();
  const market = useMarket(draft.marketId);
  const isPreset = (MARGIN_PRESETS as readonly number[]).includes(draft.margin);
  const marginRef = useRef<HTMLInputElement>(null);
  const [marginText, setMarginText] = useState<string | null>(null);
  usePrimaryAction({ label: "Review trade", href: "/trade/review", disabled: draft.margin <= 0 });
  // the other side's key flips the direction; the picked side's key goes on to Review
  useSideKeys({
    selected: draft.side === "long" ? "buy" : "sell",
    onPress: (key) => {
      const side = key === "buy" ? "long" : "short";
      if (side !== draft.side) patchDraft({ side });
      else if (draft.margin > 0) router.push("/trade/review");
    },
  });

  return (
    <Screen title="Build trade">
      <TradeHeader market={market} side={draft.side} leverage={draft.leverage} />

      <h2 className="text-pop font-display text-[24px] leading-none font-bold">Set your plan.</h2>

      <DialField
        id="margin"
        label="Practice margin"
        onStep={(dir) => {
          setMarginText(null); // show the dialled value even while the field has focus
          patchDraft((d) => ({ margin: stepMargin(d.margin, dir) }));
        }}
        readout={{ tag: "MARGIN", value: usd(draft.margin) }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center text-[15px]">
            Practice margin
            <InfoTip text="The practice money you put into this trade. It is the most you can lose." />
          </span>
          <label className="recess flex h-9 w-[132px] items-center justify-center rounded-[10px] font-display text-[19px] font-bold tabular-nums">
            <span>$</span>
            <input
              ref={marginRef}
              inputMode="decimal"
              aria-label="Practice margin in dollars"
              value={marginText ?? draft.margin.toFixed(2)}
              onFocus={(e) => {
                setMarginText(String(draft.margin));
                requestAnimationFrame(() => e.target.select());
              }}
              onBlur={() => setMarginText(null)}
              onChange={(e) => {
                const text = e.target.value.replace(/[^0-9.]/g, "");
                const n = Number(text);
                setMarginText(text);
                patchDraft({ margin: Number.isFinite(n) ? Math.min(n, 1000) : 0 });
              }}
              className="w-[5.5ch] bg-transparent text-center outline-none"
            />
          </label>
        </div>
        <Segmented
          label="Margin presets"
          options={[...MARGIN_PRESETS.map((v) => ({ value: v, label: `$${v}` })), { value: -1, label: "Custom" }]}
          value={isPreset ? draft.margin : -1}
          onChange={(v) => (v > 0 ? patchDraft({ margin: v }) : marginRef.current?.focus())}
        />
      </DialField>

      <DialField
        id="leverage"
        label="Leverage"
        onStep={(dir) => patchDraft((d) => ({ leverage: stepOption(LEVERAGE_OPTIONS, d.leverage as Leverage, dir) }))}
        readout={{ tag: "LEV", value: `${draft.leverage}x` }}
        className="flex flex-col gap-1.5"
      >
        <span className="flex items-center text-[15px]">
          Leverage
          <InfoTip text="Leverage multiplies your position size, and your gains and losses with it." />
          <span className="ml-auto text-[12px] text-white/70">Magnifies gains and losses</span>
        </span>
        <Segmented
          tone="group"
          label="Leverage"
          options={LEVERAGE_OPTIONS.map((v) => ({ value: v, label: `${v}x` }))}
          value={draft.leverage}
          onChange={(leverage) => patchDraft({ leverage })}
        />
      </DialField>

      <DialField
        id="target"
        label="Profit target"
        onStep={(dir) => patchDraft((d) => ({ targetPct: stepPct(d.targetPct, dir) }))}
        readout={targetReadout(draft.targetPct, targetPrice(market.price, draft))}
      >
        <LimitRow kind="target" value={draft.targetPct} onChange={(targetPct) => patchDraft({ targetPct })} />
      </DialField>
      <DialField
        id="stop"
        label="Stop loss"
        onStep={(dir) => patchDraft((d) => ({ stopPct: stepPct(d.stopPct, dir, 0.5, 10) }))}
        readout={stopReadout(draft.stopPct, stopPrice(market.price, draft))}
      >
        <LimitRow kind="stop" value={draft.stopPct} onChange={(stopPct) => patchDraft({ stopPct })} />
      </DialField>

      <Card className="px-3 py-1.5">
        <div className="flex items-center justify-between border-b border-white/15 pb-1 text-[14px]">
          <span>Position size</span>
          <span className="font-display text-[16px] font-bold tabular-nums">{usd(positionSize(draft))}</span>
        </div>
        <div className="grid grid-cols-2 pt-1 text-center">
          <div className="border-r border-white/20">
            <p className="text-[12px] text-white/85">At target</p>
            <p className="font-display text-[21px] leading-tight font-bold text-mint tabular-nums">{signedUsd(profitAtTarget(draft))}</p>
          </div>
          <div>
            <p className="text-[12px] text-white/85">At stop</p>
            <p className="font-display text-[21px] leading-tight font-bold text-coral tabular-nums">{signedUsd(-lossAtStop(draft))}</p>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/70">Before funding and costs.</p>
      </Card>

      <KeyHint side={draft.side} next="review" />
    </Screen>
  );
}
