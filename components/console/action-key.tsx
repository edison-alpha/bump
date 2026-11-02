"use client";

import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      // the order is already on its way; the key does nothing until it fills (then it becomes CLOSE)
      if (pathname === "/trade/progress") return;
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
      <BumpStamp size={50} />
    </Keycap>
  );
}

/** The bump "b" mark pressed into the key face: sunk fill, shadow along the top edge, light catching the bottom lip. */
function BumpStamp({ size }: { size: number }) {
  const id = useId();
  return (
    <svg aria-hidden width={size} height={size} viewBox="270 225 720 820" className="translate-x-[2px]">
      <defs>
        <mask id={`${id}-eyes`}>
          <rect x="270" y="225" width="720" height="820" fill="#fff" />
          <rect x="522" y="663" width="108" height="194" rx="54" fill="#000" />
          <rect x="693" y="663" width="108" height="194" rx="54" fill="#000" />
        </mask>
        <filter id={`${id}-deboss`} x="-10%" y="-10%" width="120%" height="120%">
          {/* light lip below the cut */}
          <feOffset in="SourceAlpha" dy="14" result="lipOffset" />
          <feComposite in="lipOffset" in2="SourceAlpha" operator="out" result="lipEdge" />
          <feFlood floodColor="#fff4cf" floodOpacity="0.85" />
          <feComposite in2="lipEdge" operator="in" result="lip" />
          {/* shadow cast inside the cut from its top edge */}
          <feFlood floodColor="#6b3d00" floodOpacity="0.75" />
          <feComposite in2="SourceAlpha" operator="out" result="outside" />
          <feOffset in="outside" dy="22" result="shadowOffset" />
          <feGaussianBlur in="shadowOffset" stdDeviation="9" result="shadowBlur" />
          <feComposite in="shadowBlur" in2="SourceAlpha" operator="in" result="inner" />
          <feMerge>
            <feMergeNode in="lip" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="inner" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${id}-deboss)`}>
        <g mask={`url(#${id}-eyes)`} fill="#d98a00">
          <path d="M300 381a139 139 0 0 1 278 0v642H460a160 160 0 0 1-160-160Z" />
          <ellipse cx="630" cy="745" rx="330" ry="282" />
        </g>
      </g>
    </svg>
  );
}
