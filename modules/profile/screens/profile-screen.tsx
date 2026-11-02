"use client";

import { useRouter } from "next/navigation";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CoinStack } from "@/components/ui/coin-stack";
import { InfoTip } from "@/components/ui/info-tip";
import { Toggle } from "@/components/ui/toggle";
import { usd } from "@/lib/format";
import { useProgress } from "@/modules/progress/progress-provider";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { MenuRow } from "../components/menu-row";

/** Long dash used for empty stats, as in the design. */
const EMPTY = <span className="mx-auto mt-2 block h-1 w-5 rounded-full bg-white" aria-label="none" />;

export function ProfileScreen() {
  const router = useRouter();
  const { session, setLeaderboardVisibility, signOut } = useSession();
  const { balance, history, broke, refill } = useTrade();
  const { level, streak, restartTutorial } = useProgress();
  const guest = session.status === "guest";

  const wins = history.filter((t) => t.pnl > 0).length;

  return (
    <Screen title="Profile">
      <div className="flex items-center gap-3">
        <Avatar seed={session.name || "you"} size={80} ring />
        <div className="min-w-0">
          <h2 className="text-pop truncate font-display text-[26px] leading-tight font-bold">{session.name || "Guest"}</h2>
          {!guest && <p className="text-[15px] leading-tight text-white">@{session.username}</p>}
          <Chip tone="info" className="mt-1 rounded-full px-3 text-[14px]">
            Level {level.level} · {guest ? "Guest" : "Practice account"}
          </Chip>
        </div>
      </div>

      <Card className="relative px-3 py-2">
        <p className="flex items-center text-[14px]">
          Practice balance
          <InfoTip text="Practice funds have no cash value." />
        </p>
        <p className="text-pop font-display text-[32px] leading-tight font-bold tabular-nums">{usd(balance)}</p>
        {broke ? (
          <Button size="sm" className="mt-1 w-auto" onClick={refill}>
            Refill to {usd(1000)}
          </Button>
        ) : (
          <CoinStack className="absolute top-1/2 right-3 w-[68px] -translate-y-1/2" />
        )}
      </Card>

      <Card className="grid grid-cols-3 py-2 text-center">
        <div className="border-r border-white/20">
          <p className="text-[13px]">Trades</p>
          {history.length ? <p className="font-display text-[20px] leading-tight font-bold">{history.length}</p> : EMPTY}
        </div>
        <div className="border-r border-white/20">
          <p className="text-[13px]">Win rate</p>
          {history.length ? <p className="font-display text-[20px] leading-tight font-bold">{Math.round((wins / history.length) * 100)}%</p> : EMPTY}
        </div>
        <div>
          <p className="text-[13px]">Streak</p>
          <p className="font-display text-[20px] leading-tight font-bold">🔥 {streak}</p>
        </div>
      </Card>

      <ul className="flex flex-col gap-1.5">
        {guest && <MenuRow icon="trophy" label="Save my progress (sign in)" href="/sign-in" />}
        <MenuRow icon="history" label="Trade history" href="/history" />
        {!guest && (
          <MenuRow
            icon="eye"
            label="Show me on the leaderboard"
            control={<Toggle checked={session.showOnLeaderboard} onChange={setLeaderboardVisibility} label="Show me on the leaderboard" />}
          />
        )}
        <MenuRow
          icon="book"
          label="Replay the guided trade"
          onClick={() => {
            restartTutorial();
            router.push("/markets");
          }}
        />
        <MenuRow
          icon="logout"
          label={guest ? "Leave guest mode" : "Sign out"}
          danger
          onClick={() => {
            signOut();
            router.replace("/");
          }}
        />
      </ul>

      <p className="mt-auto text-center text-[11px] text-white">Practice funds have no cash value.</p>
    </Screen>
  );
}
