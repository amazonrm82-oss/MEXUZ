import { supabase } from "./supabaseClient";

// Public VAPID key — safe to ship in the client bundle (only the private key, held by the
// send-task-push Edge Function, must stay secret). Generate your own pair for this deployment
// (e.g. `npx web-push generate-vapid-keys`) and paste the public half in here — see SETUP.md.
const VAPID_PUBLIC_KEY = "BLti-c0347S4bvOZtqydJ8twNegA0ZpL9pi9RJfNUVEeMdRtK2kovqJ2OyJ6TKOY_sDQDUoUXSAc2mCMBazA5iU";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

export async function enablePush(userId) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { error: "לא אושרה הרשאה להתראות" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "endpoint" }
  );
  return { error: error ? error.message : null };
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
