"use client";

import { usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { TradeHistoryItem } from "../components/trade-history-item";
import { useTrade } from "../trade-provider";

export function HistoryScreen() {
  const { history } = useTrade();
  usePrimaryAction({ label: "Make my first call", href: "/markets" });

  return (
    <Screen title="Trade history">
      {history.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Mascot size={140} />
          <p className="font-display text-xl font-semibold">Nothing here yet</p>
          <p className="text-white/70">Close your first trade and it lands here.</p>
          <Button href="/markets" className="mt-2 max-w-56">
            Make my first call
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {history.map((t) => (
            <TradeHistoryItem key={t.id} trade={t} />
          ))}
        </ul>
      )}
    </Screen>
  );
}
