-- Security fix: "Profiles are updatable by owner" (20260716000000_profiles.sql)
-- was written when this table only held full_name/avatar_url. Later
-- migrations added premium_analyses_remaining, free_analyses_remaining,
-- subscription_status/tier, stripe_customer_id, etc. to the SAME table
-- without ever tightening this policy. Supabase grants `authenticated` full
-- table-level UPDATE by default, and RLS policies only restrict which ROWS
-- are reachable, not which columns/values — so with only `using (auth.uid()
-- = id)` and no `with check`, any signed-in user could bypass the app
-- entirely and PATCH .../rest/v1/profiles?id=eq.<own-id> with e.g.
-- {"free_analyses_remaining": 99999}, completely bypassing
-- consume_analysis_quota()/refund_analysis_quota() and the Stripe webhook.
--
-- This is the only authenticated-writable policy in the whole schema —
-- every other table already does writes through service_role only (see
-- analysis_requests, properties, analyses). Confirmed safe to drop: every
-- .from("profiles") call in the app (checkout, portal, webhooks,
-- ownership.ts's getProfileSummary) already uses the service-role admin
-- client, so no legitimate feature depends on direct client-side updates.
drop policy if exists "Profiles are updatable by owner" on public.profiles;

-- Defense-in-depth: even if a policy like this is ever added back by
-- mistake, authenticated/anon should not hold base UPDATE privilege on this
-- table at all — every real write goes through service_role or the
-- security-definer RPCs (consume_analysis_quota, refund_analysis_quota).
revoke update on public.profiles from authenticated, anon;
