import { createClient } from "@supabase/supabase-js";

// Same project as src/lib/supabaseClient.js, but a SEPARATE client with its own auth storage
// key — supabase-js otherwise keeps the session in a fixed localStorage key, so a staff member
// logged into the internal CRM and a customer logging into /portal on the same browser would
// silently share (and clobber) one session. A distinct storageKey keeps the two completely
// independent, even in the same browser/tab.
const SUPABASE_URL = "https://otahnuvlfbprlfblzpno.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YWhudXZsZmJwcmxmYmx6cG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2OTg3ODAsImV4cCI6MjEwMzI3NDc4MH0.nXi3zuFpN7Rlhr7iepxI6ot9GTmPw6Bg1B00prD_pHI";

export const portalSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: "mexuz-portal-auth" },
});
