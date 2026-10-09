# Köpanalys — product overview and product rules

> **STATUS: CURRENT.** Canonical source for what Köpanalys sells, what a report contains and the product rules every
> change must respect. Verified against the code on 2026-10-08. Prices and package texts themselves live in code
> (see "Where the truth lives") — don't copy numbers from here into code.

## What Köpanalys is

A buyer-side decision support service for homes in Sweden: an **independent review of the home a person wants to buy**
— the housing association's (BRF) economy in plain Swedish, the area, and the costs that are not in the listing.
Target group since the October 2026 strategy: first-time buyers and others buying without experience. It is a
company in its early stage (team of three, no revenue yet as of 2026-10-07).

## What is sold

One-time packages, paid with Stripe in SEK incl. VAT. No subscriptions, no free tier, no free analyses: a new account
starts with 0 credits. A 50 % discount code mechanism exists (one Stripe coupon, codes from the database).

| Package | Price | What the buyer gets |
|---|---|---|
| Områdesanalys | 99 kr | Cover + the area chapter for an address. Fully automatic, minutes. |
| Trygghetspaket | 499 kr | The complete report for one home (the main product). Read and released by a person, within 24 hours. |
| Tre bostäder | 999 kr | Three Trygghetspaket credits. |

**Where the truth lives:** amounts in `frontend/src/lib/pricing.ts`; package definitions and the "lanseras snart"
switch in `frontend/src/lib/packages.ts`; what a purchase credits in `frontend/src/lib/stripe/prices.ts`; the words in
`frontend/src/i18n/messages/{sv,en}/packages.ts` and `pricing.ts`.

## The report (Trygghetspaket)

Cover → Sammanfattning → Fastighetsinformation → **Boendekalkyl** (placeholder "lanseras inom kort" until
`HOUSING_COST_LIVE` in `packages.ts` is `true`; groundwork in `lib/report/housingCost.ts`) → **Bostadsrättsförening**
(person-reviewed; left out for a freehold house) → Områdesanalys → Möjliga risker → Framtidsutsikter →
Frågor inför visningen. Also a viewing/inspection guide in the dashboard and a PDF of the report. The customer sees none
of it until a reviewer has released the report (rule 3).

## Product rules (apply to every change)

1. **Never advise, never score.** The report states facts with their sources. It never tells the buyer to buy, avoid,
   negotiate or bid, never gives a score, verdict, rating, grade or price meter, and never predicts the price.
   Missing data is shown as missing ("Uppgift saknas"), never guessed. Enforced by
   `frontend/src/lib/report/build.objectivity.verify.mjs` and `analysis_engine/tests/test_reasoning.py`
   (decision 2026-07-22, scores removed 2026-10-02). Detail for code: `.claude/rules/report-objectivity.md`.
2. **No invented data.** A source that is not connected reports `not_connected` and the report says so; counters and
   statistics show real numbers. Example and demo content must be labelled as such (`Exempel`, `Demodata`).
3. **A Trygghetspaket report is reviewed by a person before the customer sees any of it** (decision 2026-10-09). When
   the automatic analysis is done the customer gets a page saying the report is being reviewed and is ready **within 24
   hours**; a reviewer reads it in `/admin/brf` and releases it (`analyses.released_at`). A home with a housing
   association also gets the person-reviewed BRF analysis; a freehold house is reviewed too, without that chapter.
   Automatically extracted BRF figures are only a prefill for the reviewer — never shown to a customer without a
   published review. Reports that existed before the change stay visible.
4. **The standalone Områdesanalys is automatic** and shown at once. Never describe automatic parts as manual handling.
5. **Entitlement:** whoever owns a full analysis sees the whole report once it is released; an area analysis shows the
   cover and the area chapter only — enforced server-side (`src/lib/analysis/access.ts`, `redact.ts`, `release.ts`).
   No entitlement = 404, there is no free preview, and a report that is not released returns no content.
6. **Content (Bostadsguiden, Insikter, Nyheter)** is written by the team in `/admin/content`, not added through code.
   Guides may explain concepts but must not reveal engine internals such as weights or thresholds (Karol, 2026-10-07).

## The BRF review in practice

The reviewer runbook (queue, getting the annual report, what to check, publishing) and the benchmark table with its
sources are in [`docs/48_brf_review_and_deck_alignment_2026-10-02.md`](../48_brf_review_and_deck_alignment_2026-10-02.md)
§1 and §3. The benchmarks used by the code are in `frontend/src/lib/brf/interpret.ts`; review them yearly
(they are FY2023 averages, checked 2026-10-02). Reviewers are the emails in `KOPANALYS_ADMIN_EMAILS`.

**Release (2026-10-09):** the review page in `/admin/brf` also holds the customer's report ("Kundens rapport"). The
reviewer reads it, then presses *Publicera och släpp rapporten*; for a freehold house or a home without an association
*Ingen förening — släpp rapporten*. That releases every finished report of the home that waits and e-mails the
customers. Publishing is refused while the analysis is still being made. A new report version ("Update analysis") or a
new annual report opens a new 24-hour round; the customer keeps the report that was already released meanwhile.

## Open product questions

Claims on the site that cannot be verified, unfinished features and decisions still to be made are tracked in one
place: the "Known issues" and "Next steps" sections of [`PROJECT_STATE.md`](../../PROJECT_STATE.md).
