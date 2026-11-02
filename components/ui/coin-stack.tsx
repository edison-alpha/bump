import { cn } from "@/lib/cn";

/** Glossy gold coin stacks used on balance cards. */
export function CoinStack({ className }: { className?: string }) {
  const coin = (x: number, y: number, key: string) => (
    <g key={key}>
      <ellipse cx={x} cy={y + 4} rx="15" ry="6" fill="#c98a00" />
      <rect x={x - 15} y={y} width="30" height="4" fill="#e2a300" />
      <ellipse cx={x} cy={y} rx="15" ry="6" fill="url(#coin-top)" stroke="#e8a800" strokeWidth="1" />
      <ellipse cx={x - 4} cy={y - 2} rx="6" ry="1.6" fill="#fff6c4" opacity="0.8" />
    </g>
  );
  const stack = (x: number, base: number, count: number, id: string) =>
    Array.from({ length: count }, (_, i) => coin(x, base - i * 6, `${id}-${i}`));

  return (
    <svg viewBox="0 0 90 70" className={cn("w-20", className)} aria-hidden>
      <defs>
        <linearGradient id="coin-top" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff09a" />
          <stop offset="0.5" stopColor="#ffcf3d" />
          <stop offset="1" stopColor="#f0ab00" />
        </linearGradient>
      </defs>
      {stack(58, 46, 7, "b")}
      {stack(26, 58, 4, "a")}
      {stack(62, 62, 2, "c")}
    </svg>
  );
}
