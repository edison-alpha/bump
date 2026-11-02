"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Clouds } from "@/components/ui/decor";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
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
          Which way do you
          <br />
          think it will go?
        </SpeechBubble>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="long" size="lg" className="h-[60px] justify-start gap-2 rounded-[14px] px-2.5" onClick={() => choose("long")}>
          <Icon name="up" size={30} className="text-[#0f7a4f]" />
          <span className="text-left leading-tight">
            <span className="block text-[17px]">Up / Long</span>
            <span className="block font-sans text-[11px] font-semibold">Profit if price rises</span>
          </span>
        </Button>
        <Button variant="short" size="lg" className="h-[60px] justify-start gap-2 rounded-[14px] px-2.5" onClick={() => choose("short")}>
          <Icon name="down-right" size={28} className="text-[#c42a42]" />
          <span className="text-left leading-tight">
            <span className="block text-[17px]">Down / Short</span>
            <span className="block font-sans text-[11px] font-semibold">Profit if price falls</span>
          </span>
        </Button>
      </div>
    </Screen>
  );
}
