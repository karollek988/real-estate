# Köpanalys — Project State

> Concise, factual snapshot for picking this project back up after a cleared
> Claude conversation. Update this file when something in it changes;
> otherwise leave it alone. Detailed research/product docs live in `docs/`;
> this file is the "what's actually true right now" summary.

Last updated: 2026-10-05 — Tenth session: landing-page redesign on branch `styleRedesign`
(pushed, **not merged to `main`, not deployed**). Everything below this note is older.

**Tenth session — landing redesign + build fixes (branch `styleRedesign`).** Reference:
`docs/design/landing-2026-10/kopanalys-new-design.png`.
- **The build was broken on `origin/main`** (`bbef750`): the mapDemoIntegration merge added
  `src/pages/`, which types the App Router hooks as nullable, and `/buy` called
  `searchParams.get()` directly. Fixed here (`ee2fb36`); `main` still needs it.
- The same merge reverted two FAQ questions (a duplicate "Vad ingår i en Områdesanalys?" and a
  subscription-era account question); restored to `77b5d6f` (`bf2e5e4`).
- `npm run lint` runs again (`frontend/eslint.config.mjs`); 14 pre-existing react-hooks problems
  remain, none in landing-page files. `tsconfig.tsbuildinfo` is finally untracked.
- Redesign: `ka-*` tokens in `globals.css`; display serif = the report's Source Serif 4
  (`lib/fonts.ts`); `BrandLogo`; `SiteHeader` has a `variant` ("light" on `/`, default "dark" for
  `/buy` and the dashboard until they are redesigned); `components/landing/` (LandingHero,
  AnalyzeSection, ScrollLink, container); every landing section restyled to cream/sand with deep
  green; deep green global footer.
- The analysis card (screenshot / manual / area) moved from the hero into AnalyzeSection with
  unchanged forms; `FOCUS_URL_INPUT_EVENT` may carry `{ method }` to open a tab.
- Hero laptop: `public/images/hero-laptop.png`, cut out of the RGB render by
  `frontend/scripts/make-hero-laptop.py`.
- **Decided by the user (2026-10-05):** "Visa karta" scrolls to "Så fungerar det" until the public
  map ships (`MAP_TARGET`); the card copy "Se om priset är rimligt med hjälp av data och historik"
  stays as in the reference.
- **Still open:** (1) no clean Stockholm hero photo exists, so `HERO_PHOTO = null` shows an interim
  gradient (`LandingHero.tsx`); `public/hero-background.png` is the old villa image with baked-in
  price tags and a market panel and does not work behind the new hero. (2) Vercel's production
  deploy of `bbef750` failed (GitHub status, 2026-10-04 19:28 UTC); production still serves
  `429bb66` until `ee2fb36` + `bf2e5e4` reach `main`. (3) The cleanup candidates and merged branches
  from the session report await approval — nothing was deleted.

Last updated: 2026-09-28 — `mapDemoIntegration` now carries both the
**admin portal** (`admin.kopanalys.se`: login + embedded map demo, see §3g
and the admin bullet in §6 — needs a Vercel domain + DNS record before it's
reachable) and the Eighth session's FAQ value-communication work below
(merged together on this branch for the `admin.kopanalys.se` test
deployment; neither is on `main` yet). Before that, 2026-09-18 — see the
Seventh session note below; that branch has since been re-verified, merged,
pushed, and deployed to `main` (see "Merge, push & deploy" at the end of
that section for the full record).

**Eighth session — FAQ value-communication audit + rewrite.** Branch
`feature/faq-value-communication` (branched from `main`), **not merged,
not deployed**, per explicit instruction. Task: make the homepage FAQ
(`frontend/src/lib/faq.ts`, rendered by
`frontend/src/components/sections/FaqSection.tsx`) clearly communicate
Köpanalys's value versus pasting the same screenshots into a general-purpose
AI chat, and — per explicit instruction — audit every existing FAQ answer
against actual current product behavior rather than assume old copy was
still accurate. No product/feature behavior touched — only content: all of
`faq.ts`, plus the same 4 stale facts (Hemnet-link-only intake, card-only
payment, "cancel via inställningar," "delete account via support") fixed a
second time in `app/api/chat/route.ts`'s `SYSTEM_PROMPT`, once noticed
there too. That prompt already appends the full live `FAQ_ITEMS` array as
reference text after its own hardcoded bullets (`route.ts:52-53`), so the
hardcoded bullets were the only remaining place these facts could still
contradict the FAQ.

Audit findings, each cross-checked against code/DB migrations/git history,
not assumed:
- Intake-method claim was stale: FAQ said "endast länkar från Hemnet
  stöds," but the homepage has had no URL input since the screenshot-OCR
  flow shipped (§2 below) — `ScreenshotUploadForm.tsx` + `ManualEntryForm.tsx`
  are the only two intake paths today, and `screenshotExtract.ts`'s
  regex-label extraction isn't Hemnet-specific. Fixed to describe
  screenshot-of-any-site-or-manual-entry instead.
