"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Mascot } from "@/components/ui/mascot";
import { useSession } from "@/modules/session/session-provider";
import { useTrade } from "@/modules/trade/trade-provider";
import { useConsole } from "./console-provider";
import { Keycap } from "./keycap";

/**
 * The big bump key is the trade trigger.
 * - No position: first press shows the Review screen, pressing again on Review places the trade.
 * - Open position: first press shows Close Position, pressing again there closes it.
 * Two presses on purpose, so a stray tap never opens or closes a trade. Signed out: starts sign-in.
 */
export function ActionKey() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { position } = useTrade();
  const { action } = useConsole();
  const signedIn = session.status !== "signed-out";
  const mode = position ? "close" : "open";

  const press = () => {
    if (!signedIn) return router.push("/sign-in");
    if (mode === "open") {
      router.push(pathname === "/trade/review" ? "/trade/progress" : "/trade/review");
      return;
    }
    // On Close Position the screen's primary action is "Close n%": run it with the chosen amount.
    if (pathname === "/position/close") action?.current?.onPress?.();
    else router.push("/position/close");
  };

  const label = !signedIn ? "Sign in" : mode === "open" ? "Open a position" : "Close position";

  return (
    <Keycap tone="action" aria-label={label} title={label} onClick={press} className="relative grid size-[80px] place-items-center rounded-[20px]">
      <Mascot size={60} bob={false} className="-mt-3" />
      {signedIn && (
        <span
          className={cn(
            "absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-px font-display text-[10px] font-bold tracking-[0.14em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
            mode === "open" ? "bg-mint-deep" : "bg-coral-deep",
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", mode === "open" ? "bg-[#9fffd6]" : "bg-[#ffc2cb]")} />
          {mode === "open" ? "OPEN" : "CLOSE"}
        </span>
      )}
    </Keycap>
  );
}
