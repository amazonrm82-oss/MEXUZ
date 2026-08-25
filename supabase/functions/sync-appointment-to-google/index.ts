// Edge Function: sync-appointment-to-google
// Called by the appointments_notify_google trigger (supabase/migrations/0015) via pg_net every
// time an appointment is created, edited, or deleted anywhere in the app — not called directly
// by the browser. There's exactly one connected calendar for the whole team (see migration 0015
// for why); this pushes to whichever one is connected, regardless of who owns the appointment.
//
// Deploy: supabase functions deploy sync-appointment-to-google
// Secrets needed (set once): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";

async function ensureFreshToken(admin: any, tokenRow: any) {
  const expiresAt = tokenRow.access_token_expires_at ? new Date(tokenRow.access_token_expires_at).getTime() : 0;
  if (tokenRow.access_token && expiresAt > Date.now() + 60000) return tokenRow.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokenRow.refresh_token,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("token refresh failed", data);
    throw new Error("token refresh failed");
  }
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await admin.from("google_calendar_tokens").update({ access_token: data.access_token, access_token_expires_at: newExpiresAt }).eq("profile_id", tokenRow.profile_id);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.json().catch(() => ({}));
  const { action, appointment_id, google_event_id } = body;

  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: tokenRow } = await admin.from("google_calendar_tokens").select("*").limit(1).maybeSingle();
  if (!tokenRow) return new Response(JSON.stringify({ skipped: "not connected" }), { status: 200 });

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(admin, tokenRow);
  } catch {
    return new Response(JSON.stringify({ error: "token refresh failed" }), { status: 200 });
  }

  const gcalBase = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  if (action === "delete") {
    if (!google_event_id) return new Response(JSON.stringify({ skipped: "no event id" }), { status: 200 });
    const res = await fetch(`${gcalBase}/${google_event_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("google delete failed", res.status, await res.text());
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (action === "upsert") {
    const { data: appt } = await admin.from("appointments").select("*").eq("id", appointment_id).maybeSingle();
    if (!appt) return new Response(JSON.stringify({ skipped: "appointment not found" }), { status: 200 });

    const startIso = new Date(appt.date_time).toISOString();
    const endIso = new Date(new Date(appt.date_time).getTime() + 60 * 60 * 1000).toISOString();
    const eventBody = {
      summary: appt.title || (appt.lead_name ? `פגישה: ${appt.lead_name}` : "פגישה"),
      description: appt.notes || undefined,
      start: { dateTime: startIso, timeZone: "Asia/Jerusalem" },
      end: { dateTime: endIso, timeZone: "Asia/Jerusalem" },
      extendedProperties: { private: { crm_appointment_id: appt.id } },
    };

    let googleId = appt.google_event_id;
    if (googleId) {
      const res = await fetch(`${gcalBase}/${googleId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      if (res.status === 404 || res.status === 410) {
        googleId = null; // fall through to create below
      } else if (!res.ok) {
        console.error("google update failed", res.status, await res.text());
        return new Response(JSON.stringify({ error: "google update failed" }), { status: 200 });
      }
    }

    if (!googleId) {
      const res = await fetch(gcalBase, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      const created = await res.json();
      if (!res.ok || !created.id) {
        console.error("google create failed", res.status, created);
        return new Response(JSON.stringify({ error: "google create failed" }), { status: 200 });
      }
      googleId = created.id;
    }

    await admin.from("appointments").update({ google_event_id: googleId, synced_at: new Date().toISOString() }).eq("id", appt.id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), { status: 200 });
});
