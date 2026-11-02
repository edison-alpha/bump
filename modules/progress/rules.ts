/** XP per action. A target hit stacks with the win, so a clean call pays 50. */
export const XP = { call: 10, close: 10, win: 15, target: 25 } as const;

export type MissionCounter = "calls" | "wins" | "targets";

/** Daily missions; counters reset at local midnight. */
export const MISSIONS = [
  { id: "calls", label: "Make 3 calls", counter: "calls", goal: 3, xp: 30 },
  { id: "wins", label: "Close 2 trades in profit", counter: "wins", goal: 2, xp: 30 },
  { id: "target", label: "Hit a profit target", counter: "targets", goal: 1, xp: 30 },
] as const satisfies readonly { id: string; label: string; counter: MissionCounter; goal: number; xp: number }[];

/** XP needed to reach `level` from zero: 0, 100, 300, 600, 1000 … (each level costs 100 more than the last). */
const levelFloor = (level: number) => 50 * level * (level - 1);

/** Level for an XP total, plus progress through it. */
export function levelInfo(xp: number) {
  let level = 1;
  while (levelFloor(level + 1) <= xp) level++;
  const floor = levelFloor(level);
  const size = levelFloor(level + 1) - floor;
  return { level, into: xp - floor, size };
}
