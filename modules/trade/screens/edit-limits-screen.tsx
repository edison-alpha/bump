"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConsole, usePrimaryAction } from "@/components/console/console-provider";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatRow } from "@/components/ui/stat-row";
import { signedUsd, usd, usdPrice } from "@/lib/format";
import { DialField } from "@/components/console/dial-field";
import { lossAtStop, profitAtTarget, stepPct, stopPrice, targetPrice } from "../calc";
import { LimitRow, stopReadout, targetReadout } from "../components/limit-row";
import { useTrade } from "../trade-provider";
import { useRequirePosition } from "../use-require-position";

export function EditLimitsScreen() {
  const router = useRouter();
  const position = useRequirePosition();
  const { updateLimits, mode } = useTrade();
  const { flash } = useConsole();
  const [target, setTarget] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const targetPct = target ?? position?.targetPct ?? 0;
  const stopPct = stop ?? position?.stopPct ?? 0;
  // on chain this cancels the old TP/SL and arms the new pair, so it takes a couple of transactions
  const save = () => {
    if (saving) return;
    setSaving(true);
    updateLimits({ targetPct, stopPct })
      .then(() => router.back())
      .catch((error: Error) => {
        setSaving(false);
        flash(error.message, "warn");
      });
  };
  usePrimaryAction(position ? { label: saving ? "Saving…" : "Save limits", onPress: save, disabled: saving } : null);

  if (!position) return <Screen title="Edit limits">{null}</Screen>;

  const next = { ...position, targetPct, stopPct };

  return (
    <Screen title="Edit limits">
      <DialField
        id="target"
        label="Profit target"
        onStep={(dir) => setTarget((t) => stepPct(t ?? position.targetPct, dir))}
        readout={targetReadout(targetPct, targetPrice(position.entry, next))}
      >
        <LimitRow kind="target" value={targetPct} onChange={setTarget} />
      </DialField>
      <DialField
        id="stop"
        label="Stop loss"
        onStep={(dir) => setStop((s) => stepPct(s ?? position.stopPct, dir, 0.5, 10))}
        readout={stopReadout(stopPct, stopPrice(position.entry, next))}
      >
        <LimitRow kind="stop" value={stopPct} onChange={setStop} />
      </DialField>

      <Card className="divide-y divide-white/15 px-3">
        <StatRow label="Target price" value={usdPrice(targetPrice(position.entry, next))} tone="positive" />
        <StatRow label="Profit at target" value={signedUsd(profitAtTarget(next))} tone="positive" />
        <StatRow label="Stop price" value={usdPrice(stopPrice(position.entry, next))} tone="negative" />
        <StatRow label="Loss at stop" value={signedUsd(-lossAtStop(next))} tone="negative" />
      </Card>
      <p className="text-[13px] text-white/80">
        Before funding and costs. Stop fills can differ.{mode === "chain" ? " Changing them re-sets your TP/SL on dreamDEX." : ""}
      </p>

      <Button size="lg" className="mt-auto" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save limits"}
      </Button>
    </Screen>
  );
}