- "Används AI i analysen?" overclaimed: it said AI reads "mäklarens
  dokument" and summarizes a besiktningsprotokoll. That path is dormant —
  the "Dokument hos mäklaren" feature was fully removed (see the Seventh
  session's note below), and `risk.ts`'s own comment confirms
  `inspection_findings` "stays dormant until a future provider populates
  the same attribute shape." Also added that screenshot reading is
  deterministic OCR (Tesseract + regex), not AI vision — relevant context
  for the new AI-comparison question below. Fixed.
- "Vad är skillnaden mellan gratis- och Premium-analys?" still listed
  "dokument hos mäklaren" as a Premium-only chapter; that chapter no
  longer exists (same removal). Fixed.
- Account-deletion FAQ said "kontakta oss" — it's actually self-serve
  (`app/dashboard/settings/page.tsx`'s "Radera konto permanent," calls
  `DELETE /api/profile`). Subscription-cancellation FAQ pointed to
  "dashboardens inställningar" — it's the separate "Prenumerationer" page
  (`app/dashboard/subscriptions/page.tsx`, opens the Stripe billing
  portal via `/api/stripe/portal`). Fixed both.
- Payment methods: FAQ said "kort" only; `PaymentMethodsCard.tsx` also
  lists Klarna. Fixed.
- Two questions ("Vilka datakällor används?" / "Var kommer datan ifrån?")
  were near-duplicates with slightly different source lists. Merged into
  one.
- Verified real, then documented in the FAQ for the first time: the
  automatic quota refund on analysis failure.
  `pipeline.ts`'s `InsufficientListingDataError` path calls
  `ownership.ts:refundAnalysisRequestsQuota()` → the `refund_analysis_quota`
  RPC (`supabase/migrations/20260814020000_refund_analysis_quota.sql`,
  the same RPC pen-tested in this doc's security-fix history) whenever a
  listing's essential fields can't be gathered — the credit genuinely goes
  back on its own; this isn't a manual support process.
  `report/page.tsx`'s own failure screen already tells the user this; the
  new FAQ answer says the same thing and deliberately no more — it does
  **not** promise a monetary refund, since no `stripe.refunds.create` call
  (or any Stripe refund call) exists anywhere in the codebase, confirmed by
  a full-repo search.
- Verified real, then added to the FAQ for the first time: the BRF
  annual-report self-upload (`SectionDocumentUpload` →
  `POST /api/properties/[id]/brf-report` → `rerunAnalysisForProperty`, no
  quota consumed) — already built (§ below, "Generic 'upload document →
  extract → regenerate' mechanism") but never mentioned in the FAQ.

New question added per explicit instruction: "Varför ska jag använda
Köpanalys istället för vanlig AI?" — names ChatGPT/Claude explicitly (as
instructed), does not claim generic AI "can never" do this, and instead
states the concrete, verified differentiators: purpose-built analysis
pipeline, named external sources cited per datapoint, explicit
"Uppgift saknas" instead of guessing, the BRF-document complement feature,
and PDF export.

`FAQ_ITEMS` grew from 17 to 21 questions: one duplicate pair merged, six
new (the AI-comparison question, missing/wrong-data handling, the
BRF-document complement, the failed-analysis/paid-but-no-report question,
and a dedicated support-contact question), the rest edited only where
audited and found stale, otherwise left untouched.

**Tests this session**: `npx tsc --noEmit` (frontend) clean. `npm run
lint` still fails immediately with the pre-existing "no eslint.config"
error (G4 below — unrelated to, and not introduced by, this change).
Manually verified in the running dev server (`http://localhost:3001/#faq`):
all 21 questions render in the intended order, the new/edited ones open
and show the intended text (checked via the DOM, not just source), no
console errors, no React key collisions (`FAQ_ITEMS.map(..., key=
{question})` — all 21 question strings confirmed unique via a page-context
`querySelectorAll` check).

**Known gap found incidentally, not fixed (out of FAQ scope)**: see G10
below — Premium/Ultra subscription plans do not appear to actually grant
their advertised monthly analysis credits anywhere in the codebase.
Last updated: 2026-10-02 — see the Ninth session note first (pitch-deck alignment,
person-reviewed BRF analysis; **merged to `main` and deployed to production 2026-10-02 ~21:02**).
The Seventh session note below was re-verified, merged, pushed, and deployed to `main` (see
"Merge, push & deploy" at the end of that section for the full record).

**Ninth session — DEPLOYED (2026-10-02): `main` = `32d9433` (fast-forward of branch
`feature/trygghetspaket-business-model`), live on Vercel + Railway; the 3 migrations were applied
to production by the user first (SQL Editor — not recorded in the CLI migration history).** Read
**`docs/48_brf_review_and_deck_alignment_2026-10-02.md` first** (it supersedes docs/47): what was
built, the reviewer runbook, the BRF benchmarks with sources, the production rollout (needs the
user's OK) and the flags. In short:
- **BRF analysis is reviewed by a person** before the customer sees it, ready within 24 h of the
  purchase (user decision). New table `brf_reviews` (migration `20261002000200`), review console
  `/admin/brf` (reviewers = `KOPANALYS_ADMIN_EMAILS`), team/customer emails via Resend (production
  only). The report's BRF chapter shows "granskas … klar senast <tid>" until published.
- **Readable BRF analysis** (`lib/brf/interpret.ts`): the 7 mandatory key figures (BFNAR 2023:1)
  explained in plain Swedish, read against SBAB/HSB/Handelsbanken levels and Nabo's 2023 averages,
  plus "Vad det betyder för dig" in kronor (share of the association's debt, fee after a rate rise,
  decided fee change). It also feeds the summary, risks (new Avgiftsrisk), questions and viewing guide.
- **Key figures read automatically** from uploaded annual reports as the reviewer's prefill
  (`BRF-Scraper/.../extractor/key_figures.py`) — correct on all 9 real 2024 reports tested.
- **Report without scores**: chapters Sammanfattning, Fastighetsinformation, Boendekalkyl
  (placeholder "lanseras inom kort", user decision), Bostadsrättsförening, Områdesanalys, Möjliga
  risker, Framtidsutsikter, Frågor inför visningen. Automated BRF fetching removed (commit `1478207`).
- **Site follows the pitch deck**: hero, problem section (60 825 kr lagfart), Så fungerar det,
  example report (real component, made-up figures), Priser (99/499/999), FAQ, chat, /buy. The fake
  "4.8/5, 256 omdömen" card is kept on purpose until the user replaces it (next week).

**Eighth session — packages instead of Premium (2026-10-02, now committed as
`743986a` on that branch; migrations not applied to production).** Premium, subscriptions,
the 3 free analyses, locked/paywalled chapters and the "First 100 Users"
campaign are gone. What is sold (one-time, Stripe, SEK incl. VAT; amounts in
`frontend/src/lib/pricing.ts`): **Områdesanalys 99 kr** (area report only),
**Trygghetspaket 499 kr** (the complete report of one property), **Tre bostäder
999 kr** (3 × Trygghetspaket). Whoever creates a full analysis always sees all of
it; an area analysis shows the cover and the area chapter and nothing else.

- **Data model** (`supabase/migrations/20261002000000_*.sql`, `…000100_*.sql`):
  `profiles.full_analyses_remaining` / `area_analyses_remaining` (old premium/free
  columns kept, unused; paid Premium credits copied to `full`); `analysis_requests.analysis_type`
  is now `full`|`area` (old value kept in `legacy_analysis_type`; every legacy
  free/premium/locked request became `full`); `analyses.scope` (`full`|`area`) keeps
  area reports out of the full-analysis cache; `analysis_requests.refunded_at` (a
  refunded request grants no access); `credit_purchases` ledger. RPCs `consume_credit`,
  `refund_credit`, `grant_purchase_credits` (idempotent per Stripe session) — all
  service_role only. Campaign trigger dropped; discount codes (table, redeem flow,
  `generate_discount_code`) kept, `issue_discount_code(user, kind)` added; kinds are
  `trygghetspaket`/`omradesanalys` (+ inert `premium_subscription`).
- **Access** (`lib/analysis/access.ts`, `redact.ts`, `ownership.ts`): entitlement is per
  property (`full` > `area` > none); `redact.ts` is an allowlist (the area attribute list is
  checked against what `buildAreaAnalysis` really reads by `redact.verify.mjs`). No
  entitlement = 404 — there is no free preview. The viewing guide, BRF-report upload
  and everything built on the whole report require `full`.
- **Area pipeline**: `getProviderWaves("area")` runs geocoding, Booli, SCB, OSM,
  Skolverket, commute, location intelligence only; delivered only if the address was
  geocoded and ≥1 area source returned data, otherwise failed + credit refunded.
  Address must include a city (`Storgatan 12, Stockholm`).
- **Stripe**: `lib/stripe/prices.ts` (credits per key), webhook credits through
  `grant_purchase_credits` (replaces a read-modify-write that double-credited on
  repeated delivery), requires `payment_status` paid, still credits the pre-launch
  key `premium_analysis` as one Trygghetspaket. `scripts/setup-stripe-products.ts` now
  creates the three packages (not run). **Required env before launch:**
  `STRIPE_PRICE_OMRADESANALYS`, `STRIPE_PRICE_TRYGGHETSPAKET`, `STRIPE_PRICE_TRE_BOSTADER`
  (checkout returns a generic 500 without them); `STRIPE_COUPON_ANALYSIS_50OFF` must not be
  restricted to old products. Subscription webhook handlers + the billing-portal route are
  kept only so a pre-existing subscriber can still cancel — delete them once Stripe shows no
  active subscription.
- **Account**: one balance card (credits per product + counts BRF-/Områdes-/Dolda-kostnader
  analyses; a full analysis counts once in each, an area analysis only as area).
- **Verified**: `tsc` clean; `redact.verify.mjs` (28, mutation-tested) and
  `credits.verify.mjs` (33) pass; existing verify scripts unchanged (only the known
  `hemnetPage` G5 case and the network-bound `parseBotCoverage` fail); a 66-assertion SQL
  suite (legacy data → migrations → RPCs/grants/idempotency) on a throwaway Postgres;
  and against the local Supabase stack with real GoTrue sessions: signed webhooks,
  multi-user access matrix (area vs full vs nothing, API + report page), refund path,
  checkout/discount-code rejections, all pages render. **Not tested**: a real Stripe
  Checkout (no Prices exist yet), production data, the Python engine path
  (location-intelligence/BRF providers not running locally).
- **Known / open**: "Dolda kostnader" is sold as the third analysis — since the ninth session
  the Boendekalkyl chapter is a "lanseras inom kort" placeholder (user decision) and the BRF
  analysis shows the association's hidden costs in kronor; the dashboard upload bug noted here was
  fixed in the ninth session; terms text (§ Analyser och krediter) was edited and needs a
  human/legal read.

**Seventh session — Price Analysis + civic data enrichment.** Branch
`feature/price-analysis-and-area-data-enrichment`, tested on the branch
first per explicit instruction, **now merged to `main` and deployed** (see
below). Full research writeup:
`docs/46_price_and_civic_data_source_research.md`. Summary:

- **Price Analysis was less broken than it looked.** `providers/booli.ts`
  already implements comparable sold properties, price/m² benchmark, and
  quarterly trend against Booli's real API — it's just never been run with
  a configured `BOOLI_CALLER_ID`/`BOOLI_API_KEY`, and Booli's self-serve
  signup for new keys appears closed since ~2018 (site's own API docs page
  404s). This is a **credentials/business decision**, not a code gap — see
  docs/46 for the Svensk Mäklarstatistik / Booli-enterprise options, both
  paid and outside what a coding session can action.
- **`scb_housing_market.py` had a real parsing bug**, fixed: it read SCB's
  price-index table as Tid-only, when the table now also carries a
  `Region` dimension (national + 3 metro + 8 riksområden) — it happened to
  still read the correct *national* row by coincidence (region "00" lands
  at flat-index 0), silently dropping every other region. Now resolves
  cells by actual dimension index. `marketIntelligence.ts` bridges the
  national trend into the Price chapter as a labeled supplementary fact
  when no real comparables are connected — free, honest, always-available,
  not a replacement for real comparables.
- **Crime/safety and election turnout added to Area Analysis** — both were
  *already being collected* by the Python `location_intelligence` engine
  (Kolada `safety_security_index`/`voter_turnout_pct`, Polisen recent-
  events count) but discarded by the TS bridge, which only ever extracted
  one unrelated signal. Widened the bridge, not a new provider/credential.
  Rendered as a new "Trygghet & samhälle" sub-section — factual figures
  with explicit granularity caveats (kommun/county-level, not per-address),
  election data shown as a bare turnout % with no scoring, per instruction.
  The stale `crime_statistics`/`public_transport` placeholders (the latter
  superseded by `commute.ts` months ago and never retired) were removed.
- **`parseBotBooli.ts` disabled** (removed from the provider registry, not
  deleted) — confirmed broken (its location search ignores the query
  entirely, verified in an earlier session) and flagged as a legal risk by
  `docs/legal-data-migration-plan.md` (scraping-as-a-service, same risk
  class as scraping Hemnet/Booli directly).
- **"Dokument hos mäklaren" removed entirely** — UI chapter, report
  builder, provider, registry wiring, DB-access layer, download route,
  redaction entries, *and* the backend (`api/server.py`'s
  `/api/broker-documents` endpoint, `BRF-Scraper`'s `broker_discovery`
  package). `risk.ts`'s `InspectionFindingsAttribute` type — previously
  imported from the broker-documents provider — was relocated inline
  since risk.ts is now its sole consumer; that risk factor stays dormant
  until a future provider populates the same attribute shape.
  `api/tests/test_internal_auth.py`'s protected-endpoint list updated
  (30/30 passing, down from 33 — the 3 broker-documents parametrizations
  are gone with the endpoint).
- **Generic "upload document → extract → regenerate" mechanism** — new
  `SectionDocumentUpload` component (`frontend/src/components/report/`),
  embedded in the report's Bostadsrättsförening chapter, posting to the
  *existing* `/api/properties/[id]/brf-report` route (no new backend
  needed for this first use — that route already extracts via the shared
  OCR/document pipeline and re-runs the analysis). Deliberately generic:
  wiring up a new section later means adding a route with the same
  contract (`{file}` in, `{analysisId}` out) and dropping this component
  into that chapter.
- **PDF export**: investigation found it was already substantially fixed
  by an earlier session's report redesign (real `@media print` CSS exists,
  hides the "no-print" chrome, forces page breaks) — a production
  checklist doc (`docs/44`) calling this broken was stale. Added a second,
  prominent "Ladda ner PDF" button at the bottom of the report (the
  existing one is at the top only), identical href/route to the
  already-working top button. **Not re-verified with a live-rendered PDF
  this session** (would have needed a synthetic auth+analysis fixture —
  judged not worth the setup cost given the addition reuses an
  already-proven mechanism); recommend one manual click-through.

**Tests this session**: `tsc --noEmit` clean. All 7 analyzer +2 report
`*.verify.mjs` scripts pass (via `npx tsx`), plus provider/helper verify
scripts — only the pre-existing, documented `hemnetPage.verify.mjs`
failure remains (G5, unrelated). Python: `market_intelligence` 234/234
(added a regression test for the Region-dimension bug), `location_intelligence`
164/164, BRF-Scraper 426 passed/5 skipped (unchanged baseline — confirms
the `broker_discovery` removal broke nothing), `api/tests/` 30/30.
`server.py` confirmed importable with zero remaining "broker" routes.

**Merge, push & deploy.** Final re-verification pass before merging,
re-running the exact suites above on the clean feature-branch tree:
`tsc --noEmit` clean; all 16 frontend `*.verify.mjs` scripts run
individually, 15/16 green, the one failure being the same pre-existing
unrelated `hemnetPage.verify.mjs` case (G5); Python
`market_intelligence`+`location_intelligence` 398 passed/1 deselected
(=234+164, exact match); `api/tests` 30/30 (run via `BRF-Scraper/.venv`,
which has `fastapi` installed — the root Poetry env doesn't, since `api/`'s
dependencies come from `api/requirements.txt`, a separate install target
from `pyproject.toml`, not a gap introduced this session); `BRF-Scraper`
full suite 426 passed/5 skipped. Every number matches this session's
documented baseline exactly — no regressions, no new failures. Working
tree was already clean.

`feature/price-analysis-and-area-data-enrichment` merged into `main`
(fast-forward, `657c447..a9cd0f8`, no conflicts, no merge commit — same
convention as every prior merge in this repo). Pushed to `origin/main`;
`git rev-parse` confirmed local `main` and `origin/main` both at `a9cd0f8`
post-push.

Both platforms auto-deployed from the push, as expected (§6 — no override
config exists). **Railway: verified live**, not just claimed — `railway
status` showed a fresh deployment ID (`c9504a9d...`) roll to ● Online,
`railway logs` showed a clean `Application startup complete` with no
errors, and a behavioral check confirmed the shared-secret auth middleware
(§3c) is still correctly configured on the new deploy: unauthenticated
`GET /` → 200, unauthenticated `POST /api/ocr/extract-text` → 401
(fail-closed as designed — same check pattern as the fifth session).
**Vercel: confirmed live via the site itself**, not via CLI/dashboard —
the Vercel CLI in this environment is still logged out and non-interactive
re-auth isn't possible here (same pre-existing gap as sessions 4/5, not
new). `kopanalys.se` loads (200 across all requests), shows the current
UI (`Ladda upp skärmdump` / `Manuell inmatning` buttons both present,
matching the deployed screenshot-OCR flow), and served with `Age: 40`
at check time — consistent with an edge cache populated by a fresh build
right after this push. **Not tested**: the authenticated round trip
(login → screenshot upload → Python engine) — this agent doesn't log in
as a real user; same standing gap as every prior session, not specific to
this merge.

**Not implemented, deliberately deferred** (see docs/46 for why): genuine
property-level comparable sales (needs a paid Mäklarstatistik/Booli
relationship); BRF economics beyond the existing OCR pipeline (no free
structured source exists anywhere, confirmed by research); environmental/
flood/noise risk (real data, but fragmented GIS formats and partial
coverage — not a clean per-address API); full election party-vote-share
detail via Valmyndigheten (would need valdistrikt-level geospatial
matching, bigger than this session's scope — Kolada's turnout figure
shipped instead as an immediate, honest partial signal); the Lantmäteriet
detaljplan API (already scaffolded as `lantmateriet_detaljplan` in
`location_intelligence`, `not_connected` — needs OAuth2 credentials,
a provisioning step).

---

## History (sessions 1-6, all already merged/pushed/deployed to `main`)

`test/ocr-security-verification` merged into
`main` (fast-forward, no conflicts, no merge commit) after the third
session's verification pass confirmed every fix live. `main` HEAD was then
`82dbec4`, not yet pushed at that point in the history below — it has
since been pushed and deployed (fifth session) and received further fixes
(sixth session); see PROJECT_STATE.md's git history / commit log for the
exact current `main` HEAD rather than trusting a specific SHA quoted below.

A pre-deployment audit (fourth session, same day) found
`PYTHON_ENGINE_API_SECRET` was **not actually set on Railway** despite being
reported as configured on both platforms — live-checked via `railway
variable list` rather than trusted at face value. **Railway is now fixed**:
the user added it through Railway's dashboard (confirmed independently via
CLI immediately after, same session — 12 variables now present, including
`PYTHON_ENGINE_API_SECRET`, up from 11). **Vercel remains unverified** — the
linked Vercel CLI session is invalid in this environment and no interactive
re-auth is possible here, so its status is still just a claim, not a
confirmed fact; see §6. **Do not push `main` until Vercel is independently
confirmed too** (dashboard screenshot or a working `vercel env ls`) — both
platforms are git-connected to this repo with no override config found
anywhere in it, so a push almost certainly auto-deploys both.

