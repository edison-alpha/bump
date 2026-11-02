"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMarket } from "@/modules/market/price-provider";
import { stopPrice, targetPrice } from "../calc";
import { useTrade } from "../trade-provider";

/**
 * Closes the open position when the live price touches its profit target or stop loss, on whatever screen
 * the player is on, then shows the result. The target fills at its own price (a resting limit order); the stop
 * fills at the price that crossed it, so it can slip past the stop like a real stop-market order.
 */
export function LimitWatcher() {
  const router = useRouter();
  const { position, closePosition, ready } = useTrade();
  const market = useMarket(position?.marketId ?? "btc");
  const closedId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !position || closedId.current === position.id) return;
    const price = market.price;
    const long = position.side === "long";
    const target = targetPrice(position.entry, position);
    const stop = stopPrice(position.entry, position);

    const hitTarget = long ? price >= target : price <= target;
    const hitStop = long ? price <= stop : price >= stop;
    if (!hitTarget && !hitStop) return;

    closedId.current = position.id;
    if (hitTarget) closePosition(100, target, "target");
    else closePosition(100, price, "stop");
    router.replace("/position/closed");
  }, [ready, position, market.price, closePosition, router]);

  return null;
}
