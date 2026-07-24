# Task 008 — Let premium analysis run without quota, but paywall the report until paid

Read `deepseek-tasks/GROUND_RULES.md` first and follow it. **Do this task after 007
(quota defaults) — it depends on that migration's numbering/sequence; check
`deepseek-tasks/completed/007-quota-defaults.md` for the migration filename it created
before starting, so your new migration's timestamp sorts after it.**

## Context — current behavior

`frontend/src/app/api/analyses/route.ts` (`POST`, around lines 107-126): when a user
requests a `"premium"` analysis and has `0` premium credits left,
`consumeAnalysisQuota` returns `null` and the endpoint immediately returns
`402 quota_exhausted` — the analysis never runs and the user never sees anything.

**New product requirement:** when this happens, the analysis should run anyway (the user
"reaches" the report), but the report itself must be paywalled — locked/blurred with a
"pay to unlock" call to action — until they complete payment via the *existing* Stripe
one-time purchase flow (`priceKey: "premium_analysis"`,
`frontend/src/lib/stripe/checkout.ts`'s `createOneTimeCheckout`,
`frontend/src/lib/stripe/webhooks.ts`'s `handleCheckoutSessionCompleted`). That purchase
flow currently just adds a generic `+1` to `premium_analyses_remaining` on the user's
profile — keep that behavior for the normal "buy a spare credit ahead of time" case, but
extend it so a purchase can *also* directly unlock one specific already-generated
analysis the user was blocked on.

## Goal

### 1. Database — new migration (after 007's)

Add a nullable-safe `unlocked` column to `analysis_requests`:
```sql
alter table public.analysis_requests add column if not exists unlocked boolean not null default true;
```
Default `true` so every existing row (all of which were already paid for via quota or
are free-tier) stays exactly as-is. Only new premium rows created via the "let it run
without quota" path (below) will explicitly be inserted with `unlocked = false`.

### 2. `frontend/src/lib/analysis/ownership.ts`

- Add `unlocked: boolean` to `AnalysisRequestRecord` / `AnalysisRequestRow` and thread it
  through `mapRow`.
- Extend `recordAnalysisRequest`'s input with an optional `unlocked?: boolean` (default
  `true` if omitted, matching the column default) and pass it through to the insert.
- Add a new function:
  ```ts
  export async function unlockAnalysisRequest(userId: string, analysisId: string): Promise<void>
  ```
  Updates the matching `analysis_requests` row(s) (`user_id`, `analysis_id`) to
  `unlocked = true`. Used by the webhook after a successful "unlock this analysis"
  payment.
- Reuse/extend the `getAnalysisRequestType` function from task 006 (it should already
  exist by the time this task runs, per the ground rules' scoped-changes principle — if
  it doesn't exist yet, task 006 hasn't been applied yet; check
  `deepseek-tasks/completed/006-shorten-free-report.md` first, and if it's not done, add
  a similarly-shaped `getAnalysisRequestRow(userId, analysisId)` returning the full
  `{ analysisType, unlocked }` instead of just the type, so this task doesn't depend on
  006 having landed).

### 3. `frontend/src/app/api/analyses/route.ts`

In the `POST` handler, change the premium branch: when `!devAdmin` and
`analysisType === "premium"` and `consumeAnalysisQuota` returns `null` (no credits), do
**not** return 402. Instead:
- Proceed to `requestAnalysis(input, ...)` exactly as the success path already does.
- Call `recordAnalysisRequest({ ..., quotaConsumed: false, unlocked: false })`.
- Return the normal success response (same shape as `resultResponse`) so the frontend
  redirects to `/report?id=...` exactly like a paid request would.

The free-tier branch's existing 402 behavior on exhaustion is unchanged — this new
"let it through" behavior is premium-only.

### 4. Paywall on the report

- `frontend/src/app/api/analyses/[id]/route.ts` (`GET`): after loading the analysis,
  also look up the viewing user's `analysis_requests` row for this `analysisId`
  (reusing the ownership helper from step 2). If `analysisType === "premium"` and
  `unlocked === false`, include a flag in the JSON response (e.g. `locked: true`) instead
  of stripping data server-side — the report page will decide what to render.
- `frontend/src/app/report/page.tsx`: when the loaded analysis comes back `locked: true`,
  render a paywall view instead of the full report — reuse the page's existing
  visual language (cards, buttons) rather than inventing a new design system. Show:
  - The property's basic address/summary (so the user knows which listing this is for).
  - A clear message that this is a Premium analysis awaiting payment.
  - A button that starts checkout the same way `frontend/src/components/dashboard/buy/PremiumAnalysisCard.tsx`
    (or wherever the existing "buy premium_analysis" button lives — check that component
    for the exact fetch call to `/api/stripe/checkout`) already does, but passing an
    additional field identifying which analysis to unlock (see step 5).

### 5. Checkout + webhook: unlock the specific analysis on payment

- `frontend/src/app/api/stripe/checkout/route.ts`: accept an optional
  `unlockAnalysisId` field in the request body alongside `priceKey`. When present (and
  `priceKey === "premium_analysis"`), pass it through to Stripe session metadata (extend
  `createOneTimeCheckout` in `frontend/src/lib/stripe/checkout.ts` to accept and forward
  it in `metadata`).
- `frontend/src/lib/stripe/webhooks.ts`'s `handleCheckoutSessionCompleted`: in the
  existing `session.mode === "payment" && session.metadata?.priceKey === "premium_analysis"`
  branch, after incrementing `premium_analyses_remaining` (keep that line — it's the
  existing "buy a spare credit" behavior and must still happen every time), also check
  `session.metadata?.unlockAnalysisId`. If present, call `unlockAnalysisRequest(userId,
  unlockAnalysisId)` and then **decrement** `premium_analyses_remaining` back down by 1
  (since this specific purchase was spent immediately on unlocking that analysis rather
  than banked as a spare credit) — i.e. the net effect of an "unlock this one" purchase
  should be: analysis unlocked, credit balance unchanged; while a purchase with no
  `unlockAnalysisId` (bought ahead of time) nets `+1` as before. Get this arithmetic
  right and explain it clearly in your summary — it's the one subtle part of this task.

## Definition of done

- A premium request with 0 credits now succeeds and redirects to the report instead of
  erroring.
- That report renders a paywall instead of full content for the requesting user only.
- Paying via the existing Stripe flow (with `unlockAnalysisId` set) unlocks that specific
  report and leaves the user's spare premium credit balance unchanged; paying without
  `unlockAnalysisId` still just adds a spare credit as before.
- `npm run build` passes in `frontend/`.
- Final summary must include: the new migration filename, every file changed, and a
  clear walkthrough of the credit-arithmetic in step 5 so a human can verify it's correct
  without re-reading the diff line by line.
