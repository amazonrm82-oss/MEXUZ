-- Recurring tasks/reminders (another Plando gap: "one-time tasks alongside recurring ones for
-- repeating work"). Deliberately simple — no RRULE, just daily/weekly/monthly — matching how
-- lightweight the rest of the tasks feature already is. Completing a recurring item spawns the
-- next occurrence; the chain just stops once someone deletes the item without completing it or
-- clears repeat_interval.

alter table public.tasks add column if not exists repeat_interval text check (repeat_interval in ('daily', 'weekly', 'monthly'));

create or replace function public.spawn_next_recurring_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_next timestamptz;
begin
  v_next := case new.repeat_interval
    when 'daily' then new.due_at + interval '1 day'
    when 'weekly' then new.due_at + interval '7 days'
    when 'monthly' then new.due_at + interval '1 month'
  end;
  insert into public.tasks (owner_id, created_by, kind, title, notes, due_at, remind_before_minutes, repeat_interval, lead_id, lead_name)
  values (new.owner_id, new.created_by, new.kind, new.title, new.notes, v_next, new.remind_before_minutes, new.repeat_interval, new.lead_id, new.lead_name);
  return new;
end;
$$;

create trigger tasks_spawn_next_recurring
  after update on public.tasks
  for each row
  when (new.completed = true and old.completed = false and new.repeat_interval is not null)
  execute function public.spawn_next_recurring_task();

-- Managers/deputies get read access to every rep's tasks and reminders (including the automated
-- ones from 0013) so they can actually monitor whether the team is following up — before this,
-- tasks_select only let each rep see their own. Postgres OR's multiple permissive SELECT
-- policies together, so this only adds visibility, never removes any.
create policy tasks_select_manager on public.tasks for select using (public.can_act_like_manager());