Session history on the merged branch: Docker fixed (stale Inference Manager
socket file), and the two previously BLOCKED verifications (OCR-in-container,
live RPC adversarial test) both went to PASS; no code changes in that final
session, verification only.

**Fifth session — pushed and deployed.** User reported `PYTHON_ENGINE_API_SECRET`
now manually set on both Vercel and Railway with the same value. This agent
hit the same blocker as the fourth session (Vercel CLI logged out, no
interactive re-auth possible, Vercel MCP plugin also unauthenticated) and so
could not independently check Vercel's side before pushing either. Flagged
this explicitly to the user given the fourth session's identical "confirmed
on both platforms" claim had already turned out false for Railway — user
confirmed to proceed on their word. Pre-push checks: working tree clean,
local `main` exactly 12 commits ahead of `origin/main` (no divergence), no
`.env*` files tracked, diff scanned for live-secret patterns (`sk_live_`,
`AKIA...`, PEM headers, `ghp_`/`whsec_...`) — zero hits. Pushed
`f66412c..2681632` to `origin/main`.

Both platforms auto-deployed from the push, as expected (no override config
exists in the repo). **Railway: verified live, not just claimed** —
`railway status` showed the build, then a fresh deployment ID rolling to
● Online; `railway logs` showed a clean `Application startup complete` with
no errors. Then re-verified the *specific* open concern behaviorally rather
than trusting the CLI variable list alone: `POST /api/ocr/extract-text` with
no auth header returned **401** (not 500) — per `api/server.py`'s
fail-closed design (§3c), 500 would mean the secret is unset on Railway, so
401 confirms it's actually configured on the new deployment, not just
present in a dashboard screenshot. **Vercel: confirmed reachable and serving
the new deployment** — `kopanalys.se` loads, and the UI shows the new
screenshot-upload flow (`Ladda upp skärmdump` / `Manuell inmatning`)
replacing the old paste-URL form, so the build succeeded and picked up the
new code. **Not independently tested**: the actual authenticated round trip
(logged-in user → screenshot upload → Next.js → Python engine with the
shared secret) — every code path that calls the Python engine sits behind
`requireUser()`, and this agent does not create accounts or enter
credentials, so it couldn't log in to drive that call. This is the one
remaining gap between "deployed" and "confirmed working end-to-end" —
**recommended manual test for the user**: log in, use "Ladda upp skärmdump"
with a real listing screenshot, and confirm it reaches OCR extraction
instead of failing with the generic "Kunde inte läsa bilderna" error (which
is also the generic message for *any* OCR failure, so a failure here doesn't
by itself prove a secret mismatch — check Railway logs for a 401 on
`/api/ocr/extract-text` at the same timestamp to confirm root cause if it
does fail).

