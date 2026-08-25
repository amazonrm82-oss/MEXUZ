-- MEXUZ CRM — full schema for a fresh Supabase project.
-- Run this once in the Supabase SQL editor (or via `supabase db push`) on a brand-new project.
-- Real Postgres tables, Supabase Auth, RLS-enforced permissions, and Realtime subscriptions —
-- no client-side fake storage layer.
--
-- This single file is the whole schema (equivalent to running ~23 incremental migrations on the
-- original Arizot Design CRM this app was forked from, already squashed into their final state
-- and re-labeled for MEXUZ's own business: a company that builds CRM/ERP/management systems for
-- clients, instead of a packaging manufacturer). See SETUP.md for the steps to run this against
-- your own new Supabase project.

create extension if not exists pgcrypto;

-- ============================================================================
-- PROFILES (one row per Supabase Auth user — roles live here, not in auth.users)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  role text not null check (role in ('נציג חול', 'נציג רגיל', 'סגן', 'מנהל')),
  is_super_admin boolean not null default false,
  can_view_reports boolean not null default false,
  language text not null default 'he' check (language in ('he', 'en')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'App-level identity + role for each login account. role drives all permissions.';

-- Helper functions used throughout RLS policies below.
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

-- Two-factor auth (TOTP) is opt-in per account via Supabase's built-in MFA
-- (supabase.auth.mfa.enroll/challenge/verify — no custom secret storage needed, GoTrue handles
-- that). Once a סגן/מנהל/super-admin has a verified TOTP factor, can_act_like_manager() only
-- returns true when their CURRENT session has completed the 2FA challenge (aal2) — an aal1
-- session (password only, 2FA not yet entered) loses manager-tier access until they verify.
-- Accounts that never enroll are completely unaffected.
create or replace function public.has_verified_mfa()
returns boolean language sql stable as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = auth.uid() and f.status = 'verified'
  );
$$;

-- "סגן" and "מנהל" (+ super admin) get every manager-level permission except system reset.
create or replace function public.can_act_like_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select (public.is_super_admin() or public.current_role() in ('סגן', 'מנהל'))
    and (not public.has_verified_mfa() or coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2');
$$;

-- Only "מנהל" (+ super admin) can reset system data. סגן is excluded.
create or replace function public.can_reset_system()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.current_role() = 'מנהל';
$$;

create or replace function public.is_regular_rep()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'נציג רגיל';
$$;

create or replace function public.is_foreign_rep()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'נציג חול';
$$;

-- Username -> email lookup so the login screen can accept a username while Supabase Auth itself
-- still authenticates by email+password under the hood.
create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

alter table public.profiles enable row level security;

create policy profiles_select_all on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_update_self_or_manager on public.profiles
  for update using (id = auth.uid() or public.can_act_like_manager())
  with check (id = auth.uid() or public.can_act_like_manager());

create policy profiles_delete_manager on public.profiles
  for delete using (public.can_act_like_manager() and not is_super_admin);

-- Defense in depth beyond the RLS check above: a non-super-admin manager can update roles via
-- the policy, but must never be able to grant/revoke is_super_admin or change their own role
-- (self-promotion), even via a raw table update outside the app's UI.
create or replace function public.enforce_profile_update_guards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin and not public.is_super_admin() then
    raise exception 'רק סופר-אדמין יכול לשנות סטטוס סופר-אדמין';
  end if;
  if new.role is distinct from old.role and old.id = auth.uid() and not public.can_act_like_manager() then
    raise exception 'אין הרשאה לשנות תפקיד עצמי';
  end if;
  return new;
end;
$$;

create trigger profiles_update_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_update_guards();

-- Row creation happens via the admin-create-account Edge Function (service role), so no
-- client-side insert policy is needed/granted here.

-- ============================================================================
-- CATALOG — systems MEXUZ builds (CRM/ERP/project management/etc.), sold in package tiers
-- priced per number of user seats, plus optional add-on modules, service levels, and
-- deployment & onboarding pricing.
-- ============================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sub_product text not null,
  created_at timestamptz not null default now(),
  unique (name, sub_product)
);

create table public.product_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  qty integer not null,
  price numeric not null
);

create table public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  name text not null,
  price numeric not null,
  per_unit boolean not null default false
);

create table public.finishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mult numeric not null default 1
);

create table public.global_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric not null
);

