-- Support tickets — a queue for client issues/requests against a specific deployed system
-- (company_systems), since MEXUZ's clients don't log into this internal CRM themselves; a team
-- member logs the ticket on their behalf. Anyone logged in can see/create/update tickets (same
-- open pattern as tasks/announcements); only a manager/deputy can delete one outright.
-- Run this once in the Supabase SQL editor, same as the others.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  system_id uuid references public.company_systems(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  reporter_name text,
  reporter_contact text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_tickets_system_idx on public.support_tickets(system_id);
create index support_tickets_status_idx on public.support_tickets(status);

alter table public.support_tickets enable row level security;

create policy support_tickets_select on public.support_tickets for select using (auth.uid() is not null);
create policy support_tickets_insert on public.support_tickets for insert with check (auth.uid() is not null);
create policy support_tickets_update on public.support_tickets for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy support_tickets_delete on public.support_tickets for delete using (public.can_act_like_manager());

alter publication supabase_realtime add table public.support_tickets;
