import { createClient } from "@supabase/supabase-js";

// Both values come from Supabase Dashboard → Settings → API, for your own MEXUZ project (this
// app was forked from Arizot Design's CRM and needs its own separate Supabase project — never
// point it at someone else's project). The anon key is safe to ship to the browser — every table
// it can touch is protected by the RLS policies in supabase/migrations/0001_init.sql, so the key
// alone grants no more access than a logged-in user's role allows.
//
// See SETUP.md — until you create your MEXUZ Supabase project and fill in the real values below,
// the app cannot connect to any backend.
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
