"use client";

import Link from "next/link";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, LightCard } from "@/components/ui/card";
import { CoinStack } from "@/components/ui/coin-stack";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { usd } from "@/lib/format";
import { MarketRow } from "@/modules/market/components/market-row";
import { useMarkets } from "@/modules/market/price-provider";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";

export function HomeScreen() {
  const { session } = useSession();
  const { balance, position } = useTrade();
  const markets = useMarkets();
  const name = session.name || "there";
  usePrimaryAction(position ? { label: "View live position", href: "/position" } : { label: "Start trading", href: "/markets" });

  return (
    <Screen
      header={
        <header className="flex shrink-0 items-center gap-2.5">
          <Link href="/me" aria-label="Profile" className="rounded-full">
            <Avatar seed={name} size={44} ring />
          </Link>
          <h1 className="text-pop flex-1 font-display text-[24px] font-bold">Hi, {name}!</h1>
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-full border border-line bg-linear-to-b from-[#1d3b60] to-[#0f2440] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_3px_6px_rgba(0,0,0,0.35)]"
          >
            <Icon name="bell" size={22} />
          </button>
        </header>
      }
    >
      <Card className="relative px-3 py-2">
        <p className="flex items-center text-[14px] text-white">
          Practice balance
          <InfoTip text="Practice funds have no cash value. Use them to learn without risk." />
        </p>
        <p className="text-pop font-display text-[32px] leading-tight font-bold tabular-nums">{usd(balance)}</p>
        <CoinStack className="absolute top-1/2 right-3 w-[68px] -translate-y-1/2" />
      </Card>

      <div className="flex items-center gap-2">
        <Mascot size={78} sparkles="left" className="ml-4" />
        <SpeechBubble>What’s moving today?</SpeechBubble>
      </div>

      <Button href={position ? "/position" : "/markets"} size="lg" trailing={<Icon name="next" size={24} />}>
        {position ? "View live position" : "Start trading"}
      </Button>

      <div className="flex flex-col gap-1.5">
        {markets.map((m) => (
          <MarketRow key={m.id} market={m} variant="compact" />
        ))}
      </div>

      <LightCard className="flex items-center gap-2.5 py-1.5 pr-3 pl-1.5">
        <Mascot size={52} accessory="bulb" bob={false} />
        <div className="flex-1">
          <p className="font-display text-[16px] leading-tight font-bold">How it works</p>
          <p className="text-[12px] font-semibold text-bump-600">Learn the basics in 2 minutes.</p>
        </div>
        <Icon name="chevron" size={22} />
      </LightCard>
    </Screen>
  );
}
