"use client";

import { useDial, useSideKeys, type Dial } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Sparkles } from "@/components/ui/decor";
import { InfoDot } from "@/components/ui/info-tip";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { StatRow } from "@/components/ui/stat-row";
import { usd, usdPrice } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { useSession } from "@/modules/session/session-provider";
import { positionSize, stepLeverage, stepMargin, stepPct, stopPrice, targetPrice } from "../calc";
import { KeyHint } from "../components/key-hint";
import { stopReadout, targetReadout } from "../components/limit-row";
import { TradeHeader } from "../components/trade-header";
import { useTrade } from "../trade-provider";

/** A stat row the wheel can turn; tapping it selects it (the mini LCD shows which one is selected). */
function DialRow({ id, label, value, tone, onStep, readout }: Dial & { id: string; value: string; tone?: "positive" | "negative" }) {
  const { activate } = useDial(id, { label, onStep, readout });
  return (
    <div onPointerDownCapture={activate}>
      <StatRow label={label} value={value} tone={tone} />
    </div>
  );
}

export function ReviewTradeScreen() {
  const { draft, patchDraft, available, blocker, maxLeverage } = useTrade();
  const { session } = useSession();
  const market = useMarket(draft.marketId);
  const entry = market.price;
  // same rule as Build: SELL / BUY pick the direction, holding BUMP places the trade
  useSideKeys({
    selected: draft.side === "long" ? "buy" : "sell",
    onPress: (key) => patchDraft({ side: key === "buy" ? "long" : "short" }),
  });

  return (
    <Screen title="Review trade">
      <TradeHeader market={market} side={draft.side} leverage={draft.leverage} />
      <h2 className="text-pop font-display text-[26px] leading-none font-bold">One last look.</h2>

      {/* last-minute tweaks without going back: the wheel turns the lit row, tapping a row (or the wheel) picks it */}
      <Card className="divide-y divide-white/15 px-3">
        <DialRow
          id="leverage"
          label="Leverage"
          value={`${draft.leverage}x`}
          onStep={(dir) => patchDraft((d) => ({ leverage: stepLeverage(d.leverage, dir, maxLeverage) }))}
          readout={{ tag: "LEV", value: `${draft.leverage}x`, sub: usd(positionSize(draft)) }}
        />
        <DialRow
          id="margin"
          label="Your stake"
          value={usd(draft.margin)}
          onStep={(dir) => patchDraft((d) => ({ margin: stepMargin(d.margin, dir, available) }))}
          readout={{ tag: "STAKE", value: usd(draft.margin) }}
        />
        <StatRow label="Amount traded" value={usd(positionSize(draft))} />
        <StatRow label="Estimated entry" value={usdPrice(entry)} />
        <DialRow
          id="target"
          label={`Profit target (+${draft.targetPct.toFixed(1)}%)`}
          value={usdPrice(targetPrice(entry, draft))}
          tone="positive"
          onStep={(dir) => patchDraft((d) => ({ targetPct: stepPct(d.targetPct, dir) }))}
          readout={targetReadout(draft.targetPct, targetPrice(entry, draft))}
        />
        <DialRow
          id="stop"
          label={`Stop loss (−${draft.stopPct.toFixed(1)}%)`}
          value={usdPrice(stopPrice(entry, draft))}
          tone="negative"
          onStep={(dir) => patchDraft((d) => ({ stopPct: stepPct(d.stopPct, dir, 0.5, 10) }))}
          readout={stopReadout(draft.stopPct, stopPrice(entry, draft))}
        />
      </Card>

      <p className="flex items-center gap-2 text-[13px] text-white/90">
        <InfoDot size={18} /> In a fast market the stop can fill a little past its price.
      </p>

      {blocker ? (
        <p className="text-center text-[13px] font-semibold text-coral">{blocker}</p>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <Avatar seed={session.name || "you"} size={64} />
          <SpeechBubble>
            Looks good?
            <br />
            Hold BUMP!
          </SpeechBubble>
          <Sparkles className="-ml-2 size-7 -scale-x-100 self-start" />
        </div>
      )}

      <KeyHint action="place" />
    </Screen>
  );
}
