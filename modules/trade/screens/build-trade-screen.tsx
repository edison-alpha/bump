"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSideKeys } from "@/components/console/console-provider";
import { DialField } from "@/components/console/dial-field";
import { Screen } from "@/components/shell/screen";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InfoTip } from "@/components/ui/info-tip";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { signedUsd, usd } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { Coach, KeyName } from "@/modules/progress/components/coach";
import {
  capLeverage,
  leverageChoices,
  lossAtStop,
  MARGIN_PRESETS,
  positionSize,
  profitAtTarget,
  STYLES,
  stepLeverage,
  stepMargin,
  stepPct,
  stepStyle,
  stopPrice,
  styleOf,
  targetPrice,
} from "../calc";
import { KeyHint } from "../components/key-hint";
import { LimitRow, stopReadout, targetReadout } from "../components/limit-row";
import { TradeHeader } from "../components/trade-header";
import { useTrade } from "../trade-provider";

const STYLE_TONE = {
  chill: "from-[#7fe0ff] to-[#2aa8f0]",
  spicy: "from-[#ffc35c] to-[#f28a00]",
  wild: "from-[#ff8b99] to-[#e8364f]",
} as const;

const STYLE_EMOJI = { chill: "🧊", spicy: "🌶️", wild: "🔥" } as const;

