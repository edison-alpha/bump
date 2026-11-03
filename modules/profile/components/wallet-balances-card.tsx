"use client";

import { isSpotMarket, type SpotMarket } from "@somnia-chain/markets-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatEther, formatUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets } from "@/lib/chain/markets";
import { usd } from "@/lib/format";
import { BridgeToHideki } from "@/modules/trade/components/bridge-to-hideki";
import { MoveToAccount } from "@/modules/trade/components/move-to-account";
import { useTrade } from "@/modules/trade/trade-provider";

type Token = { address: Address; symbol: string; decimals: number };

const amount = (value: string) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Every ERC-20 dreamDEX lists on spot (base and quote), plus the perps collateral, deduplicated. */
function tokensOf(spot: SpotMarket[], collateral: Token | null): Token[] {
  const found = new Map<string, Token>();
  if (collateral) found.set(collateral.address.toLowerCase(), collateral);
  for (const m of spot) {
    if (!m.baseIsNative && m.baseSymbol) found.set(m.baseToken.toLowerCase(), { address: m.baseToken, symbol: m.baseSymbol, decimals: m.baseDecimals });
    if (m.quoteSymbol) found.set(m.quoteToken.toLowerCase(), { address: m.quoteToken, symbol: m.quoteSymbol, decimals: m.quoteDecimals });
  }
  return [...found.values()];
}

/**
 * What the member holds on dreamDEX testnet, token by token (STT for gas, USDso and every other listed token sitting in
 * the trading account), plus the margin account's collateral with a withdraw form. Only free collateral can leave: the
 * margin account refuses anything that would put an open trade at risk.
 */
export function WalletBalancesCard() {
  const { setup, withdraw } = useTrade();
  const { data: markets } = useChainMarkets();
  const { flash } = useConsole();
  const [value, setValue] = useState("");

  const perp = markets ? Object.values(markets)[0] : undefined;
  const bank = perp?.marginBank as Address | undefined;
  const account = setup?.account as Address | undefined;
  const wallet = setup?.address as Address | undefined;

  const holdings = useQuery({
    queryKey: ["bump", "chain", "holdings", account, wallet, perp?.quoteToken],
    enabled: !!account && !!wallet && !!perp,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { client } = exchange();
      const collateral: Token | null = perp ? { address: perp.quoteToken as Address, symbol: "USDso", decimals: perp.quoteDecimals } : null;
      const tokens = tokensOf((await client.listSpotMarkets({ limit: 200 })).filter(isSpotMarket), collateral);
      const [balances, gas, margin] = await Promise.all([
        client.getBalances(tokens.map((token) => ({ token: token.address })), account as Address),
        client.getNativeBalance(wallet as Address),
        bank ? client.getMarginAccount(bank, account as Address) : null,
      ]);
      return {
        gas: formatEther(gas),
        tokens: tokens.map((token, i) => ({ ...token, value: formatUnits(balances[i] ?? 0n, token.decimals) })),
        margin: margin && perp ? { equity: formatUnits(margin.equity, perp.quoteDecimals), withdrawable: formatUnits(margin.withdrawable > 0n ? margin.withdrawable : 0n, perp.quoteDecimals) } : null,
      };
    },
  });

  const out = useMutation({
    mutationFn: (amountToWithdraw: string) => (withdraw ? withdraw(amountToWithdraw) : Promise.reject(new Error("Withdrawing isn't available here."))),
    onSuccess: () => {
      setValue("");
      void holdings.refetch();
      flash("Withdrawn to your account.", "good");
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });

  if (!setup || !withdraw) return null;

  const data = holdings.data;
  const shown = data?.tokens.filter((t) => Number(t.value) > 0 || t.symbol === "USDso") ?? [];
  const canWithdraw = !!data?.margin && Number(data.margin.withdrawable) > 0;

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2">
      <p className="text-[14px]">Balances</p>
      {holdings.isPending && <p className="text-[12px] text-white/80">Loading your balances…</p>}
      {holdings.isError && <p className="text-[12px] text-white/80">Couldn't read your balances. They refresh on their own.</p>}
      {data && (
        <ul className="flex flex-col gap-1 text-[14px]">
          <li className="flex justify-between">
            <span>STT <span className="text-white/70">· gas</span></span>
            <span className="tabular-nums">{amount(data.gas)}</span>
          </li>
          {shown.map((t) => (
            <li key={t.address} className="flex justify-between">
              <span>{t.symbol}</span>
              <span className="tabular-nums">{amount(t.value)}</span>
            </li>
          ))}
          {data.margin && (
            <li className="mt-1 flex justify-between border-t border-white/20 pt-1">
              <span>In trading <span className="text-white/70">· USDso</span></span>
              <span className="tabular-nums">{usd(Number(data.margin.equity))}</span>
            </li>
          )}
        </ul>
      )}

      <BridgeToHideki />
      <MoveToAccount />

      {canWithdraw && data?.margin && (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            out.mutate(value.trim());
          }}
        >
          <p className="text-[12px] text-white/80">Free to withdraw: {usd(Number(data.margin.withdrawable))} USDso</p>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Amount"
              aria-label="Amount of USDso to withdraw"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-[14px] tabular-nums outline-none placeholder:text-white/50 focus:bg-white/15"
            />
            <Button type="button" size="sm" variant="outline" className="w-auto" onClick={() => setValue(data.margin?.withdrawable ?? "")}>
              Max
            </Button>
            <Button type="submit" size="sm" className="w-auto" disabled={out.isPending || !value}>
              {out.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
