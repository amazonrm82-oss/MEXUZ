// Edge Function: facebook-lead-webhook
// Public webhook — receives new leads pushed from a Make.com scenario that's triggered by
// Facebook/Instagram Lead Ads. Not a Facebook Graph API integration itself: Make already holds
// the Facebook connection (it existed before this CRM did) and does the Lead Ads → JSON step;
// this function is just the receiving end, so no Facebook App Review / webhook subscription
// work is needed on our side.
//
// Deploy: supabase functions deploy facebook-lead-webhook --no-verify-jwt
// (--no-verify-jwt is required: Make calls this as a plain HTTP request, no Supabase Authorization
// header. Auth instead comes from the shared secret checked below.)
// Secrets needed (set once): LEAD_WEBHOOK_SECRET
//
// Expected request: POST, header "x-webhook-secret: <LEAD_WEBHOOK_SECRET>", JSON body:
//   { "name": "...", "phone": "...", "business_name": "...", "contact_role": "...",
//     "product": "...", "quantity": 100, "ad_name": "...", "city": "...", "country": "...",
//     "channel": "פייסבוק", "is_international": false }
// Only name and phone are required; everything else is optional and defaults sensibly.

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
  if (!secret || secret !== Deno.env.get("LEAD_WEBHOOK_SECRET")) {
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

  const { error } = await admin.from("leads").insert({
    name,
    phone,
    business_name: (body.business_name || "").trim(),
    contact_role: (body.contact_role || "").trim(),
    product: (body.product || "").trim(),
    quantity: Number(body.quantity) || 0,
    ad_name: (body.ad_name || "").trim(),
    channel: (body.channel || "פייסבוק").trim(),
    city: (body.city || "").trim(),
    country,
    is_international: isInternational,
  });

  if (error) {
    console.error("lead insert failed", error.message);
    return new Response(JSON.stringify({ error: "insert failed" }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, skipped: false }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
