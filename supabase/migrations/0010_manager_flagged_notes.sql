-- "Notes for the manager" — any note on a lead can be flagged red for management attention.
-- A flagged, unresolved note pops up in a modal for every manager/deputy the moment they log in
-- (and immediately if the app is already open when it's written), and stays flagged until a
-- manager marks it handled — at which point everyone sees a green checkmark next to it.

alter table public.lead_notes add column if not exists flagged_for_manager boolean not null default false;
alter table public.lead_notes add column if not exists resolved boolean not null default false;
alter table public.lead_notes add column if not exists resolved_by uuid references public.profiles(id) on delete set null;
alter table public.lead_notes add column if not exists resolved_at timestamptz;

-- lead_notes had no update policy before this — only managers/deputies can resolve a flagged
-- note (the whole point is that only they can clear the flag).
create policy lead_notes_update on public.lead_notes for update using (
  public.lead_is_visible(lead_id) and public.can_act_like_manager()
) with check (
  public.lead_is_visible(lead_id) and public.can_act_like_manager()
);
