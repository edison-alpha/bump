"use client";

import { isPerpMarket } from "@somnia-chain/markets-sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { Icon } from "@/components/ui/icon";
import { marketIdOf } from "@/lib/bump/dreamdex";
import { exchange } from "@/lib/chain/exchange";
import { signedPct, signedUsd, usd, usdPrice } from "@/lib/format";
import { useTrade } from "@/modules/trade/trade-provider";

type Row = {
  symbol: string;
  pool: string;
  marketId: string | null;
  side: "long" | "short";
  size: number;
  entry: number;
  mark: number | null;
  /** Unrealized PnL in USDso at the mark, null when the oracle has no usable price. */
  pnl: number | null;
  /** Price move since entry in the position's favour (+) or against it (−), in percent. */
  move: number | null;
  notional: number;
  stops: number;
};

/** The margin account as a whole: cross margin means every open position draws on the same equity. */
type Margin = { equity: number; required: number; status: string };

const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 2 : 4 });

/**
 * Every perp position the trading account holds on dreamDEX, read from the chain market by market (the indexer lags and
 * does not mark to market), with the unrealized PnL at the live mark and whether a TP/SL is armed. The account is the
 * linked dreamDEX smart account when there is one, the wallet otherwise.
 */
export function PositionsScreen() {
  const { setup, position, mode, external, focusPosition } = useTrade();
  const { flash } = useConsole();
  /** A trade bump has its own record of: it takes the position screens, so another position has to wait for it. */
  const ownTrade = !!position && !external;
  const account = setup?.account as Address | undefined;

  const positions = useQuery({
    queryKey: ["bump", "chain", "positions", account],
    enabled: !!account,
    refetchInterval: 15_000,
    queryFn: async (): Promise<{ rows: Row[]; margin: Margin | null }> => {
      const { client } = exchange();
      const markets = (await client.listMarkets({ marketType: "PERP", limit: 200 })).filter(isPerpMarket);
      const rows = await Promise.all(
        markets.map(async (m): Promise<Row | null> => {
          try {
            const p = await client.getPerpPosition({ marginBank: m.marginBank as Address, account: account as Address, pool: m.poolAddress as Address });
            if (p.size === 0n) return null;
            const long = p.size > 0n;
            const size = Number(formatUnits(long ? p.size : -p.size, m.baseDecimals));
            const entry = Number(formatUnits(p.avgEntryPrice, m.quoteDecimals));
            const feed = await client.getPerpFeedStatus(m.poolAddress as Address).catch(() => null);
            const mark = feed && feed.markPriceOk && feed.markPrice > 0n ? Number(formatUnits(feed.markPrice, m.quoteDecimals)) : null;
            const stops = m.stopRegistry ? await client.listPerpStopOrders({ account: account as Address, pool: m.poolAddress as Address, status: ["PENDING"] }).catch(() => []) : [];
            const dir = long ? 1 : -1;
            return {
              symbol: m.baseSymbol ?? "?",
              pool: m.poolAddress,
              marketId: marketIdOf(m),
              side: long ? "long" : "short",
              size,
              entry,
              mark,
              pnl: mark === null ? null : (mark - entry) * size * dir,
              move: mark === null || entry === 0 ? null : ((mark - entry) / entry) * 100 * dir,
              notional: size * (mark ?? entry),
              stops: stops.length,
            };
          } catch {
            return null;
          }
        }),
      );
      const found = rows.filter((r): r is Row => r !== null).sort((a, b) => b.notional - a.notional);
      const bank = markets[0]?.marginBank as Address | undefined;
      const acct = found.length > 0 && bank ? await client.getMarginAccount(bank, account as Address).catch(() => null) : null;
      const decimals = markets[0]?.quoteDecimals ?? 18;
      const margin = acct ? { equity: Number(formatUnits(acct.equity, decimals)), required: Number(formatUnits(acct.imReq, decimals)), status: String(acct.marginStatus) } : null;
      return { rows: found, margin };
    },
  });

  if (mode !== "chain" || !setup) {
    return (
      <Screen title="Positions">
        <Card className="px-3 py-3 text-[14px]">Open positions on dreamDEX show up here. Sign in to see yours.</Card>
      </Screen>
    );
  }

  const rows = positions.data?.rows ?? [];
  const margin = positions.data?.margin ?? null;
  const underwater = !!margin && (margin.status !== "Healthy" || margin.required > margin.equity);
  const totalPnl = rows.reduce((sum, r) => sum + (r.pnl ?? 0), 0);
  const priced = rows.every((r) => r.pnl !== null);
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
          {underwater && <p className="leading-snug text-coral">Your open positions use more margin than your equity, so no new trade can open. Close one below to free it.</p>}
        </Card>
      )}

      {rows.map((r) => {
        const shown = !ownTrade || (!!r.marketId && position?.marketId === r.marketId);
        const body = (
          <Card className="flex flex-col gap-1.5 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <CoinIcon symbol={r.symbol.toLowerCase()} size={36} />
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
              <span className={r.stops > 0 ? "text-mint" : "text-gold"}>{r.stops > 0 ? "TP/SL set" : "No TP/SL"}</span>
            </div>
          </Card>
        );
        return (
          <Link
            key={r.symbol}
            href="/position"
            aria-label={`Open your ${r.symbol} position`}
            onClick={(event) => {
              if (!shown) {
                event.preventDefault();
                flash("Close your current trade first, then open this one.", "warn");
                return;
              }
              // the position screens show this one (a no-op when it is the trade bump already tracks)
              focusPosition?.(r.pool);
            }}
          >
            {body}
          </Link>
        );
      })}

      {rows.some((r) => r.stops === 0) && <p className="text-[12px] leading-snug text-white/60">Tap a position for its details, to set a TP/SL or to close it.</p>}
    </Screen>
  );
}
