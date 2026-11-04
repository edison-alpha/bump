"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, getAddress, isAddress, parseUnits, zeroAddress, type Address } from "viem";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shortError } from "@/lib/bump/dreamdex";
import { GAS_ENVELOPE_STT, SIDES, type BridgeSide } from "@/lib/chain/bridge";
import { exchangeOn } from "@/lib/chain/exchange";
import { floorDp, tokensOf } from "@/lib/chain/swap";
import { useTrade } from "@/modules/trade/trade-provider";
import { useSender } from "../use-send";
import { useSpotPairs } from "../use-spot-pairs";

const amountOf = (value: number, max = 6) => value.toLocaleString("en-US", { maximumFractionDigits: max });
/** A decimal string with no exponent: 1e-7 would break parseUnits and read oddly in the field. */
const plain = (x: number, dp: number) => (x.toFixed(dp).includes(".") ? x.toFixed(dp).replace(/.?0+$/, "") : x.toFixed(dp));
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Send any token the chain lists (the native coin, USDso, WBTC, WETH) to any address, from the wallet or, when the
 * player trades through a dreamDEX account, from that account. The wallet signs and pays gas either way.
 */
export function SendPanel({ chain }: { chain: BridgeSide }) {
  const { setup } = useTrade();
  const { flash } = useConsole();
  const queryClient = useQueryClient();
  const send = useSender();
  const [symbol, setSymbol] = useState("STT");
  const [fromAccount, setFromAccount] = useState(false);
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");

  const wallet = setup?.address as Address | undefined;
  const account = setup?.account as Address | undefined;
  const canUseAccount = chain === "hideki" && !!setup?.linked;
  const fromAcct = canUseAccount && fromAccount;
  const source = fromAcct ? account : wallet;

  const pairs = useSpotPairs(chain);
  const tokens = tokensOf(pairs.data ?? []);
  const token = tokens.find((t) => t.symbol === symbol) ?? tokens[0];

  const held = useQuery({
    queryKey: ["bump", "send", "balance", chain, source, wallet, token?.symbol],
    enabled: !!source && !!wallet && !!token,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { client } = exchangeOn(chain);
      const gas = await client.getNativeBalance(wallet as Address);
      const raw = token?.address ? ((await client.getBalances([{ token: token.address }], source as Address))[0] ?? 0n) : await client.getNativeBalance(source as Address);
      return { raw: raw.toString(), gas: gas.toString() };
    },
  });
  const decimals = token?.decimals ?? 18;
  const balance = Number(formatUnits(BigInt(held.data?.raw ?? "0"), decimals));
  const gasBalance = Number(formatUnits(BigInt(held.data?.gas ?? "0"), 18));
  // sending the coin out of the wallet that pays gas keeps the gas envelope back
  const spendable = token && !token.address && !fromAcct ? Math.max(0, balance - GAS_ENVELOPE_STT) : balance;

  const input = Number(value) || 0;
  const recipientOk = isAddress(to.trim());
  const recipient = recipientOk ? (getAddress(to.trim()) as Address) : undefined;
  const problem =
    to.trim() && !recipientOk
      ? "That isn't a valid address."
      : recipient === zeroAddress
        ? "That's the zero address: funds sent there are gone."
        : recipient && token?.address && recipient.toLowerCase() === token.address.toLowerCase()
          ? "That's the token's own contract address: funds sent there are lost."
          : recipient && source && recipient.toLowerCase() === source.toLowerCase()
            ? "That's the address you are sending from."
            : null;
  const tooMuch = input > spendable + 1e-9;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!wallet || !token || !recipient) throw new Error("Your wallet isn't ready yet.");
      if (gasBalance < GAS_ENVELOPE_STT) throw new Error(`Your wallet needs at least ${GAS_ENVELOPE_STT} STT on ${SIDES[chain].name} to send this. Top it up and try again.`);
      const dp = Math.min(decimals, 8);
      const raw = parseUnits(plain(floorDp(input, dp), dp), decimals);
      if (raw <= 0n) throw new Error("Enter an amount to send.");
      await send({ chain, token, to: recipient, raw, wallet, ...(fromAcct && account ? { fromAccount: account } : {}) });
      return token.symbol;
    },
    onSuccess: (sent) => {
      setValue("");
      setTo("");
      flash(`${sent} sent.`, "good");
      void held.refetch();
      void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
    },
    onError: (error) => flash(error instanceof Error && error.message.length < 150 && /^(The|Your|Enter)/.test(error.message) ? error.message : shortError(error), "warn"),
  });

  if (!setup) return <Card className="px-3 py-3 text-[14px]">Sending is for real dreamDEX trading. Sign in to use it.</Card>;
  if (pairs.isPending) return <Card className="px-3 py-3 text-[14px]">Loading tokens…</Card>;
  if (!token) return <Card className="px-3 py-3 text-[14px]">Couldn&apos;t load the tokens. Try again in a moment.</Card>;

  const label = mutation.isPending ? "Sending…" : !recipientOk ? "Enter an address" : input <= 0 ? "Enter an amount" : tooMuch ? `Not enough ${token.symbol}` : "Send";
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-[13px] font-semibold ${active ? "bg-white/20" : "bg-white/5 text-white/60"}`;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      {canUseAccount && (
        <div className="flex gap-2" role="group" aria-label="Send from">
          <button type="button" aria-pressed={!fromAcct} disabled={mutation.isPending} onClick={() => setFromAccount(false)} className={`flex-1 ${chip(!fromAcct)}`}>
            My wallet
          </button>
          <button type="button" aria-pressed={fromAcct} disabled={mutation.isPending} onClick={() => setFromAccount(true)} className={`flex-1 ${chip(fromAcct)}`}>
            dreamDEX account
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Token">
        {tokens.map((t) => (
          <button key={t.symbol} type="button" aria-pressed={t.symbol === token.symbol} disabled={mutation.isPending} onClick={() => { setSymbol(t.symbol); setValue(""); }} className={chip(t.symbol === token.symbol)}>
            {t.symbol}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-1.5 px-3 py-2.5">
        <label htmlFor="send-to" className="text-[13px] text-white/70">
          To address
        </label>
        <input
          id="send-to"
          value={to}
          onChange={(event) => setTo(event.target.value.trim())}
          placeholder="0x…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 bg-transparent font-mono text-[14px] outline-none placeholder:text-white/30"
        />
        {problem && <p className="text-[12px] leading-snug text-coral">{problem}</p>}
      </Card>

      <Card className="flex flex-col gap-2 px-3 py-2.5">
        <span className="text-[13px] text-white/70">Amount</span>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.0"
            aria-label={`Amount of ${token.symbol} to send`}
            className="min-w-0 flex-1 bg-transparent font-display text-[28px] font-bold tabular-nums outline-none placeholder:text-white/30"
          />
          <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-display text-[16px] font-bold">{token.symbol}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] text-white/70">
          <span>
            {fromAcct ? "dreamDEX account" : "Wallet"} {held.isPending ? "…" : amountOf(balance)}
          </span>
          <button type="button" className="font-semibold text-cyan" onClick={() => setValue(plain(floorDp(spendable, Math.min(decimals, 8)), Math.min(decimals, 8)))}>
            Max
          </button>
        </div>
      </Card>

      <Card className="flex flex-col gap-1 px-3 py-2 text-[12px] text-white/80">
        <p className="flex justify-between"><span>From</span><span>{source ? short(source) : "…"}</span></p>
        <p className="flex justify-between"><span>Network gas</span><span>STT on {SIDES[chain].name}</span></p>
      </Card>

      <Button type="submit" disabled={mutation.isPending || !recipientOk || !!problem || input <= 0 || tooMuch}>
        {label}
      </Button>
      <p className="text-center text-[11px] leading-snug text-white/50">Check the address: a transfer can&apos;t be undone. Testnet funds only.</p>
    </form>
  );
}
