-- Product model change (2026-10): Premium, subscriptions and the limited
-- "free" analysis tier are gone. What is sold today are one-time packages:
--
--   Områdesanalys   99 kr   -> 1 area credit    (report with the area chapter only)
--   Trygghetspaket 499 kr   -> 1 full credit    (the complete report, one property)
--   Tre bostäder   999 kr   -> 3 full credits
--
-- Whoever creates a full analysis always sees all of it; whoever creates an
-- area analysis sees the area chapter and nothing else. There is no locked /
-- paywalled state any more, so the old premium_analyses_remaining /
-- free_analyses_remaining counters and the free/premium analysis_type values
-- are replaced by the two credit buckets and two scopes below.
--
-- Nothing is dropped: the old profile columns, analysis_requests.unlocked and
-- the old RPCs stay in place (unused) so this can be rolled back by
-- redeploying the previous app version, and the pre-migration analysis_type
-- of every request is kept in legacy_analysis_type.

-- ── 1. Credit buckets on profiles ────────────────────────────────────────────

alter table public.profiles
  add column if not exists full_analyses_remaining integer not null default 0,
  add column if not exists area_analyses_remaining integer not null default 0;

alter table public.profiles
  add constraint profiles_full_analyses_remaining_nonneg check (full_analyses_remaining >= 0),
  add constraint profiles_area_analyses_remaining_nonneg check (area_analyses_remaining >= 0);

-- Paid Premium credits carry over one-to-one: one old Premium analysis was one
-- complete report, which is exactly what one full credit buys now. Unused
-- *free* (limited-report) credits are not carried over — that tier no longer
-- exists. Both old columns are left untouched.
update public.profiles
  set full_analyses_remaining = premium_analyses_remaining
  where premium_analyses_remaining > 0;

-- ── 2. analysis_requests: free/premium -> full/area ──────────────────────────

alter table public.analysis_requests add column if not exists legacy_analysis_type text;

-- Set when a failed analysis's credit has been given back. A refunded request
-- no longer entitles its owner to anything (they were not charged), so it
-- can't be used to read a later, paid-for analysis of the same property; the
-- row itself stays so the owner can still see that the analysis failed.
alter table public.analysis_requests add column if not exists refunded_at timestamptz;
-- 20260722000000 granted select/insert/delete only; the refund path updates rows.
grant update on public.analysis_requests to service_role;

update public.analysis_requests
  set legacy_analysis_type = analysis_type
  where legacy_analysis_type is null;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.analysis_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%analysis_type%'
  loop
    execute format('alter table public.analysis_requests drop constraint %I', c.conname);
  end loop;
end
$$;

-- Every analysis ever requested through the old product ran the complete
-- pipeline ("free" and "premium" differed only in how much of the finished
-- report was shown), so each becomes a full analysis its owner can read in
-- full — including old free / still-locked ones. (The app has no restricted
-- state any more, so there is nothing to map a limited request to; the
-- original value stays in legacy_analysis_type for the record.)
update public.analysis_requests
  set analysis_type = 'full'
  where analysis_type in ('free', 'premium');

alter table public.analysis_requests
  add constraint analysis_requests_analysis_type_check check (analysis_type in ('full', 'area'));

-- ── 3. analyses.scope ────────────────────────────────────────────────────────

-- 'area' analyses only ever contain the area chapter's data. The scope keeps
-- them out of the full-analysis cache (pipeline.ts): a full analysis request
-- must never be answered with an area-only report.
alter table public.analyses
  add column if not exists scope text not null default 'full' check (scope in ('full', 'area'));

-- ── 4. Purchase ledger (idempotent credit grants) ────────────────────────────

-- One row per paid Checkout Session. Stripe delivers checkout.session.completed
-- at least once, so the webhook must be safe to run twice for the same
-- session — the primary key on the session id is what makes that true.
create table if not exists public.credit_purchases (
  stripe_session_id text primary key,
  -- set null (not cascade) so the accounting record survives an account deletion.
  user_id uuid references auth.users (id) on delete set null,
  price_key text not null,
  full_credits integer not null check (full_credits >= 0),
  area_credits integer not null check (area_credits >= 0),
  created_at timestamptz not null default now()
);

