-- Customer self-service portal — a client (matched by the email on their originating lead) can
-- log in with a magic link and see their own system's status, billing, and support tickets.
--
-- IMPORTANT SECURITY FIX bundled in here: company_systems/system_charges/support_tickets were
-- all `select using (auth.uid() is not null)` — "any authenticated user" — which was a safe
-- shorthand for "any staff member" back when only admin-created internal accounts existed. Now
-- that a customer can also become an authenticated Supabase user (via magic link), that same
-- policy would let ANY customer read EVERY system, EVERY invoice, and EVERY support ticket in
-- the whole database. Those three policies are tightened to staff-only, and replaced for
-- customers with a narrow, email-matched policy below.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() is not null;
$$;

drop policy if exists company_systems_select on public.company_systems;
create policy company_systems_select on public.company_systems for select using (public.is_staff());

drop policy if exists system_charges_select on public.system_charges;
create policy system_charges_select on public.system_charges for select using (public.is_staff());

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select using (public.is_staff());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets for insert with check (public.is_staff());

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets for update using (public.is_staff()) with check (public.is_staff());

-- SECURITY DEFINER because the email-match join reaches into `leads`, which has its own
-- staff-only RLS — without bypassing it here, the join would silently see zero rows for a
-- customer and this whole feature would just never match anything.
create or replace function public.customer_owns_system(p_system_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_systems s
    join public.leads l on l.id = s.source_lead_id
    where s.id = p_system_id
      and l.email is not null
      and lower(l.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy company_systems_select_customer on public.company_systems for select using (
  public.customer_owns_system(id)
);

create policy system_charges_select_customer on public.system_charges for select using (
  public.customer_owns_system(system_id)
);

create policy support_tickets_select_customer on public.support_tickets for select using (
  system_id is not null and public.customer_owns_system(system_id)
);

-- Self-service ticket creation: created_by stays null (a customer has no `profiles` row to
-- reference) — reporter_name/reporter_contact already existed for exactly this "external
-- reporter" case.
create policy support_tickets_insert_customer on public.support_tickets for insert with check (
  created_by is null and system_id is not null and public.customer_owns_system(system_id)
);