create table public.shipping_options (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.shipping_ranges (
  id uuid primary key default gen_random_uuid(),
  shipping_option_id uuid not null references public.shipping_options(id) on delete cascade,
  from_qty integer not null,
  to_qty integer not null,
  price numeric not null
);

alter table public.products enable row level security;
alter table public.product_tiers enable row level security;
alter table public.product_addons enable row level security;
alter table public.finishes enable row level security;
alter table public.global_addons enable row level security;
alter table public.shipping_options enable row level security;
alter table public.shipping_ranges enable row level security;

create policy catalog_select on public.products for select using (auth.uid() is not null);
create policy catalog_write on public.products for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy tiers_select on public.product_tiers for select using (auth.uid() is not null);
create policy tiers_write on public.product_tiers for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy addons_select on public.product_addons for select using (auth.uid() is not null);
create policy addons_write on public.product_addons for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy finishes_select on public.finishes for select using (auth.uid() is not null);
create policy finishes_write on public.finishes for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy global_addons_select on public.global_addons for select using (auth.uid() is not null);
create policy global_addons_write on public.global_addons for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy shipping_options_select on public.shipping_options for select using (auth.uid() is not null);
create policy shipping_options_write on public.shipping_options for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy shipping_ranges_select on public.shipping_ranges for select using (auth.uid() is not null);
create policy shipping_ranges_write on public.shipping_ranges for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

-- ============================================================================
-- LEADS + children
-- ============================================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  business_name text,
  contact_role text,
  product text,
  quantity integer,
  ad_name text,
  channel text,
  city text,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  lead_status text not null default 'ליד חדש',
  process_status text not null default 'ליד ראשוני',
  address text,
  country text,
  is_international boolean not null default false,
  received_at timestamptz not null default now(),
  closed_at timestamptz,
  ops_status text,
  pending_approval boolean not null default false,
  approved_at timestamptz,
  delivered_at timestamptz,
  archived boolean not null default false,
  canceled boolean not null default false,
  canceled_at timestamptz,
  owes_payment boolean not null default false,
  unpaid_since timestamptz,
  paid_amount numeric not null default 0,
  expense numeric not null default 0,
  is_hot boolean not null default false,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index leads_claimed_by_idx on public.leads(claimed_by);
create index leads_is_international_idx on public.leads(is_international);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  product text not null,
  qty integer not null,
  amount numeric not null,
  given_amount numeric,
  created_at timestamptz not null default now()
);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  text text not null,
  follow_up date,
  created_at timestamptz not null default now()
);

create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender text not null check (sender in ('rep', 'system')),
  text text not null,
  created_at timestamptz not null default now()
);

create table public.lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  file_type text,
  url text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.order_lines enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_messages enable row level security;
alter table public.lead_files enable row level security;

create policy leads_select on public.leads for select using (
  public.can_act_like_manager()
  or (public.is_foreign_rep() and is_international)
  or (public.is_regular_rep() and not is_international)
);

create policy leads_insert on public.leads for insert with check (auth.uid() is not null);

create policy leads_update on public.leads for update using (
  (
    public.can_act_like_manager()
    or (public.is_foreign_rep() and is_international)
    or (public.is_regular_rep() and not is_international)
  )
  and (public.can_act_like_manager() or claimed_by is null or claimed_by = auth.uid())
) with check (
  (
    public.can_act_like_manager()
    or (public.is_foreign_rep() and is_international)
    or (public.is_regular_rep() and not is_international)
  )
  and (public.can_act_like_manager() or claimed_by is null or claimed_by = auth.uid())
);

create policy leads_delete on public.leads for delete using (public.can_reset_system());

create or replace function public.lead_is_visible(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l where l.id = p_lead_id and (
      public.can_act_like_manager()
      or (public.is_foreign_rep() and l.is_international)
      or (public.is_regular_rep() and not l.is_international)
    )
  );
$$;

-- A lead claimed by someone else is view-only for anyone but the claimer or a manager/deputy —
-- this is the gate that stops notes/messages/files/order-lines being added to a claimed lead by
-- someone who can merely see it.
create or replace function public.lead_is_editable(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_act_like_manager() or exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (l.claimed_by is null or l.claimed_by = auth.uid())
  );
$$;

-- Guard the transitions that must stay manager-only even though reps can update their own leads:
-- marking a project "נמסר ללקוח" (delivered) and clearing pending_approval (approving a deal).
create or replace function public.enforce_lead_transition_guards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ops_status = 'נמסר ללקוח' and (old.ops_status is distinct from new.ops_status) and not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לסמן פרויקט כנמסר ללקוח';
  end if;
  if old.pending_approval = true and new.pending_approval = false and not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לאשר עסקה';
  end if;
  return new;
end;
$$;

create trigger leads_transition_guard
  before update on public.leads
  for each row execute function public.enforce_lead_transition_guards();

