import { api } from "./api/client";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** The service worker only registers in production builds, so push is off in `next dev`. */
export const pushSupported = () =>
  typeof window !== "undefined" && !!VAPID_KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return navigator.serviceWorker.getRegistration("/");
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  return !!(await (await registration())?.pushManager.getSubscription());
}

/** Asks permission, subscribes this device and hands the subscription to bump-backend. Resolves false when refused. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await registration();
  if (!reg) return false;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) }));
  await api("/api/me/push", { body: sub.toJSON() });
  return true;
}

export async function disablePush(): Promise<void> {
  const sub = pushSupported() ? await (await registration())?.pushManager.getSubscription() : null;
  if (!sub) return;
  await api("/api/me/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => undefined);
  await sub.unsubscribe();
}
