"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConsoleProvider } from "@/components/console/console-provider";
import { ClickSounds } from "@/components/shell/click-sounds";
import { createQueryClient } from "@/lib/api/query";
import { hideki } from "@/lib/chain";
import { PRIVY_APP_ID, PRIVY_CONFIGURED } from "@/lib/privy-config";
import { PriceProvider } from "@/modules/market/price-provider";
import { ProgressProvider } from "@/modules/progress/progress-provider";
import { SessionProvider } from "@/modules/session/session-provider";
import { LimitWatcher } from "@/modules/trade/components/limit-watcher";
import { TradeProvider } from "@/modules/trade/trade-provider";

/** Mounts Privy only when an app id is configured; otherwise the app is guest-only (see lib/privy-config.ts). */
function Auth({ children }: { children: ReactNode }) {
  if (!PRIVY_CONFIGURED) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: { theme: "dark", accentColor: "#3aaeff" },
        // email/Google members get an embedded wallet (holding BUMP must sign without a popup, so its UI stays hidden);
        // members who sign in with their own wallet keep using it and get no embedded one
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        defaultChain: hideki,
        // Somnia Testnet is listed only so the wallet can switch to it for the Hideki bridge; trading stays on Hideki
        supportedChains: [hideki, somniaShannon],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  // one client per browser session; created in state so a re-render never drops the cache
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <Auth>
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
      </Auth>
    </QueryClientProvider>
  );
}