-- When a rep marks a lead's process_status as "מספר שגוי" (wrong number), the lead should just
-- disappear rather than sit around needing a manual delete. leads_delete is manager-only
-- (can_reset_system), so this runs as a SECURITY DEFINER trigger to bypass that restriction only
-- for this one specific, narrow case.
create or replace function public.auto_delete_wrong_number_leads()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.process_status = 'מספר שגוי' then
    delete from public.leads where id = new.id;
  end if;
  return new;
end;
$$;

create trigger leads_auto_delete_wrong_number
  after update on public.leads
  for each row execute function public.auto_delete_wrong_number_leads();

-- If a brand-new lead's phone number matches a lead that already had a closed deal, the person
-- is a returning customer — tag it "לקוח עבר" automatically instead of the default "ליד חדש".
-- Runs on INSERT only, and only overrides the default, so it never clobbers a status someone
-- explicitly set.
create or replace function public.mark_returning_customer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_status = 'ליד חדש' and new.phone is not null and exists (
    select 1 from public.leads l where l.phone = new.phone and l.closed_at is not null
  ) then
    new.lead_status := 'לקוח עבר';
  end if;
  return new;
end;
$$;

create trigger leads_mark_returning_customer
  before insert on public.leads
  for each row execute function public.mark_returning_customer();

-- "Hot lead" is automatic, not a manual toggle: a CRM/ERP system deal with more than 50 seats —
-- MEXUZ's biggest, highest-value system categories at enterprise scale. Recomputed on every
-- insert/update so it always reflects product/qty, even if a rep edits either after creation.
create or replace function public.auto_tag_hot_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_hot := coalesce(new.quantity, 0) > 50 and (
    new.product ilike '%מערכת CRM%' or new.product ilike '%מערכת ERP%'
  );
  return new;
end;
$$;

create trigger leads_auto_tag_hot
  before insert or update on public.leads
  for each row execute function public.auto_tag_hot_lead();

-- Supports the "stuck leads" report — tracks when process_status last changed.
create or replace function public.track_lead_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.process_status is distinct from old.process_status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger leads_track_status_change
  before update on public.leads
  for each row execute function public.track_lead_status_change();

