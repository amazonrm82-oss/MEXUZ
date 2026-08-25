// Edge Function: pull-google-calendar-changes
// Called every 10 minutes by pg_cron (see migration 0015). Pulls whatever changed on the
// connected Google Calendar since the last run and applies it to the CRM's appointments table —
// this is the "Google → CRM" half of the two-way sync; sync-appointment-to-google is the other
// half. Uses Google's incremental sync (syncToken) once a first full sync has run.
//
// Deploy: supabase functions deploy pull-google-calendar-changes
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

Deno.serve(async (_req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: tokenRow } = await admin.from("google_calendar_tokens").select("*").limit(1).maybeSingle();
  if (!tokenRow) return new Response(JSON.stringify({ skipped: "not connected" }), { status: 200 });

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(admin, tokenRow);
  } catch {
    return new Response(JSON.stringify({ error: "token refresh failed" }), { status: 200 });
  }

  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const params = new URLSearchParams({ maxResults: "250" });
  if (tokenRow.sync_token) {
    params.set("syncToken", tokenRow.sync_token);
  } else {
    params.set("timeMin", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    params.set("singleEvents", "true");
  }

  const res = await fetch(`${base}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();

  if (res.status === 410) {
    // syncToken expired/invalid — drop it, next run does a full resync.
    await admin.from("google_calendar_tokens").update({ sync_token: null }).eq("profile_id", tokenRow.profile_id);
    return new Response(JSON.stringify({ resync: true }), { status: 200 });
  }
  if (!res.ok) {
    console.error("google list failed", res.status, data);
    return new Response(JSON.stringify({ error: "google list failed" }), { status: 200 });
  }

  let applied = 0;
  for (const event of data.items || []) {
    const crmId = event.extendedProperties?.private?.crm_appointment_id || null;

    if (event.status === "cancelled") {
      if (crmId) {
        await admin.from("appointments").update({ google_event_id: null }).eq("id", crmId).eq("google_event_id", event.id);
      }
      continue;
    }

    const startIso = event.start?.dateTime || event.start?.date;
    if (!startIso) continue;

    if (crmId) {
      const { data: appt } = await admin.from("appointments").select("id, synced_at").eq("id", crmId).maybeSingle();
      if (!appt) continue; // deleted in the CRM — leave it alone, don't resurrect
      const googleUpdated = event.updated ? new Date(event.updated).getTime() : 0;
      const lastSynced = appt.synced_at ? new Date(appt.synced_at).getTime() : 0;
      if (googleUpdated <= lastSynced) continue; // this is our own last push echoing back, not a real edit
      await admin.from("appointments").update({
        title: event.summary || "פגישה",
        date_time: new Date(startIso).toISOString(),
        notes: event.description || null,
        google_event_id: event.id,
        synced_at: new Date().toISOString(),
      }).eq("id", crmId);
      applied++;
    } else {
      // Created directly in Google, not from the CRM — bring it in.
      const { data: created } = await admin.from("appointments").insert({
        title: event.summary || "פגישה",
        date_time: new Date(startIso).toISOString(),
        notes: event.description || null,
        created_by: tokenRow.profile_id,
        google_event_id: event.id,
        synced_at: new Date().toISOString(),
      }).select().single();
      if (created) {
        await fetch(`${base}/${event.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ extendedProperties: { private: { crm_appointment_id: created.id } } }),
        });
        applied++;
      }
    }
  }

  if (data.nextSyncToken) {
    await admin.from("google_calendar_tokens").update({ sync_token: data.nextSyncToken }).eq("profile_id", tokenRow.profile_id);
  }

  return new Response(JSON.stringify({ ok: true, applied }), { status: 200 });
});
