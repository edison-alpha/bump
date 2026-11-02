"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTrade } from "./trade-provider";

/** A trade closed this recently is the reason the position is gone: show its result rather than the market list. */
const JUST_CLOSED_MS = 3000;

/** Returns the open position, or sends the user on once storage has loaded: to the result of a trade that just closed, else to pick a market. */
export function useRequirePosition(enabled = true) {
  const { position, lastClosed, ready } = useTrade();
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !ready || position) return;
    const justClosed = lastClosed && Date.now() - lastClosed.closedAt < JUST_CLOSED_MS;
    router.replace(justClosed ? "/position/closed" : "/markets");
  }, [enabled, ready, position, lastClosed, router]);

  return position;
}
