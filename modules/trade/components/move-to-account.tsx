"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { exchange } from "@/lib/chain/exchange";
import { useChainMarkets } from "@/lib/chain/markets";
import { useTrade } from "@/modules/trade/trade-provider";

/**
 * With a linked dreamDEX smart account, USDso sent to the sign-in wallet never reaches the account that trades. This
 * shows what the wallet holds and moves it across in one transfer. Renders nothing unless an account is linked and the
 * wallet actually holds USDso.
 */
export function MoveToAccount() {
  const { setup, moveToAccount } = useTrade();
  const { data: markets } = useChainMarkets();
  const { flash } = useConsole();
  const [value, setValue] = useState("");

  const perp = markets ? Object.values(markets)[0] : undefined;
  const wallet = setup?.address as Address | undefined;

  const held = useQuery({
    queryKey: ["bump", "chain", "wallet-usdso", wallet, perp?.quoteToken],
    enabled: !!wallet && !!perp && !!moveToAccount,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [raw] = await exchange().client.getBalances([{ token: perp?.quoteToken as Address }], wallet as Address);
      return formatUnits(raw ?? 0n, perp?.quoteDecimals ?? 6);
    },
  });

  const move = useMutation({
    mutationFn: (amount: string) => (moveToAccount ? moveToAccount(amount) : Promise.reject(new Error("No linked account."))),
    onSuccess: () => {
      setValue("");
      void held.refetch();
      flash("Moved to your dreamDEX account.", "good");
    },
    onError: (error: Error) => flash(error.message, "warn"),
  });

  if (!moveToAccount || !held.data || Number(held.data) <= 0) return null;

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        move.mutate(value.trim());
      }}
    >
      <p className="text-[12px] text-white/80">
        Your wallet holds {Number(held.data).toLocaleString("en-US", { maximumFractionDigits: 4 })} USDso. Move it to your dreamDEX account to trade.
      </p>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Amount"
          aria-label="Amount of USDso to move to your dreamDEX account"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-[14px] tabular-nums outline-none placeholder:text-white/50 focus:bg-white/15"
        />
        <Button type="button" size="sm" variant="outline" className="w-auto" onClick={() => setValue(held.data)}>
          Max
        </Button>
        <Button type="submit" size="sm" className="w-auto" disabled={move.isPending || !value}>
          {move.isPending ? "Moving…" : "Move"}
        </Button>
      </div>
    </form>
  );
}
