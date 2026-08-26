-- Fixes a real bug: public.leads has two AFTER UPDATE triggers — leads_auto_delete_wrong_number
-- and leads_log_activity. Postgres fires same-event triggers in alphabetical order by trigger
-- name, so "leads_auto_delete_wrong_number" (a...) always runs before "leads_log_activity" (l...).
-- When a rep sets process_status to 'מספר שגוי', the first trigger deletes the row — then the
-- second trigger still fires (it operates on the same NEW record) and tries to INSERT into
-- lead_activity_log with a lead_id that no longer exists in public.leads, violating the foreign
-- key. That aborts the whole UPDATE transaction, silently rolling back the delete too — but the
-- frontend (InboxView.jsx) shows "the lead was deleted" regardless of whether the update actually
-- succeeded, so the failure was invisible until you checked whether the lead was really gone.
--
-- Fix: don't bother logging activity for a lead that's being deleted in the same statement —
-- there's nothing to log to, since it won't exist a moment later.
create or replace function public.log_lead_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.process_status = 'מספר שגוי' then
    return new;
  end if;
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