-- RLS on with no policies: server-only, like properties/analyses.
alter table public.credit_purchases enable row level security;
grant select, insert on public.credit_purchases to service_role;

-- ── 5. Credit RPCs (service_role only) ───────────────────────────────────────

-- Atomic check-and-decrement of one credit. Returns the new balance, or null
-- when the bucket was already empty — callers must treat null as "no credit".
create or replace function public.consume_credit(p_user_id uuid, p_kind text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  if p_kind = 'full' then
    update public.profiles
      set full_analyses_remaining = full_analyses_remaining - 1
      where id = p_user_id and full_analyses_remaining > 0
      returning full_analyses_remaining into remaining;
  elsif p_kind = 'area' then
    update public.profiles
      set area_analyses_remaining = area_analyses_remaining - 1
      where id = p_user_id and area_analyses_remaining > 0
      returning area_analyses_remaining into remaining;
  else
    raise exception 'consume_credit: unknown credit kind %', p_kind;
  end if;

  return remaining;
end;
$$;

-- Counterpart to consume_credit(): gives one credit back (a failed analysis
-- must not cost the customer anything).
create or replace function public.refund_credit(p_user_id uuid, p_kind text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  if p_kind = 'full' then
    update public.profiles
      set full_analyses_remaining = full_analyses_remaining + 1
      where id = p_user_id
      returning full_analyses_remaining into remaining;
  elsif p_kind = 'area' then
    update public.profiles
      set area_analyses_remaining = area_analyses_remaining + 1
      where id = p_user_id
      returning area_analyses_remaining into remaining;
  else
    raise exception 'refund_credit: unknown credit kind %', p_kind;
  end if;

  return remaining;
end;
$$;

-- Credits a paid Checkout Session to the buyer exactly once. Returns true when
-- the credits were added, false when this session had already been credited
-- (a repeated webhook delivery). The ledger insert and the balance update run
-- in one transaction: if the profile update fails, the ledger row is rolled
-- back too, so the next delivery retries cleanly instead of being skipped.
create or replace function public.grant_purchase_credits(
  p_session_id text,
  p_user_id uuid,
  p_price_key text,
  p_full integer,
  p_area integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_inserted text;
begin
  if p_full < 0 or p_area < 0 or (p_full = 0 and p_area = 0) then
    raise exception 'grant_purchase_credits: invalid credit amounts (full %, area %)', p_full, p_area;
  end if;

  insert into public.credit_purchases (stripe_session_id, user_id, price_key, full_credits, area_credits)
    values (p_session_id, p_user_id, p_price_key, p_full, p_area)
    on conflict (stripe_session_id) do nothing
    returning stripe_session_id into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  update public.profiles
    set full_analyses_remaining = full_analyses_remaining + p_full,
        area_analyses_remaining = area_analyses_remaining + p_area
    where id = p_user_id;

  if not found then
    raise exception 'grant_purchase_credits: no profile for user %', p_user_id;
  end if;

  return true;
end;
$$;

-- Same lock-down as every other SECURITY DEFINER RPC here (see
-- 20260917010000): these take a caller-supplied user id with no ownership
-- check, so they must only ever be reachable through the service role.
revoke execute on function public.consume_credit(uuid, text) from public, anon, authenticated;
revoke execute on function public.refund_credit(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_purchase_credits(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, text) to service_role;
grant execute on function public.refund_credit(uuid, text) to service_role;
grant execute on function public.grant_purchase_credits(text, uuid, text, integer, integer) to service_role;

-- ── 6. New signups ───────────────────────────────────────────────────────────

-- New accounts start with no credits (both columns default to 0). To hand out
-- a starter credit, set it here, e.g. area_analyses_remaining = 1.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;
