"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/modules/session/session-provider";

/**
 * On public auth screens: send people who already have a profile straight to Home, and a member without one (back from
 * Google sign-in, say) to profile setup. Checked once, when the session settles, so signing in or starting as a guest on
 * this screen goes wherever that action navigates.
 */
export function useRedirectIfSignedIn() {
  const { session, ready } = useSession();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    if (session.status === "guest" || (session.status === "member" && session.username)) router.replace("/home");
    else if (session.status === "member") router.replace("/profile-setup");
  }, [ready, session.status, session.username, router]);
}
