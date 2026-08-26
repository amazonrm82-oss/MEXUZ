-- "Our Systems" — a portfolio view inside MEXUZ CRM listing the systems MEXUZ has built and
-- maintains for clients (plus MEXUZ itself), with a live count of how many are active. Anyone
-- logged in can see it; only managers/deputies can add, remove, or change a system's status.
-- Run this once in the Supabase SQL editor, same as 0001_init.sql.

create table public.company_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  description text,
  url text,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.company_systems enable row level security;

create policy company_systems_select on public.company_systems for select using (auth.uid() is not null);
create policy company_systems_write on public.company_systems for all
  using (public.can_act_like_manager()) with check (public.can_act_like_manager());

alter publication supabase_realtime add table public.company_systems;

insert into public.company_systems (name, client_name, description, status, sort_order) values
  ('MEXUZ CRM', 'MEXUZ (פנימי)', 'המערכת שבה אתם נמצאים כרגע — ניהול לידים ופרויקטים של MEXUZ עצמה.', 'active', 0),
  ('ARIZOT Design CRM', 'Arizot Design', 'מערכת CRM לניהול לידים ותפעול שנבנתה עבור חברת אריזות.', 'active', 1),
  ('Machon Managers', 'Machon Managers', 'מערכת ניהול שנבנתה עבור מכון מנג''רס.', 'active', 2);
