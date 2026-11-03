"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConsoleProvider } from "@/components/console/console-provider";
import { ClickSounds } from "@/components/shell/click-sounds";
import { createQueryClient } from "@/lib/api/query";
import { hideki } from "@/lib/chain";
import { PriceProvider } from "@/modules/market/price-provider";
import { ProgressProvider } from "@/modules/progress/progress-provider";
import { SessionProvider } from "@/modules/session/session-provider";
import { LimitWatcher } from "@/modules/trade/components/limit-watcher";
import { TradeProvider } from "@/modules/trade/trade-provider";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  // one client per browser session; created in state so a re-render never drops the cache
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ["email", "google"],
          appearance: { theme: "dark", accentColor: "#3aaeff" },
          // every member gets an embedded wallet; holding BUMP must sign without a popup, so wallet UIs stay hidden
          embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
          defaultChain: hideki,
          supportedChains: [hideki],
        }}
      >
        <SessionProvider>
          <ClickSounds />
          <PriceProvider>
            <TradeProvider>
              <ProgressProvider>
                <LimitWatcher />
                <ConsoleProvider>{children}</ConsoleProvider>
              </ProgressProvider>
            </TradeProvider>
          </PriceProvider>
        </SessionProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}
