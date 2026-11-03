"use client";

import Link from "next/link";
import { useConsole } from "@/components/console/console-provider";
import { Card } from "@/components/ui/card";
import { usd } from "@/lib/format";
import { BridgeToHideki } from "@/modules/trade/components/bridge-to-hideki";
import { MoveToAccount } from "@/modules/trade/components/move-to-account";
import { useTrade } from "@/modules/trade/trade-provider";

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const link ="text-[12px] font-semibold text-cyan underline underline-offset-2";

function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${ok ? "bg-mint" : "bg-gold"}`} />
      <span className="flex-1">{label}</span>
      <span className="text-white/70 tabular-nums">{value}</span>
    </div>
  );
}

/**
 * "Charging up" for members: what their wallet needs before the first real trade. STT pays gas and the TP/SL trigger
 * fee; USDso in the trading account is the collateral. Shown only while something is missing.
 */
export function ChargeUpCard() {
  const { mode, setup, available, position } = useTrade();
  const { flash } = useConsole();
  if (mode !== "chain" || !setup || position) return null;

  const hasGas = setup.gas >= setup.gasNeeded;
  const funded = available >= 1;
  if (hasGas && funded) return null;
  const usdsoValue = setup.balanceError ? "can't read" : setup.balanceLoading ? "checking…" : `${usd(available)} free`;

  const needs = [!funded && "USDso", !hasGas && "STT"].filter(Boolean).join(" and ");
  // STT pays gas from the signing wallet; USDso belongs in the account that trades (the same address unless one is linked)
  const target = funded ? setup.address : setup.account;
  const copy = () => navigator.clipboard?.writeText(target).then(() => flash("Address copied.", "good")).catch(() => undefined);

  return (
    <Card className="flex flex-col gap-1 px-3 py-2">
      <p className="font-display text-[14px] leading-tight font-bold">Charging up</p>
      <Row ok={hasGas} label="Gas (STT)" value={`${setup.gas.toFixed(2)} / ${setup.gasNeeded}`} />
      <Row ok={funded} label="USDso" value={usdsoValue} />
      <p className="text-[11px] leading-snug text-white/70">Send {needs} to your {funded || !setup.linked ? "wallet" : "account"} on Hideki Testnet (chain 50383).</p>
      <p className="text-[11px] leading-snug text-white/50">
        USDso is read from {setup.linked ? "your dreamDEX account" : "your wallet"} {shorten(setup.account)}
        {setup.linked ? `, STT from your wallet ${shorten(setup.address)}` : ""}.
      </p>
      <BridgeToHideki />
      <MoveToAccount />
      {setup.balanceError &&<p className="text-[11px] leading-snug text-coral">Couldn&apos;t read the USDso balance. It retries every 10 seconds.</p>}
      <div className="flex gap-3">
        <button type="button" onClick={copy} className={link}>
          Copy address
        </button>
        {!funded && !setup.linked && (
          <Link href="/profile" className={link}>
            Use my dreamDEX account
          </Link>
        )}
      </div>
    </Card>
  );
}
