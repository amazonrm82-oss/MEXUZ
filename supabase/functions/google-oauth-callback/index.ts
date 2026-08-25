// Edge Function: google-oauth-callback
// Public — Google redirects the browser straight here after Eden approves the consent screen,
// with no Authorization header (it's a navigation, not a fetch from our app). Identity is
// carried instead through the one-time nonce minted by google-oauth-start / start_google_oauth().
//
// Deploy: supabase functions deploy google-oauth-callback --no-verify-jwt
// (--no-verify-jwt is required: Supabase's platform-level JWT check would otherwise reject
// Google's redirect outright, since it never carries any Authorization header at all.)
// Secrets needed (set once): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";

function htmlResponse(message: string, ok: boolean) {
  const body = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f3efe6;">
      <div style="text-align:center;padding:24px;">
        <div style="font-size:20px;font-weight:800;color:${ok ? "#2e7d32" : "#c62828"};margin-bottom:8px;">${message}</div>
        <div style="color:#666;font-size:14px;">אפשר לסגור את החלון הזה ולחזור למערכת.</div>
      </div>
    </body></html>`;
  // Send the byte length explicitly and encode as a UTF-8 buffer — some intermediary layers were
  // dropping the charset from the Content-Type header, which made browsers fall back to guessing
  // (usually Windows-1252) and mangling the Hebrew text into mojibake.
  const encoded = new TextEncoder().encode(body);
  return new Response(encoded, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Length": String(encoded.byteLength) },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return htmlResponse("חסרים פרטים בבקשה מגוגל", false);

  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: stateRow, error: stateErr } = await admin
    .from("google_oauth_state")
    .select("profile_id, created_at")
    .eq("id", state)
    .maybeSingle();
  if (stateErr || !stateRow) return htmlResponse("הבקשה פגה או לא נמצאה — נסי לחבר שוב", false);
  await admin.from("google_oauth_state").delete().eq("id", state);
  if (Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) {
    return htmlResponse("הבקשה פגה — נסי לחבר שוב", false);
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error("google token exchange failed", tokenData);
    return htmlResponse("החיבור נכשל — ייתכן שצריך לנתק ולחבר מחדש (Google לא תמיד מחזירה הרשאה מלאה בפעם השנייה)", false);
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Only one connected calendar is ever meant to exist (see migration 0015) — clear out any
  // other row first so two managers connecting around the same time can't leave two rows behind
  // for the sync functions to pick between arbitrarily.
  await admin.from("google_calendar_tokens").delete().neq("profile_id", stateRow.profile_id);

  const { error: upsertErr } = await admin.from("google_calendar_tokens").upsert({
    profile_id: stateRow.profile_id,
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token,
    access_token_expires_at: expiresAt,
  }, { onConflict: "profile_id" });
  if (upsertErr) {
    console.error("token save failed", upsertErr.message);
    return htmlResponse("החיבור הצליח אך שמירת הפרטים נכשלה — פני לתמיכה", false);
  }

  return htmlResponse("יומן Google חובר בהצלחה!", true);
});
