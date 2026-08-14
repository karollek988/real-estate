-- "First 100 Users" campaign: the first 100 accounts created from the moment
-- this migration ships each receive 3 unique 50%-off codes (2x one Premium
-- analysis, 1x one Premium subscription). Position assignment uses a real
-- Postgres sequence rather than the UPDATE...RETURNING counter-row pattern
-- used elsewhere (consume_analysis_quota) — a sequence is the right tool for
-- "hand out a strictly increasing, globally unique number under concurrency,"
-- which is exactly what's needed here and is lock-free/transaction-safe by
-- construction. Only NEW auth.users inserts trigger enrollment, so existing
-- accounts are never retroactively enrolled.

-- gen_random_bytes() (used by generate_discount_code() below) is not a core
-- Postgres builtin — unlike gen_random_uuid() — it comes from pgcrypto,
-- which isn't guaranteed pre-enabled on every Supabase project. This was
-- caught locally: without it, handle_first100_campaign() raised inside the
-- same transaction as the auth.users insert and aborted signup entirely.
create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.first100_position_seq;

create table if not exists public.campaign_enrollments (
  user_id uuid primary key references auth.users (id) on delete cascade,
  position integer not null unique,
  enrolled_at timestamptz not null default now()
);

alter table public.campaign_enrollments enable row level security;

create policy "Campaign enrollment is viewable by owner"
  on public.campaign_enrollments for select
  using (auth.uid() = user_id);

grant select on public.campaign_enrollments to service_role;

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique,
  kind text not null check (kind in ('premium_analysis', 'premium_subscription')),
  percent_off integer not null default 50,
  status text not null default 'active' check (status in ('active', 'reserved', 'redeemed')),
  stripe_checkout_session_id text,
  reserved_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discount_codes_user_id_idx on public.discount_codes (user_id);
create index if not exists discount_codes_session_id_idx on public.discount_codes (stripe_checkout_session_id);

alter table public.discount_codes enable row level security;

create policy "Discount codes are viewable by owner"
  on public.discount_codes for select
  using (auth.uid() = user_id);

grant select, update on public.discount_codes to service_role;

-- Generates one unique human-friendly code (KOP-XXXXX-XXXXX). Retries on the
-- (practically impossible, 40 bits of entropy) chance of a collision rather
-- than trusting entropy alone.
create or replace function public.generate_discount_code()
returns text
language plpgsql
-- extensions is required here (not just public) because gen_random_bytes()
-- comes from pgcrypto, which Supabase installs into the extensions schema,
-- not public — a security definer function's search_path must list it
-- explicitly, it doesn't inherit the caller's extra_search_path.
security definer set search_path = public, extensions
as $$
declare
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := 'KOP-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 5))
      || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 6, 5));
    exit when not exists (select 1 from public.discount_codes where code = candidate);
    attempt := attempt + 1;
    if attempt > 20 then
      raise exception 'generate_discount_code: could not find a unique code after % attempts', attempt;
    end if;
  end loop;
  return candidate;
end;
$$;

-- Enrolls a new user in the campaign iff they land at position <= 100, and
-- issues their 3 codes. A second, independent trigger alongside the existing
-- handle_new_user() (Postgres supports multiple AFTER INSERT triggers per
-- table) — kept separate so this campaign's logic never touches the
-- unrelated quota-defaulting trigger.
create or replace function public.handle_first100_campaign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_position integer;
begin
  v_position := nextval('public.first100_position_seq');

  if v_position <= 100 then
    insert into public.campaign_enrollments (user_id, position)
    values (new.id, v_position);

    insert into public.discount_codes (user_id, code, kind)
    values
      (new.id, public.generate_discount_code(), 'premium_analysis'),
      (new.id, public.generate_discount_code(), 'premium_analysis'),
      (new.id, public.generate_discount_code(), 'premium_subscription');
  end if;

  return new;
exception
  -- Never let a campaign-enrollment failure block account creation — this
  -- trigger runs in the same transaction as the auth.users insert, so an
  -- uncaught error here would abort signup entirely. Losing one campaign
  -- slot to an unexpected error is an acceptable trade-off; losing a
  -- customer's ability to sign up at all is not.
  when others then
    raise warning 'handle_first100_campaign failed for user %: % (%)', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

create trigger on_auth_user_created_first100_campaign
  after insert on auth.users
  for each row execute function public.handle_first100_campaign();

-- Atomically claims a code for use: active -> reserved. No row returned means
-- invalid code, wrong owner, wrong kind, or already used/reserved — callers
-- must treat all of those identically (uniform "invalid code" response) so a
-- caller can't distinguish *why* a code failed and probe for valid codes.
create or replace function public.redeem_discount_code(p_user_id uuid, p_code text, p_kind text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.discount_codes
    set status = 'reserved', reserved_at = now(), stripe_checkout_session_id = null
    where code = p_code and user_id = p_user_id and kind = p_kind and status = 'active'
    returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.redeem_discount_code(uuid, text, text) to service_role;

-- Attaches the Stripe Checkout Session id to a just-reserved code (called
-- right after Stripe returns the session, still within the same request).
create or replace function public.attach_discount_code_session(p_code_id uuid, p_session_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.discount_codes
    set stripe_checkout_session_id = p_session_id
    where id = p_code_id and status = 'reserved';
end;
$$;

grant execute on function public.attach_discount_code_session(uuid, text) to service_role;

-- reserved -> active: releases a code back for reuse if its checkout session
-- was abandoned/expired without completing payment.
create or replace function public.release_discount_code(p_session_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.discount_codes
    set status = 'active', reserved_at = null, stripe_checkout_session_id = null
    where stripe_checkout_session_id = p_session_id and status = 'reserved';
end;
$$;

grant execute on function public.release_discount_code(text) to service_role;

-- reserved -> redeemed: finalizes a code once its checkout session actually
-- completes payment. A code can only ever be finalized once, since it must
-- already be 'reserved' (not 'redeemed') for this to match any row.
create or replace function public.finalize_discount_code(p_session_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.discount_codes
    set status = 'redeemed', redeemed_at = now()
    where stripe_checkout_session_id = p_session_id and status = 'reserved';
end;
$$;

grant execute on function public.finalize_discount_code(text) to service_role;
