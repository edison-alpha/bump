import { usd } from "@/lib/format";

type PositionChartProps = {
  series: number[];
  /** Time at the left edge, e.g. "5 min ago". */
  startLabel?: string;
  entry: number;
  target: number;
  stop: number;
};

const LINES = [
  { key: "target", label: "Target", color: "#3fe0a6", value: "#3fe0a6" },
  { key: "entry", label: "Entry", color: "#ffffff", value: "#ffffff" },
  { key: "stop", label: "Stop loss", color: "#ff6377", value: "#ff6377" },
] as const;

/** Where "Now" sits horizontally; the right side is left free for the level labels. */
const NOW_X = 62;

/** Price line up to "Now" with target / entry / stop guides; grows to fill the LCD. Labels are HTML so text stays crisp. */
export function PositionChart({ series, startLabel, entry, target, stop }: PositionChartProps) {
  const levels = { target, entry, stop };
  const all = [...series, target, stop];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const span = max - min || 1;
  const y = (v: number) => 14 + ((max - v) / span) * 72; // percent, 14..86
  const points = series.map((v, i) => `${(i / (series.length - 1)) * NOW_X},${y(v)}`).join(" ");
  const last = series[series.length - 1];

  return (
    <div className="relative -mx-1 min-h-[180px] flex-1" role="img" aria-label="Price versus entry, target and stop loss">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id="pos-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3fe0a6" stopOpacity="0.25" />
            <stop offset="1" stopColor="#3fe0a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {LINES.map(({ key, color }) => (
          <line
            key={key}
            x1="0"
            x2="97"
            y1={y(levels[key])}
            y2={y(levels[key])}
            stroke={color}
            strokeWidth="2"
            strokeDasharray="7 5"
            vectorEffect="non-scaling-stroke"
            opacity="0.85"
          />
        ))}
        <line x1={NOW_X} x2={NOW_X} y1="0" y2="92" stroke="#4cc9ff" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${points} ${NOW_X},100`} fill="url(#pos-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#3fe0a6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "drop-shadow(0 0 4px rgba(63,224,166,0.7))" }}
        />
      </svg>

      <span
        className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-cyan shadow-[0_0_10px_#4cc9ff]"
        style={{ left: `${NOW_X}%`, top: `${y(last)}%` }}
      />
      <span className="absolute -bottom-1 -translate-x-1/2 font-display text-[13px] font-semibold text-cyan" style={{ left: `${NOW_X}%` }}>
        Now
      </span>
      {startLabel && <span className="absolute -bottom-1 left-0 font-display text-[12px] text-white/60">{startLabel}</span>}

      {LINES.map(({ key, label, color, value }) => (
        <span key={key}>
          <span
            className="absolute right-0 size-3.5 -translate-y-1/2 rounded-full border-[2.5px] bg-navy-900"
            style={{ top: `${y(levels[key])}%`, borderColor: color }}
          />
          <span
            className="absolute -translate-y-[calc(100%+3px)] text-left font-display text-[13px] leading-tight"
            style={{ top: `${y(levels[key])}%`, left: `${NOW_X + 6}%`, color }}
          >
            {label}
            <span className="block font-semibold" style={{ color: value }}>
              {usd(levels[key])}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
