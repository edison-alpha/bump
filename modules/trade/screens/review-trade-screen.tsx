"use client";

import { useRouter } from "next/navigation";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "@/components/ui/decor";
import { InfoDot } from "@/components/ui/info-tip";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { StatRow } from "@/components/ui/stat-row";
import { usd } from "@/lib/format";
import { useMarket } from "@/modules/market/price-provider";
import { useSession } from "@/modules/session/session-provider";
import { positionSize, stopPrice, targetPrice } from "../calc";
import { TradeHeader } from "../components/trade-header";
import { useTrade } from "../trade-provider";

export function ReviewTradeScreen() {
  const router = useRouter();
  const { draft } = useTrade();
  const { session } = useSession();
  const market = useMarket(draft.marketId);
  const entry = market.price;
  usePrimaryAction({ label: "Confirm trade", href: "/trade/progress" });

  return (
    <Screen title="Review trade">
      <TradeHeader market={market} side={draft.side} leverage={draft.leverage} />
      <h2 className="text-pop font-display text-[26px] leading-none font-bold">One last look.</h2>

      <Card className="divide-y divide-white/15 px-3">
        <StatRow label="Practice margin" value={usd(draft.margin)} />
        <StatRow label="Position size" value={usd(positionSize(draft))} />
        <StatRow label="Estimated entry" value={usd(entry)} />
        <StatRow label={`Profit target (+${draft.targetPct.toFixed(1)}%)`} value={usd(targetPrice(entry, draft))} tone="positive" />
        <StatRow label={`Stop loss (−${draft.stopPct.toFixed(1)}%)`} value={usd(stopPrice(entry, draft))} tone="negative" />
      </Card>

      <p className="flex items-center gap-2 text-[13px] text-white/90">
        <InfoDot size={18} /> Stop fills can differ.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Avatar seed={session.name || "you"} size={64} />
        <SpeechBubble>
          Looks good?
          <br />
          Let’s place it!
        </SpeechBubble>
        <Sparkles className="-ml-2 size-7 -scale-x-100 self-start" />
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button size="lg" trailing={<Icon name="next" size={24} />} onClick={() => router.push("/trade/progress")}>
          Confirm trade
        </Button>
        <Button variant="light" size="md" leading={<Icon name="settings" size={22} />} onClick={() => router.back()}>
          Edit plan
        </Button>
      </div>
    </Screen>
  );
}
