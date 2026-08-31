-- Automated reminders (inspired by competitor feature audit — Plando): three rule-based
-- automations that create a normal `tasks` row for the right rep, so they ride the exact same
-- push-notification pipeline that already exists (send-task-push, cron'd every minute) — no new
-- edge function, no new vendor, nothing to deploy beyond this migration.
--
-- 1. An appointment gets an auto-linked reminder task (30 min before), kept in sync on reschedule.
-- 2. A lead note's follow-up date arriving today creates a same-day reminder for the claiming rep.
-- 3. A lead stuck 7+ days in the same status (mirrors STUCK_LEAD_MS in src/lib/constants.js) gets
--    one reminder task per "stuck period" for the claiming rep.

alter table public.tasks add column if not exists appointment_id uuid references public.appointments(id) on delete cascade;
create unique index if not exists tasks_appointment_id_uidx on public.tasks(appointment_id) where appointment_id is not null;

alter table public.tasks add column if not exists followup_note_id uuid references public.lead_notes(id) on delete cascade;
create unique index if not exists tasks_followup_note_id_uidx on public.tasks(followup_note_id) where followup_note_id is not null;

-- lead id + the status_changed_at it was stuck at, so a *new* reminder fires if the lead moves
-- and then gets stuck again later — not just once ever per lead.
alter table public.tasks add column if not exists stuck_key text;
create unique index if not exists tasks_stuck_key_uidx on public.tasks(stuck_key) where stuck_key is not null;

-- ============================================================================
-- 1. Appointment reminder — event-driven (trigger), fires immediately on create/reschedule.
-- ============================================================================

create or replace function public.sync_appointment_reminder_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tasks (owner_id, created_by, kind, title, due_at, remind_before_minutes, lead_id, lead_name, appointment_id)
    values (
      new.created_by, new.created_by, 'reminder',
      'תזכורת לפגישה' || case when new.lead_name is not null then ' עם ' || new.lead_name else '' end,
      new.date_time, 30, new.lead_id, new.lead_name, new.id
    )
    on conflict (appointment_id) where appointment_id is not null do nothing;
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    new.date_time is distinct from old.date_time or
    new.lead_name is distinct from old.lead_name or
    new.title is distinct from old.title
  ) then
    -- Resets notified_at/pre_notified_at so a reschedule re-arms the reminder for the new time,
    -- instead of staying silent because the old time already fired it.
    update public.tasks set
      due_at = new.date_time,
      title = 'תזכורת לפגישה' || case when new.lead_name is not null then ' עם ' || new.lead_name else '' end,
      lead_id = new.lead_id, lead_name = new.lead_name,
      notified_at = null, pre_notified_at = null
    where appointment_id = new.id;
    return new;
  end if;

  return new;
end;
$$;

create trigger appointments_sync_reminder_task
  after insert or update on public.appointments
  for each row execute function public.sync_appointment_reminder_task();

-- Backfill: appointments already on the books (created before this migration) get a reminder too.
insert into public.tasks (owner_id, created_by, kind, title, due_at, remind_before_minutes, lead_id, lead_name, appointment_id)
select a.created_by, a.created_by, 'reminder',
  'תזכורת לפגישה' || case when a.lead_name is not null then ' עם ' || a.lead_name else '' end,
  a.date_time, 30, a.lead_id, a.lead_name, a.id
from public.appointments a
where a.date_time > now()
on conflict (appointment_id) where appointment_id is not null do nothing;

-- ============================================================================
-- 2 & 3. Follow-up due today, and stuck leads — time-driven, so these need a daily scan rather
-- than a trigger (nothing mutates the row at the moment a date "arrives").
-- ============================================================================

create or replace function public.run_lead_automations()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.tasks (owner_id, created_by, kind, title, due_at, lead_id, lead_name, followup_note_id)
  select
    l.claimed_by, l.claimed_by, 'reminder',
    'מעקב: ' || l.name || coalesce(' · ' || l.business_name, ''),
    now(), l.id, l.name, n.id
  from public.lead_notes n
  join public.leads l on l.id = n.lead_id
  where n.follow_up = current_date
    and l.claimed_by is not null
    and l.closed_at is null and not l.canceled and not l.archived
  on conflict (followup_note_id) where followup_note_id is not null do nothing;

  insert into public.tasks (owner_id, created_by, kind, title, due_at, lead_id, lead_name, stuck_key)
  select
    l.claimed_by, l.claimed_by, 'reminder',
    'ליד תקוע: ' || l.name || ' — לא זז מסטטוס "' || l.process_status || '" כבר מעל שבוע',
    now(), l.id, l.name, l.id::text || ':' || l.status_changed_at::text
  from public.leads l
  where l.claimed_by is not null
    and l.closed_at is null and not l.canceled and not l.archived
    and l.process_status <> 'לא מעוניין'
    and l.status_changed_at < now() - interval '7 days'
  on conflict (stuck_key) where stuck_key is not null do nothing;
end;
$$;

select cron.schedule(
  'run-lead-automations-daily',
  '0 5 * * *',
  $$ select public.run_lead_automations(); $$
);
