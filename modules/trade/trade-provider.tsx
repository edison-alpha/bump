"use client";

import type { ReactNode } from "react";
import { useSession } from "@/modules/session/session-provider";
import { ChainTradeProvider } from "./chain-trade-provider";
import { LocalTradeProvider } from "./local-trade-provider";

export { MIN_STAKE, useTrade } from "./trade-context";

/**
 * Members trade for real on dreamDEX (signed by their embedded wallet); guests, and anyone whose wallet is not ready,
 * play with practice money. Both fill the same trade context, so screens never know which one they are on.
 */
export function TradeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (session.status === "member" && session.address) return <ChainTradeProvider address={session.address}>{children}</ChainTradeProvider>;
  return <LocalTradeProvider>{children}</LocalTradeProvider>;
}
