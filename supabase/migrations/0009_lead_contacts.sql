-- Multiple contacts per lead/client — an ongoing systems-delivery project usually has more than
-- one stakeholder (e.g. a technical contact and a decision maker), unlike the original one-buyer
-- packaging-order flow this app was forked from. Same visibility/edit rules as lead_notes.
create table public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.lead_contacts enable row level security;

create policy lead_contacts_select on public.lead_contacts for select using (public.lead_is_visible(lead_id));
create policy lead_contacts_insert on public.lead_contacts for insert with check (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);
create policy lead_contacts_delete on public.lead_contacts for delete using (
  public.lead_is_visible(lead_id) and public.lead_is_editable(lead_id)
);

alter publication supabase_realtime add table public.lead_contacts;
