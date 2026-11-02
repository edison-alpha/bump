"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDial, usePrimaryAction, useSideKeys } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Clouds } from "@/components/ui/decor";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { signedPct, usdPriceShort } from "@/lib/format";
import { MarketRow } from "@/modules/market/components/market-row";
import { useMarkets } from "@/modules/market/price-provider";
import { useTrade } from "../trade-provider";
import type { Side } from "../types";

export function PickMarketScreen() {
  const router = useRouter();
  const markets = useMarkets();
  const { draft, patchDraft } = useTrade();
  const [query, setQuery] = useState("");

  const filtered = markets.filter((m) => `${m.name} ${m.symbol}`.toLowerCase().includes(query.trim().toLowerCase()));

  const choose = (side: Side) => {
    patchDraft({ side });
    router.push("/trade/build");
  };
  usePrimaryAction({ label: `Build a ${draft.side} trade`, href: "/trade/build" });
  // SELL / BUY on the hardware keys pick the direction and go on; the wheel picks the market
  useSideKeys({ selected: null, onPress: (key) => choose(key === "buy" ? "long" : "short") });
  const selected = markets.find((m) => m.id === draft.marketId) ?? markets[0];
  useDial("market", {
    label: "Market",
    onStep: (dir) => {
      const list = filtered.length ? filtered : markets;
      const i = list.findIndex((m) => m.id === draft.marketId);
      const nextMarket = list[Math.min(list.length - 1, Math.max(0, i - dir))];
      patchDraft({ marketId: nextMarket.id });
    },
    readout: { tag: selected.symbol, value: signedPct(selected.change, 1), sub: usdPriceShort(selected.price), tone: selected.change >= 0 ? "positive" : "negative" },
  });

  return (
    <Screen title="Pick your market">
      <label className="recess flex h-11 shrink-0 items-center gap-3 rounded-[12px] px-3.5 focus-within:border-cyan">
        <Icon name="search" size={22} className="text-white" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets"
          aria-label="Search markets"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/70"
        />
      </label>

      <div className="flex flex-col gap-2">
        {filtered.map((m) => (
          <MarketRow key={m.id} market={m} selected={m.id === draft.marketId} onSelect={() => patchDraft({ marketId: m.id })} />
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-white/70">No markets match “{query}”.</p>}
      </div>

      <div className="relative -mx-3 mt-auto flex items-center justify-center gap-2 px-3">
        <Clouds className="absolute inset-x-0 bottom-0 h-10" />
        <Mascot size={112} sparkles="left" className="relative" />
        <SpeechBubble className="relative">
          Which way will it go?
          <br />
          <span className="text-coral-deep">SELL</span> if down, <span className="text-mint-deep">BUY</span> if up.
        </SpeechBubble>
      </div>
    </Screen>
  );
}
