"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatUnits, type Address } from "viem";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Icon } from "@/components/ui/icon";
import { exchange } from "@/lib/chain/exchange";
import { perpRows, useChainPositions } from "@/lib/chain/positions";
import { signedPct, signedUsd, usd, usdPrice } from "@/lib/format";
import { useTrade } from "@/modules/trade/trade-provider";

const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 2 : 4 });

/**
 * Every perp position the trading account holds on dreamDEX, with the unrealized PnL at the live mark and whether a
 * TP/SL is armed, and the margin they all share. The positions come from one read shared with the rest of the app
 * (lib/chain/positions.ts). The account is the linked dreamDEX smart account when there is one, the wallet otherwise.
 */
export function PositionsScreen() {
  const queryClient = useQueryClient();
  const { setup, mode, focusPosition } = useTrade();
  const account = setup?.account as Address | undefined;

  const positions = useChainPositions(account, mode === "chain");
  const rows = positions.data ?? [];

  // cross margin: every open position draws on the same equity
  const margin = useQuery({
    queryKey: ["bump", "chain", "margin", account],
    enabled: !!account && rows.length > 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const m = (await perpRows(queryClient))[0];
      if (!m) return null;
      const acct = await exchange().client.getMarginAccount(m.marginBank as Address, account as Address);
      return { equity: Number(formatUnits(acct.equity, m.quoteDecimals)), required: Number(formatUnits(acct.imReq, m.quoteDecimals)), status: String(acct.marginStatus) };
    },
  }).data;
  const underwater = !!margin && (margin.status !== "Healthy" || margin.required > margin.equity);

  if (mode !== "chain" || !setup) {
    return (
      <Screen title="Positions">
        <Card className="px-3 py-3 text-[14px]">Open positions on dreamDEX show up here. Sign in to see yours.</Card>
      </Screen>
    );
  }

  // unrealized profit at the mark, priced per position
  const shown = rows.map((r) => {
    const dir = r.side === "long" ? 1 : -1;
    return {
      ...r,
      pnl: r.mark === null ? null : (r.mark - r.entry) * r.size * dir,
      move: r.mark === null || r.entry === 0 ? null : ((r.mark - r.entry) / r.entry) * 100 * dir,
      notional: r.size * (r.mark ?? r.entry),
    };
  });
  const totalPnl = shown.reduce((sum, r) => sum + (r.pnl ?? 0), 0);
  const priced = shown.every((r) => r.pnl !== null);

  return (
    <Screen title="Positions">
      {positions.isPending && <Card className="px-3 py-3 text-[14px]">Reading your positions…</Card>}
      {positions.isError && <Card className="px-3 py-3 text-[14px]">Couldn&apos;t read your positions. They refresh on their own.</Card>}

      {positions.data && rows.length === 0 && (
        <Card className="flex flex-col items-center gap-2 px-3 py-4 text-center">
          <p className="font-display text-[17px] font-bold">No open positions</p>
          <p className="text-[13px] text-white/80">Make a call and it shows up here, with its live profit or loss.</p>
          <Link href="/markets" className="w-full">
            <Button size="sm">Make a call</Button>
          </Link>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="flex items-center justify-between px-3 py-2">
          <span className="text-[13px] text-white/80">
            {rows.length} open · unrealized{priced ? "" : " (some unpriced)"}
          </span>
          <span className={`font-display text-[18px] font-bold tabular-nums ${totalPnl >= 0 ? "text-mint" : "text-coral"}`}>{signedUsd(totalPnl)}</span>
        </Card>
      )}

      {margin && (
        <Card className="flex flex-col gap-0.5 px-3 py-2 text-[12px]">
          <p className="flex justify-between text-white/80">
            <span>Margin (shared by all positions)</span>
            <span className={underwater ? "font-semibold text-coral" : "text-mint"}>{underwater ? "Needs attention" : "Healthy"}</span>
          </p>
          <p className="flex justify-between tabular-nums text-white/75">
            <span>Equity {usd(margin.equity)}</span>
            <span>Required {usd(margin.required)}</span>
          </p>
          {underwater && <p className="leading-snug text-coral">Your open positions use more margin than your equity, so no new trade can open. Close one to free it.</p>}
        </Card>
      )}

      {shown.map((r) => {
        return (
          <Link
            key={r.pool}
            href="/position"
            aria-label={`Open your ${r.symbol} position`}
            // the position screens show this one
            onClick={() => focusPosition?.(r.pool)}
          >
            <Card className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <CoinIcon symbol={r.symbol} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-display text-[16px] leading-tight font-bold">
                    {r.symbol}
                    <span className={`rounded-full px-2 py-px text-[10px] font-bold tracking-[0.08em] ${r.side === "long" ? "bg-mint/20 text-mint" : "bg-coral/20 text-coral"}`}>{r.side.toUpperCase()}</span>
                  </p>
                  <p className="text-[12px] text-white/75">
                    {qty(r.size)} {r.symbol} · {usd(r.notional)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-display text-[16px] leading-tight font-bold tabular-nums ${(r.pnl ?? 0) >= 0 ? "text-mint" : "text-coral"}`}>{r.pnl === null ? "–" : signedUsd(r.pnl)}</p>
                  <p className="text-[12px] text-white/75 tabular-nums">{r.move === null ? "no price" : signedPct(r.move, 2)}</p>
                </div>
                <Icon name="chevron" size={20} className="shrink-0 text-white" />
              </div>
              <div className="flex items-center justify-between text-[12px] text-white/75">
                <span>
                  Entry {usdPrice(r.entry)} → {r.mark === null ? "–" : usdPrice(r.mark)}
                </span>
                <span className={r.stops.length > 0 ? "text-mint" : "text-gold"}>{r.stops.length > 0 ? "TP/SL set" : "No TP/SL"}</span>
              </div>
            </Card>
          </Link>
        );
      })}

      {rows.length > 0 && <p className="text-[12px] leading-snug text-white/60">Tap a position for its details, to set a TP/SL or to close it.</p>}
    </Screen>
  );
}
