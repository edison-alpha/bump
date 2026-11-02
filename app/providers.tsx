"use client";

import type { ReactNode } from "react";
import { ConsoleProvider } from "@/components/console/console-provider";
import { ClickSounds } from "@/components/shell/click-sounds";
import { PriceProvider } from "@/modules/market/price-provider";
import { SessionProvider } from "@/modules/session/session-provider";
import { TradeProvider } from "@/modules/trade/trade-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ClickSounds />
      <PriceProvider>
        <TradeProvider>
          <ConsoleProvider>{children}</ConsoleProvider>
        </TradeProvider>
      </PriceProvider>
    </SessionProvider>
  );
}
