// Edge Function: google-oauth-start
// Called by the browser (Settings → יומן Google → "חבר יומן") to get the Google consent-screen
// URL. Manager-only — enforced again here even though start_google_oauth() also checks, since
// that's the real gate (RLS-equivalent for this feature).
//
// Deploy: supabase functions deploy google-oauth-start
// Secrets needed (set once): GOOGLE_CLIENT_ID
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "לא מחובר" }), { status: 401, headers: corsHeaders });
  }

  // Must run as the caller (not the service role) so auth.uid() inside start_google_oauth()
  // resolves to this user — that's how the function knows who to link the nonce to and whether
  // they're allowed to do this at all.
  const { data: nonce, error: nonceErr } = await callerClient.rpc("start_google_oauth");
  if (nonceErr) {
    return new Response(JSON.stringify({ error: nonceErr.message.includes("רק") ? nonceErr.message : "אין הרשאה" }), { status: 403, headers: corsHeaders });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state: nonce,
  });

  return new Response(JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
