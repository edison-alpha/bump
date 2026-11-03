import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { Metric, RankedEntry } from "../data";
import { formatMetric } from "./format-metric";

const MEDAL = ["from-[#ffe48a] to-[#f0a800]", "from-[#e8f4ff] to-[#9cc8ec]", "from-[#ffd0b0] to-[#ee8a52]"];

type RankRowProps = {
  entry: RankedEntry;
  metric: Metric;
  /** Coloured medal for ranks 1-3 and bigger rows (Top Losses list). */
  medals?: boolean;
};

export function RankRow({ entry, metric, medals = false }: RankRowProps) {
  const positive = entry.value >= 0;
  const medal = medals ? MEDAL[entry.rank - 1] : undefined;

  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-[12px] px-2.5",
        medals ? "py-1.5" : "py-1",
        entry.isYou
          ? "gloss bg-linear-to-b from-[#3aaeff] to-[#1580ea] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_0_1.5px_#7fd3ff,0_4px_12px_rgba(30,140,255,0.4)]"
          : "glass",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold",
          medal ? `gloss bg-linear-to-b text-navy-900 ${medal}` : "text-white",
        )}
      >
        {entry.rank}
      </span>
      <Avatar seed={entry.name} size={medals ? 36 : 30} />
      <span className="flex flex-1 items-center gap-2 font-display text-[15px] font-semibold">
        {entry.name}
        {entry.isYou && (
          <span className="rounded-[7px] bg-white/25 px-2 py-px text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">You</span>
        )}
      </span>
      <span
        className={cn(
          "font-display font-bold tabular-nums",
          medals ? "text-[18px]" : "text-[16px]",
          entry.isYou ? "text-mint" : positive ? "text-mint" : "text-coral",
        )}
      >
        {formatMetric(entry.value, metric, entry.volume)}
      </span>
    </li>
  );
}
