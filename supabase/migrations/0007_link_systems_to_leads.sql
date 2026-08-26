-- Links "Our Systems" back to the deal that produced it, so a delivered project can become a
-- tracked live system with one click instead of a manager re-typing its name/client by hand in
-- a completely disconnected screen — and so a system's card can jump back to its original deal.
alter table public.company_systems add column if not exists source_lead_id uuid references public.leads(id) on delete set null;
