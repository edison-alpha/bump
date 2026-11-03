"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSession } from "@/modules/session/session-provider";

/**
 * On public auth screens: send people who already have a profile straight to Home, and a member without one to profile
 * setup. When the screen first opens that covers guests and returning members. After that only a member is acted on:
 * signing in while the screen is open (coming back from Google lands on "/" before the session exists) must move on,
 * while starting as a guest on this screen goes wherever that action navigates.
 */
export function useRedirectIfSignedIn() {
  const { session, ready } = useSession();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (!ready) return;
    const first = !checked.current;
    checked.current = true;
    const member = session.status === "member";
    if (!first && !member) return;
    if (member) router.replace(session.username ? "/home" : "/profile-setup");
    else if (first && session.status === "guest") router.replace("/home");
  }, [ready, session.status, session.username, router]);
}