-- Tracks who changed what on a lead and when — status, assignment, cancellation. Populated only
-- by the trigger below (no insert policy for clients); manager/deputy-only to read (reps should
-- not see it on leads they don't manage).
create table public.lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

alter table public.lead_activity_log enable row level security;
create policy lead_activity_log_select on public.lead_activity_log for select using (public.can_act_like_manager());

create or replace function public.log_lead_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.process_status is distinct from old.process_status then
    insert into public.lead_activity_log (lead_id, actor_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'process_status', old.process_status, new.process_status);
  end if;
  if new.lead_status is distinct from old.lead_status then
    insert into public.lead_activity_log (lead_id, actor_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'lead_status', old.lead_status, new.lead_status);
  end if;
  if new.claimed_by is distinct from old.claimed_by then
    insert into public.lead_activity_log (lead_id, actor_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'claimed_by', old.claimed_by::text, new.claimed_by::text);
  end if;
  if new.canceled is distinct from old.canceled then
    insert into public.lead_activity_log (lead_id, actor_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'canceled', old.canceled::text, new.canceled::text);
  end if;
  return new;
end;
$$;

create trigger leads_log_activity
  after update on public.leads
  for each row execute function public.log_lead_activity();

create policy order_lines_select on public.order_lines for select using (public.lead_is_visible(lead_id));
create policy order_lines_insert on public.order_lines for insert with check (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);
create policy order_lines_write on public.order_lines for update using (public.can_act_like_manager()) with check (public.can_act_like_manager());
create policy order_lines_delete on public.order_lines for delete using (public.can_act_like_manager());

create policy lead_notes_select on public.lead_notes for select using (public.lead_is_visible(lead_id));
create policy lead_notes_insert on public.lead_notes for insert with check (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);

create policy lead_messages_select on public.lead_messages for select using (public.lead_is_visible(lead_id));
create policy lead_messages_insert on public.lead_messages for insert with check (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);

create policy lead_files_select on public.lead_files for select using (public.lead_is_visible(lead_id));
create policy lead_files_insert on public.lead_files for insert with check (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);
create policy lead_files_delete on public.lead_files for delete using (
  uploaded_by = auth.uid() or public.can_act_like_manager()
);

insert into storage.buckets (id, name, public)
values ('lead-files', 'lead-files', true)
on conflict (id) do nothing;

create policy lead_files_storage_insert on storage.objects for insert
  with check (bucket_id = 'lead-files' and auth.uid() is not null);

create policy lead_files_storage_select on storage.objects for select
  using (bucket_id = 'lead-files');

create policy lead_files_storage_delete on storage.objects for delete
  using (bucket_id = 'lead-files' and (owner = auth.uid() or public.can_act_like_manager()));

-- ============================================================================
-- VENDORS & SUBCONTRACTORS (freelance developers/designers, hosting, API/SaaS vendors, etc.)
-- ============================================================================

create table public.suppliers_master (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.supplier_charges (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers_master(id),
  lead_id uuid references public.leads(id) on delete set null,
  amount numeric not null,
  due_date date,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.suppliers_master enable row level security;
alter table public.supplier_charges enable row level security;

create policy suppliers_master_select on public.suppliers_master for select using (auth.uid() is not null);
create policy suppliers_master_write on public.suppliers_master for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy supplier_charges_select on public.supplier_charges for select using (public.can_act_like_manager());
create policy supplier_charges_write on public.supplier_charges for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

-- ============================================================================
-- CUSTOMERS (manually added, in addition to customers derived from closed leads)
-- ============================================================================

create table public.manual_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  business_name text,
  last_deal text,
  created_at timestamptz not null default now()
);

alter table public.manual_customers enable row level security;
create policy manual_customers_select on public.manual_customers for select using (auth.uid() is not null);
create policy manual_customers_write on public.manual_customers for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================================
-- APPOINTMENTS / CALENDAR (+ optional two-way Google Calendar sync)
-- ============================================================================

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  lead_name text,
  date_time timestamptz not null,
  title text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  google_event_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;
create policy appointments_select on public.appointments for select using (auth.uid() is not null);
create policy appointments_insert on public.appointments for insert with check (auth.uid() is not null);
create policy appointments_update on public.appointments for update using (
  created_by = auth.uid() or public.can_act_like_manager()
) with check (
  created_by = auth.uid() or public.can_act_like_manager()
);
create policy appointments_delete on public.appointments for delete using (
  created_by = auth.uid() or public.can_act_like_manager()
);

-- Two-way sync between the CRM calendar and a single connected Google Calendar (meant to be
-- whoever's account is connected — that becomes the one shared destination/source for every
-- appointment, regardless of who created it in the CRM). Only one row in google_calendar_tokens
-- is expected at a time.
--
-- IMPORTANT — before running the cron.schedule block near the bottom of this file:
-- 1. Deploy sync-appointment-to-google and pull-google-calendar-changes (see SETUP.md).
-- 2. Replace YOUR_PROJECT_REF and PASTE_YOUR_SERVICE_ROLE_KEY_HERE with your own project's values
--    (Supabase Dashboard -> Project Settings -> API -> service_role — never the anon key, and
--    never put this key anywhere in the frontend code).

create table public.google_calendar_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  sync_token text,
  connected_at timestamptz not null default now()
);
alter table public.google_calendar_tokens enable row level security;

-- Short-lived nonce linking a Google OAuth redirect back to the profile that started it.
create table public.google_oauth_state (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.google_oauth_state enable row level security;

create or replace function public.google_calendar_connected()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.google_calendar_tokens);
$$;
grant execute on function public.google_calendar_connected() to authenticated;

create or replace function public.disconnect_google_calendar()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לנתק את יומן Google';
  end if;
  delete from public.google_calendar_tokens;
end;
$$;
grant execute on function public.disconnect_google_calendar() to authenticated;

create or replace function public.start_google_oauth()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לחבר את יומן Google';
  end if;
  delete from public.google_oauth_state where created_at < now() - interval '10 minutes';
  insert into public.google_oauth_state (profile_id) values (auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.start_google_oauth() to authenticated;

-- Pushes every real appointment change (create/edit/delete, from any screen) to Google. Only
-- fires on columns a human actually edits — writes that ONLY touch google_event_id/synced_at
-- (which is all the sync functions themselves ever set) don't re-trigger, so a pull-driven
-- update and the push it causes can't ping-pong forever.
create or replace function public.notify_appointment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  should_sync boolean;
begin
  if tg_op = 'DELETE' then
    if old.google_event_id is not null then
      perform net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-appointment-to-google',
        headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_SERVICE_ROLE_KEY_HERE', 'Content-Type', 'application/json'),
        body := jsonb_build_object('action', 'delete', 'google_event_id', old.google_event_id)
      );
    end if;
    return old;
  end if;

  should_sync := tg_op = 'INSERT' or (
    new.title is distinct from old.title or
    new.date_time is distinct from old.date_time or
    new.notes is distinct from old.notes or
    new.lead_name is distinct from old.lead_name
  );

  if should_sync then
    perform net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-appointment-to-google',
      headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_SERVICE_ROLE_KEY_HERE', 'Content-Type', 'application/json'),
      body := jsonb_build_object('action', 'upsert', 'appointment_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger appointments_notify_google
  after insert or update or delete on public.appointments
  for each row execute function public.notify_appointment_change();

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'pull-google-calendar-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/pull-google-calendar-changes',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_SERVICE_ROLE_KEY_HERE', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- IMPORT SOURCES + APP SETTINGS
-- ============================================================================

create table public.import_sources (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text,
  default_country text,
  last_import_at timestamptz
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

create table public.custom_tabs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  title text,
  content text,
  sort_order integer not null default 0
);

alter table public.import_sources enable row level security;
alter table public.app_settings enable row level security;
alter table public.custom_tabs enable row level security;

create policy import_sources_select on public.import_sources for select using (public.can_act_like_manager());
create policy import_sources_write on public.import_sources for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy app_settings_select on public.app_settings for select using (auth.uid() is not null);
create policy app_settings_write on public.app_settings for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

create policy custom_tabs_select on public.custom_tabs for select using (auth.uid() is not null);
create policy custom_tabs_write on public.custom_tabs for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

-- Manager-managed quick reply templates for WhatsApp.
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

create policy message_templates_select on public.message_templates for select using (auth.uid() is not null);
create policy message_templates_write on public.message_templates for all
  using (public.can_act_like_manager()) with check (public.can_act_like_manager());

-- ============================================================================
-- ANNOUNCEMENTS — the app's post-login home screen bulletin board. Anyone can read; only
-- managers/deputies can post, pin, or delete.
-- ============================================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy announcements_select on public.announcements for select using (auth.uid() is not null);
create policy announcements_write on public.announcements for all using (public.can_act_like_manager()) with check (public.can_act_like_manager());

-- ============================================================================
-- LOGIN LOCKOUT — escalating: 5 failed attempts -> 5 min wait, 10 -> 10 min, 12 -> 12 hour block.
-- Tracked per username, not per session, since login happens before any auth.uid() exists. RLS is
-- enabled with no policies at all — only these SECURITY DEFINER functions can touch the table.
-- ============================================================================

create table public.login_attempts (
  username text primary key,
  fail_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

create or replace function public.check_login_lockout(p_username text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until from public.login_attempts where username = p_username;
  if v_locked_until is not null and v_locked_until > now() then
    return json_build_object('locked', true, 'retry_after_seconds', ceil(extract(epoch from (v_locked_until - now())))::integer);
  end if;
  return json_build_object('locked', false, 'retry_after_seconds', 0);
end;
$$;

create or replace function public.record_login_failure(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  insert into public.login_attempts (username, fail_count, last_attempt_at)
  values (p_username, 1, now())
  on conflict (username) do update set
    fail_count = public.login_attempts.fail_count + 1,
    last_attempt_at = now()
  returning fail_count into v_count;

  if v_count >= 12 then
    update public.login_attempts set locked_until = now() + interval '12 hours' where username = p_username;
  elsif v_count >= 10 then
    update public.login_attempts set locked_until = now() + interval '10 minutes' where username = p_username;
  elsif v_count >= 5 then
    update public.login_attempts set locked_until = now() + interval '5 minutes' where username = p_username;
  end if;
end;
$$;

create or replace function public.record_login_success(p_username text)
returns void language sql security definer set search_path = public as $$
  delete from public.login_attempts where username = p_username;
$$;

grant execute on function public.check_login_lockout(text) to anon, authenticated;
grant execute on function public.record_login_failure(text) to anon, authenticated;
grant execute on function public.record_login_success(text) to anon, authenticated;

-- ============================================================================
-- ACTIVE SESSIONS — lets a manager/deputy see who's currently logged in (across devices) and
-- force-disconnect a specific session. Reads/writes auth.sessions directly via SECURITY DEFINER.
-- ============================================================================

create or replace function public.list_active_sessions()
returns table(session_id uuid, user_id uuid, name text, username text, role text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לראות התחברויות פעילות';
  end if;
  return query
    select s.id, s.user_id, p.name, p.username, p.role, s.created_at, s.updated_at
    from auth.sessions s
    join public.profiles p on p.id = s.user_id
    order by s.updated_at desc;
end;
$$;
grant execute on function public.list_active_sessions() to authenticated;

create or replace function public.force_logout_session(target_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_act_like_manager() then
    raise exception 'רק סגן או מנהל יכולים לנתק התחברויות';
  end if;
  delete from auth.sessions where id = target_session_id;
end;
$$;
grant execute on function public.force_logout_session(uuid) to authenticated;

-- ============================================================================
-- TASKS + REMINDERS
--   kind='reminder', owner_id=created_by       -> personal reminders (fires at due_at, optional pre-notify)
--   kind='task',     owner_id=created_by       -> personal tasks with a self-set deadline
--   kind='task',     owner_id<>created_by      -> assigned by a manager/deputy to owner_id
-- ============================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('task', 'reminder')),
  title text not null,
  notes text,
  due_at timestamptz not null,
  remind_before_minutes integer,
  completed boolean not null default false,
  completed_at timestamptz,
  seen boolean not null default false,
  notified_at timestamptz,
  pre_notified_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  lead_name text,
  created_at timestamptz not null default now()
);

create index tasks_owner_idx on public.tasks(owner_id);
create index tasks_created_by_idx on public.tasks(created_by);

alter table public.tasks enable row level security;

create policy tasks_select on public.tasks for select using (
  owner_id = auth.uid() or created_by = auth.uid()
);

-- Self-made items (task or reminder) always have owner=created_by=me.
-- Manager-assigned items must be kind='task', created by a manager, for any employee.
create policy tasks_insert on public.tasks for insert with check (
  (owner_id = auth.uid() and created_by = auth.uid())
  or (kind = 'task' and created_by = auth.uid() and public.can_act_like_manager())
);

create policy tasks_update on public.tasks for update using (
  owner_id = auth.uid() or created_by = auth.uid()
) with check (
  owner_id = auth.uid() or created_by = auth.uid()
);

create policy tasks_delete on public.tasks for delete using (
  owner_id = auth.uid() or created_by = auth.uid()
);

-- ============================================================================
-- PUSH NOTIFICATIONS — real push for tasks/reminders (fires even when the app is closed), on
-- top of the in-tab toasts useTaskAlerts.js already shows. Needs the send-task-push Edge
-- Function deployed first (see SETUP.md) — the block below sets up storage for subscriptions +
-- the cron job that calls that function every minute.
-- ============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete using (user_id = auth.uid());

-- ============================================================================
-- IMPORTANT — before running the cron.schedule block below:
-- 1. Deploy the send-task-push Edge Function (see SETUP.md).
-- 2. Replace YOUR_PROJECT_REF and PASTE_YOUR_SERVICE_ROLE_KEY_HERE with your project's own values
--    (Supabase Dashboard -> Project Settings -> API -> service_role, the secret one — never the
--    anon key, and never put this key anywhere in the frontend code).
-- ============================================================================

select cron.schedule(
  'send-task-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-task-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer PASTE_YOUR_SERVICE_ROLE_KEY_HERE',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- CHAT
-- ============================================================================

create table public.team_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  text text,
  edited_at timestamptz,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz not null default now()
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete set null,
  text text,
  edited_at timestamptz,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz not null default now()
);

create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, member_id)
);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  text text,
  edited_at timestamptz,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  created_at timestamptz not null default now()
);

create table public.chat_reads (
  conversation_key text not null,
  account_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_key, account_id)
);

alter table public.team_messages enable row level security;
alter table public.direct_messages enable row level security;
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.chat_reads enable row level security;

create policy team_messages_select on public.team_messages for select using (auth.uid() is not null);
create policy team_messages_insert on public.team_messages for insert with check (sender_id = auth.uid());
-- Messages can be edited by their sender within 5 minutes, and deleted by their sender within 10
-- minutes (a manager can still delete anytime, for moderation).
create policy team_messages_delete on public.team_messages for delete using (
  (sender_id = auth.uid() and created_at > now() - interval '10 minutes') or public.can_act_like_manager()
);
create policy team_messages_update on public.team_messages for update using (
  sender_id = auth.uid() and created_at > now() - interval '5 minutes'
) with check (sender_id = auth.uid());

create policy direct_messages_select on public.direct_messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy direct_messages_insert on public.direct_messages for insert with check (sender_id = auth.uid());
create policy direct_messages_delete on public.direct_messages for delete using (
  (sender_id = auth.uid() and created_at > now() - interval '10 minutes') or public.can_act_like_manager()
);
create policy direct_messages_update on public.direct_messages for update using (
  sender_id = auth.uid() and created_at > now() - interval '5 minutes'
) with check (sender_id = auth.uid());

-- security definer so it bypasses RLS internally — a plain self-referencing subquery in a
-- chat_group_members policy would otherwise trigger "infinite recursion detected in policy".
create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_group_members m where m.group_id = p_group_id and m.member_id = auth.uid());
$$;

