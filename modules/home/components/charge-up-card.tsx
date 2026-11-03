"use client";

import Link from "next/link";
import { useConsole } from "@/components/console/console-provider";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { usd } from "@/lib/format";
import { useTrade } from "@/modules/trade/trade-provider";

/**
 * "Charging up…" for members: what their wallet needs before the first real trade. STT pays gas and the TP/SL trigger
 * fee; USDso in the trading account is the collateral. Shown only while something is missing.
 */
export function ChargeUpCard() {
  const { mode, setup, available, position } = useTrade();
  const { flash } = useConsole();
  if (mode !== "chain" || !setup || position) return null;

  const hasGas = setup.gas >= setup.gasNeeded;
  const funded = available >= 1;
  if (hasGas && funded) return null;

  const copyTo = (value: string) => () => navigator.clipboard?.writeText(value).then(() => flash("Wallet address copied.", "good")).catch(() => undefined);
  // STT pays gas from the signing wallet; USDso belongs in the account that trades (the same address unless one is linked)
  const copy = copyTo(setup.address);

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2.5">
      <p className="font-display text-[16px] leading-tight font-bold">⚡ Charging up</p>
      <p className="text-[12px] text-white/80">Two things before your first real trade on dreamDEX testnet:</p>

      <div className="flex items-center gap-2 text-[14px]">
        <Icon name={hasGas ? "check" : "info"} size={18} className={hasGas ? "text-mint" : "text-gold"} />
        <span className="flex-1">
          STT for gas <span className="text-white/70 tabular-nums">· {setup.gas.toFixed(2)} / {setup.gasNeeded} STT</span>
        </span>
        {!hasGas && (
          <button type="button" onClick={copy} className="font-semibold text-cyan underline underline-offset-2">
            Copy address
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[14px]">
        <Icon name={funded ? "check" : "info"} size={18} className={funded ? "text-mint" : "text-gold"} />
        <span className="flex-1">
          Collateral <span className="text-white/70 tabular-nums">· {usd(available)} free</span>
        </span>
      </div>

      {!funded && (
        <>
          <p className="text-[12px] text-white/80">
            {setup.linked
              ? "This dreamDEX account has no USDso to trade. Send some USDso (Somnia Tokyo testnet) to it."
              : "Send USDso (Somnia Tokyo testnet) to your wallet address to trade. Already have a balance in dreamDEX? Connect that account in Profile."}
          </p>
          <div className="flex gap-3">
            {!setup.linked && (
              <Link href="/profile" className="text-[13px] font-semibold text-cyan underline underline-offset-2">
                Use my dreamDEX account
              </Link>
            )}
            <button type="button" onClick={copyTo(setup.account)} className="text-[13px] font-semibold text-cyan underline underline-offset-2">
              Copy {setup.linked ? "account" : "wallet"} address
            </button>
          </div>
        </>
      )}
      {!hasGas && <p className="text-[12px] text-white/80">Send STT to your wallet address (Somnia Tokyo testnet) to cover gas and the TP/SL fee.</p>}
    </Card>
  );
}
