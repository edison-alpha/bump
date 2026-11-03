/**
 * The Privy app id, inlined at build time. Without one (a Vercel project missing its env var, a preview with no secrets),
 * PrivyProvider throws while prerendering and the whole build fails, so the app runs guest-only instead: no sign-in, but
 * everything that does not need an account still works.
 */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export const PRIVY_CONFIGURED = PRIVY_APP_ID.length > 0;
