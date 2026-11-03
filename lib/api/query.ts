import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

/**
 * One cache for everything read from bump-backend. 4xx answers are final (bad input, signed out, taken username), so
 * only network failures and 5xx are retried.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}

/** Query keys in one place, so a write can invalidate exactly what it changed. */
export const qk = {
  all: ["bump"] as const,
  leaderboard: (kind: string, period: string, viewer: string) => ["bump", "leaderboard", kind, period, viewer] as const,
  leaderboards: ["bump", "leaderboard"] as const,
  progress: (address: string) => ["bump", "progress", address] as const,
  trades: (address: string) => ["bump", "trades", address] as const,
  push: ["bump", "push"] as const,
};
