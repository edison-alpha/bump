"use client";

import { isPerpMarket } from "@somnia-chain/markets-sdk";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { formatUnits, isAddress, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/ui/coin-icon";
import { marketIdOf } from "@/lib/bump/dreamdex";
import { STYLES } from "@/lib/bump/shared/calc";
import { exchange } from "@/lib/chain/exchange";
import { signedPct, signedUsd, usd, usdPrice } from "@/lib/format";
import { useTrade } from "@/modules/trade/trade-provider";

const qty = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 2 : 6 });
const CLOSE_STEPS = [25, 50, 75, 100] as const;

type Stop = { kind: "TP" | "SL"; trigger: number };
type Detail = {
  symbol: string;
  marketId: string | null;
  side: "long" | "short";
  size: number;
  entry: number;
  mark: number | null;
  pnl: number | null;
  move: number | null;
  notional: number;
  stops: Stop[];
  /** What closing everything now would pay out after the PnL, funding and fee; null when the book has no price. */
  netIfClosed: number | null;
  margin: { equity: number; required: number; status: string } | null;
};

/**
 * One on-chain position in full: how it stands against the live mark, the TP/SL armed on it (with their trigger
 * prices), what closing it would pay, and the two things you do with it: set protection and close some or all.
 * Everything is read from the chain, so it works for a position bump did not open too.
 */
