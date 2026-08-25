// Edge Function: admin-delete-account
// Deletes a login (auth user + profiles row, cascades). Manager-only, cannot target a super admin.
// Deploy: supabase functions deploy admin-delete-account

import { createClient } from "npm:@supabase/supabase-js@2";

// Required for supabase.functions.invoke() from the browser: without these headers the
// preflight OPTIONS request gets rejected and the real POST never leaves the browser.
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
    return new Response(JSON.stringify({ error: "אין הרשאה למחוק משתמשים" }), { status: 403, headers: corsHeaders });
  }

  const { targetId } = await req.json().catch(() => ({}));
  if (!targetId) {
    return new Response(JSON.stringify({ error: "חסר מזהה משתמש" }), { status: 400, headers: corsHeaders });
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", targetId)
    .single();
  if (targetProfile?.is_super_admin) {
    return new Response(JSON.stringify({ error: "לא ניתן למחוק חשבון סופר-אדמין" }), { status: 400, headers: corsHeaders });
  }

  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    const message = error.message?.includes("violates foreign key constraint")
      ? "המחיקה נכשלה בגלל נתונים שעדיין מקושרים לחשבון הזה. נסי שוב, ואם זה חוזר פני לתמיכה."
      : error.message;
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
