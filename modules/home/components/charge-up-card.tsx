"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/console-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { usd } from "@/lib/format";
import { useTrade } from "@/modules/trade/trade-provider";

/**
 * "Charging up…" for members: what their wallet needs before the first real trade. STT pays gas and the TP/SL trigger
 * fee; a one-time dreamDEX credit voucher puts house money in the margin account. Shown only while something is missing.
 */
export function ChargeUpCard() {
  const { mode, setup, available, position, refill, refillLabel } = useTrade();
  const { flash } = useConsole();
  const [claiming, setClaiming] = useState(false);
  if (mode !== "chain" || !setup || position) return null;

  const hasGas = setup.gas >= setup.gasNeeded;
  const funded = available >= 1;
  if (hasGas && funded) return null;

  const claim = () => {
    setClaiming(true);
    refill()
      .then(() => flash("Charged up! You can trade now.", "good"))
      .catch((error: Error) => flash(error.message, "warn"))
      .finally(() => setClaiming(false));
  };
  const copy = () => navigator.clipboard?.writeText(setup.address).then(() => flash("Wallet address copied.", "good")).catch(() => undefined);

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

      {!funded &&
        (setup.canClaim ? (
          <Button size="sm" className="w-auto self-start" onClick={claim} disabled={claiming || !hasGas}>
            {claiming ? "Claiming…" : refillLabel}
          </Button>
        ) : (
          <p className="text-[12px] text-white/80">No voucher left for this wallet. Send USDso (Hideki testnet) to your wallet address to trade.</p>
        ))}
      {!hasGas && <p className="text-[12px] text-white/80">Send STT to your wallet address (Hideki testnet) to cover gas and the TP/SL fee.</p>}
    </Card>
  );
}
