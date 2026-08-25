// Edge Function: send-task-push
// Called every minute by a pg_cron job (see migration 0008_push_notifications.sql) — checks
// for tasks/reminders whose pre-notify or due time has just passed and pushes them to every
// device the owner subscribed from (src/lib/push.js), then marks them so they aren't re-sent.
//
// Deploy: supabase functions deploy send-task-push
// Secrets needed (set once): supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to every Edge Function.
//
// Logs every step (console.log/console.error) on purpose — pg_cron only reports whether the
// HTTP call to this function was dispatched, not whether the push inside it actually succeeded,
// so the Edge Function's own Logs tab is the only place a real webpush.sendNotification failure
// (bad VAPID keys, expired subscription, etc.) is visible.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

Deno.serve(async (_req) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID keys missing", { hasPublic: !!VAPID_PUBLIC_KEY, hasPrivate: !!VAPID_PRIVATE_KEY });
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Bounded window: no task can need a push further out than its longest possible
  // remind-before offset (1 week, see REMIND_BEFORE_OPTIONS) past its due date.
  const horizonIso = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();

  const { data: candidates, error } = await admin
    .from("tasks")
    .select("id, owner_id, title, due_at, remind_before_minutes, notified_at, pre_notified_at")
    .eq("completed", false)
    .lte("due_at", horizonIso)
    .or("notified_at.is.null,pre_notified_at.is.null");

  if (error) {
    console.error("query error", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log("candidates found:", (candidates || []).length);

  const now = Date.now();
  const due = [];
  for (const t of candidates || []) {
    const dueMs = new Date(t.due_at).getTime();
    if (t.remind_before_minutes != null && !t.pre_notified_at) {
      if (now >= dueMs - t.remind_before_minutes * 60000) due.push({ task: t, kind: "pre" });
    }
    if (!t.notified_at && now >= dueMs) due.push({ task: t, kind: "due" });
  }

  console.log("due to push:", due.length);

  let sent = 0;
  for (const { task, kind } of due) {
    const { data: subs, error: subsErr } = await admin.from("push_subscriptions").select("*").eq("user_id", task.owner_id);
    if (subsErr) console.error("subs query error", subsErr.message);
    console.log("task", task.id, "owner", task.owner_id, "subs found:", (subs || []).length);

    const payload = JSON.stringify({
      title: kind === "pre" ? `⏰ מתקרב: ${task.title}` : `🔔 הגיע הזמן: ${task.title}`,
      body: new Date(task.due_at).toLocaleString("he-IL"),
      url: "/",
    });
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
        console.log("push sent ok to", s.endpoint.slice(0, 60));
      } catch (err) {
        console.error("push send FAILED:", err?.statusCode, err?.message || String(err), err?.body);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    await admin.from("tasks")
      .update(kind === "pre" ? { pre_notified_at: new Date().toISOString() } : { notified_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  console.log("done. checked:", (candidates || []).length, "sent:", sent);
  return new Response(JSON.stringify({ ok: true, checked: (candidates || []).length, sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
