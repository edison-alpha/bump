"use client";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useProgress } from "../progress-provider";

/** Level chip with a thin XP bar under it; the Home header and Profile use it. */
export function LevelChip({ className }: { className?: string }) {
  const { level } = useProgress();
  return (
    <span
      className={cn("glass flex flex-col items-center rounded-[12px] px-2.5 pt-1 pb-1.5", className)}
      aria-label={`Level ${level.level}, ${level.into} of ${level.size} XP to the next level`}
    >
      <span className="font-display text-[13px] leading-none font-bold">Lv {level.level}</span>
      <span className="mt-1 h-1 w-10 overflow-hidden rounded-full bg-white/20">
        <span className="block h-full rounded-full bg-gold" style={{ width: `${(level.into / level.size) * 100}%` }} />
      </span>
    </span>
  );
}

/** Days in a row with a trade. Dim until today's trade keeps it going. */
export function StreakChip({ className }: { className?: string }) {
  const { streak, tradedToday } = useProgress();
  return (
    <span
      className={cn(
        "glass flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 font-display text-[15px] leading-none font-bold tabular-nums",
        !tradedToday && "opacity-70",
        className,
      )}
      aria-label={`${streak} day streak${tradedToday ? "" : ", trade today to keep it"}`}
    >
      <span aria-hidden>🔥</span>
      {streak}
    </span>
  );
}

/** Today's three missions with progress; done ones get a mint check. */
export function MissionsCard({ className }: { className?: string }) {
  const { missions } = useProgress();
  const doneCount = missions.filter((m) => m.done).length;
  return (
    <Card className={cn("px-3 py-2", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[16px] font-bold">Today’s missions</h2>
        <span className="text-[12px] text-white/80">
          {doneCount}/{missions.length} · +30 XP each
        </span>
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {missions.map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-[14px]">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full",
                m.done ? "bg-mint text-navy-950" : "border-2 border-white/40",
              )}
            >
              {m.done && <Icon name="check" size={14} />}
            </span>
            <span className={cn("flex-1", m.done && "text-white/60 line-through")}>{m.label}</span>
            <span className="font-display text-[13px] font-semibold text-white/80 tabular-nums">
              {m.progress}/{m.goal}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
