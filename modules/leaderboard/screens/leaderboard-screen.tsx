"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Avatar } from "@/components/ui/avatar";
import { LightCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { Segmented } from "@/components/ui/segmented";
import { qk } from "@/lib/api/query";
import { cn } from "@/lib/cn";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { formatMetric } from "../components/format-metric";
import { Podium } from "../components/podium";
import { RankRow } from "../components/rank-row";
import { fetchLeaderboard, getLeaderboard, METRICS, PERIOD_MS, PERIODS, type Kind, type Metric, type Period, type RankedEntry } from "../data";

const KINDS = [
  { value: "wins", label: "Top Wins", icon: "bars", tint: "text-[#4cb8ff]", active: "from-[#62f6be] to-[#2cd396]" },
  { value: "losses", label: "Top Losses", icon: "trend-down", tint: "text-coral", active: "from-[#ffb3bb] to-[#f7808d]" },
] as const;

const METRIC_SHORT: Record<Metric, string> = { usd: "$", pct: "%" };

export function LeaderboardScreen() {
  const { session } = useSession();
  const { history } = useTrade();
  const [kind, setKind] = useState<Kind>("wins");
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("usd");

  const member = session.status === "member";
  // live board from bump-backend; a failed or unreachable read shows the sample board instead
  const board = useQuery({
    queryKey: qk.leaderboard(kind, period, session.address),
    queryFn: () => fetchLeaderboard(kind, period),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const sample = board.isError || board.data === null;
  const live: RankedEntry[] | null = board.data ?? null;

  // offline: the player's own closed trades for the period, ranked against the sample entries
  const localPnl = useMemo(() => {
    const since = Date.now() - PERIOD_MS[period];
    return history.filter((t) => t.closedAt >= since).reduce((sum, t) => sum + t.pnl, 0);
  }, [history, period]);
  const you = member ? { name: session.name, value: localPnl } : null;
  const entries = useMemo(
    () => (sample ? getLeaderboard(kind, period, you) : (live ?? [])),
    [sample, live, kind, period, you?.name, you?.value], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const yourRow = entries.find((e) => e.isYou);
  const yourPnl = sample ? localPnl : (yourRow?.value ?? 0);

  const wins = kind === "wins";
  usePrimaryAction({ label: wins ? "Top losses" : "Top wins", onPress: () => setKind(wins ? "losses" : "wins") });
  const rows = wins ? entries.slice(3) : entries;

  return (
    <Screen title="Leaderboard" className="[&>*]:shrink-0">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Leaderboard type">
        {KINDS.map(({ value, label, icon, tint, active }) => {
          const on = kind === value;
          return (
            <button
              key={value}
              role="tab"
              aria-selected={on}
              onClick={() => setKind(value)}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-[12px] font-display text-[16px] font-semibold",
                on
                  ? `gloss bg-linear-to-b text-navy-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.15),0_3px_8px_rgba(0,0,0,0.3)] ${active}`
                  : "glass text-white",
              )}
            >
              <Icon name={icon} size={22} className={on ? (value === "wins" ? "text-navy-900" : "text-[#a8122b]") : tint} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} className="flex-1" />
        <Segmented
          label="Ranking metric"
          options={METRICS.map((m) => ({ value: m.value, label: METRIC_SHORT[m.value] }))}
          value={metric}
          onChange={setMetric}
          className="w-[84px]"
        />
      </div>

      {/* where you stand, always at the top, so you don't have to hunt for yourself */}
      {member ? (
        <div className="gloss flex items-center gap-2.5 rounded-[12px] bg-linear-to-b from-[#3aaeff] to-[#1580ea] px-2.5 py-1.5 shadow-[0_0_0_1.5px_#7fd3ff]">
          <Avatar seed={session.name} size={32} />
          <span className="flex-1 font-display text-[15px] font-semibold">
            You {yourRow ? `· #${yourRow.rank}` : `· not on ${wins ? "wins" : "losses"} this ${period === "today" ? "day" : period}`}
            {!session.showOnLeaderboard && <span className="block font-sans text-[11px] font-semibold text-white/80">Hidden from others</span>}
          </span>
          <span className="font-display text-[16px] font-bold tabular-nums">{formatMetric(yourPnl, metric, yourRow?.volume)}</span>
        </div>
      ) : (
        <Link href="/sign-in" className="glass flex items-center gap-2 rounded-[12px] px-3 py-2 text-[14px]">
          <Icon name="trophy" size={22} className="text-gold" />
          <span className="flex-1 font-semibold">Sign in to get ranked with your trades</span>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      {board.isSuccess && !sample && entries.length === 0 && (
        <p className="glass rounded-[14px] p-3 text-center text-[14px] text-white/90">
          No ranked trades {period === "today" ? "today" : `this ${period}`} yet. Close a real trade to take the top spot.
        </p>
      )}

      {wins && entries.length > 0 && <Podium entries={entries.slice(0, 3)} metric={metric} />}

      <ul className={cn("flex flex-col", wins ? "-mt-2 gap-1" : "gap-1.5")}>
        {rows.map((e) => (
          <RankRow key={e.id} entry={e} metric={metric} medals={!wins} />
        ))}
      </ul>

      {member && !session.showOnLeaderboard && (
        <p className="glass rounded-[14px] p-3 text-[14px] text-white/90">
          Others can’t see you yet.{" "}
          <Link href="/me" className="font-semibold text-cyan underline">
            Show me
          </Link>
        </p>
      )}

      {!wins && (
        <LightCard className="flex items-center gap-2 py-2 pr-2.5 pl-1.5">
          <Mascot size={84} accessory="bulb" />
          <div>
            <p className="font-display text-[16px] leading-tight font-bold">Ouch? It happens.</p>
            <p className="text-[12px] font-semibold text-navy-700">A stop loss closes a bad call before it gets worse.</p>
          </div>
        </LightCard>
      )}

      <p className="mt-auto text-center text-[12px] text-white/90">
        {sample ? "Sample board: bump is offline right now." : "Closed on-chain trades, price PnL. Only players who opted in show up."}
      </p>
    </Screen>
  );
}
