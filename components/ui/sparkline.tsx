import { useId } from "react";
import { cn } from "@/lib/cn";

type SparklineProps = {
  data: number[];
  className?: string;
  /** Force colour; defaults to last >= first. */
  positive?: boolean;
};

export function Sparkline({ data, className, positive }: SparklineProps) {
  const id = useId();
  if (data.length < 2) return null;

  const up = positive ?? data[data.length - 1] >= data[0];
  const color = up ? "#3ee0a0" : "#ff6b81";
  const min = Math.min(...data);
  const range = Math.max(...data) - min || 1;
  const points = data.map((v, i) => [(i / (data.length - 1)) * 100, 28 - ((v - min) / range) * 24 - 2] as const);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-7 w-20", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${line} 100,28`} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
