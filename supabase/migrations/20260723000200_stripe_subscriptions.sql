alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_tier text,
  add column if not exists price_id text,
  add column if not exists subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists subscription_end timestamptz;

grant all on public.profiles to service_role;
