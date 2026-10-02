-- Removes the "First 100 Users" campaign while keeping everything that makes
-- discount codes work. From now on nobody is enrolled or handed codes
-- automatically at signup; codes are issued on purpose with
-- issue_discount_code() and redeemed through the unchanged
-- redeem_discount_code / attach / finalize / release flow.
--
-- Kept on purpose (nothing here is dropped):
--   * public.discount_codes and its RLS/grants, so codes that were already
--     issued to the first 100 users stay redeemable;
--   * public.campaign_enrollments and first100_position_seq, as the record of
--     who received codes;
--   * generate_discount_code() and the redeem/attach/release/finalize RPCs.

-- ── 1. Stop automatic enrollment ─────────────────────────────────────────────

drop trigger if exists on_auth_user_created_first100_campaign on auth.users;
drop function if exists public.handle_first100_campaign();

-- ── 2. Discount code kinds follow the products now sold ─────────────────────

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.discount_codes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.discount_codes drop constraint %I', c.conname);
  end loop;
end
$$;

-- The old "50% off one Premium analysis" codes are 50% off one single-property
-- analysis, which is the Trygghetspaket now.
update public.discount_codes set kind = 'trygghetspaket' where kind = 'premium_analysis';

-- premium_subscription stays a valid value only so the rows already issued
-- remain valid; subscriptions are no longer sold, so nothing can redeem one.
alter table public.discount_codes
  add constraint discount_codes_kind_check
  check (kind in ('trygghetspaket', 'omradesanalys', 'premium_subscription'));

-- ── 3. Issue a code on demand ────────────────────────────────────────────────

-- Creates one unused code for a user and returns it. This is the replacement
-- for what the signup trigger used to do inline — run it from the SQL editor
-- or call it from a future admin tool. Only 50% is supported because the code
-- is applied through one fixed 50%-off Stripe Coupon
-- (STRIPE_COUPON_ANALYSIS_50OFF); a different percentage would show a
-- different number here than Stripe actually charges.
create or replace function public.issue_discount_code(
  p_user_id uuid,
  p_kind text,
  p_percent_off integer default 50
)
returns text
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_code text;
begin
  if p_kind not in ('trygghetspaket', 'omradesanalys') then
    raise exception 'issue_discount_code: unsupported kind %', p_kind;
  end if;
  if p_percent_off <> 50 then
    raise exception 'issue_discount_code: only 50%% codes are supported, got %', p_percent_off;
  end if;

  v_code := public.generate_discount_code();

  insert into public.discount_codes (user_id, code, kind, percent_off)
    values (p_user_id, v_code, p_kind, p_percent_off);

  return v_code;
end;
$$;

revoke execute on function public.issue_discount_code(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.issue_discount_code(uuid, text, integer) to service_role;
