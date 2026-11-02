"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConsole, usePrimaryAction } from "@/components/console/console-provider";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card, LightCard } from "@/components/ui/card";
import { Confetti } from "@/components/ui/confetti";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { signedUsd, usd, usdPrice } from "@/lib/format";
import { MARKETS } from "@/modules/market/data";
import { useProgress, type Reward } from "@/modules/progress/progress-provider";
import { useSession } from "@/modules/session/session-provider";
import type { ClosedTrade, CloseReason } from "../types";
import { useTrade } from "../trade-provider";

const OUTCOME: Record<CloseReason, { win: string; loss: string; body: string }> = {
  manual: { win: "Nice call!", loss: "That’s a wrap", body: "You closed it yourself." },
  target: { win: "Target hit!", loss: "Target hit!", body: "Price reached your target, so we cashed it in." },
  stop: { win: "Stopped out", loss: "Stopped out", body: "Your stop closed it before it got worse." },
};

/** One thing to try next time, picked by how the trade ended. */
function tipFor(trade: ClosedTrade) {
  if (trade.reason === "stop") return "Stops save you from bigger losses. Try Chill style for smaller swings.";
  if (trade.leverage >= 3) return "Big leverage moves fast both ways. Chill style gives a call more room.";
  return "Markets wiggle. A wider target and stop lets a trade breathe.";
}

export function TradeClosedScreen() {
  const router = useRouter();
  const { lastClosed, history, ready, patchDraft, available } = useTrade();
  const { lastReward } = useProgress();
  const { session } = useSession();
  const { flash } = useConsole();

  useEffect(() => {
    if (ready && !lastClosed) router.replace("/markets");
  }, [ready, lastClosed, router]);

  /** Same coin, side and style, ready to place again with one hold of BUMP. */
  const runItBack = () => {
    if (!lastClosed) return;
    patchDraft({
      marketId: lastClosed.marketId,
      side: lastClosed.side,
      leverage: lastClosed.leverage,
      margin: Math.max(1, Math.min(lastClosed.margin, Math.floor(available))),
    });
    router.push("/trade/build");
  };
  usePrimaryAction({ label: "Run it back", onPress: runItBack });

  if (!lastClosed) return <Screen title="Trade closed">{null}</Screen>;
  const win = lastClosed.pnl > 0;
  // closed at (about) the entry price: neither a win nor a loss
  const even = Math.abs(lastClosed.pnl) < 0.005;
  const tone = even ? "text-white" : win ? "text-mint" : "text-coral";
  const copy = OUTCOME[lastClosed.reason ?? "manual"];
  const symbol = MARKETS.find((m) => m.id === lastClosed.marketId)?.symbol ?? lastClosed.marketId.toUpperCase();
  const reward = lastReward?.tradeId === lastClosed.id ? lastReward : null;

  const share = async () => {
    const text = `${win ? "Called it!" : "Took the L."} ${signedUsd(lastClosed.pnl)} on ${symbol} ${lastClosed.side === "long" ? "BUY" : "SELL"} ${lastClosed.leverage}x in bump 🎮`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        flash("Copied! Paste it anywhere.", "good");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <Screen title="Trade closed" back="/home">
      {win && <Confetti />}

      <div className="flex items-center gap-3">
        <Mascot size={92} accessory={win ? "check" : undefined} sparkles={win ? "both" : undefined} className="ml-3" />
        <div>
          <h2 className="text-pop font-display text-[28px] leading-tight font-bold">{win ? copy.win : copy.loss}</h2>
          <p className="text-[13px] leading-snug text-white">{copy.body}</p>
        </div>
      </div>

      <Card className="px-3 py-2 text-center">
        <p className="text-[14px]">{even ? "Break even" : win ? "You won" : "You lost"}</p>
        <p className={cn("animate-pop font-display text-[44px] leading-none font-bold tabular-nums", tone)}>
          {even ? usd(0) : signedUsd(lastClosed.pnl)}
        </p>
        <p className="mt-1 text-[12px] text-white/85">
          {symbol} {lastClosed.side === "long" ? "BUY" : "SELL"} · {lastClosed.leverage}x · {usdPrice(lastClosed.entry)} → {usdPrice(lastClosed.exit)}
        </p>
      </Card>

      {reward && <RewardCard reward={reward} />}

      {!win && !even && (
        <LightCard className="flex items-center gap-2 py-1.5 pr-3 pl-1.5">
          <Mascot size={48} accessory="bulb" bob={false} />
          <p className="flex-1 text-[13px] leading-snug font-semibold">{tipFor(lastClosed)}</p>
        </LightCard>
      )}

      {session.status === "guest" && history.length > 0 && (
        <Link href="/sign-in" className="glass flex items-center gap-2 rounded-[14px] px-3 py-2">
          <Icon name="trophy" size={26} className="text-gold" />
          <span className="flex-1">
            <span className="block font-display text-[15px] leading-tight font-bold">Save your score</span>
            <span className="block text-[12px] text-white/80">Sign in to keep your XP and join the leaderboard.</span>
          </span>
          <Icon name="chevron" size={20} />
        </Link>
      )}

      <div className="mt-auto grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="light" onClick={share} className="font-bold">
          Share
        </Button>
        <Button onClick={runItBack} trailing={<Icon name="next" size={22} />}>
          Run it back
        </Button>
      </div>
      <Link href="/history" className="-mt-0.5 text-center text-[13px] text-white/80 underline underline-offset-4">
        All my trades
      </Link>
    </Screen>
  );
}

/** XP, level progress, missions and streak earned by the trade. */
function RewardCard({ reward }: { reward: Reward }) {
  const { level } = useProgress();
  const levelledUp = reward.levelAfter > reward.levelBefore;
  return (
    <Card className="animate-pop flex flex-col gap-1.5 px-3 py-2">
      {reward.firstTrade && (
        <p className="text-center font-display text-[14px] font-bold text-cyan">🎉 First trade done! You know how to play.</p>
      )}
      {levelledUp && (
        <p className="rounded-[10px] bg-gold py-1 text-center font-display text-[15px] font-bold text-navy-900">Level up! You’re level {reward.levelAfter}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="font-display text-[22px] font-bold text-gold">+{reward.xp} XP</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
          <span className="block h-full rounded-full bg-gold" style={{ width: `${(level.into / level.size) * 100}%` }} />
        </span>
        <span className="font-display text-[13px] font-semibold">Lv {level.level}</span>
      </div>
      {reward.missions.map((m) => (
        <p key={m} className="flex items-center gap-1.5 text-[13px] text-mint">
          <Icon name="check" size={16} /> Mission done: {m}
        </p>
      ))}
      {reward.streak > 1 && <p className="text-[13px]">🔥 {reward.streak} days in a row</p>}
    </Card>
  );
}