**Sixth session — screenshot OCR extraction accuracy.** Testing against a
real listing (Augustendalsvägen, Nacka strand) found the review form only
filled 2 of the ~15 applicable fields, with `askingPrice` actively wrong
(picked up `Pris/m²` instead of the real price). Fixed across several
iterations on `fix/ocr-price-and-boarea-extraction`; coverage is now 9/10
applicable fields for this listing. Full breakdown in §2a.

## 1. Architecture

- **Frontend**: Next.js App Router (`frontend/`), deployed on Vercel. Supabase
  (Postgres + Auth + Storage) for data/auth. Stripe for payments/subscriptions.
- **Analysis engine**: Python FastAPI (`api/server.py`), deployed via the root
  `Dockerfile` — almost certainly Railway (`railway.json`, "railway logs" in
  code comments). Wraps `analysis_engine/` (BRF financial calculator +
  reasoning + report text), `BRF-Scraper/` (Hemnet/Booli/Allabrf profile
  acquisition, PDF/DOCX/image extraction, broker-document discovery), and the
  standalone `location_intelligence`/`market_intelligence` packages under `src/`.
- The two deployments talk over plain HTTP: Next.js reads `PYTHON_ENGINE_API_URL`
  and calls the FastAPI service directly, authenticated by a shared secret
  (`PYTHON_ENGINE_API_SECRET`, §3c) — every call site attaches it via
  `frontend/src/lib/pythonEngine.ts`.

## 2. Current feature: screenshot upload replacing Hemnet URL scraping

Automated Hemnet scraping became unreliable (Cloudflare). The primary property
entry flow is now:

```
screenshot(s) → OCR (Tesseract, deterministic) → regex field extraction
             → ManualEntryForm (user reviews/corrects) → existing analysis pipeline
```

- `ScreenshotUploadForm.tsx` → `POST /api/listing-screenshots/extract`
  (`frontend/src/app/api/listing-screenshots/extract/route.ts`) → Python
  `/api/ocr/extract-text` (`brf_scraper.extractor.ocr.ocr_image`, Tesseract
  `swe+eng`) → `screenshotExtract.ts` (pure regex, no AI vision) → pre-fills
  `ManualEntryForm`. **Nothing is persisted**: images are base64-relayed
  in-memory and never written to disk/storage (server-verified, not just
  client-claimed — the route has no storage bucket reference at all).
- Manual entry is a fully real fallback now (`page.tsx`'s `MANUAL_ENTRY_ENABLED`
  flag), not a disabled placeholder. Required-field validation exists **both**
  client-side (`ManualEntryForm.tsx`) and server-side
  (`pipeline.ts:missingEssentialFields`, called from `api/analyses/route.ts`
  before quota is touched) — address, asking price, living area always;
  monthly fee only for apartment tenures (`requiresMonthlyFee`).
- BRF annual reports now support PDF (incl. scanned/OCR'd), DOCX, and images,
  all funneled into the same `PDFDocument` shape so every downstream extractor
  (financial/property/loan parsing, validation) is unchanged
  (`BRF-Scraper/src/brf_scraper/extractor/{pdf_reader,docx_reader,image_reader,engine}.py`).
  BRF reports **are** legitimately stored (Supabase Storage, dedup'd by
  content hash) — this is intentionally different from listing screenshots.
- OCR engine choice: Tesseract via `pytesseract`, replacing a previously
  planned PaddleOCR integration — deterministic, no AI vision API, matches the
  product's evidence-based/traceable design principle (`BLUEPRINT.md`).

### 2a. Screenshot field-extraction accuracy (`screenshotExtract.ts`) — hardened, not rewritten

Fixes, in the order found (all regex-only, no AI vision, per this
project's evidence-based design principle):

- **Address**: recognizes a bare street-name line (Swedish suffixes
  `-vägen`/`-gatan`/`-gränd`/…) combined with a following "…kommun" line —
  handles a listing showing no house number at all.
- **askingPrice**: a bare "Pris" is never trusted as a label (it matches
  inside `Pris/m²`, `Prisidé`, `Prisutveckling`); only `Utgångspris`/
  `Slutpris` are. Otherwise resolved **by position**, not by pattern-matching
  the separator: the real price is the largest `N kr` figure appearing
  *before* the "Om bostaden"/`Boarea`/`Antal rum` detail table starts —
  `Pris/m²` lives inside that table, so it's excluded structurally. This
  replaced two earlier rounds that tried to exclude `Pris/m²` by its `/m²`
  suffix, which OCR renders too inconsistently (`kr/m²`, `kr per m²`, bare
  `kr m²`) to pattern-match reliably. **Last-resort fallback**: if no
  `kr`-priced figure is found at all (e.g. the price heading's own "kr"
  didn't survive OCR next to a large bold font), derive it from
  `price/m² × boarea` — both already independently extracted from OCR.
- **livingArea (Boarea)**: was coming back empty because the superscript
  "2" in "m²" doesn't OCR reliably — neither `m²`/`m2`/`㎡` matched when
  Tesseract rendered it as a bare `m`. A bare `m` (guarded so it can never
  match the "m" inside `mån(ad)`/`mejla`/etc.) now also counts.
- `Boarea`/`Avgift`/`Driftskostnader` fall back to "the only candidate
  anywhere in the text" when a two-column table OCRs as all-labels-then-
  all-values — only when that field's own label appears somewhere, so
  `avgift`/`driftskostnader` (both `N kr/mån`) never borrow each other's
  figure.
- `Balkong`/`Hiss`/`Parkering` read Hemnet's amenity tags (`Ja` only — the
  tags never appear when false), with a negation guard for "ingen hiss".
- `Mäklarbyrå` matched against a list of known Swedish brokerage brands.

**Known limitation, not fixed**: `Mäklare` (broker's own name) is currently
empty on the real test listing. The heuristic (a bare two-Title-Case-word
line near "Mejla"/"Visa telefonnummer") first picked up the agency's own
mixed-case byline instead — excluding the known agency name fixed that
specific wrong answer, but the broker's real name still isn't found, for a
reason not yet diagnosed. `Skick` and `Beskrivning` are not attempted at
all — a subjective rating and a free-text paragraph, neither has a
reliable regex boundary in OCR'd text.

**No ground-truth OCR text was available while debugging this** — every
fix above is based on the real page layout (reference screenshots) plus
inference from which fields worked across iterations, not the literal
Tesseract output. A **temporary debug panel** now closes this gap for next
time: after extracting, a collapsed "Visa rå OCR-text (tillfälligt, för
felsökning)" section on the review page shows the raw per-image OCR text
(`extract/route.ts` now also returns `texts`, rendered in
`ScreenshotUploadForm.tsx`). **Remove once extraction is no longer being
actively tuned against real screenshots.**

**Tests**: `screenshotExtract.verify.mjs` grew from 21 to 56 checks across
this work, including a full reconstruction of the real listing (using the
degraded `"119 m"` form to match the actual failure mode) and isolated
regressions for each bug fixed. All 56 pass; `tsc --noEmit` clean.

**Also this session, unrelated small UX fixes**: removed placeholder
example text from every free-text/number field in `ManualEntryForm` (was
being mistaken for real extracted values, twice); added a hint under
`Utgångspris` clarifying it's the total price, not price per m²; disabled
the browser's scroll-position restore on reload (`ScrollRestorationReset.tsx`)
so a refresh always starts at the top.

## 3. Security fixes this session

### 3a. Profile quota fields (`free_analyses_remaining` etc.) — already fixed, verified sound

`supabase/migrations/20260917000000_fix_profiles_update_policy.sql` (present
before this session started) drops the old owner-UPDATE RLS policy on
`profiles` and revokes base UPDATE from `authenticated`/`anon`. Reviewed the
whole quota/entitlement call chain end-to-end
(`ownership.ts`/`access.ts`/`requireUser.ts`/`analyses/route.ts`/webhook
handlers) — every write to `profiles`, `analyses`, `properties`, and
`analysis_requests` goes through the service-role client from a server-side
route; none of these tables grant `anon`/`authenticated` anything. This part
of the system is sound.

### 3b. NEW finding (critical) — quota/campaign RPCs were callable directly, bypassing the app entirely

`consume_analysis_quota`, `refund_analysis_quota`, and the First 100 campaign
functions (`redeem_discount_code`, `attach_discount_code_session`,
`release_discount_code`, `finalize_discount_code`, `mark_campaign_popup_shown`,
`generate_discount_code`) are `SECURITY DEFINER` and were only ever `GRANT`ed
to `service_role` — but Postgres auto-grants `EXECUTE` on every new function
to `PUBLIC` by default (unlike tables, which grant nothing by default), and no
migration ever revoked it. `anon`/`authenticated` are members of `PUBLIC`, so
both were reachable directly via `POST /rest/v1/rpc/<fn>` — the same class of
bug §3a already fixed for the `profiles` table, one layer deeper.

Worst case: `refund_analysis_quota(p_user_id, p_type)` takes a caller-supplied
user id with **no ownership check** (by design — it's meant to run only as
service_role) and unconditionally `+1`s that bucket. Any signed-in user could
have called it directly, repeatedly, with their own `auth.uid()` to mint
unlimited Free/Premium analyses, or with any other user's id to grief their
quota.

**Fix**: `supabase/migrations/20260917010000_revoke_public_execute_on_security_definer_rpcs.sql`
— revokes `EXECUTE` from `public`/`anon`/`authenticated` on all of the above,
plus `alter default privileges ... revoke execute on functions from public`
so a future migration that adds a new RPC and forgets this doesn't reopen the
same gap.

**Verification status**: confirmed by static analysis (grep across every
migration's `grant`/`revoke` statements — no revoke existed for any of these
functions) and by the well-documented, version-stable Postgres default-grant
behavior (official Postgres `GRANT` docs: "the right to execute a function
... is granted to PUBLIC by default when the function is created"; Supabase's
own docs warn about this exact footgun for RPC functions). **Now also
verified live (third session)** — Docker came up this session (see §4/G6),
`supabase start` + `supabase db reset` ran the full local stack against
every migration through `20260917010000`, and a live adversarial script hit
every function directly over `POST /rest/v1/rpc/<fn>` through the real Kong
gateway/PostgREST, using two real signed-up auth users (not mocks):

- Attacker (authenticated, own valid JWT) tried: `refund_analysis_quota` on
  their own `free` bucket, their own `premium` bucket, and victim user B's
  `free` bucket; `consume_analysis_quota` directly; `generate_discount_code`;
  `mark_campaign_popup_shown`. **All six rejected** — Postgres `42501
  permission denied for function <name>`, surfaced by PostgREST as HTTP 403.
- Same `refund_analysis_quota` attempt fully anonymous (no login, anon key
  only) — **rejected**, HTTP 401, same `42501` underneath.
- Bonus regression check on §3a: attacker `PATCH`ed their own `profiles` row
  (`premium_analyses_remaining: 999`) directly — **rejected**, HTTP 403
  `42501 permission denied for table profiles` (RLS/grant fix from
  `20260917000000` still holds).
- Read both users' `free_analyses_remaining`/`premium_analyses_remaining`
  before and after all eight attempts via the service-role key — **byte-for-
  byte unchanged**, confirming the rejections weren't just wrong status codes
  papering over a partial write.
- **Control** (must keep working, or the fix would have been too strong):
  called `refund_analysis_quota` as `service_role` (the identity the app's
  own server routes use) — succeeded, HTTP 200, and the target user's
  `free_analyses_remaining` actually incremented by 1. The legitimate path is
  intact.

11/11 checks passed. This is the live reproduction the second session
flagged as the one remaining gap — finding fully closed now, not just
reasoned through. Script lived in this session's scratchpad (not committed —
throwaway/local-only, same treatment as the prior session's
`rpc_grant_test.sql`; needs a running local Supabase to execute, so it isn't
a natural fit for the existing CI-less pytest suites without more design
work than this verification pass called for).

One environment note for whoever runs this next: the *first* attempt at this
reproduction gave misleading mixed results (two functions 404 "not found",
two others callable by the attacker) — not a real regression, but a stale
local Postgres volume that pre-dated the last five migrations (only had
`schema_migrations` through `20260814000000`). `supabase start` does **not**
retroactively apply new migrations to an already-initialized volume by
itself in every case — check `select version from
supabase_migrations.schema_migrations order by version` (via `docker exec -i
<db container> psql -U postgres -d postgres -c "..."`) before trusting a
"local Supabase" result, or just run `supabase db reset` unconditionally
first, since it's a disposable local dev database.

### 3c. Python engine had no authentication — FIXED this session

`api/server.py` had zero auth/API-key/CORS middleware on any endpoint
(verified: no `Depends`, `HTTPBearer`, `APIKeyHeader`, or CORS middleware
anywhere in the file). Every protection (login, rate limiting, essential-field
validation, quota) lived only in the Next.js layer. If the Railway URL was
discoverable, anyone could call `/api/ocr/extract-text`, `/api/browser-fetch`
(spins up a real Firefox/Camoufox instance per call), `/api/analyze`, etc.
directly — unlimited, free, bypassing Next.js entirely. This didn't let an
attacker forge *their own* premium analyses inside the app's database (the
quota bookkeeping lives in Supabase, untouched by this path), but it was a
real cost-abuse / infrastructure-DoS vector.

