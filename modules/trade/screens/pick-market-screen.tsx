"use client";

import { useRouter } from "next/navigation";
import { useDial, useSideKeys } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { signedPct, usdPriceShort } from "@/lib/format";
import { MarketRow } from "@/modules/market/components/market-row";
import { useMarkets } from "@/modules/market/price-provider";
import { Coach, KeyName } from "@/modules/progress/components/coach";
import { useProgress } from "@/modules/progress/progress-provider";
import { useTrade } from "../trade-provider";
import type { Side } from "../types";

export function PickMarketScreen() {
  const router = useRouter();
  const markets = useMarkets();
  const { draft, patchDraft } = useTrade();
  const { tutorialActive } = useProgress();

  const choose = (side: Side) => {
    patchDraft({ side });
    router.push("/trade/build");
  };
  // picking the direction is this screen's step: SELL / BUY pick it and go on; the wheel (or a tap) picks the coin
  useSideKeys({ selected: null, onPress: (key) => choose(key === "buy" ? "long" : "short") });
  const selected = markets.find((m) => m.id === draft.marketId) ?? markets[0];
  useDial("market", {
    label: "Coin",
    onStep: (dir) => {
      const i = markets.findIndex((m) => m.id === draft.marketId);
      patchDraft({ marketId: markets[Math.min(markets.length - 1, Math.max(0, i - dir))].id });
    },
    readout: { tag: selected.symbol, value: signedPct(selected.change, 1), sub: usdPriceShort(selected.price), tone: selected.change >= 0 ? "positive" : "negative" },
  });

  return (
    <Screen title="Pick a coin">
      <Coach step={1} points="sides">
        Think {selected.name} goes up? Press <KeyName tone="buy">BUY</KeyName>. Down? Press <KeyName tone="sell">SELL</KeyName>.
      </Coach>

      <div className="flex flex-col gap-2">
        {markets.map((m) => (
          <MarketRow key={m.id} market={m} selected={m.id === draft.marketId} onSelect={() => {
              patchDraft({ marketId: m.id });
              router.push(`/markets/${m.id}`);
            }} />
        ))}
      </div>

      {!tutorialActive && (
        <div className="relative mt-auto flex items-center justify-center gap-2">
          <Mascot size={84} sparkles="left" className="relative" />
          <SpeechBubble className="relative">
            {selected.name}: up or down?
          </SpeechBubble>
        </div>
      )}

      {/* the same choice as the SELL / BUY keys, for people who reach for the screen */}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button variant="short" size="lg" onClick={() => choose("short")}>
          SELL · drops
        </Button>
        <Button variant="long" size="lg" onClick={() => choose("long")}>
          BUY · climbs
        </Button>
      </div>
    </Screen>
  );
}
