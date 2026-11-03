"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLogin, useLoginWithEmail, useLoginWithOAuth, usePrivy, useWallets } from "@privy-io/react-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/query";
import { exchange as dreamdex } from "@/lib/chain/exchange";
import { PRIVY_CONFIGURED } from "@/lib/privy-config";
import type { GuestImportRequest, SessionResponse, TradingAccountRequest } from "@/lib/api/types";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

export type Session = {
  status: "signed-out" | "guest" | "member";
  email: string;
  name: string;
  username: string;
  showOnLeaderboard: boolean;
  /** The member's wallet (embedded, or the external one they signed in with); empty for guests. */
  address: string;
  /** The dreamDEX smart account the member trades through; null means the embedded wallet trades itself. */
  tradingAccount: string | null;
};

export type ProfileInput = Pick<Session, "name" | "username" | "showOnLeaderboard">;

const EMPTY: Session = { status: "signed-out", email: "", name: "", username: "", showOnLeaderboard: false, address: "", tradingAccount: null };

type SessionContextValue = {
  session: Session;
  /** False until storage, Privy and the backend sign-in have settled; gate redirects on this. */
  ready: boolean;
  /** Why the last sign-in step failed, in words for the player. */
  authError: string | null;
  setEmail: (email: string) => void;
  /** Emails a 6-digit code (Privy). Throws with a message to show. */
  sendEmailCode: (email: string) => Promise<void>;
  /** Checks the code; the member session follows once the wallet is ready. Throws with a message to show. */
  verifyEmailCode: (code: string) => Promise<void>;
  /** Leaves for Google and comes back signed in. */
  signInWithGoogle: () => Promise<void>;
  /** Opens the wallet picker (MetaMask and the like); the member session follows once connected. */
  signInWithWallet: () => void;
  continueAsGuest: () => void;
  /** Saves name, username and visibility on the server. Throws ApiError (409 when the username is taken). */
  saveProfile: (profile: ProfileInput) => Promise<void>;
  /** Trades through a dreamDEX smart account (null: back to the embedded wallet). Throws ApiError with the server's reason. */
  linkTradingAccount: (account: string | null) => Promise<void>;
  setLeaderboardVisibility: (visible: boolean) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/** The guest's local practice history and tutorial flag, offered to the server once on first sign-in. */
function guestData(): GuestImportRequest {
  try {
    const trade = JSON.parse(localStorage.getItem("bump:trade") ?? "null") as { history?: GuestImportRequest["history"] } | null;
    const progress = JSON.parse(localStorage.getItem("bump:progress") ?? "null") as { tutorialDone?: boolean } | null;
    return { history: (trade?.history ?? []).slice(0, 200), tutorialDone: progress?.tutorialDone ?? false };
  } catch {
    return { history: [], tutorialDone: false };
  }
}

const message = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

/** The real thing when Privy is configured; guest-only (sign-in says so) when it is not. */
export function SessionProvider({ children }: { children: ReactNode }) {
  return PRIVY_CONFIGURED ? <PrivySessionProvider>{children}</PrivySessionProvider> : <GuestSessionProvider>{children}</GuestSessionProvider>;
}

/** No Privy on this deploy: guests play as usual and every sign-in path explains why it is unavailable. */
function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession, stored] = useLocalStorageState<Session>("bump:session", EMPTY);
  const [authError, setAuthError] = useState<string | null>(null);
  const unavailable = "Sign-in isn't set up on this site yet. You can still play as a guest.";

  const value = useMemo<SessionContextValue>(
    () => ({
      // a member session stored by an earlier deploy cannot be honoured without Privy
      session: session.status === "member" ? EMPTY : session,
      ready: stored,
      authError,
      setEmail: (email) => setSession((s) => ({ ...s, email })),
      sendEmailCode: async () => {
        throw new Error(unavailable);
      },
      verifyEmailCode: async () => {
        throw new Error(unavailable);
      },
      signInWithGoogle: async () => setAuthError(unavailable),
      signInWithWallet: () => setAuthError(unavailable),
      continueAsGuest: () => setSession({ ...EMPTY, status: "guest", name: "Guest" }),
      saveProfile: async () => {
        throw new Error(unavailable);
      },
      linkTradingAccount: async () => {
        throw new Error(unavailable);
      },
      setLeaderboardVisibility: () => undefined,
      signOut: async () => setSession(EMPTY),
    }),
    [session, stored, authError, setSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function PrivySessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession, stored] = useLocalStorageState<Session>("bump:session", EMPTY);
  const { ready: privyReady, authenticated, user, getAccessToken, logout, createWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { initOAuth } = useLoginWithOAuth();
  const { login } = useLogin();
  const queryClient = useQueryClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const exchanged = useRef<string | null>(null);

  const address = wallets.find((w) => w.walletClientType === "privy")?.address ?? user?.wallet?.address ?? null;

  /** Trades the Privy access token for the backend's session cookie, then imports guest data once. */
  const exchange = useMutation({
    mutationFn: async (wallet: string) => {
      const token = await getAccessToken();
      if (!token) throw new ApiError("Your sign-in expired. Try again.", 401);
      const { user: me } = await api<SessionResponse>("/api/session", { body: { token, address: wallet } });
      if (!me) throw new ApiError("Sign-in failed. Try again.", 401);
      if (!me.guestImported) await api("/api/me/import", { body: guestData() }).catch(() => undefined);
      void api("/api/me/prefs", { body: { tzOffsetMin: new Date().getTimezoneOffset() } }).catch(() => undefined);
      return me;
    },
    onSuccess: (me) => {
      setSession((s) => ({
        status: "member",
        email: me.email ?? s.email,
        // a guest's "Guest" placeholder is not a name
        name: me.name || (s.status === "member" ? s.name : ""),
        username: me.username,
        showOnLeaderboard: me.showOnLeaderboard,
        address: me.address,
        tradingAccount: me.tradingAccount,
      }));
      setAuthError(null);
      void queryClient.invalidateQueries({ queryKey: qk.all });
    },
    onError: (error) => {
      exchanged.current = null;
      setAuthError(message(error, "Sign-in failed. Try again."));
    },
  });
  const { mutate: exchangeFor } = exchange;

  // Privy signed in + embedded wallet ready → sign in to the backend, once per wallet
  useEffect(() => {
    if (!stored || !privyReady || !authenticated || !address || exchanged.current === address) return;
    exchanged.current = address;
    exchangeFor(address);
  }, [stored, privyReady, authenticated, address, exchangeFor]);

  // The Privy dashboard can have "create wallet on login" off, and the client setting is not always honoured: if the
  // player is signed in and no embedded wallet shows up, create it here. Without a wallet nothing else can proceed.
  const creating = useRef(false);
  useEffect(() => {
    if (!stored || !privyReady || !authenticated || !walletsReady || address || creating.current) return;
    creating.current = true;
    createWallet().catch((error: Error) => {
      // "already has one" means the wallet is on its way into the list: nothing to report
      if (!/already/i.test(error.message)) setAuthError("Couldn't set up your wallet. Reload the page and try again.");
    });
  }, [stored, privyReady, authenticated, walletsReady, address, createWallet]);

  // and if there is still no wallet after a while, say so instead of waiting in silence
  useEffect(() => {
    if (!authenticated || address) return;
    const id = setTimeout(() => setAuthError((e) => e ?? "Your wallet is taking too long to set up. Reload the page and try again."), 25_000);
    return () => clearTimeout(id);
  }, [authenticated, address]);

  // the Privy session ended elsewhere (expired, logged out in another tab): this device is no longer a member
  useEffect(() => {
    if (stored && privyReady && !authenticated && session.status === "member") {
      exchanged.current = null;
      creating.current = false;
      setSession(EMPTY);
    }
  }, [stored, privyReady, authenticated, session.status, setSession]);

  const setEmail = useCallback((email: string) => setSession((s) => ({ ...s, email })), [setSession]);

  const sendEmailCode = useCallback(
    async (email: string) => {
      setAuthError(null);
      try {
        await sendCode({ email });
      } catch {
        throw new Error("Couldn't send the code. Check the email and try again.");
      }
    },
    [sendCode],
  );

  const verifyEmailCode = useCallback(
    async (code: string) => {
      setAuthError(null);
      try {
        await loginWithCode({ code });
      } catch {
        throw new Error("That code didn't work. Check it or ask for a new one.");
      }
    },
    [loginWithCode],
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await initOAuth({ provider: "google" });
    } catch {
      setAuthError("Google sign-in didn't start. Try email instead.");
    }
  }, [initOAuth]);

  const signInWithWallet = useCallback(() => {
    setAuthError(null);
    try {
      login({ loginMethods: ["wallet"] });
    } catch {
      setAuthError("Couldn't open the wallet picker. Try email instead.");
    }
  }, [login]);

  // no username, so a guest who signs in later is sent to profile setup (their trades and XP stay)
  const continueAsGuest = useCallback(() => setSession({ ...EMPTY, status: "guest", name: "Guest" }), [setSession]);

  const profileMutation = useMutation({
    mutationFn: (profile: ProfileInput) => api<SessionResponse>("/api/me/profile", { body: profile }),
    onSuccess: ({ user: me }, profile) => {
      setSession((s) => ({ ...s, ...profile, username: me?.username ?? profile.username, status: "member" }));
      void queryClient.invalidateQueries({ queryKey: qk.leaderboards });
    },
  });
  const { mutateAsync: saveProfileAsync } = profileMutation;
  const saveProfile = useCallback(async (profile: ProfileInput) => void (await saveProfileAsync(profile)), [saveProfileAsync]);

  const accountMutation = useMutation({
    mutationFn: (account: string | null) => api<SessionResponse>("/api/me/account", { body: { account } satisfies TradingAccountRequest }),
    onSuccess: ({ user: me }) => {
      setSession((s) => ({ ...s, tradingAccount: me?.tradingAccount ?? null }));
      // the balance, position and limits all belong to the other account now
      void queryClient.invalidateQueries({ queryKey: ["bump", "chain"] });
    },
  });
  const { mutateAsync: linkAccountAsync } = accountMutation;
  const linkTradingAccount = useCallback(async (account: string | null) => void (await linkAccountAsync(account)), [linkAccountAsync]);

  // A member whose wallet owns a dreamDEX smart account trades through it, so their balance and claimed voucher are
  // already there. Done once per wallet: after it links (or the member switches back) it never overrides their choice.
  const autoLinking = useRef<string | null>(null);
  useEffect(() => {
    if (session.status !== "member" || session.tradingAccount || !session.address || autoLinking.current === session.address) return;
    const key = `bump:autolink:${session.address.toLowerCase()}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // storage blocked: look the account up each time instead
    }
    autoLinking.current = session.address;
    dreamdex()
      .client.accounts.listControlledAccounts(session.address as `0x${string}`)
      .then(async (found) => {
        const account = found[0]?.address;
        if (!account) return;
        await linkAccountAsync(account);
        try {
          localStorage.setItem(key, "1");
        } catch {
          // nothing to remember it in
        }
      })
      .catch(() => {
        // a failed lookup or link just leaves the wallet trading itself; Profile can still connect the account
        autoLinking.current = null;
      });
  }, [session.status, session.tradingAccount, session.address, linkAccountAsync]);

  // optimistic: the toggle flips at once and flips back if the server refuses
  const visibilityMutation = useMutation({
    mutationFn: (showOnLeaderboard: boolean) => api("/api/me/prefs", { body: { showOnLeaderboard } }),
    onMutate: (showOnLeaderboard) => setSession((s) => ({ ...s, showOnLeaderboard })),
    onError: (_error, showOnLeaderboard) => setSession((s) => ({ ...s, showOnLeaderboard: !showOnLeaderboard })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.leaderboards }),
  });
  const { mutate: setLeaderboardVisibility } = visibilityMutation;

  const signOut = useCallback(async () => {
    exchanged.current = null;
    creating.current = false;
    setSession(EMPTY);
    queryClient.removeQueries({ queryKey: qk.all });
    if (!authenticated) return;
    await Promise.allSettled([api("/api/session", { method: "DELETE" }), logout()]);
  }, [authenticated, logout, setSession, queryClient]);

  // signed in to Privy but not yet to the backend (wallet being created, exchange in flight): hold redirects
  const settling = authenticated && session.status !== "member" && !authError;
  const ready = stored && privyReady && !exchange.isPending && !settling;

  const value = useMemo(
    () => ({ session, ready, authError, setEmail, sendEmailCode, verifyEmailCode, signInWithGoogle, signInWithWallet, continueAsGuest, saveProfile, linkTradingAccount, setLeaderboardVisibility, signOut }),
    [session, ready, authError, setEmail, sendEmailCode, verifyEmailCode, signInWithGoogle, signInWithWallet, continueAsGuest, saveProfile, linkTradingAccount, setLeaderboardVisibility, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
