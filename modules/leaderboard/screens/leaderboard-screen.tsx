"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { LightCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InfoDot } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useSession } from "@/modules/session/session-provider";
import { Podium } from "../components/podium";
import { RankRow } from "../components/rank-row";
import { getLeaderboard, METRICS, PERIODS, type Kind, type Metric, type Period } from "../data";

const KINDS = [
  { value: "wins", label: "Top Wins", icon: "bars", tint: "text-[#4cb8ff]", active: "from-[#62f6be] to-[#2cd396]" },
  { value: "losses", label: "Top Losses", icon: "trend-down", tint: "text-coral", active: "from-[#ffb3bb] to-[#f7808d]" },
] as const;

export function LeaderboardScreen() {
  const { session } = useSession();
  const [kind, setKind] = useState<Kind>("wins");
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("usd");

  const you = session.status === "member" ? { name: session.name, visible: session.showOnLeaderboard } : null;
  const entries = useMemo(() => getLeaderboard(kind, period, you), [kind, period, you?.name, you?.visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const wins = kind === "wins";
  usePrimaryAction({ label: wins ? "Show top losses" : "Show top wins", onPress: () => setKind(wins ? "losses" : "wins") });
  const rows = wins ? entries.slice(3) : entries;

  return (
    <Screen title="Leaderboard">
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

      <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} />

      <div className="relative">
        <select
          aria-label="Ranking metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
          className="recess h-10 w-full appearance-none rounded-[12px] px-3.5 font-display text-[16px] font-semibold text-white"
        >
          {METRICS.map((m) => (
            <option key={m.value} value={m.value} className="bg-navy-900">
              {m.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={22} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2" />
      </div>
      <p className="-mt-0.5 flex items-center gap-1.5 px-1 text-[12px] text-white/90">
        <InfoDot size={16} /> Closed trades · After costs
      </p>

      {wins && <Podium entries={entries.slice(0, 3)} metric={metric} />}

      <ul className={cn("flex flex-col", wins ? "-mt-2 gap-1" : "gap-1.5")}>
        {rows.map((e) => (
          <RankRow key={e.id} entry={e} metric={metric} medals={!wins} />
        ))}
      </ul>

      {wins && you && !you.visible && (
        <p className="glass rounded-[14px] p-3 text-[14px] text-white/90">
          You’re hidden from the leaderboard.{" "}
          <Link href="/me" className="font-semibold text-cyan underline">
            Turn on visibility
          </Link>
        </p>
      )}

      {!wins && (
        <LightCard className="flex items-center gap-2 py-2 pr-2.5 pl-1.5">
          <Mascot size={84} accessory="bulb" />
          <div>
            <p className="font-display text-[16px] leading-tight font-bold">Learn from every trade.</p>
            <p className="text-[12px] font-semibold text-navy-700">Use stop losses to manage risk.</p>
            <Link
              href="/home"
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border-2 border-bump-600 bg-white px-3 py-1 font-display text-[13px] font-semibold text-navy-900"
            >
              Explore stop-loss tips <Icon name="next" size={16} />
            </Link>
          </div>
        </LightCard>
      )}

      <p className="mt-auto text-center text-[12px] text-white/90">Only opted-in public profiles.</p>
    </Screen>
  );
}