create policy chat_groups_select on public.chat_groups for select using (public.is_group_member(id));
create policy chat_groups_insert on public.chat_groups for insert with check (created_by = auth.uid());
create policy chat_groups_delete on public.chat_groups for delete using (created_by = auth.uid() or public.can_act_like_manager());

create policy chat_group_members_select on public.chat_group_members for select using (
  member_id = auth.uid() or public.is_group_member(group_id)
);
create policy chat_group_members_insert on public.chat_group_members for insert with check (
  exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid())
  or member_id = auth.uid()
);
create policy chat_group_members_delete on public.chat_group_members for delete using (
  member_id = auth.uid() or exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid())
);

create policy group_messages_select on public.group_messages for select using (public.is_group_member(group_id));
create policy group_messages_insert on public.group_messages for insert with check (
  sender_id = auth.uid() and public.is_group_member(group_id)
);
create policy group_messages_delete on public.group_messages for delete using (
  (sender_id = auth.uid() and created_at > now() - interval '10 minutes') or public.can_act_like_manager()
);
create policy group_messages_update on public.group_messages for update using (
  sender_id = auth.uid() and created_at > now() - interval '5 minutes'
) with check (sender_id = auth.uid());

-- Read receipts ("seen"/"sent" ticks) need every participant to see everyone's last-read time
-- for a conversation, not just their own — read timestamps aren't sensitive.
create policy chat_reads_select on public.chat_reads for select using (auth.uid() is not null);
create policy chat_reads_upsert on public.chat_reads for insert with check (account_id = auth.uid());
create policy chat_reads_update on public.chat_reads for update using (account_id = auth.uid()) with check (account_id = auth.uid());

