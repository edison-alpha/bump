"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

export type Session = {
  status: "signed-out" | "guest" | "member";
  email: string;
  name: string;
  username: string;
  showOnLeaderboard: boolean;
};

export type ProfileInput = Pick<Session, "name" | "username" | "showOnLeaderboard">;

const EMPTY: Session = { status: "signed-out", email: "", name: "", username: "", showOnLeaderboard: false };

type SessionContextValue = {
  session: Session;
  /** False until localStorage has been read; gate redirects on this. */
  ready: boolean;
  setEmail: (email: string) => void;
  /** Mock sign-in. Swap for Privy login once wired. */
  signIn: (profile?: Partial<Session>) => void;
  continueAsGuest: () => void;
  saveProfile: (profile: ProfileInput) => void;
  setLeaderboardVisibility: (visible: boolean) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession, ready] = useLocalStorageState<Session>("bump:session", EMPTY);

  const setEmail = useCallback((email: string) => setSession((s) => ({ ...s, email })), [setSession]);
  const signIn = useCallback(
    (profile?: Partial<Session>) => setSession((s) => ({ ...s, ...profile, status: "member" })),
    [setSession],
  );
  const continueAsGuest = useCallback(
    () => setSession({ ...EMPTY, status: "guest", name: "Guest", username: "guest" }),
    [setSession],
  );
  const saveProfile = useCallback(
    (profile: ProfileInput) => setSession((s) => ({ ...s, ...profile, status: "member" })),
    [setSession],
  );
  const setLeaderboardVisibility = useCallback(
    (showOnLeaderboard: boolean) => setSession((s) => ({ ...s, showOnLeaderboard })),
    [setSession],
  );
  const signOut = useCallback(() => setSession(EMPTY), [setSession]);

  const value = useMemo(
    () => ({ session, ready, setEmail, signIn, continueAsGuest, saveProfile, setLeaderboardVisibility, signOut }),
    [session, ready, setEmail, signIn, continueAsGuest, saveProfile, setLeaderboardVisibility, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
