"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTrade } from "./trade-provider";

/** Returns the open position, or sends the user back to pick a market once storage has loaded. */
export function useRequirePosition(enabled = true) {
  const { position, ready } = useTrade();
  const router = useRouter();

  useEffect(() => {
    if (enabled && ready && !position) router.replace("/markets");
  }, [enabled, ready, position, router]);

  return position;
}