export function PositionDetailScreen({ pool }: { pool: string }) {
  const { setup, position, mode, closeOnChain, setLimitsOnChain } = useTrade();
  const { flash } = useConsole();
  const account = setup?.account as Address | undefined;
  const [percent, setPercent] = useState<number>(100);
  const [confirmClose, setConfirmClose] = useState(false);
  const [working, setWorking] = useState<"close" | "limits" | null>(null);

  const valid = isAddress(pool);
  const detail = useQuery({
    queryKey: ["bump", "chain", "position", account, pool],
    enabled: !!account && valid,
    refetchInterval: 8_000,
    queryFn: async (): Promise<Detail | null> => {
      const { client } = exchange();
      const m = (await client.listMarkets({ marketType: "PERP", limit: 200 })).filter(isPerpMarket).find((x) => x.poolAddress.toLowerCase() === pool.toLowerCase());
      if (!m) return null;
      const p = await client.getPerpPosition({ marginBank: m.marginBank as Address, account: account as Address, pool: m.poolAddress as Address });
      if (p.size === 0n) return null;
      const long = p.size > 0n;
      const dir = long ? 1 : -1;
      const size = Number(formatUnits(long ? p.size : -p.size, m.baseDecimals));
      const entry = Number(formatUnits(p.avgEntryPrice, m.quoteDecimals));
      const feed = await client.getPerpFeedStatus(m.poolAddress as Address).catch(() => null);
      const mark = feed && feed.markPriceOk && feed.markPrice > 0n ? Number(formatUnits(feed.markPrice, m.quoteDecimals)) : null;
      const pending = m.stopRegistry ? await client.listPerpStopOrders({ account: account as Address, pool: m.poolAddress as Address, status: ["PENDING"] }).catch(() => []) : [];
      // a stop that fires above (operator 0) is the target of a long and the stop of a short; below (1) is the reverse
      const stops: Stop[] = pending
        .map((s): Stop => ({ kind: (s.triggerOperator === 0) === long ? "TP" : "SL", trigger: Number(formatUnits(BigInt(s.triggerPrice), m.quoteDecimals)) }))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "TP" ? -1 : 1));
      const preview = await client.previewPerpClosePnl({ pool: m.poolAddress as Address, marginBank: m.marginBank as Address, account: account as Address }).catch(() => null);
      const acct = await client.getMarginAccount(m.marginBank as Address, account as Address).catch(() => null);
      return {
        symbol: m.baseSymbol ?? "?",
        marketId: marketIdOf(m),
        side: long ? "long" : "short",
        size,
        entry,
        mark,
        pnl: mark === null ? null : (mark - entry) * size * dir,
        move: mark === null || entry === 0 ? null : ((mark - entry) / entry) * 100 * dir,
        notional: size * (mark ?? entry),
        stops,
        netIfClosed: preview && preview.priceable ? Number(formatUnits(preview.netProceeds, m.quoteDecimals)) : null,
        margin: acct ? { equity: Number(formatUnits(acct.equity, m.quoteDecimals)), required: Number(formatUnits(acct.imReq, m.quoteDecimals)), status: String(acct.marginStatus) } : null,
      };
    },
  });

  if (mode !== "chain" || !setup) {
    return (
      <Screen title="Position">
        <Card className="px-3 py-3 text-[14px]">Open positions on dreamDEX show up here. Sign in to see yours.</Card>
      </Screen>
    );
  }
  if (!valid) {
    return (
      <Screen title="Position">
        <Card className="px-3 py-3 text-[14px]">That isn&apos;t a position.</Card>
      </Screen>
    );
  }
  if (detail.isPending) {
    return (
      <Screen title="Position">
        <Card className="px-3 py-3 text-[14px]">Reading your position…</Card>
      </Screen>
    );
  }

  const d = detail.data;
  if (!d) {
    return (
      <Screen title="Position">
        <Card className="flex flex-col items-center gap-2 px-3 py-4 text-center">
          <p className="font-display text-[17px] font-bold">{detail.isError ? "Couldn't read this position" : "This position is closed"}</p>
          <p className="text-[13px] text-white/80">{detail.isError ? "Try again in a moment." : "Nothing is open here any more."}</p>
          <Link href="/positions" className="w-full">
            <Button size="sm">Back to positions</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  const tracked = !!position && !!d.marketId && position.marketId === d.marketId;
  const up = (d.pnl ?? 0) >= 0;
  const underwater = !!d.margin && (d.margin.status !== "Healthy" || d.margin.required > d.margin.equity);

  const close = async () => {
    if (!closeOnChain) return;
    if (!confirmClose) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    setWorking("close");
    try {
      await closeOnChain(pool, percent);
      flash(percent >= 100 ? `${d.symbol} closed.` : `Closed ${percent}% of ${d.symbol}.`, "good");
      await detail.refetch();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Couldn't close it. Try again.", "warn");
    } finally {
      setWorking(null);
    }
  };
  const protect = async (style: (typeof STYLES)[number]) => {
    if (!setLimitsOnChain) return;
    setWorking("limits");
    try {
      await setLimitsOnChain(pool, style.targetPct, style.stopPct);
      flash("TP/SL set.", "good");
      await detail.refetch();
    } catch (error) {
      flash(error instanceof Error ? error.message : "Couldn't set TP/SL. Try again.", "warn");
    } finally {
      setWorking(null);
    }
  };

  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[11px] text-white/65">{label}</span>
      <span className="font-display text-[15px] leading-tight font-bold tabular-nums">{value}</span>
    </div>
  );

  return (
    <Screen title={`${d.symbol} position`}>
      <Card className="flex items-center gap-2.5 px-3 py-2.5">
        <CoinIcon symbol={d.symbol} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-[18px] leading-tight font-bold">
            {d.symbol}
            <span className={`rounded-full px-2 py-px text-[10px] font-bold tracking-[0.08em] ${d.side === "long" ? "bg-mint/20 text-mint" : "bg-coral/20 text-coral"}`}>{d.side.toUpperCase()}</span>
          </p>
          <p className="text-[12px] text-white/75">
            {qty(d.size)} {d.symbol} · {usd(d.notional)}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-display text-[22px] leading-tight font-bold tabular-nums ${up ? "text-mint" : "text-coral"}`}>{d.pnl === null ? "–" : signedUsd(d.pnl)}</p>
          <p className="text-[12px] text-white/75 tabular-nums">{d.move === null ? "no price" : signedPct(d.move, 2)}</p>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
        {stat("Entry price", usdPrice(d.entry))}
        {stat("Current price", d.mark === null ? "–" : usdPrice(d.mark))}
        {stat("Size", `${qty(d.size)} ${d.symbol}`)}
        {stat("Worth now", usd(d.notional))}
        {stat("If you close now", d.netIfClosed === null ? "–" : signedUsd(d.netIfClosed))}
        {stat("Margin status", d.margin ? (underwater ? "Needs attention" : "Healthy") : "–")}
      </Card>
      {underwater && d.margin && (
        <p className="text-[12px] leading-snug text-coral">
          This position uses {usd(d.margin.required)} of margin and your equity is {usd(d.margin.equity)}, so no new trade can open until it is closed or topped up.
        </p>
      )}

      <Card className="flex flex-col gap-1.5 px-3 py-2.5">
        <p className="text-[14px]">TP/SL</p>
        {d.stops.length === 0 ? (
          <p className="text-[12px] text-gold">None set. This position isn&apos;t protected.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-[14px]">
            {d.stops.map((s, i) => (
              <li key={`${s.kind}${i}`} className="flex justify-between">
                <span className={s.kind === "TP" ? "text-mint" : "text-coral"}>{s.kind === "TP" ? "Take profit" : "Stop loss"}</span>
                <span className="tabular-nums">{usdPrice(s.trigger)}</span>
              </li>
            ))}
          </ul>
        )}
        {tracked ? (
          <p className="text-[12px] text-white/70">This is your current trade: change its limits from its own screen.</p>
        ) : (
          setLimitsOnChain && (
            <>
              <p className="text-[12px] text-white/70">{d.stops.length ? "Replace them" : "Set them"} from the current price. Two stops cost 0.3 STT, refunded when they are cancelled.</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((style) => (
                  <Button key={style.id} size="sm" variant="outline" disabled={working !== null} onClick={() => void protect(style)}>
                    {working === "limits" ? "…" : `${style.label} +${style.targetPct}/−${style.stopPct}%`}
                  </Button>
                ))}
              </div>
            </>
          )
        )}
      </Card>

      {tracked ? (
        <Link href="/position" className="w-full">
          <Button>Open this trade</Button>
        </Link>
      ) : (
        closeOnChain && (
          <Card className="flex flex-col gap-2 px-3 py-2.5">
            <p className="text-[14px]">Close</p>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="How much to close">
              {CLOSE_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  aria-pressed={percent === step}
                  disabled={working !== null}
                  onClick={() => {
                    setPercent(step);
                    setConfirmClose(false);
                  }}
                  className={`rounded-full px-2 py-1.5 text-[13px] font-semibold ${percent === step ? "bg-white/20" : "bg-white/5 text-white/60"}`}
                >
                  {step}%
                </button>
              ))}
            </div>
            <Button variant={confirmClose ? "primary" : "outline"} disabled={working !== null} onClick={() => void close()}>
              {working === "close" ? "Closing…" : confirmClose ? `Tap again to close ${percent}%` : `Close ${percent}%`}
            </Button>
            <p className="text-[12px] leading-snug text-white/65">A market order against the live book, up to 1% from the current price. Closing all of it also cancels its TP/SL.</p>
          </Card>
        )
      )}
    </Screen>
  );
}
