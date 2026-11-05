"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsole, useDial, useSideKeys } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { signedPct, usdPriceShort } from "@/lib/format";
import { MarketRow } from "@/modules/market/components/market-row";
import { cn } from "@/lib/cn";
import { signedUsd } from "@/lib/format";
import { useMarket, useMarkets } from "@/modules/market/price-provider";
import { PriceNotice } from "@/modules/market/components/price-notice";
import { Coach, KeyName } from "@/modules/progress/components/coach";
import { useProgress } from "@/modules/progress/progress-provider";
import { unrealizedPnl } from "../calc";
import { SideChip } from "../components/trade-header";
import { useTrade } from "../trade-provider";
import type { Position, Side } from "../types";

/** A position that is open, pinned above the pair list: coin, side and how it stands right now. Tap to open it. */
function OpenPositionCard({ position, onOpen }: { position: Position; onOpen: () => void }) {
  const market = useMarket(position.marketId);
  const pnl = unrealizedPnl(position, position.entry, market.price);
  return (
    <Link href="/position" onClick={onOpen} aria-label={`Open your ${market.name} position`}>
      <Card className="flex items-center gap-2.5 px-3 py-2">
        <CoinIcon symbol={market.symbol} size={36} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-[11px] font-bold tracking-[0.1em] text-white/70">YOUR POSITION</p>
          <p className="flex items-center gap-1.5 font-display text-[16px] leading-tight font-bold">
            {market.name} <SideChip side={position.side} /> <span className="text-[13px] text-white/75">{Number(position.leverage.toFixed(1))}x</span>
          </p>
        </div>
        <span className={cn("font-display text-[18px] font-bold tabular-nums", pnl >= 0 ? "text-mint" : "text-coral")}>{signedUsd(pnl)}</span>
        <Icon name="chevron" size={20} className="shrink-0 text-white" />
      </Card>
    </Link>
  );
}

export function PickMarketScreen() {
  const router = useRouter();
  const markets = useMarkets();
  const { draft, patchDraft, openPositions, focusPosition } = useTrade();
  const { flash } = useConsole();
  const { tutorialActive } = useProgress();

  const choose = (side: Side) => {
    // adding on the side you hold is fine; the other side would be a close
    const held = openPositions.find((p) => p.position.marketId === draft.marketId);
    if (held && held.position.side !== side) return flash(`You hold a ${held.position.side === "long" ? "BUY" : "SELL"} here. Close it before you ${side === "long" ? "BUY" : "SELL"}.`, "warn");
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
    <Screen title="Pick a coin" className="[&>*]:shrink-0">
      {openPositions.map((p) => (
        <OpenPositionCard key={p.pool} position={p.position} onOpen={() => focusPosition?.(p.pool)} />
      ))}
      <PriceNotice market={selected} />
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
    </Screen>
  );
}
