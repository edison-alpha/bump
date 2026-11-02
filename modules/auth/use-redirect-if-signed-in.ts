"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/modules/session/session-provider";

/**
 * On public auth screens: send people who already have a profile straight to Home. Checked once, when the stored
 * session loads, so signing in or starting as a guest on this screen goes wherever that action navigates.
 */
export function useRedirectIfSignedIn() {
  const { session, ready } = useSession();
  const router = useRouter();
  const checked = useRef(false);
  const hasProfile = session.status === "guest" || (session.status === "member" && !!session.username);

  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    if (hasProfile) router.replace("/home");
  }, [ready, hasProfile, router]);
}
