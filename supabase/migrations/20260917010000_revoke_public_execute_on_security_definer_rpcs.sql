-- Security fix: every SECURITY DEFINER function added for quotas
-- (20260722000100, 20260814020000) and the First 100 campaign
-- (20260814000000, 20260814010000) was granted "execute ... to service_role"
-- but none of them ever REVOKED the privilege Postgres grants to PUBLIC by
-- default on every newly created function. Unlike tables (no access unless
-- explicitly granted), `create function` auto-grants EXECUTE to PUBLIC, and
-- every Postgres role — including `anon` and `authenticated`, the roles
-- PostgREST assumes for unauthenticated/authenticated API requests — is a
-- member of PUBLIC. The explicit service_role grant never took away that
-- default, so all of these were reachable directly via
-- POST /rest/v1/rpc/<function_name>, completely bypassing the Next.js API
-- layer (auth, rate limiting, essential-field checks) — the exact same class
-- of bug 20260917000000 just fixed for the profiles table's column values,
-- just one layer deeper (function grants instead of table grants).
--
-- Impact if exploited: consume_analysis_quota/refund_analysis_quota take a
-- caller-supplied p_user_id with no ownership check (by design — they're
-- meant to run only as service_role, trusted by construction), so any
-- signed-in user could call refund_analysis_quota directly with their own
-- id to mint unlimited Free/Premium analyses, or with any other user's id
-- to grief their quota. redeem_discount_code/mark_campaign_popup_shown have
-- the same shape but need a valid code/session id first, which materially
-- limits (but doesn't excuse) exposure.
--
-- Fix: revoke the PUBLIC default on every one of them, same end state the
-- profiles fix already established for that table — these RPCs are callable
-- by service_role only, exactly as every comment in these migrations already
-- assumed was true.
revoke execute on function public.consume_analysis_quota(uuid, text) from public, anon, authenticated;
revoke execute on function public.refund_analysis_quota(uuid, text) from public, anon, authenticated;
revoke execute on function public.redeem_discount_code(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.attach_discount_code_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_discount_code(text) from public, anon, authenticated;
revoke execute on function public.finalize_discount_code(text) from public, anon, authenticated;
revoke execute on function public.mark_campaign_popup_shown(uuid) from public, anon, authenticated;
-- Internal helper, never meant to be called directly (only from
-- handle_first100_campaign, which runs as the function owner and is
-- unaffected by this revoke) — locked down for the same reason, not because
-- it was independently exploitable (it only reads discount_codes to check
-- for a collision; it never writes anything).
revoke execute on function public.generate_discount_code() from public, anon, authenticated;

-- Defense-in-depth: make this the default for every function created in
-- this schema from now on, so a future migration that adds a new
-- SECURITY DEFINER RPC and forgets this revoke doesn't reopen the same gap.
alter default privileges in schema public revoke execute on functions from public;
