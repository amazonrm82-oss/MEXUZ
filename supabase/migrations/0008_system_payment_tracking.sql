-- Turns the monthly_fee on company_systems from a number that just sits there into something
-- actually tracked: a per-system ledger of monthly charges, each markable paid/unpaid — so MRR
-- reflects money that's really been collected, not just a promise.
create table public.system_charges (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.company_systems(id) on delete cascade,
  amount numeric not null,
  due_date date not null,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index system_charges_system_idx on public.system_charges(system_id);

alter table public.system_charges enable row level security;

create policy system_charges_select on public.system_charges for select using (auth.uid() is not null);
create policy system_charges_write on public.system_charges for all
  using (public.can_act_like_manager()) with check (public.can_act_like_manager());

alter publication supabase_realtime add table public.system_charges;
