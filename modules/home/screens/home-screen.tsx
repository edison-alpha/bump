"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConsole, usePrimaryAction } from "@/components/console/console-provider";
import { ChargeUpCard } from "../components/charge-up-card";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, LightCard } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { CoinStack } from "@/components/ui/coin-stack";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { signedPct, signedUsd, usd, usdPrice } from "@/lib/format";
import { useMarket, useMarkets } from "@/modules/market/price-provider";
import { PriceNotice } from "@/modules/market/components/price-notice";
import { Coach } from "@/modules/progress/components/coach";
import { LevelChip, MissionsCard, StreakChip } from "@/modules/progress/components/progress-bits";
import { useProgress } from "@/modules/progress/progress-provider";
import { useSession } from "@/modules/session/session-provider";
import { unrealizedPnl } from "@/modules/trade/calc";
import { useTrade } from "@/modules/trade/trade-provider";
import type { Position, Side } from "@/modules/trade/types";

export function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { balance, position, broke, refill, refillLabel, patchDraft, mode } = useTrade();
  const { flash } = useConsole();
  const doRefill = () =>
    void refill()
      .then(() => flash("Done! You are ready to trade.", "good"))
      .catch((error: Error) => flash(error.message, "warn"));
  const { restartTutorial } = useProgress();
  const markets = useMarkets();
  const name = session.name || "there";

  // the coin that moved most over 24h (the figure drifts slowly, so the pick doesn't flicker with every tick)
  const liveMarkets = markets.filter((market) => market.priceStatus === "live");
  const hot = (liveMarkets.length ? liveMarkets : markets).reduce((a, b) => (Number.isFinite(b.change) && (!Number.isFinite(a.change) || Math.abs(b.change) > Math.abs(a.change)) ? b : a));
  const call = (side: Side) => {
    if (hot.priceStatus !== "live") return;
    patchDraft({ marketId: hot.id, side });
    router.push("/trade/build");
  };

  usePrimaryAction(
    position
      ? { label: "Check my trade", href: "/position" }
      : broke
        ? { label: "Refill", onPress: doRefill }
        : { label: "Make a call", href: "/markets" },
  );

  return (
    <Screen
      className="[&>*]:shrink-0"
      header={
        <header className="flex shrink-0 items-center gap-2">
          <Link href="/me" aria-label="Profile" className="rounded-full">
            <Avatar seed={name} size={44} ring />
          </Link>
          <h1 className="text-pop min-w-0 flex-1 truncate font-display text-[22px] font-bold">Hi, {name}!</h1>
          <StreakChip />
          <LevelChip />
        </header>
      }
    >
      <Coach step={1} points="next">
        Let’s make your first call. Press <b>NEXT</b> or pick the hot coin below.
      </Coach>

      <Card className="relative px-3 py-2">
        <p className="flex items-center text-[14px] text-white">
          {mode === "chain" ? "dreamDEX balance" : "Practice balance"}
          <InfoTip text={mode === "chain" ? "Your collateral on dreamDEX testnet. It has no cash value." : "Practice funds have no cash value. Use them to learn without risk."} />
        </p>
        <p className="text-pop font-display text-[30px] leading-tight font-bold tabular-nums">{usd(balance)}</p>
        {broke ? (
          <Button size="sm" className="mt-1 w-auto" onClick={doRefill}>
            Out of coins? {refillLabel}
          </Button>
        ) : (
          <CoinStack className="absolute top-1/2 right-3 w-[64px] -translate-y-1/2" />
        )}
      </Card>

      <ChargeUpCard />

      {mode === "chain" && (
        <Link href="/bridge" className="glass flex min-h-12 items-center gap-3 rounded-[12px] px-3 py-1.5">
          <Icon name="bars" size={24} className="text-white" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[16px] leading-tight font-bold">DEX</span>
            <span className="block truncate text-[12px] text-white/75">Swap, bridge, send &amp; withdraw</span>
          </span>
          <Icon name="chevron" size={20} className="text-white" />
        </Link>
      )}
      <PriceNotice market={position ? markets.find((market) => market.id === position.marketId) ?? hot : hot} />

      {position ? (
        <OpenTradeCard position={position} />
      ) : (
        <Card className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold px-2 py-px font-display text-[11px] font-bold tracking-[0.1em] text-navy-900">HOT CALL</span>
            <span className="text-[12px] text-white/80">Biggest mover today</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <CoinIcon symbol={hot.symbol} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[17px] leading-tight font-bold">
                {hot.name} <span className={hot.change >= 0 ? "text-mint" : "text-coral"}>{signedPct(hot.change, 1)}</span>
              </p>
              <p className="text-[13px] text-white/85">{hot.change >= 0 ? "Ride it up or bet it cools off?" : "Keep falling or bounce back?"}</p>
            </div>
            <span className="font-display text-[15px] font-semibold tabular-nums">{usdPrice(hot.price)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="short" size="md" disabled={hot.priceStatus !== "live"} onClick={() => call("short")}>
              SELL · drops
            </Button>
            <Button variant="long" size="md" disabled={hot.priceStatus !== "live"} onClick={() => call("long")}>
              BUY · climbs
            </Button>
          </div>
          <Link href="/markets" className="mt-1.5 flex items-center justify-center gap-1 font-display text-[13px] font-semibold text-cyan">
            Other coins <Icon name="chevron" size={16} />
          </Link>
        </Card>
      )}

      <MissionsCard />

      <LightCard className="flex items-center gap-2.5 py-1.5 pr-3 pl-1.5">
        <Mascot size={52} accessory="bulb" bob={false} />
        <button
          type="button"
          className="flex flex-1 items-center text-left"
          onClick={() => {
            restartTutorial();
            router.push(position ? "/position" : "/markets");
          }}
        >
          <span className="flex-1">
            <span className="block font-display text-[16px] leading-tight font-bold">New here?</span>
            <span className="block text-[12px] font-semibold text-bump-600">Play a guided trade, step by step.</span>
          </span>
          <Icon name="chevron" size={22} />
        </button>
      </LightCard>
    </Screen>
  );
}

/** The running trade, so Home answers "how am I doing?" without opening it. */
function OpenTradeCard({ position }: { position: Position }) {
  const market = useMarket(position.marketId);
  const pnl = unrealizedPnl(position, position.entry, market.price);
  return (
    <Link href="/position" className="glass flex items-center gap-2.5 rounded-[16px] px-3 py-2.5">
      <CoinIcon symbol={market.symbol} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-white/80">Your trade is live</span>
        <span className="block font-display text-[17px] leading-tight font-bold">
          {market.name} {position.side === "long" ? "BUY" : "SELL"} · {position.leverage}x
        </span>
      </span>
      <span className={cn("font-display text-[22px] font-bold tabular-nums", pnl >= 0 ? "text-mint" : "text-coral")}>{signedUsd(pnl)}</span>
      <Icon name="chevron" size={22} />
    </Link>
  );
}
