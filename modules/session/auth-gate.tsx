"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Screen } from "@/components/shell/screen";
import { useSession } from "./session-provider";

/** Keeps signed-out visitors out of the app screens. Until storage is read the LCD stays lit and only its content waits. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const router = useRouter();
  const allowed = session.status !== "signed-out";

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  if (!ready || !allowed) {
    return (
      <Screen header={<span />}>
        <div aria-busy aria-label="Loading" className="m-auto flex flex-col items-center gap-3">
          <span className="size-9 animate-spin rounded-full border-[3px] border-white/15 border-t-cyan" />
          <span className="font-display text-[13px] tracking-[0.2em] text-white/60 uppercase">Loading</span>
        </div>
      </Screen>
    );
  }
  return <>{children}</>;
}
