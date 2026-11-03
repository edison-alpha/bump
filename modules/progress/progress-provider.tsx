"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query";
import type { ProgressView } from "@/lib/api/types";
import { sfx } from "@/lib/sound";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { MISSIONS, XP, levelInfo, type MissionCounter } from "./rules";

/** What the last closed trade earned; the Closed screen shows it. */
export type Reward = {
  tradeId: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  /** Labels of daily missions this trade completed. */
  missions: string[];
  streak: number;
  /** The guided first trade just finished. */
  firstTrade: boolean;
};

type Counters = Record<MissionCounter, number>;

type ProgressState = {
  xp: number;
  /** Consecutive days with at least one trade; `day` is the last of them (local YYYY-MM-DD). */
  streak: { count: number; day: string | null };
  /** Today's mission counters, reset when the day changes. */
  daily: { day: string | null; counters: Counters };
  tutorialDone: boolean;
  /** Position / closed trade already rewarded, so a reload never pays twice. */
  seenPositionId: string | null;
  seenClosedId: string | null;
  lastReward: Reward | null;
};

const ZERO: Counters = { calls: 0, wins: 0, targets: 0 };

const INITIAL: ProgressState = {
  xp: 0,
  streak: { count: 0, day: null },
  daily: { day: null, counters: ZERO },
  tutorialDone: false,
  seenPositionId: null,
  seenClosedId: null,
  lastReward: null,
};

/** Trades older than this when the app starts were made before progress existed: marked seen, not rewarded. */
const LEGACY_MS = 5000;

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const todayCounters = (s: ProgressState, today: string): Counters => (s.daily.day === today ? s.daily.counters : ZERO);

function bumpStreak(streak: ProgressState["streak"], now: number): ProgressState["streak"] {
  const today = dayKey(now);
  if (streak.day === today) return streak;
  const yesterday = dayKey(now - 86_400_000);
  return { count: streak.day === yesterday ? streak.count + 1 : 1, day: today };
}

/** Mission XP for counters going from `before` to `after`, and the labels of missions that just completed. */
function completed(before: Counters, after: Counters) {
  const done = MISSIONS.filter((m) => before[m.counter] < m.goal && after[m.counter] >= m.goal);
  return { xp: done.reduce((sum, m) => sum + m.xp, 0), labels: done.map((m) => m.label) };
}

