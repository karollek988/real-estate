# Task 019 — Pause the Ultra tier (Basic + Premium only for now)

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

Product decision: the "Ultra" subscription tier is paused — no live Stripe product
exists for it yet, and no Ultra-specific features have been built, so it should not be
purchasable or visible as an option right now. Only the free (Basic) tier and Premium
should be offered. Do not delete the Ultra plumbing entirely (tier enum, product config
entry) — just make it unreachable/invisible, since it may come back later once real Ultra
features exist. This is a presentation/availability change, not a data-model change.

Relevant files:
- `frontend/src/app/dashboard/buy/page.tsx` — has an Ultra `PlanCard` config (around
  lines 43-56, `priceKey: "ultra_monthly"`).
- `frontend/src/lib/stripe/prices.ts` — `getProductConfig()` has an `ultra_monthly` entry
  reading `process.env.STRIPE_PRICE_ULTRA_MONTHLY` (which is likely unset now that Ultra
  has no live price — `getPriceId` already throws a clear error if that happens, which is
  correct fail-safe behavior; don't change that error-throwing logic).
- `frontend/src/app/api/stripe/checkout/route.ts` — `ALLOWED_SUBSCRIPTIONS` includes
  `"ultra_monthly"`.

## Goal

1. In `frontend/src/app/dashboard/buy/page.tsx`, remove (or conditionally hide behind a
   constant you can flip back later, e.g. `const ULTRA_ENABLED = false;` guarding the
   card's render — your call on which is cleaner given how the existing plan cards are
   structured, explain your choice in the summary) the Ultra plan card from what's shown
   to users, so nobody sees or can click into an "Ultra" purchase option.
2. In `frontend/src/app/api/stripe/checkout/route.ts`, remove `"ultra_monthly"` from
   `ALLOWED_SUBSCRIPTIONS` — if somehow reached anyway (e.g. a stale client request), it
   should get the existing `invalid_price_key` error response rather than attempting a
   checkout session with a missing price ID.
3. Do NOT remove `SUBSCRIPTION_TIER.ULTRA`, the `ultra_monthly` entry in
   `getProductConfig()`, or any other backend plumbing — leave those as dormant
   infrastructure for when Ultra actually launches.
4. Check `frontend/src/components/dashboard/buy/PlanCard.tsx` and any other place Ultra
   might be referenced (search for "ultra"/"Ultra" across `frontend/src`) to make sure no
   other visible UI element (e.g. a comparison table, a nav item) still advertises Ultra
   as purchasable today.

## Definition of done

- No page a normal user can reach shows Ultra as a purchasable option.
- Attempting to hit the checkout API directly with `priceKey: "ultra_monthly"` gets a
  clean `400 invalid_price_key` response, not a 500 from a missing Stripe price ID.
- The tier enum and product config entries for Ultra still exist in the code, just not
  reachable/visible.
- `npm run build` passes in `frontend/`.
- Final summary: exact mechanism used to hide the Ultra card (removed vs
  flag-guarded) and why.