-- Storage bucket for chat file/image attachments.
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

create policy chat_attachments_insert on storage.objects for insert
  with check (bucket_id = 'chat-attachments' and auth.uid() is not null);

create policy chat_attachments_select on storage.objects for select
  using (bucket_id = 'chat-attachments');

create policy chat_attachments_delete on storage.objects for delete
  using (bucket_id = 'chat-attachments' and owner = auth.uid());

-- ============================================================================
-- REALTIME — the frontend subscribes to postgres_changes on every table below instead of
-- polling, so each one needs to be in the supabase_realtime publication.
-- ============================================================================

alter publication supabase_realtime add table
  public.leads, public.order_lines, public.lead_notes, public.lead_messages, public.lead_files,
  public.profiles, public.custom_tabs, public.app_settings, public.import_sources,
  public.supplier_charges, public.suppliers_master, public.manual_customers, public.appointments,
  public.team_messages, public.direct_messages, public.chat_groups, public.chat_group_members,
  public.group_messages, public.chat_reads,
  public.products, public.product_tiers, public.product_addons, public.finishes, public.global_addons,
  public.shipping_options, public.shipping_ranges,
  public.tasks, public.announcements, public.message_templates, public.lead_activity_log;

-- ============================================================================
-- SEED DATA (catalog only — accounts are created via Supabase Auth, see SETUP.md)
-- ============================================================================

