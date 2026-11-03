import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Sparkles } from "@/components/ui/decor";
import { cn } from "@/lib/cn";
import type { Metric, RankedEntry } from "../data";
import { formatMetric } from "./format-metric";

const STYLE = {
  1: { block: "min-h-[72px] from-[#ffe58f] to-[#f5b92a]", ring: "gold", badge: "from-[#ffe48a] to-[#f0a800]", avatar: 62 },
  2: { block: "min-h-[50px] from-white to-[#cfe3f5]", ring: "silver", badge: "from-[#e8f4ff] to-[#9cc8ec]", avatar: 50 },
  3: { block: "min-h-[50px] from-[#ffd2b8] to-[#f4996a]", ring: "bronze", badge: "from-[#ffd0b0] to-[#ee8a52]", avatar: 50 },
} as const;

function Place({ entry, metric }: { entry: RankedEntry; metric: Metric }) {
  const place = entry.rank as 1 | 2 | 3;
  const s = STYLE[place];
  return (
    <li className={cn("relative flex flex-col items-center", place === 1 ? "z-10 w-[38%]" : "w-[31%]")}>
      {place === 1 ? (
        <>
          <Sparkles className="absolute top-1 -left-2 size-7" />
          <Sparkles className="absolute top-1 -right-2 size-7 -scale-x-100" />
          <Icon name="crown" size={26} className="relative z-10 -mb-2.5 text-gold drop-shadow-[0_2px_0_#c98a00]" />
        </>
      ) : (
        <span
          className={cn(
            "gloss relative z-10 -mb-2.5 grid size-6 place-items-center rounded-full bg-linear-to-b font-display text-[13px] font-bold text-navy-900 ring-2 ring-white/70",
            s.badge,
          )}
        >
          {entry.rank}
        </span>
      )}
      <Avatar seed={entry.name} size={s.avatar} ring={s.ring} className="relative -mb-3" />
      <div
        className={cn(
          "flex w-full flex-col items-center justify-end rounded-t-[12px] bg-linear-to-b pt-3.5 pb-1 text-navy-900 shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_4px_10px_rgba(0,0,0,0.3)]",
          s.block,
        )}
      >
        <span className={cn("font-display leading-tight font-bold", place === 1 ? "text-[17px]" : "text-[15px]")}>{entry.name}</span>
        <span className={cn("font-display leading-tight font-bold text-[#11885a] tabular-nums", place === 1 ? "text-[20px]" : "text-[16px]")}>
          {formatMetric(entry.value, metric, entry.volume)}
        </span>
      </div>
    </li>
  );
}

/** Top three, ordered 2-1-3 so the winner stands in the middle. */
export function Podium({ entries, metric }: { entries: RankedEntry[]; metric: Metric }) {
  const [first, second, third] = entries;
  if (!first || !second || !third) return null;
  return (
    <ol className="-mx-1 flex shrink-0 items-end justify-center pt-1" aria-label="Top three">
      <Place entry={second} metric={metric} />
      <Place entry={first} metric={metric} />
      <Place entry={third} metric={metric} />
    </ol>
  );
}
