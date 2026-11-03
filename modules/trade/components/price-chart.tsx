import { useId } from "react";
import { usdPrice } from "@/lib/format";

/** A price line with a fill, and the range it covers on the right edge. Grows to fill its box. */
export function PriceChart({ series }: { series: number[] }) {
  const id = useId();
  if (series.length < 2) return <div className="min-h-[170px] flex-1" />;

  const up = (series[series.length - 1] as number) >= (series[0] as number);
  const color = up ? "#3fe0a6" : "#ff6377";
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const y = (v: number) => 8 + ((max - v) / span) * 84;
  const points = series.map((v, i) => `${(i / (series.length - 1)) * 100},${y(v)}`).join(" ");
  const last = series[series.length - 1] as number;

  return (
    <div className="relative min-h-[170px] flex-1" role="img" aria-label={`Price chart, high ${usdPrice(max)}, low ${usdPrice(min)}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.3" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[8, 50, 92].map((line) => (
          <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="white" strokeOpacity="0.12" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={`0,100 ${points} 100,100`} fill={`url(#${id})`} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color}b3)` }}
        />
      </svg>
      <span className="absolute top-0 left-0 rounded bg-navy-950/70 px-1 font-display text-[11px] text-white/70 tabular-nums">{usdPrice(max)}</span>
      <span className="absolute bottom-0 left-0 rounded bg-navy-950/70 px-1 font-display text-[11px] text-white/70 tabular-nums">{usdPrice(min)}</span>
      <span
        className="absolute right-0 size-3 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_8px_currentColor]"
        style={{ top: `${y(last)}%`, background: color, color }}
      />
    </div>
  );
}
