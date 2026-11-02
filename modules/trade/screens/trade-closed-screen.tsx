"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrimaryAction } from "@/components/console/console-provider";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Mascot } from "@/components/ui/mascot";
import { cn } from "@/lib/cn";
import { signedUsd, usd } from "@/lib/format";
import { TradeHistoryItem } from "../components/trade-history-item";
import { useTrade } from "../trade-provider";

export function TradeClosedScreen() {
  const router = useRouter();
  const { lastClosed, history, ready } = useTrade();

  useEffect(() => {
    if (ready && !lastClosed) router.replace("/markets");
  }, [ready, lastClosed, router]);

  usePrimaryAction({ label: "Back home", href: "/home" });

  if (!lastClosed) return <Screen title="Trade Closed">{null}</Screen>;
  const tone = lastClosed.pnl >= 0 ? "text-mint" : "text-coral";

  return (
    <Screen title="Trade Closed" back="/home">
      <div className="flex items-center gap-3">
        <Mascot size={96} accessory="check" sparkles="left" className="ml-5" />
        <div>
          <h2 className="text-pop font-display text-[28px] leading-tight font-bold">Trade closed</h2>
          <p className="text-[13px] leading-snug text-white">Your practice trade has been closed.</p>
        </div>
      </div>

      <Card className="px-3 py-2">
        <p className="flex items-center text-[14px]">
          Gross trading profit
          <InfoTip text="Profit before funding and costs are applied." />
        </p>
        <p className={cn("font-display text-[38px] leading-none font-bold tabular-nums", tone)}>{signedUsd(lastClosed.pnl)}</p>
        <p className="mt-0.5 text-[12px] text-white/85">Before funding and costs.</p>
        <div className="mt-2 grid grid-cols-2 border-t border-white/15 pt-1.5">
          <div className="border-r border-white/20">
            <p className="text-[12px]">Entry price</p>
            <p className="font-display text-[17px] font-bold tabular-nums">{usd(lastClosed.entry)}</p>
          </div>
          <div className="pl-3">
            <p className="text-[12px]">Exit price</p>
            <p className="font-display text-[17px] font-bold tabular-nums">{usd(lastClosed.exit)}</p>
          </div>
        </div>
        <Link href="/history" className="flex items-center justify-center gap-1 font-display text-[14px] font-semibold text-cyan">
          View final settlement <Icon name="chevron" size={16} />
        </Link>
      </Card>

      <Card className="px-3 pt-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[16px] font-semibold">Recent trades</h3>
          <Link href="/history" className="inline-flex items-center gap-1 font-display text-[13px] font-semibold text-cyan">
            View all <Icon name="chevron" size={16} />
          </Link>
        </div>
        <ul className="divide-y divide-white/10">
          {history.slice(0, 2).map((t) => (
            <TradeHistoryItem key={t.id} trade={t} />
          ))}
        </ul>
      </Card>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button variant="light" href="/history" className="font-bold">
          View full history
        </Button>
        <Button href="/home">Back home</Button>
      </div>
    </Screen>
  );
}
