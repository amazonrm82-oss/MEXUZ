-- Security hardening: the public lead-intake webhooks (facebook-lead-webhook, website-lead-webhook)
-- had no rate limiting at all. website-lead-webhook in particular is meant to be called straight
-- from browser JS on the public landing page, so its shared secret is visible in that page's
-- source — anyone who copies it could otherwise flood the leads table. This is the same sliding-
-- window-lockout idea as login_attempts, keyed by "<function name>:<source ip>" instead of username.

create table public.webhook_rate_limit (
  bucket_key text primary key,
  window_start timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.webhook_rate_limit enable row level security;
-- Deliberately no policies: only the service-role key (used by Edge Functions, which bypasses
-- RLS entirely) ever needs to touch this table.

create or replace function public.check_webhook_rate_limit(p_bucket_key text, p_max_requests integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  select window_start, request_count into v_window_start, v_count
  from public.webhook_rate_limit where bucket_key = p_bucket_key for update;

  if v_window_start is null or now() - v_window_start > make_interval(secs => p_window_seconds) then
    insert into public.webhook_rate_limit (bucket_key, window_start, request_count)
    values (p_bucket_key, now(), 1)
    on conflict (bucket_key) do update set window_start = now(), request_count = 1;
    return true;
  end if;

  if v_count >= p_max_requests then
    return false;
  end if;

  update public.webhook_rate_limit set request_count = request_count + 1 where bucket_key = p_bucket_key;
  return true;
end;
$$;

grant execute on function public.check_webhook_rate_limit(text, integer, integer) to service_role;