-- Service levels (formerly "finishes") — a flat multiplier applied to a system's base price.
insert into public.finishes (name, mult) values
  ('סטנדרט', 1), ('תמיכה מועדפת (Priority)', 1.15), ('SLA ארגוני 24/7', 1.35);

-- General add-on modules any system can carry.
insert into public.global_addons (name, price) values
  ('אינטגרציית WhatsApp Business', 350), ('אפליקציית מובייל (iOS+Android)', 1500),
  ('דוחות BI מותאמים אישית', 600), ('הדרכת צוות מורחבת', 400);

-- "Deployment & onboarding" (formerly "shipping") — priced by number of user seats.
insert into public.shipping_options (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'פריסה והטמעה סטנדרטית');

insert into public.shipping_ranges (shipping_option_id, from_qty, to_qty, price) values
  ('00000000-0000-0000-0000-000000000001', 1, 10, 800),
  ('00000000-0000-0000-0000-000000000001', 11, 50, 2000),
  ('00000000-0000-0000-0000-000000000001', 51, 200, 4500);

-- Vendors & subcontractors MEXUZ works with on client projects.
insert into public.suppliers_master (name) values
  ('סטודיו UI/UX - נועה'), ('AWS Cloud Hosting'), ('קבלן פיתוח Backend - רון'),
  ('קבלן פיתוח Frontend - עידן'), ('סוכנות שיווק דיגיטלי'), ('API SMS/WhatsApp - Twilio'),
  ('בודק QA חיצוני - דנה'), ('מתרגם ולוקליזציה - אורי'), ('יועץ אבטחת מידע - גיא'),
  ('צלם ויוצר תוכן - שירה');

insert into public.import_sources (label, url, default_country) values
  ('לידים ישראל', '', 'ישראל'),
  ('לידים חו"ל', '', 'ארה"ב');