**Fix**: `require_internal_secret`, an `@app.middleware("http")` hook in
`api/server.py`, rejects every request except `GET /` (the static demo page,
which also doubles as Railway's health check — never gated) unless it carries
a header (`X-Internal-Secret`) matching the `PYTHON_ENGINE_API_SECRET` env
var, compared with `hmac.compare_digest` (timing-safe). Fails closed: if the
env var itself is unset on the Python side, every protected request gets 500,
never silently passed through. Implemented as middleware rather than a
per-route dependency so a future endpoint is protected the moment it's added.

On the Next.js side, `frontend/src/lib/pythonEngine.ts` (`pythonEngineHeaders()`)
is the one place that reads `PYTHON_ENGINE_API_SECRET` and attaches the
header — a server-only env var (never `NEXT_PUBLIC_`), guarded by the same
`typeof window !== "undefined"` check `lib/supabase/admin.ts` already uses for
the Supabase service-role key. All 8 call sites that reach
`PYTHON_ENGINE_API_URL` were switched from a bare
`{ "Content-Type": "application/json" }` to this helper: the two API routes
(`api/listing-screenshots/extract`, `api/properties/[id]/brf-report`) and six
providers (`hemnetPage.ts`'s browser-bridge escalation, `brfAcquisition`,
`brfFinancials`, `brokerDocuments`, `locationIntelligence`,
`marketIntelligence`). If the secret isn't configured on the Next.js side, the
header is simply omitted — the Python engine then returns 401, which every
existing caller already handles the same way it handles any other backend
failure (degrading to that provider's `error`/`not_connected` status, never
crashing the pipeline).

**Verification**: `api/tests/test_internal_auth.py` — 33 tests against the
real `app` object via FastAPI's `TestClient`, parametrized over all 10
protected endpoints (`browser-fetch`, `resolve`, `analyze`,
`brf-annual-report`, `brf-annual-report/upload`, `ocr/extract-text`,
`broker-documents`, `brf-financials`, `location-intelligence`,
`market-intelligence`): missing header → 401, wrong header → 401, secret
unconfigured on the server → 500 (fail closed), correct header → reaches the
real handler, `/` stays public with no header at all, and a same-length wrong
secret is still rejected (guards against a future accidental swap of
`hmac.compare_digest` for `==`). **PASS — 33/33**, actually run (`pytest
api/tests/test_internal_auth.py`), not inferred from code review.

### 3d. NEW finding (low, fixed) — manual-entry numeric fields had no sanity bounds server-side

`missingEssentialFields` only checked "is this a finite number", not "is this
a plausible price/area/fee" — the frontend's `min="0"` is a UI-only
constraint, trivially skipped by posting directly to `/api/analyses`.
Tightened to require positive, plausible-range values (same bounds
`screenshotExtract.ts` already used: price ≤ 200M SEK, area ≤ 2000 m², fee ≤
100k SEK/month) in `frontend/src/lib/analysis/pipeline.ts`.

### 3e. `SEND_EMAIL_HOOK_SECRET` — investigated, no exposure found in this repo

Searched full git history (`git log --all -S"whsec_"`, `git grep` across
every commit) and the current tree: the real secret value exists only in the
gitignored, untracked `frontend/.env.local` (confirmed never committed, no
history for that path at all). The only tracked references to the secret's
*name*/format are `.env.example` (empty placeholder) and
`verifyWebhookSignature.ts` (HMAC verification code, no hardcoded value, no
logging of the secret). **Could not find or rule out** an exposure through a
channel outside this repo (this session has no record of the earlier report
that prompted the investigation). Recommend rotating it anyway — cheap,
low-risk, and this class of secret (Supabase Auth Hook signing key) being
briefly exposed lets an attacker forge the `send-email` webhook and trigger
arbitrary "confirmation" emails to arbitrary addresses with an
attacker-chosen `token_hash`/`redirect_to`.

### 3f. Admin/debug surface — checked, no issues

`isDevAdmin()` (`lib/auth/devAdmin.ts`) is hard-gated on
`NODE_ENV === "development"`, never true in a Vercel production build. No
other admin/debug HTTP routes existed at the time of this check (the admin
portal added on 2026-09-28 is documented separately in §3g). Stripe webhook
verifies signatures correctly (`stripe.webhooks.constructEvent`). No
`.update`/`.upsert` on `profiles` anywhere outside the service-role admin
client.

### 3g. Admin portal (`admin.kopanalys.se`) — login + embedded map demo

Added 2026-09-28. `admin.kopanalys.se` shows a login box; after login it shows
the KopanalysMapDemo "Atlas" map workspace (github.com/intothenether/KopanalysMapDemo,
ported into `frontend/src/components/admin/atlas/`, differences listed in that
file's header comment). Everything lives under `frontend/src/lib/admin/`,
`src/components/admin/`, `src/pages/` and `src/app/api/admin-portal/`.

- **Routing.** `proxy.ts` runs `lib/admin/adminProxy.ts` first. On the admin
  host `/` is rewritten to `src/pages/admin-portal`; only
  `/api/admin-portal/{login,logout}` and Next internals stay reachable — every
  other site page/API answers 404 there, and the Supabase `updateSession`
  never runs. On every other host the portal page, its `_next/data` route and
  its API answer 404. Hosts: `admin.kopanalys.se` and (dev) `admin.localhost`
  — `lib/admin/host.ts`. **Run locally:** `npm run dev` in `frontend/`, then
  open `http://admin.localhost:3001` (Chromium/Firefox resolve `*.localhost`
  to loopback — no hosts-file edit; the portal needs no Supabase env vars).
  Dev uses an ephemeral session key, so restarting the dev server signs you out.
- **Why the Pages Router.** `app/layout.tsx` wraps every App Router page in
  Tailwind + the marketing chrome (footer, cookie banner, chat widget, Supabase
  provider); a route can only escape it by moving *all* site routes into a
  route group and enabling the experimental `globalNotFound` flag for a 404
  page. A `pages/` route sits outside that layout with no change to the site's
  route tree (verified: `next build` route table for `app` is unchanged, `/`
  still prerenders, the site's own 404 still renders inside its layout).
  **Side effect:** with a `pages/` dir Next adds
  `next/navigation-types/compat/navigation` to `next-env.d.ts`, which makes
  `useSearchParams()/usePathname()/useParams()` typed as nullable project-wide.
  Three existing pages (`analyzing`, `buy`, `dashboard/inspection`) got
  `searchParams?.get(...) ?? null` — type-only, no runtime change. New code that
  uses those hooks needs the same null handling.
- **Credentials.** Username `admin`. The password is stored **only as a scrypt
  hash** (N=2^16, r=8, p=2, random salt; `lib/admin/password.ts`) — built into
  `lib/admin/credentials.ts`, overridable with `ADMIN_PASSWORD_HASH`; create a
  hash with `npm run admin:hash`. The plaintext is not in any file. Login
  always verifies the password even for a wrong username (no timing/enumeration
  signal), compares in constant time, and caps concurrent scrypt runs per
  instance (memory).
- **Session.** Stateless signed cookie (`lib/admin/session.ts`): HMAC-SHA256,
  8 h, `HttpOnly; Secure; SameSite=Strict; Path=/`, `__Host-` prefixed on https
  (host-only — never sent to `kopanalys.se`). The signature covers a
  fingerprint of the password hash, so **changing the password signs every
  session out**. Key = `ADMIN_SESSION_SECRET`, else derived (HKDF) from
  `SUPABASE_SERVICE_ROLE_KEY`; with neither, production login is disabled
  (fails closed, verified). No server-side revocation: logout clears the cookie
  only, a copied cookie stays valid until expiry.
- **Abuse limits.** 5 failed logins / 15 min per client → 429 with
  `Retry-After` (`lib/admin/loginThrottle.ts`), checked *before* hashing.
  In-memory and per serverless instance — same caveat as `lib/rateLimit.ts`;
  add a Vercel Firewall rate-limit rule on `POST /api/admin-portal/login` for a
  shared limit. POSTs must be same-origin (Origin + Sec-Fetch-Site) and JSON.
- **Headers (admin host only, `next.config.ts`).** Strict CSP in production
  (`script-src 'self'` — verified it blocks injected inline script and inline
  handlers; allows https images, Nominatim, inline styles), `geolocation=(self)`
  for the map's "use my location" (the site-wide policy blocks it), noindex,
  COOP; login/page responses `no-store`.
- **The demo's own "Logga in med BankID" button is a client-side mock** (it flips
  a localStorage flag) and has nothing to do with the admin login. Its data
  lives in `localStorage` of the `admin.kopanalys.se` origin, nothing is
  sent to a server. The port HTML-escapes user/geocoder text and restricts
  link/image URLs (the original interpolated them raw into `innerHTML`).
- **Known weakness — by request, not by design.** The account uses the
  password `[redacted]`, which is in every common-password list: anyone who
  finds `admin.kopanalys.se` can log in on the first try, and the hash (built
  into the code, so visible to anyone with repo access) offers no protection
  because it can be dictionary-attacked offline in seconds. Hashing/lockouts
  only help against leaks and guessing, not against a known-weak password.
  Rotate it: `npm run admin:hash` → set `ADMIN_PASSWORD_HASH` in Vercel.
- **Tests.** `npx tsx src/lib/admin/admin.verify.mjs` (70 checks: hashing,
  sessions, throttle, host routing, login/logout handlers; generated
  passwords only). Manually verified on `next dev` and on a production
  `next build` + `next start` at `http://admin.localhost:3001`: login, wrong
  password, lockout, fail-closed, session persistence, sign-out, headers/CSP,
  main-host 404s, desktop + mobile layout, every demo feature. **Not yet
  verified on Vercel** (needs the domain below).

## 4. Known gaps / next steps

- **G1** (RESOLVED, second session): Python engine had no auth — fixed, see
  §3c. Remaining action item: **set `PYTHON_ENGINE_API_SECRET` to the same
  value on both the Vercel and Railway projects before deploying this
  branch** — until both sides have it, every Python-engine call will 401
  (Next.js side unset) or every request will 500 (Railway side unset).
  Generate it with e.g. `openssl rand -hex 32`; there's no default and none
  is committed anywhere.
- **G2**: `SEND_EMAIL_HOOK_SECRET` rotation (§3e) — recommended precaution,
  needs the value changed in Supabase Auth Hooks config *and* the app's env
  vars simultaneously (rotating one without the other breaks signup emails).
- **G3**: Rate limiting (`lib/rateLimit.ts`) is in-memory per serverless
  instance, not distributed — documented as an accepted trade-off in the file
  itself; upgrade to Vercel KV/Upstash if abuse is observed.
- **G4**: Frontend has no working ESLint config (`eslint.config.js` missing;
  `eslint.config.*` — pre-existing on `main`, not introduced this session;
  `npm run lint` fails immediately with a config-not-found error).
- **G5**: `frontend/src/lib/analysis/listing/hemnetPage.verify.mjs` has one
  pre-existing failing check ("fireplace"/unmapped-amenity feature dedup) —
  present on `main` before this session, unrelated to the OCR/security work.
- **G7** (sixth session, open): `Mäklare` (broker's own name) extraction —
  see §2a. Needs the raw-OCR debug panel's actual output from a real
  listing to diagnose properly; not fixed, out of scope for that session.
- **G8** (seventh session, open): real Booli API credentials
  (`BOOLI_CALLER_ID`/`BOOLI_API_KEY`) are not configured anywhere in this
  environment, and Booli's self-serve signup for new keys appears closed —
  see `docs/46_price_and_civic_data_source_research.md`. Comparable-sold-
  property data in Price Analysis stays incomplete until this is resolved
  (a business/credentials decision) or an alternative (Svensk
  Mäklarstatistik) is contracted.
- **G9** (seventh session, open): `Mäklare` extraction (G7) is now joined
  by a second open PDF item — the bottom "Ladda ner PDF" button added this
  session was not verified with an actual live-rendered PDF (would have
  needed a synthetic auth+analysis fixture; the existing top button's
  identical mechanism was already confirmed working by code review).
  Recommend one manual click-through before relying on it.
- **G6 (RESOLVED, third session)**: Docker Desktop would not start in the
  first session (WSL2 VM stayed "Stopped") and crashed with a popup on
  launch in the second and third. This session got an actual screenshot of
  the error (previous sessions correctly declined to guess without one) and
  diagnosed it precisely instead of dismissing it: Docker's **Inference
  Manager** (its AI/model-runner subsystem — unrelated to normal containers)
  failed during startup trying to delete-and-recreate a Unix-domain-socket
  file at `%LOCALAPPDATA%\Docker\run\dockerInference`, hitting Windows error
  123 (`ERROR_INVALID_NAME`, ie. "Incorrect syntax for file name..."). The
  file was a stale, 0-byte `ReparsePoint` last touched over a month earlier,
  orphaned from a prior crash; no Docker process held it. This crashed the
  *entire* app, not just the AI feature. Fix: delete that one file (the user
  did this, not this agent — the harness's own auto-mode classifier flagged
  the deletion as irreversible-local-destruction and declined to do it
  automatically, correctly given it's outside the repo) and relaunch — no
  "Reset to factory defaults" needed, no data lost, sibling runtime sockets
  in the same folder are recreated by Docker on every clean start anyway.
  Both blocked verifications are now done:
  - **Tesseract + Swedish OCR in the production container**: built the image
    (`docker build -t kopanalys-engine:verify .`, ~81s, 1.2GB content) —
    clean build, no errors. Inside it: `tesseract --version` → 5.5.0;
    `tesseract --list-langs` → `eng`, `osd`, `swe` all present, exactly as
    the `Dockerfile`'s `apt-get install` line promises. Ran
    `BRF-Scraper/tests/unit/test_ocr_extraction.py` for real inside a
    container from that image (`pytest`/`pytest-asyncio`/`pytest-mock`
    installed ad hoc into the running container only — never added to the
    shipped image/Dockerfile, since these are dev-only tools with no
    business in a production image) — **5/5 passed**, including
    `test_extracts_recognizable_swedish_text`, the one that was structurally
    unable to run on native Windows (no `tesseract` on PATH there, by
    design/skip). This is the first time this exact test has ever run
    against the real production image.
  - **Live RPC-grant reproduction (§3b)**: done, see §3b for the full
    breakdown — 11/11 checks passed against a real local Postgres/PostgREST
    stack with real signed-up users, not a static-analysis inference.
  - **Git-Bash-on-Windows gotcha worth keeping**: running `docker run` from
    this repo's Git Bash mangles any POSIX-looking path in the command (e.g.
    `-e PYTHONPATH=/app/BRF-Scraper/src`, or even a relative test path like
    `BRF-Scraper/tests/...`) into a Windows path before Docker ever sees it,
    producing confusing `ModuleNotFoundError`s that look like real app bugs
    but aren't. Fix: prefix the command with `MSYS_NO_PATHCONV=1`. Cost about
    20 minutes of misdiagnosis this session before the pattern was clear —
    worth remembering for next time rather than re-discovering it.
  - Repo-side readiness that was already re-checked pre-Docker two sessions
    running remains accurate and unchanged: `Dockerfile` installs
    `tesseract-ocr`, `tesseract-ocr-swe`, `tesseract-ocr-eng`,
    `fonts-dejavu-core`; `api/requirements.txt` has `pytesseract`, `pillow`,
    `python-docx`; the internal-auth middleware added no new dependency and
    doesn't touch the Docker build steps.

- **G10** (eighth session, open — found incidentally while fact-checking
  FAQ copy against the account/credit system, not itself a FAQ-scope fix;
  flagging for engineering attention): the Premium/Ultra **subscription**
  plans (`app/dashboard/subscriptions/page.tsx`'s "15 Premium Decision
  Analyses/månad" / "30 ... /månad" copy) do not appear to actually grant
  `premium_analyses_remaining` anywhere in the codebase. In
  `lib/stripe/webhooks.ts`, `handleCheckoutSessionCompleted`'s
  `mode === "subscription"` branch and both
  `handleSubscriptionCreatedOrUpdated` and `handleInvoicePaid` only write
  `subscription_status`/`subscription_tier`/period dates to `profiles` —
  the *only* place `premium_analyses_remaining` is incremented anywhere in
  `frontend/src` is the one-time `premium_analysis` purchase branch of
  `handleCheckoutSessionCompleted` (adds exactly 1). No cron/Edge
  Function/scheduled route exists to top it up either (`supabase/functions`
  is empty; no `vercel.json` crons in the repo). `consume_analysis_quota`
  (the RPC gating every analysis request, `supabase/migrations/20260722000100_quotas.sql`)
  is a plain counter decrement with no subscription-tier awareness at all.
  **Net effect, strongly indicated by a full-repo search but not verified
  end-to-end against a real Stripe subscription**: subscribing may
  currently buy `subscription_status`/billing-portal access without
  actually increasing the buyer's usable analysis balance. This session's
  FAQ rewrite deliberately avoids asserting specific subscription-renewal
  numbers or mechanics (it points to the dashboard instead) so as not to
  promise something that may not hold — but the underlying gap is a
  product/billing issue independent of the FAQ, worth an engineering look,
  since a real customer could be paying monthly for credits they never
  receive.

- **G10** (ninth session, DONE 2026-10-02): production rollout — migrations applied by the user via
  the SQL Editor (verified read-only), Stripe Prices + Vercel env set by the user, `main` pushed and
  deployed (Vercel live, Railway SUCCESS). Still open: the logged-in checks (real checkout, `/admin/brf`
  as reviewer, upload + publish + emails, PDF) and recording the 3 migrations in the CLI history
  (`supabase migration repair`) before any `supabase db push`. Details in docs/48.
- **G11** (ninth session, open): the BRF 24-hour promise depends on people watching `/admin/brf`; no
  escalation for late reviews; after deploy every legacy customer who opens an old report opens a
  review (expect a burst of team emails). The chapter promises the team obtains the annual report.
- **G12** (ninth session, open): fake social proof ("4.8/5 baserat på 256 omdömen") still on the
  landing page — user will replace it next week.
- **G13** (ninth session, open): new accounts get 0 credits — decide how the jury tries the product.
- **G14** (ninth session, open): privacy policy text about OpenAI/uploaded documents is inaccurate and
  doesn't mention human review — legal read.
- **G15** (ninth session, open): Boendekalkyl is a placeholder; groundwork in `lib/report/housingCost.ts`
  (verified 2026 cost rules); flip `HOUSING_COST_LIVE` in `lib/packages.ts` when it ships.
- **G16** (ninth session, open): `parseBotCoverage.verify.ts` can't run since `pipeline.ts` uses
  `after()` (needs a request scope); the automatic `brfFinancials` provider still runs but nothing
  customer-facing reads it; hero image shows baked-in price tags; local bucket config allows PDF only.
  Full list: docs/48 "Flags".

## 5. Tests / verification status

PASS = actually run and green. FAIL = actually run and red. BLOCKED = not run.

| Area | Result | Notes |
|---|---|---|
| Python unit tests (`BRF-Scraper`, full suite) | **PASS** | 426 passed, 5 skipped — re-run seventh session after removing `broker_discovery`, unchanged baseline |
| New OCR tests (`test_ocr_extraction.py`) natively on Windows | **BLOCKED** | Skips itself (no `tesseract` binary on this host's PATH) — by design |
| New OCR tests inside the production Docker image | **PASS** (third session) | 5/5, real container from `kopanalys-engine:verify`, incl. the Swedish-text test — see §4/G6 |
| TypeScript (`tsc --noEmit`) | **PASS** | Re-run seventh session after the price/civic-data + broker-docs-removal changes — exit 0, no errors |
| ESLint | **BLOCKED** | Pre-existing repo config gap (G4), unrelated to this branch |
| Screenshot field extraction (`screenshotExtract.verify.mjs`) | **PASS** (sixth session) | 56/56 checks, up from 20 — see §2a |
| Analysis engine analyzers + report builder (7 analyzer + 2 report verify scripts) | **PASS** (re-run seventh session) | All green under `npx tsx`, including `build.objectivity.verify.mjs` |
| `market_intelligence` Python suite | **PASS** (seventh session) | 234/234, incl. a new regression test locking in the SCB Region-dimension fix (see Seventh session note above) |
| `location_intelligence` Python suite | **PASS** (seventh session) | 164 passed, 1 deselected |
| `api/tests/test_internal_auth.py` | **PASS** (seventh session) | 30/30 (down from 33 — 3 parametrizations removed with the deleted `/api/broker-documents` endpoint); `server.py` re-confirmed importable with zero "broker" routes left |
| Ninth session: TS + verify scripts + build | **PASS** | `tsc` clean, `npm run build` green, 18/20 verify scripts green (new: `lib/brf/interpret.verify.mjs`, `lib/report/housingCost.verify.mjs`; rewritten analyzer/report/redact scripts); the 2 red are pre-existing (G5, G16) |
| Ninth session: Python | **PASS** | BRF-Scraper 31 passed + 5 OCR skips (15 new key-figure tests incl. real 2024 PDFs), `api/tests` 25, `analysis_engine` 79 |
| Ninth session: local end to end | **PASS** | purchase → review opened → upload real PDF → console prefill → publish → reviewed chapter; Områdesanalys; villa without BRF chapter; desktop + mobile. PDF download not verified (see docs/48) |
| Hemnet extraction (`listing/hemnetPage.verify.mjs`) | **FAIL (pre-existing)** | 1/10 checks red on unmodified `main` code (G5) |
| RLS/RPC bypass — profiles quota fields | **PASS** | Verified via migration/grant audit second session; **live-reproduced too, third session** (attacker `PATCH` on own `profiles` row rejected, see §3b) |
| RLS/RPC bypass — quota RPCs (§3b) | **PASS** (third session) | 11/11, live adversarial test against real local Supabase/PostgREST — all attacker paths rejected (`42501`), state unchanged, legitimate `service_role` path still works |
| Railway/FastAPI internal-secret auth (§3c) | **PASS** | 33/33, `pytest api/tests/test_internal_auth.py` — valid/missing/invalid/unconfigured, all 10 protected endpoints + the public `/`. Re-run third session on the unchanged code, still 33/33; env var naming re-verified identical end to end (`PYTHON_ENGINE_API_SECRET` in `api/server.py`'s `INTERNAL_SECRET_ENV_VAR`, `frontend/.env.example`, and `frontend/src/lib/pythonEngine.ts`, with no default/fallback value anywhere) |
| Docker: Tesseract + Swedish language pack in production image | **PASS** (third session) | `tesseract --version` → 5.5.0; `tesseract --list-langs` → `eng`, `osd`, `swe` all present |

## 6. Deployment requirements

- Env vars needed in production (Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SEND_EMAIL_HOOK_SECRET`, `STRIPE_*`, `RESEND_*`, `PYTHON_ENGINE_API_URL`
  (public Railway URL), `PYTHON_ENGINE_API_SECRET` (new, §3c — server-only,
  never `NEXT_PUBLIC_`), `OPENAI_API_KEY` (chat + inspection extraction).
- Env vars needed on Railway (the Python engine): `PYTHON_ENGINE_API_SECRET`
  — **must be the exact same value as Vercel's**, or every request from
  Next.js gets 401 (or 500 if Railway's side is simply unset). Nothing
  generates or ships a default value; no production secret has ever been
  generated, printed, or committed by any session's verification work.
  What's confirmed by code/tests (third session, still true): the variable
  name is spelled identically in all three places that matter
  (`api/server.py`'s `INTERNAL_SECRET_ENV_VAR`, `frontend/.env.example`,
  `frontend/src/lib/pythonEngine.ts`), there's no hardcoded fallback on
  either side, and the fail-closed behavior is exercised by 33 passing
  tests.
  - **Fourth session (pre-deployment audit) — live-checked, not assumed**:
    reported to this agent as "now configured on both Vercel and Railway
    with the same value." Verified independently instead of trusting that at
    face value (same discipline as the RPC live-test earlier — don't rely on
    a claim when a live check is possible and cheap). Initial result:
    **Railway did not have it.** `railway status` confirms the CLI is linked
    to the right project/service (`kopanalys-python-api`, project
    `aca1bd81-e437-472f-909b-477bf5ad4a95`, environment `production` — the
    same project ID the `restart-python-engine.yml` workflow already
    targets, so this is definitely the right service, not a lookup mistake).
    `railway variable list --service kopanalys-python-api --environment
    production --json` (values never printed/displayed — only key names
    were extracted, per this task's own "don't print a production secret"
    instruction) returns **11 variables, all Railway's own auto-injected
    `RAILWAY_*` ones — zero user-defined variables of any kind**, not just
    this one missing. Vercel's side could **not** be independently checked
    this session — the linked Vercel CLI session token is invalid
    (`vercel whoami` fails) and re-authenticating needs an interactive
    browser flow this non-interactive session can't run — so Vercel's status
    is unverified, not confirmed; given Railway's claim just turned out
    false, don't assume Vercel is fine without checking it directly
    (dashboard, or `vercel env ls` from a session with a valid login — that
    command lists names/environments without exposing values).
    One lead worth checking if this is puzzling: the Railway CLI in this
    environment is authenticated as `babynestmart@gmail.com`, not this
    project's usual `karollek98@gmail.com` — if the variable was actually
    set through a different Railway login/workspace, it's worth confirming
    it landed on this exact project/service/environment and not a
    similarly-named one elsewhere.
  - **Resolved, same session, minutes later**: user added the variable via
    Railway's own dashboard (they initially described it as "Vercel" but the
    screenshot was unambiguously Railway's UI — Deployments/Variables/
    Metrics/**Console**/Settings tabs and the "N variables added by Railway"
    label are Railway-specific; confirmed with the user, who agreed). Checked
    again immediately via the same CLI command (still names only, no values
    shown/logged): now **12 variables**, the new one being exactly
    `PYTHON_ENGINE_API_SECRET`. Railway's side is confirmed done.
  - **Vercel is still the open item** — unverified, not confirmed, for the
    reason above (no working CLI session here). **Do not push `main` until
    Vercel is independently confirmed too**, and until you've personally
    checked the value on Vercel is the exact same string as the one now on
    Railway (a mismatch fails identically to it being missing — 401, not an
    obvious "these don't match" error — and no agent session can compare two
    secret values without seeing them, which it shouldn't).
  - **Will pushing `main` trigger a deploy?** Almost certainly yes, on both
    sides, by default — checked for anything that would change that and
    found nothing: no `vercel.json`/`vercel.ts` in the repo (nothing
    overriding Vercel's default git-integration auto-deploy-on-push), and
    `railway.json` only sets build/restart policy, not a deploy trigger
    (that's a dashboard setting, invisible from the repo either way).
    `.vercel/project.json` (root and `frontend/`) confirms this repo is
    linked to Vercel project `real-estate`
    (`prj_n8HROlyCtZ28Tev94vHB8My98h5N`); `railway status` confirms the
    Railway service is connected to `karollek988/real-estate` and currently
    Online. The repo's one GitHub Actions workflow
    (`.github/workflows/restart-python-engine.yml`) only fires on a daily
    cron or manual dispatch, **not** on push, so it's not an extra trigger
    — but it's a real signal Railway auto-deploy is live for this project,
    since it exists specifically to work around Camoufox memory growth
    between deploys. Bottom line: treat `git push origin main` as
    equivalent to hitting "deploy" on both platforms, not just updating a
    remote branch.
  - No secrets found committed anywhere: re-scanned tracked files on `main`
    for live-looking key patterns (`sk_live_`, `AKIA...`, PEM private-key
    headers, `ghp_`/`github_pat_`, `whsec_...`) and for any `*_SECRET`/
    `*_KEY` assigned a real-looking literal — zero hits outside the
    self-labeled `"test-only-secret-not-a-real-credential"` in
    `api/tests/test_internal_auth.py`. Re-confirmed (§3e's original check,
    still true) no `.env`/`.env.local` was ever committed in the entire git
    history, not just the current tree.
- **Ninth session (branch `feature/trygghetspaket-business-model`)**: migrations
  `20261002000000`, `20261002000100`, `20261002000200` must be applied before that frontend deploys;
  new Vercel env `KOPANALYS_ADMIN_EMAILS`, `KOPANALYS_TEAM_EMAILS` (both optional with defaults, see
  `frontend/.env.example`); Stripe `STRIPE_PRICE_OMRADESANALYS/_TRYGGHETSPAKET/_TRE_BOSTADER`. The
  Python change (key figures in the upload response) is backwards compatible.
- Supabase migrations must be applied in order up through
  `20260917010000_revoke_public_execute_on_security_definer_rpcs.sql` before
  deploying this branch's frontend changes — the two are independent
  (frontend doesn't depend on the new migration to function), but the new
  migration is the actual security fix and should not be deferred.
- Docker image (`Dockerfile`) now also installs `fonts-dejavu-core` (a few
  hundred KB) so the OCR test suite has a real TrueType font to render
  against inside the container — small, low-risk addition.
- **Admin portal (`admin.kopanalys.se`, §3g) — manual steps, none of which the
  code can do for you:**
  1. Vercel → project `real-estate` → Settings → Domains → add
     `admin.kopanalys.se`, then create the DNS record Vercel shows (normally a
     CNAME `admin` → `cname.vercel-dns.com`; nothing to do if the domain's
     nameservers are already on Vercel). Until then the portal is unreachable.
  2. `ADMIN_SESSION_SECRET` (server-only, ≥ 32 random characters) on Vercel is
     recommended. If it's missing the session key is derived from
     `SUPABASE_SERVICE_ROLE_KEY` (already set), so login still works; only if
     *neither* exists is login disabled (503 "not configured").
  3. Optional but advisable: rotate the password (`npm run admin:hash`, set
     `ADMIN_PASSWORD_HASH`) — see the known weakness in §3g — and add a Vercel
     Firewall rate-limit rule for `POST /api/admin-portal/login`.
  4. Deploying changes `frontend/package.json`/lockfile (adds `leaflet`,
     `@types/leaflet`); the lockfile was patched by hand to avoid npm-on-Windows
     dropping the `libc` fields of the Linux native-binary entries, so if you
     re-run `npm install` locally, check `git diff package-lock.json` stays small.
