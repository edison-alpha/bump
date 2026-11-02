export type Period = "today" | "week" | "month";
export type Kind = "wins" | "losses";
export type Metric = "usd" | "pct";

export type Entry = { id: string; name: string; value: number; isYou?: boolean };
export type RankedEntry = Entry & { rank: number };

export const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export const METRICS: { value: Metric; label: string }[] = [
  { value: "usd", label: "Net PnL ($)" },
  { value: "pct", label: "Net PnL (%)" },
];

const PERIOD_SCALE: Record<Period, number> = { today: 0.4, week: 1, month: 2.6 };
const PRACTICE_BALANCE = 1000;

/** Sample data, weekly values. Replace with the leaderboard API response. */
const WINS: Entry[] = [
  { id: "nara", name: "Nara", value: 42.6 },
  { id: "kiko", name: "Kiko", value: 31.2 },
  { id: "miko", name: "Miko", value: 25.8 },
  { id: "luna", name: "Luna", value: 20.4 },
  { id: "sora", name: "Sora", value: 16.8 },
  { id: "dika", name: "Dika", value: 14.6 },
  { id: "riri", name: "Riri", value: 12.4 },
];

const LOSSES: Entry[] = [
  { id: "raka", name: "Raka", value: -24.8 },
  { id: "dito", name: "Dito", value: -19.4 },
  { id: "sena", name: "Sena", value: -15.6 },
  { id: "rumi", name: "Rumi", value: -12.2 },
  { id: "yuki", name: "Yuki", value: -8.4 },
];

/** How far back each period reaches, for the player's own closed trades. */
export const PERIOD_MS: Record<Period, number> = { today: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

/** The player, with their real net PnL for the period (from their trade history). */
type YouInput = { name: string; value: number } | null;

/**
 * The board for a kind and period. The player is always ranked against the sample entries, on the side their PnL
 * falls on (wins if >= 0, losses below), so they can see where they'd stand even while hidden from others.
 */
export function getLeaderboard(kind: Kind, period: Period, you: YouInput): RankedEntry[] {
  const scale = PERIOD_SCALE[period];
  const base = kind === "wins" ? WINS : LOSSES;
  const entries: Entry[] = base.map((e) => ({ ...e, value: Math.round(e.value * scale * 100) / 100 }));

  if (you && (kind === "wins" ? you.value >= 0 : you.value < 0)) {
    entries.push({ id: "you", name: you.name, value: Math.round(you.value * 100) / 100, isYou: true });
  }

  entries.sort((a, b) => (kind === "wins" ? b.value - a.value : a.value - b.value));
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

export const toMetric = (value: number, metric: Metric) =>
  metric === "usd" ? value : (value / PRACTICE_BALANCE) * 100;
