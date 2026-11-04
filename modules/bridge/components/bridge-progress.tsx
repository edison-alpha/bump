"use client";

import { Card } from "@/components/ui/card";

/** Where a bridge is: the stages run in this order, and "approve" is skipped when the allowance already covers it. */
export type BridgeStage = "switch" | "approve" | "send" | "deliver" | "done" | "failed";

export type BridgeRun = {
  stage: BridgeStage;
  /** The stage that was running when it failed. */
  failedAt?: Exclude<BridgeStage, "done" | "failed">;
  amount: string;
  /** What is moving, and between which networks (display names). */
  asset: string;
  from: "somnia" | "hideki";
  fromName: string;
  toName: string;
  recipient: string;
  needsApproval: boolean;
  bridgeHash?: string;
  /** The Hyperlane message id, read from the origin receipt; delivery is the destination Mailbox saying it processed it. */
  messageId?: string;
  startedAt: number;
  error?: string;
};

const ORDER: Exclude<BridgeStage, "failed">[] = ["switch", "approve", "send", "deliver", "done"];

const labels = (run: BridgeRun): Record<string, { now: string; done: string }> => ({
  switch: { now: `Switching to ${run.fromName}`, done: `On ${run.fromName}` },
  approve: { now: `Approve ${run.asset} in your wallet`, done: `${run.asset} approved` },
  send: { now: `Sending on ${run.fromName}`, done: `Sent on ${run.fromName}` },
  deliver: { now: `Arriving on ${run.toName}`, done: `Arrived on ${run.toName}` },
});

/** After this long without delivery the relayer is probably out of gas; the funds stay escrowed on the origin side. */
export const SLOW_AFTER_MS = 90_000;

function Dot({ state }: { state: "done" | "now" | "todo" | "failed" }) {
  if (state === "done") {
    return (
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-mint text-navy-950">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    );
  }
  if (state === "failed") return <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-coral text-[12px] font-bold text-navy-950">!</span>;
  if (state === "now") return <span aria-hidden className="size-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-cyan" />;
  return <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-white/25" />;
}

/**
 * The bridge's progress as a short checklist: switch network, approve, send, then the wait for the relayer to deliver
 * on Hideki (seconds when it is healthy). Shows the Somnia transaction link once it exists.
 */
export function BridgeProgress({ run, explorerTx, now, onDismiss }: { run: BridgeRun; explorerTx?: string; now: number; onDismiss: () => void }) {
  const failed = run.stage === "failed";
  const at = ORDER.indexOf(run.stage === "failed" ? (run.failedAt ?? "switch") : run.stage);
  const steps = (["switch", "approve", "send", "deliver"] as const).filter((s) => s !== "approve" || run.needsApproval);
  const slow = run.stage === "deliver" && now - run.startedAt > SLOW_AFTER_MS;
  const text = labels(run);

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2.5" aria-live="polite">
      <p className="font-display text-[14px] font-bold">
        {run.stage === "done" ? `Bridged ${run.amount} ${run.asset}` : failed ? "Bridge stopped" : `Bridging ${run.amount} ${run.asset}`}
      </p>
      <ul className="flex items-start gap-1">
        {steps.map((s) => {
          const index = ORDER.indexOf(s);
          const state = failed && index === at ? "failed" : index < at || run.stage === "done" ? "done" : index === at ? "now" : "todo";
          return (
            <li key={s} className={`flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-[11px] leading-tight ${state === "todo" ? "text-white/50" : ""}`}>
              <Dot state={state} />
              {state === "done" ? text[s].done : text[s].now}
            </li>
          );
        })}
      </ul>
      {failed && run.error && <p className="text-[12px] leading-snug text-coral">{run.error}</p>}
      {slow && <p className="text-[12px] leading-snug text-gold">Taking longer than usual. The relayer may be refilling; your {run.asset} is held safely and arrives once it does.</p>}
      <div className="flex gap-3 text-[12px] font-semibold">
        {explorerTx && (
          <a href={explorerTx} target="_blank" rel="noreferrer" className="text-cyan underline underline-offset-2">
            View transaction
          </a>
        )}
        {(run.stage === "done" || failed || slow) && (
          <button type="button" onClick={onDismiss} className="text-white/70 underline underline-offset-2">
            Dismiss
          </button>
        )}
      </div>
    </Card>
  );
}
