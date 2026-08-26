// Edge Function: website-lead-webhook
// Public webhook — receives new leads submitted directly from MEXUZ's marketing landing page
// (e.g. a "request a quote" / "contact us" form). Kept as its own function with its own secret,
// separate from facebook-lead-webhook, because this one may be called straight from a public
// browser page rather than a trusted server (Make.com) — if that secret ever needs rotating
// (e.g. because it's technically visible in browser devtools on a client-side call), it won't
// affect the Facebook/Instagram lead pipeline.
//
// Deploy: supabase functions deploy website-lead-webhook --no-verify-jwt
// (--no-verify-jwt is required: the landing page calls this as a plain HTTP request, no Supabase
// Authorization header. Auth instead comes from the shared secret checked below.)
// Secrets needed (set once): WEBSITE_LEAD_WEBHOOK_SECRET
//
// Expected request: POST, header "x-webhook-secret: <WEBSITE_LEAD_WEBHOOK_SECRET>", JSON body:
//   { "name": "...", "phone": "...", "email": "...", "business_name": "...",
//     "product": "...", "quantity": 10, "message": "free-text project description",
//     "city": "...", "country": "...", "channel": "אתר האינטרנט", "is_international": false }
// Only name and phone are required; everything else is optional and defaults sensibly.
// If a caller can't safely embed the secret client-side, route this call through the landing
// page's own backend (if it has one) instead of calling it directly from browser JS.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mirrors src/lib/constants.js's isUSCountryValue() so a lead imported here without an explicit
// is_international flag routes to the same rep pool (regular vs. overseas) as one entered by hand.
const US_STATES_HE = [
  'ארה"ב', "ארהב", "אלבמה", "אלסקה", "אריזונה", "ארקנסו", "קליפורניה", "קולורדו", "קונטיקט", "דלאוור",
  "פלורידה", "ג'ורג'יה", "הוואי", "איידהו", "אילינוי", "אינדיאנה", "איווה", "קנזס", "קנטקי", "לואיזיאנה",
  "מיין", "מרילנד", "מסצ'וסטס", "מישיגן", "מינסוטה", "מיסיסיפי", "מיזורי", "מונטנה", "נברסקה", "נבאדה",
  "ניו המפשייר", "ניו ג'רזי", "ניו מקסיקו", "ניו יורק", "צפון קרוליינה", "צפון דקוטה", "אוהיו", "אוקלהומה",
  "אורגון", "פנסילבניה", "רוד איילנד", "דרום קרוליינה", "דרום דקוטה", "טנסי", "טקסס", "יוטה", "ורמונט",
  "וירג'יניה", "וושינגטון", "מערב וירג'יניה", "ויסקונסין", "וויומינג",
];
const US_TOKENS_EN = [
  "usa", "u.s.a", "u.s.a.", "us", "u.s.", "united states", "united states of america", "america",
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
  "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
  "wisconsin", "wyoming",
];
function isUSCountryValue(countryValue: string) {
  const raw = (countryValue || "").trim();
  if (!raw) return false;
  if (US_STATES_HE.includes(raw)) return true;
  const lower = raw.toLowerCase();
  return US_TOKENS_EN.some((t) => lower.includes(t));
}

function digitsOnly(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const secret = req.headers.get("x-webhook-secret") || "";
  if (!secret || secret !== Deno.env.get("WEBSITE_LEAD_WEBHOOK_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  if (!name || !phone) {
    return new Response(JSON.stringify({ error: "name and phone are required" }), { status: 400, headers: corsHeaders });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const phoneDigits = digitsOnly(phone);
  const { data: existing } = await admin.from("leads").select("phone");
  const isDuplicate = (existing || []).some((l: { phone: string }) => digitsOnly(l.phone) === phoneDigits);
  if (isDuplicate) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate_phone" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const country = (body.country || "").trim();
  const isInternational = typeof body.is_international === "boolean" ? body.is_international : isUSCountryValue(country);

  const { data: inserted, error } = await admin.from("leads").insert({
    name,
    phone,
    email: (body.email || "").trim() || null,
    business_name: (body.business_name || "").trim(),
    product: (body.product || "").trim(),
    quantity: Number(body.quantity) || 0,
    channel: (body.channel || "אתר האינטרנט").trim(),
    city: (body.city || "").trim(),
    country,
    is_international: isInternational,
  }).select("id").single();

  if (error) {
    console.error("lead insert failed", error.message);
    return new Response(JSON.stringify({ error: "insert failed" }), { status: 500, headers: corsHeaders });
  }

  const message = (body.message || "").trim();
  if (message) {
    const { error: noteErr } = await admin.from("lead_notes").insert({ lead_id: inserted.id, text: message });
    if (noteErr) console.error("lead note insert failed", noteErr.message);
  }

  return new Response(JSON.stringify({ ok: true, skipped: false }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
