"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMarket } from "@/modules/market/price-provider";
import { stopPrice, targetPrice } from "../calc";
import { useTrade } from "../trade-provider";

/**
 * Watches the open position for its target or stop, on whatever screen the player is on, then shows the result.
 *
 * Practice trades are watched here: the target fills at its own price (a resting limit order); the stop fills at the
 * price that crossed it, so it can slip past the stop like a real stop-market order.
 *
 * On chain the exchange holds the TP/SL, so nothing is decided here. When the open trade disappears without the player
 * closing it, the stop registry fired (or the account was liquidated) and bump-backend logged it: show the result.
 */
export function LimitWatcher() {
  const router = useRouter();
  const { position, closePosition, ready, mode, lastClosed, pending } = useTrade();
  const market = useMarket(position?.marketId ?? "btc");
  const closedId = useRef<string | null>(null);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "practice" || !ready || !position || market.priceStatus !== "live" || closedId.current === position.id) return;
    const price = market.price;
    const long = position.side === "long";
    const target = targetPrice(position.entry, position);
    const stop = stopPrice(position.entry, position);

    const hitTarget = long ? price >= target : price <= target;
    const hitStop = long ? price <= stop : price >= stop;
    if (!hitTarget && !hitStop) return;

    closedId.current = position.id;
    const done = hitTarget ? closePosition(100, target, "target") : closePosition(100, price, "stop");
    void done.then(() => router.replace("/position/closed"));
  }, [mode, ready, position, market.price, market.priceStatus, closePosition, router]);

  useEffect(() => {
    if (mode !== "chain" || !ready) return;
    const gone = lastSeen.current;
    lastSeen.current = position?.id ?? null;
    // our own close navigates itself; anything else that ended the trade did it on the exchange
    const ours = pending?.kind === "close";
    if (gone && !position && !ours && lastClosed?.id === gone) router.replace("/position/closed");
  }, [mode, ready, position, lastClosed?.id, pending?.kind, router]);

  return null;
}
