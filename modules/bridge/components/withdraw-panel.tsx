"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortError } from "@/lib/bump/dreamdex";
import { GAS_ENVELOPE_STT, SIDES } from "@/lib/chain/bridge";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets } from "@/lib/chain/markets";
import { floorDp } from "@/lib/chain/swap";
import { useTrade } from "@/modules/trade/trade-provider";
import { useSender } from "../use-send";

const amountOf = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 6 });
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const plain = (x: number, dp: number) => (x.toFixed(dp).includes(".") ? x.toFixed(dp).replace(/\.?0+$/, "") : x.toFixed(dp));

/**
 * Takes USDso out of trading. Step one pulls free collateral from the margin account back to the account that trades
 * (the margin account refuses anything that would put an open trade at risk, and house-money vouchers stay in). Step
 * two, only when the player trades through a dreamDEX smart account, sends that USDso on to their own wallet.
 */
export function WithdrawPanel() {
  const { setup, withdraw } = useTrade();
  const { data: markets } = useChainMarkets();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const send = useSender();
  const [value, setValue] = useState("");
  const [moveValue, setMoveValue] = useState("");

  const perp = markets ? Object.values(markets)[0] : undefined;
  const bank = perp?.marginBank as Address | undefined;
  const wallet = setup?.address as Address | undefined;
  const account = setup?.account as Address | undefined;
  const linked = !!setup?.linked;
  const decimals = perp?.quoteDecimals ?? 18;

  const holdings = useQuery({
    queryKey: ["bump", "withdraw", "holdings", account, wallet, perp?.quoteToken],
    enabled: !!account && !!wallet && !!perp && !!bank,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { client } = exchange();
      const [margin, held, gas] = await Promise.all([
        client.getMarginAccount(bank as Address, account as Address),
        client.getBalances([{ token: perp?.quoteToken as Address }], account as Address),
        client.getNativeBalance(wallet as Address),
      ]);
      return {
        equity: Number(formatUnits(margin.equity, decimals)),
        free: Number(formatUnits(margin.withdrawable > 0n ? margin.withdrawable : 0n, decimals)),
        held: Number(formatUnits(held[0] ?? 0n, decimals)),
        gas: Number(formatUnits(gas, 18)),
      };
    },
  });
  const data = holdings.data;

  const out = useMutation({
    mutationFn: (amount: string) => (withdraw ? withdraw(amount) : Promise.reject(new Error("Withdrawing isn't available here."))),
    onSuccess: () => {
      setValue("");
      void holdings.refetch();
      flash(linked ? "Withdrawn to your dreamDEX account." : "Withdrawn to your wallet.", "good");
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });

  // linked accounts only: the account sends its USDso on to the wallet
  const move = useMutation({
    mutationFn: async () => {
      if (!wallet || !account || !perp) throw new Error("Your wallet isn't ready yet.");
      if ((data?.gas ?? 0) < GAS_ENVELOPE_STT) throw new Error(`Your wallet needs at least ${GAS_ENVELOPE_STT} STT on ${SIDES.hideki.name} to send this. Top it up and try again.`);
      const amount = Number(moveValue) || 0;
      if (amount <= 0) throw new Error("Enter an amount to send.");
      const dp = Math.min(decimals, 8);
      await send({
        chain: "hideki",
        token: { symbol: "USDso", address: perp.quoteToken as Address, decimals },
        to: wallet,
        raw: parseUnits(plain(floorDp(amount, dp), dp), decimals),
        wallet,
        fromAccount: account,
      });
    },
    onSuccess: () => {
      setMoveValue("");
      void holdings.refetch();
      void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
      flash("USDso sent to your wallet.", "good");
    },
    onError: (error) => flash(error instanceof Error && error.message.length < 150 && /^(The|Your|Enter)/.test(error.message) ? error.message : shortError(error), "warn"),
  });

  if (!setup || !withdraw) return <Card className="px-3 py-3 text-[14px]">Withdrawing is for real dreamDEX trading. Sign in to use it.</Card>;
  if (holdings.isPending) return <Card className="px-3 py-3 text-[14px]">Loading your balances…</Card>;
  if (!data) return <Card className="px-3 py-3 text-[14px]">Couldn&apos;t read your balances. They refresh on their own.</Card>;

  const entered = Number(value) || 0;
  const moved = Number(moveValue) || 0;
  const target = linked ? "your dreamDEX account" : "your wallet";

  return (
    <div className="flex flex-col gap-2">
      <Card className="flex flex-col gap-1 px-3 py-2.5 text-[14px]">
        <p className="flex justify-between"><span>In trading</span><span className="tabular-nums">{amountOf(data.equity)} USDso</span></p>
        <p className="flex justify-between"><span>Free to withdraw</span><span className="tabular-nums">{amountOf(data.free)} USDso</span></p>
        {data.equity > data.free && <p className="text-[12px] leading-snug text-white/60">The rest backs open trades or is house money from a voucher, so it stays in.</p>}
      </Card>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          out.mutate(value.trim());
        }}
      >
        <Card className="flex flex-col gap-2 px-3 py-2.5">
          <span className="text-[13px] text-white/70">Withdraw to {target}</span>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.0"
              aria-label="Amount of USDso to withdraw"
              className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
            />
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-display text-[16px] font-bold">USDso</span>
          </div>
          <div className="flex justify-end text-[12px]">
            <button type="button" className="font-semibold text-cyan" onClick={() => setValue(plain(floorDp(data.free, 6), 6))}>
              Max
            </button>
          </div>
        </Card>
        <Button type="submit" disabled={out.isPending || entered <= 0 || entered > data.free + 1e-9}>
          {out.isPending ? "Withdrawing…" : entered <= 0 ? "Enter an amount" : entered > data.free + 1e-9 ? "More than is free" : "Withdraw"}
        </Button>
      </form>

      {linked && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            move.mutate();
          }}
        >
          <Card className="flex flex-col gap-2 px-3 py-2.5">
            <span className="text-[13px] text-white/70">Send from your dreamDEX account to your wallet {short(wallet ?? "0x0000000000")}</span>
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                value={moveValue}
                onChange={(event) => setMoveValue(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.0"
                aria-label="Amount of USDso to send to your wallet"
                className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
              />
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-display text-[16px] font-bold">USDso</span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-white/70">
              <span>In the account {amountOf(data.held)}</span>
              <button type="button" className="font-semibold text-cyan" onClick={() => setMoveValue(plain(floorDp(data.held, 6), 6))}>
                Max
              </button>
            </div>
          </Card>
          <Button type="submit" variant="outline" disabled={move.isPending || moved <= 0 || moved > data.held + 1e-9}>
            {move.isPending ? "Sending…" : moved <= 0 ? "Enter an amount" : moved > data.held + 1e-9 ? "Not enough in the account" : "Send to my wallet"}
          </Button>
        </form>
      )}
    </div>
  );
}
