"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/modules/session/session-provider";

/** On public auth screens: send people who already have a profile straight to Home. */
export function useRedirectIfSignedIn() {
  const { session, ready } = useSession();
  const router = useRouter();
  const hasProfile = session.status === "guest" || (session.status === "member" && !!session.username);

  useEffect(() => {
    if (ready && hasProfile) router.replace("/home");
  }, [ready, hasProfile, router]);
}
