import { KeyName } from "@/modules/progress/components/coach";

/** Tells the player which hardware key does the screen's job, in place of an on-screen button. */
export function KeyHint({ action }: { action: "place" | "close" }) {
  return (
    <p className="mt-auto text-center text-[13px] leading-relaxed text-white/85">
      {action === "place" ? (
        <>
          Hold <KeyName tone="gold">BUMP</KeyName> to place it. <KeyName tone="sell">SELL</KeyName> /{" "}
          <KeyName tone="buy">BUY</KeyName> switch direction.
        </>
      ) : (
        <>
          Hold <KeyName tone="gold">BUMP</KeyName> to close it.
        </>
      )}
    </p>
  );
}
