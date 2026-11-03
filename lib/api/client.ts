import type { ApiError as ApiErrorBody } from "./types";

/**
 * Where the browser sends API calls. Production uses the app's own origin: next.config.ts proxies /api/* to bump-backend,
 * so the session cookie is first-party. A cross-site cookie is dropped by Safari and iOS home-screen apps, which would
 * leave a signed-in player with every call after sign-in answered 401. Only a local backend URL is used directly.
 */
const configured = process.env.NEXT_PUBLIC_API_URL ?? "";
export const API_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured) ? configured : process.env.NODE_ENV === "production" ? "" : "http://localhost:3300";

/** A failed call to bump-backend. `message` is the server's own line, written to be shown to the player. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** JSON call to bump-backend with the session cookie. Throws ApiError on any non-2xx answer or network failure. */
export async function api<T>(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      credentials: "include",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Can't reach bump right now. Check your connection.", 0);
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) throw new ApiError((data as ApiErrorBody | null)?.error ?? `Request failed (${response.status}).`, response.status);
  return data as T;
}
