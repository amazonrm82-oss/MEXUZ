-- A "contact us" / "request a quote" form on the marketing landing page will almost always
-- collect an email, unlike the original packaging-order flow which only ever needed a phone
-- number. Nullable — existing leads and the manual add-lead form both work unchanged.
alter table public.leads add column if not exists email text;
