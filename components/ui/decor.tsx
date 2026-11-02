import { cn } from "@/lib/cn";

type DecorProps = { className?: string };

/** Three yellow "pop" strokes that frame the mascot. Mirror with `-scale-x-100`. */
export function Sparkles({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <g stroke="#ffcb3d" strokeWidth="5" strokeLinecap="round">
        <path d="M22 4 25 13" />
        <path d="M6 14 15 19" />
        <path d="M4 31 13 30" />
      </g>
    </svg>
  );
}

export function Star({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-7", className)} aria-hidden>
      <path
        d="m12 2 2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17l-6.1 3.3 1.4-6.7-5-4.6 6.8-.8L12 2Z"
        fill="#ffcb3d"
        stroke="#e7a400"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendArrow({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-10", className)} aria-hidden>
      <path d="M4 34 15 21l7 6L35 9" fill="none" stroke="#3fe0a6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 8h11v11" fill="none" stroke="#3fe0a6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Soft cloud bank / bushes that sit behind the mascot. */
export function Clouds({ className, tone = "blue" }: DecorProps & { tone?: "blue" | "mixed" }) {
  const back = tone === "mixed" ? "#1f8a5b" : "#1c5fa6";
  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" className={cn("h-16 w-full", className)} aria-hidden>
      <g fill={back} opacity="0.85">
        <circle cx="30" cy="62" r="34" />
        <circle cx="80" cy="58" r="26" />
      </g>
      <g fill="#2b78c9" opacity="0.75">
        <circle cx="320" cy="56" r="30" />
        <circle cx="370" cy="48" r="34" />
        <circle cx="270" cy="68" r="22" />
      </g>
      <g fill="#3a92e3" opacity="0.55">
        <circle cx="130" cy="74" r="22" />
        <circle cx="200" cy="80" r="26" />
      </g>
    </svg>
  );
}

/** Light-blue envelope used by the email + verify mascots. */
export function Envelope({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 64 48" className={cn("w-16", className)} aria-hidden>
      <defs>
        <linearGradient id="env-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f2f9ff" />
          <stop offset="1" stopColor="#b9dcf7" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="60" height="40" rx="6" fill="url(#env-g)" stroke="#8cc2ec" strokeWidth="2" />
      <path d="M4 8 32 28 60 8" fill="none" stroke="#8cc2ec" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckBadge({ className }: DecorProps) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-12", className)} aria-hidden>
      <defs>
        <linearGradient id="chk-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#62f6be" />
          <stop offset="1" stopColor="#17a571" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill="url(#chk-g)" stroke="#fff" strokeWidth="3" />
      <path d="m14 25 7 7 13-14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
