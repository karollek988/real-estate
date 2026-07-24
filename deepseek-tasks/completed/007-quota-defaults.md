# Task 007 — Cap analysis quotas to 3 free / 0 premium for all users

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`supabase/migrations/20260722000100_quotas.sql` currently grants **every new signup 10
Premium + 3 Free** analyses (see the `handle_new_user()` trigger, lines 14-21: it inserts
`premium_analyses_remaining = 10, free_analyses_remaining = 3`). Product decision: new
users should get **3 Free + 0 Premium**. Premium analyses should only be obtainable by
paying (the existing Stripe "premium_analysis" one-time purchase, or a subscription —
see `frontend/src/lib/stripe/webhooks.ts`'s `handleCheckoutSessionCompleted`, which
already increments `premium_analyses_remaining` on purchase — do not change that
increment logic, it's correct and out of scope here).

This also needs to apply retroactively: existing users currently sitting on up to 10
unearned Premium credits need to be capped down too.

## Goal

Create a **new** migration file in `supabase/migrations/` (do not edit the existing
`20260722000100_quotas.sql` — this project's migrations are already applied to a live
production database via a GitHub→Supabase auto-deploy integration, so past migrations
must stay immutable; add a new one that runs after it). Name it following the existing
naming convention in that folder (timestamp-prefixed, check existing filenames for the
exact format, e.g. `YYYYMMDDHHMMSS_description.sql`) — use a timestamp later than
`20260722000100`.

The new migration must:

1. Update the `handle_new_user()` function so new signups get
   `premium_analyses_remaining = 0` instead of `10` (keep `free_analyses_remaining = 3`
   unchanged — that part is already correct). Use `create or replace function` exactly
   like the original, keeping everything else about the function identical.

2. Add a one-time data backfill (plain `update` statements, not inside the function) that
   caps every **existing** row in `public.profiles`:
   - `premium_analyses_remaining` → set to `0` for every row where it's currently `> 0`.
   - `free_analyses_remaining` → set to `least(free_analyses_remaining, 3)` for every row
     where it's currently `> 3`.

   Add a one-line SQL comment above this block explicitly noting that this is a
   deliberate one-time cap applied uniformly to every existing user, including any who
   may have legitimately purchased Premium credits before this change shipped — flag this
   plainly in your final summary too, since a human should be aware their paid customers
   (if any exist yet) would also get capped by this statement. Do not add any
   Stripe-purchase-history exception logic yourselves — that's a human product decision,
   just implement the blanket cap as specified and surface the trade-off in your summary.

3. Do not modify `consume_analysis_quota()` — its logic (atomic decrement, reject at 0)
   is already correct and unrelated to what defaults get granted.

## Definition of done

- New migration file created, existing migration file untouched.
- `handle_new_user()` grants 0 Premium / 3 Free to new signups.
- Existing profiles get capped per the rules above.
- Final summary: exact filename created, and an explicit note flagging that this
  uniformly caps ALL existing users' premium credits to 0 with no exceptions, for a human
  to confirm is actually intended before this migration is deployed.