insert into public.app_settings (key, value) values
  ('sync_minutes', '5'),
  ('nav_labels', '{
    "inbox": "תיבת לידים", "myDeals": "הפרויקטים שלי", "add": "הוספת ליד", "calc": "מחשבון הצעת מחיר",
    "import": "ייבוא לידים", "ops": "תפעול", "dashboard": "ביצועים", "customers": "לקוחות",
    "notifications": "התראות", "paymentDues": "חייבים בתשלום", "suppliers": "ספקים וקבלני משנה",
    "calendar": "יומן", "history": "היסטוריה", "canceled": "לידים שבוטלו", "settings": "הגדרות",
    "teamChat": "צ''אט צוות"
  }');

-- Catalog: the systems MEXUZ sells, each in a few package tiers. product_tiers.qty is the number
-- of user seats a price tier applies to (mirrors the discount-by-volume model this app already
-- has); product_tiers.price is the per-seat price at that tier.
do $$
declare
  p record;
  prod_id uuid;
begin
  for p in select * from (values
    ('מערכת CRM','Starter (עד 10 משתמשים)',
      '[{"qty":5,"price":450},{"qty":10,"price":380}]'::jsonb,
      '{"name":"מודול אוטומציות מתקדם","price":800,"perUnit":false}'::jsonb),
    ('מערכת CRM','Business (11-50 משתמשים)',
      '[{"qty":15,"price":340},{"qty":30,"price":290},{"qty":50,"price":250}]'::jsonb,
      '{"name":"אינטגרציית WhatsApp Business API","price":1200,"perUnit":false}'::jsonb),
    ('מערכת CRM','Enterprise (50+ משתמשים)',
      '[{"qty":75,"price":220},{"qty":150,"price":190}]'::jsonb,
      '{"name":"מודול BI ודוחות מותאמים","price":2500,"perUnit":false}'::jsonb),
    ('מערכת ERP','Starter',
      '[{"qty":5,"price":520},{"qty":10,"price":460}]'::jsonb, null::jsonb),
    ('מערכת ERP','Business',
      '[{"qty":15,"price":420},{"qty":30,"price":360}]'::jsonb,
      '{"name":"מודול הנהלת חשבונות","price":1500,"perUnit":false}'::jsonb),
    ('מערכת ERP','Enterprise',
      '[{"qty":60,"price":300},{"qty":120,"price":260}]'::jsonb, null::jsonb),
    ('מערכת ניהול פרויקטים','Starter',
      '[{"qty":5,"price":300},{"qty":10,"price":260}]'::jsonb, null::jsonb),
    ('מערכת ניהול פרויקטים','Business',
      '[{"qty":20,"price":220},{"qty":40,"price":190}]'::jsonb,
      '{"name":"אינטגרציית Gantt ומעקב שעות","price":900,"perUnit":false}'::jsonb),
    ('מערכת ניהול מלאי','Starter',
      '[{"qty":5,"price":340},{"qty":10,"price":290}]'::jsonb, null::jsonb),
    ('מערכת ניהול מלאי','Business',
      '[{"qty":20,"price":250},{"qty":40,"price":210}]'::jsonb,
      '{"name":"סריקת ברקוד וניהול מחסן","price":1100,"perUnit":false}'::jsonb),
    ('מערכת נוכחות ומשמרות','Starter',
      '[{"qty":10,"price":180},{"qty":25,"price":150}]'::jsonb, null::jsonb),
    ('מערכת נוכחות ומשמרות','Business',
      '[{"qty":50,"price":120},{"qty":100,"price":95}]'::jsonb,
      '{"name":"אפליקציית נוכחות מובייל","price":700,"perUnit":false}'::jsonb),
    ('פורטל לקוחות','Basic (עד 100 חשבונות לקוח)',
      '[{"qty":100,"price":45},{"qty":500,"price":32}]'::jsonb, null::jsonb),
    ('פורטל לקוחות','Advanced',
      '[{"qty":100,"price":65},{"qty":500,"price":48}]'::jsonb,
      '{"name":"אפליקציית מובייל ללקוחות","price":1800,"perUnit":false}'::jsonb)
  ) as t(name, sub_product, tiers, addon)
  loop
    insert into public.products (name, sub_product) values (p.name, p.sub_product) returning id into prod_id;
    insert into public.product_tiers (product_id, qty, price)
      select prod_id, (t->>'qty')::int, (t->>'price')::numeric from jsonb_array_elements(p.tiers) t;
    if p.addon is not null then
      insert into public.product_addons (product_id, name, price, per_unit)
        values (prod_id, p.addon->>'name', (p.addon->>'price')::numeric, coalesce((p.addon->>'perUnit')::boolean, false));
    end if;
  end loop;
end $$;
