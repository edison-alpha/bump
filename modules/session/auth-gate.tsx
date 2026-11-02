"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "./session-provider";

/** Keeps signed-out visitors out of the app screens. Renders an empty screen until storage is read. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const router = useRouter();
  const allowed = session.status !== "signed-out";

  useEffect(() => {
    if (ready && !allowed) router.replace("/");
  }, [ready, allowed, router]);

  if (!ready || !allowed) return <div className="min-h-0 flex-1" aria-busy />;
  return <>{children}</>;
}
