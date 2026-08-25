// Edge Function: admin-create-account
// Creates a new login (auth user + profiles row). Must run server-side because it needs the
// service-role key — never call this with the anon key from the browser without going through
// this function. Only an existing "סגן"/"מנהל"/super-admin caller may invoke it successfully.
//
// Deploy: supabase functions deploy admin-create-account
// Secrets needed (set once): SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically to every Edge Function by the Supabase platform — no manual secret needed.

import { createClient } from "npm:@supabase/supabase-js@2";

// Required for supabase.functions.invoke() from the browser: without these headers the
// preflight OPTIONS request gets rejected and the real POST never leaves the browser.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLE_OPTIONS = ["נציג חול", "נציג רגיל", "סגן", "מנהל"];

// Mirrors src/lib/passwordPolicy.js — re-checked here since the client-side check is only a
// convenience, not a real gate.
function passwordError(pw: string): string | null {
  if (!pw || pw.length < 8 || pw.length > 16) return "הסיסמה חייבת להכיל בין 8 ל-16 תווים";
  if (!/[A-Z]/.test(pw)) return "הסיסמה חייבת לכלול לפחות אות גדולה אחת (A-Z)";
  if (!/[a-z]/.test(pw)) return "הסיסמה חייבת לכלול לפחות אות קטנה אחת (a-z)";
  if (!/[0-9]/.test(pw)) return "הסיסמה חייבת לכלול לפחות ספרה אחת (0-9)";
  return null;
}

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, is_super_admin")
    .eq("id", user.id)
    .single();

  const canActLikeManager =
    callerProfile && (callerProfile.is_super_admin || ["סגן", "מנהל"].includes(callerProfile.role));
  if (!canActLikeManager) {
    return new Response(JSON.stringify({ error: "אין הרשאה ליצור משתמשים" }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { username, name, password, role } = body;
  if (!username || !name || !password || !ROLE_OPTIONS.includes(role)) {
    return new Response(JSON.stringify({ error: "נתונים חסרים או שגויים" }), { status: 400, headers: corsHeaders });
  }
  const pwErr = passwordError(password);
  if (pwErr) {
    return new Response(JSON.stringify({ error: pwErr }), { status: 400, headers: corsHeaders });
  }

  const email = `${crypto.randomUUID()}@mexuz.internal`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    name,
    role,
    is_super_admin: false,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    const msg = profileErr.code === "23505" ? "שם המשתמש כבר קיים" : profileErr.message;
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, id: created.user.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
