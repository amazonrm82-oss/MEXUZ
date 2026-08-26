-- Turns "Our Systems" from a static portfolio list into a recurring-revenue tracker: each system
-- can carry a monthly maintenance/hosting fee and a contract renewal date, so the app can surface
-- total MRR and flag contracts coming up for renewal. Run this once in the Supabase SQL editor,
-- same as the others.

alter table public.company_systems add column if not exists monthly_fee numeric not null default 0;
alter table public.company_systems add column if not exists contract_start date;
alter table public.company_systems add column if not exists renewal_date date;