export function BuildTradeScreen() {
  const { draft, patchDraft, available, blocker, maxLeverage, openPositions } = useTrade();
  /** Opening again on the side you already hold adds to that position, as on a futures exchange. */
  const adding = openPositions.find((p) => p.position.marketId === draft.marketId && p.position.side === draft.side);
  const market = useMarket(draft.marketId);
  const style = styleOf(draft);

  // a coin with a lower cap than the draft's leverage (picked on a 20x coin, say) pulls it down to the cap
  useEffect(() => {
    if (draft.leverage > maxLeverage) patchDraft({ leverage: capLeverage(draft.leverage, maxLeverage) });
  }, [draft.leverage, maxLeverage, patchDraft]);
  const isPreset = (MARGIN_PRESETS as readonly number[]).includes(draft.margin);
  const marginRef = useRef<HTMLInputElement>(null);
  const [marginText, setMarginText] = useState<string | null>(null);
  const [tuning, setTuning] = useState(!style);

  // SELL / BUY only pick the direction here; holding BUMP places the trade
  useSideKeys({
    selected: draft.side === "long" ? "buy" : "sell",
    onPress: (key) => patchDraft({ side: key === "buy" ? "long" : "short" }),
  });

  return (
    <Screen title="Plan your trade">
      <TradeHeader market={market} side={draft.side} leverage={draft.leverage} />

      <Coach step={2} points="bump">
        Chill is a safe start. Now press and hold the gold <KeyName tone="gold">BUMP</KeyName> key to place it.
      </Coach>

      <DialField
        id="style"
        label="Style"
        onStep={(dir) => {
          const next = stepStyle(draft, dir);
          patchDraft({ leverage: capLeverage(next.leverage, maxLeverage), targetPct: next.targetPct, stopPct: next.stopPct });
        }}
        readout={{ tag: "STYLE", value: style ? style.label.toUpperCase() : "CUSTOM", sub: `${draft.leverage}x` }}
        className="flex flex-col gap-1.5"
      >
        <span className="font-display text-[16px] font-semibold">How spicy?</span>
        <div role="radiogroup" aria-label="Trade style" className="grid grid-cols-3 gap-1.5">
          {STYLES.map((s) => {
            const on = style?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => patchDraft({ leverage: capLeverage(s.leverage, maxLeverage), targetPct: s.targetPct, stopPct: s.stopPct })}
                className={cn(
                  "flex flex-col items-center rounded-[14px] px-1 py-1.5 transition active:translate-y-0.5",
                  on
                    ? `gloss bg-linear-to-b text-navy-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.15),0_0_0_2px_#fff] ${STYLE_TONE[s.id]}`
                    : "glass text-white",
                )}
              >
                <span aria-hidden className="text-[20px] leading-none">
                  {STYLE_EMOJI[s.id]}
                </span>
                <span className="mt-0.5 font-display text-[15px] leading-tight font-bold">{s.label}</span>
                <span className={cn("text-[11px] leading-tight", on ? "text-navy-900/80" : "text-white/70")}>{capLeverage(s.leverage, maxLeverage)}x</span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-[12px] text-white/80">{style ? style.blurb : "Tuned by hand"}</p>
      </DialField>

      <DialField
        id="margin"
        label="Stake"
        onStep={(dir) => {
          setMarginText(null); // show the dialled value even while the field has focus
          patchDraft((d) => ({ margin: stepMargin(d.margin, dir, available) }));
        }}
        readout={{ tag: "STAKE", value: usd(draft.margin) }}
        className="flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center font-display text-[16px] font-semibold">
            Your stake
            <InfoTip text="The practice money you put in. It’s the most you can lose on this trade." />
          </span>
          <label className="recess flex h-9 w-[120px] items-center justify-center rounded-[10px] font-display text-[19px] font-bold tabular-nums">
            <span>$</span>
            <input
              ref={marginRef}
              inputMode="decimal"
              aria-label="Stake in dollars"
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
                patchDraft({ margin: Number.isFinite(n) ? Math.min(n, Math.floor(available)) : 0 });
              }}
              className="w-[5.5ch] bg-transparent text-center outline-none"
            />
          </label>
        </div>
        <Segmented
          label="Stake presets"
          options={[
            ...MARGIN_PRESETS.filter((v) => v <= available).map((v) => ({ value: v, label: `$${v}` })),
            { value: -1, label: "Custom" },
          ]}
          value={isPreset ? draft.margin : -1}
          onChange={(v) => (v > 0 ? patchDraft({ margin: v }) : marginRef.current?.focus())}
        />
      </DialField>

      <Card className="px-3 py-1.5">
        <div className="grid grid-cols-2 text-center">
          <div className="border-r border-white/20">
            <p className="text-[12px] text-white/85">Win if right</p>
            <p className="font-display text-[22px] leading-tight font-bold text-mint tabular-nums">{signedUsd(profitAtTarget(draft))}</p>
          </div>
          <div>
            <p className="text-[12px] text-white/85">Lose at most</p>
            <p className="font-display text-[22px] leading-tight font-bold text-coral tabular-nums">{signedUsd(-lossAtStop(draft))}</p>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/70">
          Trades {usd(positionSize(draft))} of {market.symbol} · closes itself at either number
        </p>
      </Card>

      <button
        type="button"
        aria-expanded={tuning}
        onClick={() => setTuning((v) => !v)}
        className="flex items-center justify-center gap-1 font-display text-[14px] font-semibold text-cyan"
      >
        {tuning ? "Hide tuning" : "Tune it yourself"}
        <Icon name="chevron" size={18} className={cn("transition-transform", tuning && "rotate-90")} />
      </button>

      {tuning && (
        <>
          <DialField
            id="leverage"
            label="Leverage"
            onStep={(dir) => patchDraft((d) => ({ leverage: stepLeverage(d.leverage, dir, maxLeverage) }))}
            readout={{ tag: "LEV", value: `${draft.leverage}x`, sub: `max ${maxLeverage}x` }}
            className="flex flex-col gap-1.5"
          >
            <span className="flex items-center text-[15px]">
              Leverage · up to {maxLeverage}x on {market.symbol}
              <InfoTip text="Multiplies how much you trade, and your wins and losses with it. Every coin has its own limit." />
            </span>
            <Segmented
              tone="group"
              label="Leverage"
              options={leverageChoices(maxLeverage).map((v) => ({ value: v, label: `${v}x` }))}
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
        </>
      )}

      {adding && !blocker && (
        <p className="text-center text-[12px] leading-snug text-white/75">
          Adds to your open {draft.marketId.toUpperCase()} position: one average entry, and this trade&apos;s target and stop replace the old ones.
        </p>
      )}
      {blocker && <p className="text-center text-[13px] font-semibold text-coral">{blocker}</p>}

      <KeyHint action="place" />
      <Link href="/trade/review" className="-mt-1 text-center text-[13px] text-white/80 underline underline-offset-4">
        See all the details first
      </Link>
    </Screen>
  );
}