type ProgressContextValue = {
  ready: boolean;
  xp: number;
  level: ReturnType<typeof levelInfo>;
  /** Streak still alive today (traded today or yesterday), else 0. */
  streak: number;
  tradedToday: boolean;
  missions: { id: string; label: string; goal: number; progress: number; done: boolean }[];
  tutorialActive: boolean;
  lastReward: Reward | null;
  skipTutorial: () => void;
  restartTutorial: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

/** Guest progress: watches the practice trades and turns opens / closes into XP, missions and streak days, in localStorage. */
function LocalProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState, ready] = useLocalStorageState<ProgressState>("bump:progress", INITIAL);
  const trade = useTrade();
  const startedAt = useRef(Date.now());

  const position = trade.position;
  const lastClosed = trade.lastClosed;

  useEffect(() => {
    if (!ready || !trade.ready || !position || position.id === state.seenPositionId) return;
    if (position.openedAt < startedAt.current - LEGACY_MS) {
      setState((s) => ({ ...s, seenPositionId: position.id }));
      return;
    }
    const now = Date.now();
    const today = dayKey(now);
    const before = todayCounters(state, today);
    const after = { ...before, calls: before.calls + 1 };
    const missions = completed(before, after);
    setState((s) => ({
      ...s,
      xp: s.xp + XP.call + missions.xp,
      streak: bumpStreak(s.streak, now),
      daily: { day: today, counters: after },
      seenPositionId: position.id,
    }));
  }, [ready, trade.ready, position, state, setState]);

  useEffect(() => {
    if (!ready || !trade.ready || !lastClosed || lastClosed.id === state.seenClosedId) return;
    if (lastClosed.closedAt < startedAt.current - LEGACY_MS) {
      // existing player from before progress: they've done a trade, so no tutorial
      setState((s) => ({ ...s, seenClosedId: lastClosed.id, tutorialDone: true }));
      return;
    }
    const now = Date.now();
    const today = dayKey(now);
    const win = lastClosed.pnl > 0;
    const target = lastClosed.reason === "target";
    const before = todayCounters(state, today);
    const after = { ...before, wins: before.wins + (win ? 1 : 0), targets: before.targets + (target ? 1 : 0) };
    const missions = completed(before, after);
    const gained = XP.close + (win ? XP.win : 0) + (target ? XP.target : 0) + missions.xp;
    const levelBefore = levelInfo(state.xp).level;
    const levelAfter = levelInfo(state.xp + gained).level;
    const streak = bumpStreak(state.streak, now);

    setState((s) => ({
      ...s,
      xp: s.xp + gained,
      streak,
      daily: { day: today, counters: after },
      seenClosedId: lastClosed.id,
      tutorialDone: true,
      lastReward: {
        tradeId: lastClosed.id,
        xp: gained,
        levelBefore,
        levelAfter,
        missions: missions.labels,
        streak: streak.count,
        firstTrade: !s.tutorialDone,
      },
    }));
    // after the close jingle
    if (levelAfter > levelBefore) setTimeout(() => sfx.levelUp(), 700);
  }, [ready, trade.ready, lastClosed, state, setState]);

  const skipTutorial = useCallback(() => setState((s) => ({ ...s, tutorialDone: true })), [setState]);
  const restartTutorial = useCallback(() => setState((s) => ({ ...s, tutorialDone: false })), [setState]);

  const value = useMemo<ProgressContextValue>(() => {
    const now = Date.now();
    const today = dayKey(now);
    const counters = todayCounters(state, today);
    const alive = state.streak.day === today || state.streak.day === dayKey(now - 86_400_000);
    return {
      ready,
      xp: state.xp,
      level: levelInfo(state.xp),
      streak: alive ? state.streak.count : 0,
      tradedToday: state.streak.day === today,
      missions: MISSIONS.map((m) => ({
        id: m.id,
        label: m.label,
        goal: m.goal,
        progress: Math.min(m.goal, counters[m.counter]),
        done: counters[m.counter] >= m.goal,
      })),
      tutorialActive: ready && !state.tutorialDone,
      lastReward: state.lastReward,
      skipTutorial,
      restartTutorial,
    };
  }, [state, ready, skipTutorial, restartTutorial]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/**
 * Member progress: XP, missions, streak and the tutorial flag as bump-backend computes them from the verified trade log.
 * The browser never sends XP, so it cannot be edited here; this only reads and refreshes after every trade.
 */
function ServerProgressProvider({ address, children }: { address: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const key = qk.progress(address);
  const query = useQuery({ queryKey: key, queryFn: () => api<ProgressView>("/api/me/progress"), staleTime: 15_000 });
  const tutorial = useMutation({
    mutationFn: (tutorialDone: boolean) => api("/api/me/prefs", { body: { tutorialDone } }),
    onMutate: (tutorialDone) => queryClient.setQueryData<ProgressView>(key, (p) => (p ? { ...p, tutorialDone } : p)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const { mutate: setTutorialDone } = tutorial;
  const data = query.data;

  const value = useMemo<ProgressContextValue>(
    () => ({
      ready: query.isSuccess,
      xp: data?.xp ?? 0,
      level: data?.level ?? levelInfo(0),
      streak: data?.streak ?? 0,
      tradedToday: data?.tradedToday ?? false,
      missions: data?.missions ?? MISSIONS.map((m) => ({ id: m.id, label: m.label, goal: m.goal, progress: 0, done: false })),
      tutorialActive: query.isSuccess && !data?.tutorialDone,
      lastReward: data?.lastReward ?? null,
      skipTutorial: () => setTutorialDone(true),
      restartTutorial: () => setTutorialDone(false),
    }),
    [query.isSuccess, data, setTutorialDone],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/** Members see what the server computed; guests keep their own progress on this device. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (session.status === "member" && session.address) return <ServerProgressProvider address={session.address}>{children}</ServerProgressProvider>;
  return <LocalProgressProvider>{children}</LocalProgressProvider>;
}
export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}
