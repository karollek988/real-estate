-- Cleanup (2026-10-07): removes what the Premium/free-tier, "First 100 Users"
-- and broker-documents eras left behind and that no code reads any more
-- (checked against main and styleRedesign, frontend and api/server.py).
-- 20261002000000 and 20261002000100 kept these on purpose as a rollback
-- path; the app has moved on since, so that path is gone anyway.
--
-- On production this ran right after 20260917000000 and 20260917010000,
-- which had never been applied there. A backup of every removed row,
-- function definition and file was taken first (outside the public repo).
--
-- Not removed here: profiles.subscription_status / subscription_tier /
-- subscription_end / current_period_end / price_id / subscription_id. The
-- app on main still reads them (ownership.ts, the Stripe webhook, the
-- billing portal), so they go in a later migration once that code is gone.

-- ── 1. Old quota RPCs (replaced by consume_credit / refund_credit) ───────────

drop function if exists public.consume_analysis_quota(uuid, text);
drop function if exists public.refund_analysis_quota(uuid, text);

-- ── 2. The "First 100 Users" campaign ───────────────────────────────────────

-- Who received codes is still visible in discount_codes.user_id.
drop function if exists public.mark_campaign_popup_shown(uuid);
drop table if exists public.campaign_enrollments;
drop sequence if exists public.first100_position_seq;

-- ── 3. Subscription discount codes ──────────────────────────────────────────

-- Subscriptions are not sold, so a premium_subscription code can never be
-- redeemed (checkout maps only trygghetspaket/omradesanalys to a kind).
delete from public.discount_codes where kind = 'premium_subscription';

alter table public.discount_codes drop constraint if exists discount_codes_kind_check;
alter table public.discount_codes
  add constraint discount_codes_kind_check
  check (kind in ('trygghetspaket', 'omradesanalys'));

-- ── 4. Premium / free-tier counters and the paywall flag ────────────────────

-- full_analyses_remaining took over the premium balance in 20261002000000.
alter table public.profiles
  drop column if exists premium_analyses_remaining,
  drop column if exists free_analyses_remaining;

alter table public.analysis_requests
  drop column if exists unlocked,
  drop column if exists legacy_analysis_type;

-- ── 5. Broker-site documents (feature removed in 7ee751e) ───────────────────

drop table if exists public.broker_documents;

-- Direct deletes from storage tables are blocked, and forcing one on a
-- non-empty bucket would orphan its files, so the bucket row only goes once
-- its objects have been removed through the Storage API.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'broker-documents')
     and not exists (select 1 from storage.objects where bucket_id = 'broker-documents') then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.buckets where id = 'broker-documents';
  end if;
end
$$;
