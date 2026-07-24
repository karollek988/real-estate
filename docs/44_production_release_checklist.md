# 44. Production Release Checklist — Köpanalys

**Date:** 2026-07-20. **Scope:** launch-readiness audit only — no architecture
changes. Every item below was verified against the current code (file/line
citations), not against design docs or PROJECT_STATUS.md narrative, which in
several places describes intent rather than what actually ships.

**Definition used:** a **BLOCKER** prevents a customer from successfully (and,
where the risk is a legal/security one that would take the product down or
expose customer data, *safely*) using the product. HIGH degrades quality or
trust without stopping use. MEDIUM is a real defect worth fixing before/soon
after launch. LOW is polish.

Audited by five parallel focused passes: (1) property identification /
Hemnet / Booli, (2) BRF lookup, (3) market + location intelligence, (4)
frontend PDF/errors/loading, (5) deployment/security/monitoring/performance.

---

## BLOCKERS

### B1. No authentication/authorization on any API route or the report page
**Why it blocks launch:** `frontend/src/app/api/analyses/route.ts`,
`[id]/route.ts`, `[id]/pdf/route.ts`, `properties/[id]/analyses/route.ts`,
and `frontend/src/app/report/page.tsx` (line 67-75) all use the
service-role Supabase client (bypasses RLS) with no session/auth check.
`report/page.tsx` fetches and renders any analysis by guessing/enumerating
`id` from the URL. Any customer's property/financial data is readable by
anyone with a URL — a real data-exposure incident on day one.
**Effort:** M. **Files:** the four API routes above, `report/page.tsx`,
new `frontend/src/middleware.ts`, reuse existing `lib/supabase/server.ts` +
the already-present `profiles` table/RLS pattern.
**Status:** ✅ **FIXED this pass** (user confirmed). Added
`frontend/src/lib/auth/requireUser.ts` (session check via the existing
session-aware `lib/supabase/server.ts` client) and called it first in all
four API routes; added `/report` to `PROTECTED_PREFIXES` in
`lib/supabase/middleware.ts` (same pattern already used for `/dashboard`).
The PDF route forwards the caller's session cookie to its internal
Puppeteer navigation via `page.setExtraHTTPHeaders`, since a headless
browser has no cookies of its own and would otherwise get redirected by
the same gate. Verified live against the running dev server: unauthenticated
`POST /api/analyses` → `401 {"error":{"code":"unauthorized",...}}`;
unauthenticated `GET /report?id=...` → `307` redirect to
`/?auth=required`. `npm run build`/`tsc --noEmit` both clean.
**Important scope note — not the same as full multi-tenancy:** `properties`
and `analyses` have no `user_id`/owner column at all (confirmed in
`supabase/migrations/20260716120000_properties_analyses.sql`) — every
logged-in user shares one global namespace today. This fix closes
"anonymous internet-wide access" (the literal B1 finding) but not
"customer A can see customer B's analysis" — that needs an ownership
column + RLS policy + dashboard query changes, tracked as a new HIGH item
below, not silently bundled into this fix.

### B2. No rate limiting on `POST /api/analyses`
**Why it blocks launch:** each call triggers up to 7 sequential external
API calls plus, if the FastAPI path is live, a headless-browser fetch
(`api/server.py`, Camoufox). Unlimited unauthenticated calls (compounds B1)
can exhaust Booli/Trafikverket quotas or run up cost with no throttle
anywhere in the request path.
**Effort:** M. **Files:** `frontend/src/app/api/analyses/route.ts`,
`api/server.py`.
**Status:** NOT fixed this pass.

### B3. Hemnet is actively scraped in the FastAPI path, contradicting the product's own ToS decision
**Why it blocks launch:** `docs/data-source-inventory.md` (entry 2) rules
Hemnet "unusable under any circumstance" — ToS bans scraping and ML/AI use.
`frontend/src/lib/analysis/listing/hemnet.ts` (top comment) correctly
claims the code "never fetches the page." But `api/server.py:122-148`
(`POST /api/resolve`) calls `ProfileEngine.build()` →
`BRF-Scraper/src/brf_scraper/profile/engine.py:182-189` (`_fetch_hemnet`)
→ `discovery/hemnet_provider.py:121-163`, which does a real HTTP GET with a
spoofed User-Agent and escalates to a full Camoufox browser fetch on a
403/429/503 bot-block specifically to defeat anti-scraping measures. If
this FastAPI service is reachable in production, every request is a real
ToS breach with takedown/IP-ban exposure that could stop the product
working for every customer, not just one.
**Effort:** L — this is a product decision, not a patch (see below).
**Files:** `api/server.py`, `BRF-Scraper/src/brf_scraper/discovery/hemnet_provider.py`,
`BRF-Scraper/src/brf_scraper/profile/engine.py`.
**Status:** NOT fixed this pass — flagged for a decision, not silently
disabled (removing a working fallback without sign-off is its own risk).

### B4. A second, independent Booli scraper bypasses bot protection — same risk as B3, plus ambiguous which pipeline is live
**Why it blocks launch:** `BRF-Scraper/src/brf_scraper/discovery/booli_provider.py`
scrapes Booli via Camoufox + JSON-LD parsing, while the Next.js pipeline
(`frontend/src/lib/analysis/providers/booli.ts`) uses Booli's official
signed Listing API v2 — the ToS-clean path. `docs/data-source-inventory.md`
also flags Booli's free tier as restricting commercial/competitive use. Two
parallel, contradictory data-acquisition strategies for the same source is
itself a launch risk: nobody can currently state with confidence which
pipeline production traffic goes through.
**Effort:** M. **Files:** `BRF-Scraper/src/brf_scraper/discovery/booli_provider.py`,
`api/server.py`.
**Status:** NOT fixed — tied to the same decision as B3.

### B5. BRF financial extraction was wired but never executed — every "annual report found" case still yielded 0% real financial data
**Why it blocks launch:** `ProfileEngine._fetch_allabrf` called
`AllabrfProvider.acquire(download=False, download_dir=None)`, and
`ProfileEngine.build()`'s Stage 5 only ran extraction
`if allabrf_acq.downloads:` — which was always empty because nothing was
ever downloaded. A real 30-listing test run
(`projects/real-estate/tests/coverage_results.json`) confirmed the
mechanism: annual-report documents were found for 16/30 (43%), yet
`fiscal_year`/`income_statement`/`balance_sheet`/`loans` were 0/30 (0%).
BRF financial data is core to the product's value proposition.
Additionally, the moment this gate opened, a guaranteed `NameError`
(`ExtractedValue` referenced but never imported in `engine.py`, in a
`dict.get()` default that Python evaluates eagerly) would have crashed
every profile build with any loan data — and a parallel, same-shaped bug
existed in `profile/merge.py:272` (`BRFFinancials` referenced, never
imported).
**Effort:** S. **Files:** `BRF-Scraper/src/brf_scraper/profile/engine.py`,
`BRF-Scraper/src/brf_scraper/profile/merge.py`.
**Status:** ✅ **FIXED this pass.** Changed the Stage-5 gate to check
`allabrf_acq.documents` (matching what `_extract_annual_reports` — which
re-downloads its own target PDF and never reads `.downloads` — actually
needs), removed the dead, crash-prone `ExtractedValue(...)` default in the
loan-mapping comprehension, and added the missing `BRFFinancials` import
to `merge.py`. Verified with `python -m py_compile` on both files.

### B6. `location_intelligence` and `market_intelligence` Python engines are not called anywhere in the live product
**Why it blocks launch:** grepping `frontend/src` and `api/` for either
package name returns zero hits. The live pipeline
(`frontend/src/lib/analysis/pipeline.ts`, `providers/registry.ts:25-34`)
uses a separate, smaller set of hand-written TypeScript providers. The MI
engine's own audit (`Market_Intelligence_Engine/AUDIT_SPRINT5.md:430-435`)
lists "Analysis Engine consuming MI+LI data" as future work, i.e.
self-documents that nothing downstream consumes it. Every "Wave 2
complete" / test-passing claim in PROJECT_STATUS.md is true only for the
Python package in isolation — a real customer today gets zero value from
either engine.
**Effort:** L. **Files:** need a bridge from `frontend/src/lib/analysis/pipeline.ts`
into `src/location_intelligence`/`src/market_intelligence` (likely a small
Python service the Next.js API calls, or a rewrite of the wanted providers
as TS), or a scope decision to exclude these from the launch surface.
**Status:** ✅ **Bridged this pass** (user confirmed: build it now).
Both packages are pure stdlib Python (confirmed via import grep — no
third-party dependencies), so `api/server.py` (the existing FastAPI
service, already used for BRF profile resolution) now also imports them
directly via a `sys.path` addition (same pattern the file already uses
for `analysis_engine`/`BRF-Scraper`) and exposes two new routes,
`POST /api/location-intelligence` and `POST /api/market-intelligence`,
each mirroring that package's own `__main__.py` CLI call chain
(`context → EngineConfig.from_env() → EngineRunner → PackageBuilder`) as
a sync route handler (FastAPI runs sync handlers in a threadpool, so the
up-to-45s worst-case provider deadline never blocks the event loop).
Verified live end-to-end through a `TestClient`, not just imports:
`location-intelligence` returned 10/12 real providers `ok` (66 findings,
real Nominatim/OSM/SCB/Kolada/Polisen/Bolagsverket/Skolverket/SVT data)
for a real Stockholm address; `market-intelligence` returned 5-6/9 real
providers `ok` for Stockholm municipality (see new MEDIUM item below on
the 3 that errored).

Two new frontend providers consume these routes and are registered in
`providers/registry.ts`:
- `providers/locationIntelligence.ts` — extracts
  `attributes.nearby_planned_projects` (a real array of named nearby
  construction/infrastructure/zoning items with distances) from whichever
  of the LI engine's three "nearby development" domains actually
  returned data, correctly distinguishing "checked, found none" (empty
  array, `status: "ok"`) from "couldn't check" (`status: "no_data"`, key
  left unset) by keying off each domain's always-present `_count_within_*m`
  finding rather than the conditionally-present `_nearest` one. Verified
  the exact real JSON shape (`domain`, `key`, `value[].name`,
  `value[].distance_m`) against a live response before writing the
  extraction, not just against the source.
- `providers/marketIntelligence.ts` — extracts only
  `municipal_economics.employment_rate`/`.municipal_tax_rate` for the
  property's own municipality (both already latest-period-only per
  finding, so no time-series logic needed) into
  `attributes.municipality_employment_rate_pct`/`_tax_rate_pct`. **Deliberately
  does not** attempt to turn the `housing_market` domain's multi-period
  house-price-index findings into `area_price_trend_pct`/
  `market_price_index_trend_pct` this pass — see the new MEDIUM item below
  for why that was judged too risky to rush.

`futureDevelopment.ts`'s analyzer was updated from its permanent
"scoring is not yet implemented" dead branch to real scoring: score is
50 + 4 points per nearby project (capped 0-100, a documented tunable
constant, same convention as `price.ts`), confidence 0.5. This is the one
analyzer connection made this pass — the other six analyzers' forward-
contract attributes are still unset by any live provider (unchanged from
before this pass, tracked under B8).

**New operational dependency, not previously true:** the frontend now
functionally depends on `api/server.py` being reachable at
`PYTHON_ENGINE_API_URL` (added to `.env.example`) for these two providers
to return real data — without it they correctly report `not_connected`
(never fake data), but this raises the stakes on the existing HIGH item
"no Dockerfile/CI for the frontend or `api/`," since deployment now needs
both processes running together, not just the Next.js app.

### B7. Area analyzer fabricated a "+0% price trend" that was never collected
**Why it blocks launch:** `frontend/src/lib/analysis/engine/analyzers/area.ts`'s
guard only skipped scoring when *both* `priceTrendPct` and
`populationGrowthPct` were null (AND). The live `scb.ts` provider sets
population growth whenever a municipality resolves, with no
price-trend provider wired anywhere. So in production the "insufficient
data" branch was skippable while price trend was still null, and the
scoring branch defaulted `trend = priceTrendPct ?? 0`, emitting the
sentence *"Area price trend is approximately +0% year over year"* with
`confidence: 0.7` — a specific, false, confident claim about data that
was never fetched. This directly violates the product's own stated
"never invent a judgment" principle (also documented, incorrectly, as
"not reachable" in the file's own comment).
**Effort:** S. **Files:** `frontend/src/lib/analysis/engine/analyzers/area.ts`.
**Status:** ✅ **FIXED this pass.** Rewrote the analyzer to score only from
whichever signal(s) are actually present (price trend weighted 0.7,
population growth 0.3 when both exist; population growth alone when price
trend is absent), and to only claim what was actually measured in the
explanation text. Verified with `tsc --noEmit` (clean).

### B8. Effectively all 7 substantive Decision Engine analyzers never produce a real score in production
**Why it blocks launch:** every analysis a real customer runs today lands
near the neutral prior (~50, "Requires a Closer Look"/"Caution Advised"),
regardless of the actual property, because no wired provider ever sets the
trigger attribute each analyzer needs:
- `market.ts`, `housingAssociation.ts`, `risk.ts`, `futureDevelopment.ts`,
  `negotiation.ts` each gate on an attribute
  (`market_price_index_trend_pct`, `brf_debt_per_m2_sek`,
  `environmental_risk_score`, `nearby_planned_projects`, `days_on_market`)
  that no registered provider sets — these are dead code today, not just
  "pending data."
- `price.ts` requires `area_median_price_per_m2_sek`; `scb.ts` explicitly
  documents it does not (cannot) supply this. No other provider does
  either.
- `area.ts` is now real for the signals it has (fixed in B7), but those
  signals (price trend, population growth) are only 2 of the 7 analyzers'
  total surface.
The core product — a differentiated score per property — is
indistinguishable from a fixed constant for every real customer.
**Effort:** L — needs genuine comparables/financial/crime/development data
sources per analyzer, not code wiring. This is the single largest
remaining item and should be sequenced as an ongoing series of
provider-by-provider sprints (the codebase's existing "forward contract"
pattern is the right shape for this — keep it), not one PR.
**Files:** `frontend/src/lib/analysis/engine/analyzers/*.ts` and whichever
new providers each needs.
**Status:** NOT fixed this pass beyond B7 (partial).

### B9. PDF report quality: wrong visual state captured, wrong layout, and missing data mislabeled as a real finding
Three compounding issues in the same feature:
- **B9a — captured mid-animation.** `api/analyses/[id]/pdf/route.ts` took
  the PDF snapshot immediately on `networkidle0`, before the report page's
  CSS entrance animations (score-ring draw ~1.35s, section fades ~1.1s)
  finished — the headline Decision Score ring was very likely still
  drawing in the exported PDF.
  **Effort:** S. **Status:** ✅ **FIXED this pass** — injected a style tag
  forcing all animation/transition durations and delays to `0s` right
  before `page.pdf()`, so the snapshot always captures the settled end
  state regardless of timing.
- **B9b — PDF is a screenshot of the dark dashboard UI, not the documented
  print layout.** `docs/report-pdf-layout-blueprint.md` specifies a white
  A4 document with running headers, footnoted sources, and page-break
  control; the actual output is a Puppeteer print of the live dark
  glassmorphism `report/page.tsx` with zero `@media print`/`@page`/
  `page-break` CSS anywhere in the codebase — cards will split mid-page on
  an arbitrary-height flex column.
  **Effort:** L — this is the acknowledged blueprint-vs-reality gap, not a
  quick fix. **Status:** NOT fixed this pass; needs a real print
  stylesheet or a separate print-only route.
- **B9c — missing data renders identically to a real negative finding.**
  `buildAnalysis.ts` computes `pending: factor.score === null`, but
  `report/page.tsx`'s render loop never reads `pending` — every "no data"
  and every "we checked and it's bad" factor shows the same amber chip.
  The report's own footer promises factors "marked 'Pending data'" — that
  marking doesn't exist in the code that ships. This is materially
  misleading in a paid PDF a customer bases a purchase decision on.
  **Effort:** S. **Files:** `frontend/src/lib/analysis/engine/buildAnalysis.ts`,
  `frontend/src/app/report/page.tsx` (render loop + `TONE_STYLES`).
  **Status:** NOT fixed this pass.

### B10. The frontend source tree is not committed to git
**Why it blocks launch:** `git ls-files projects/real-estate/frontend`
returns only `README.md`; `src/`, `package.json`, `package-lock.json`, and
all config files are untracked (`git status --porcelain`, confirmed
2026-07-20). Whatever is on disk cannot be reproduced from a clean
checkout, cannot go through code review, and cannot be deployed by any
CI/CD system pointed at this repo. `npm run build` does still succeed
locally today (verified) — the risk is purely "this only exists on one
machine."
**Effort:** S (the work is trivial — `git add`/commit — but it's a real
gap until done).
**Status:** ✅ **FIXED this pass** (user confirmed). Committed
`projects/real-estate/frontend` (114 files) as its own commit, scoped to
that directory only — the rest of the repo's in-progress restructure
(betting project move, docs reorg) was deliberately left untouched and
uncommitted, exactly as it was found.

---

## Implementation order (blockers)

1. **B5 — BRF financial extraction fix** (done this pass, no dependencies)
2. **B7 — Area analyzer fabrication fix** (done this pass, no dependencies)
3. **B9a — PDF animation timing fix** (done this pass, no dependencies)
4. **B10 — commit the frontend tree** — trivial, but blocks any CI/CD or
   deploy work below; do this before B1/B2 changes so they're reviewable.
5. **B1 — auth on API routes + report page** — needed before real traffic;
   also gates whether B2's rate limiting should be per-user or per-IP.
6. **B2 — rate limiting on `/api/analyses`**
7. **B9c — mark pending/missing data distinctly in report UI + PDF** — small,
   fixes a trust problem independent of B9b.
8. **B3 / B4 — Hemnet/Booli scraping ToS decision** — resolve before any
   further BRF-Scraper work depends on it, since it may mean removing or
   gating the Camoufox fallback paths.
9. **B6 — bridge or retire the orphaned location/market intelligence
   engines** — large; scope explicitly rather than leaving ambiguous.
10. **B8 — real data sources for the 7 analyzers** — largest, ongoing,
    provider-by-provider (natural continuation of the existing
    `docs/28_free_data_providers.md` pattern).
11. **B9b — real print-layout PDF** — large, can run in parallel with B8
    once B9c is in.

---

## Open decisions (need the user, not more engineering)

- **B3/B4:** is scraping Hemnet/Booli via Camoufox an accepted interim
  fallback (with legal review), or should it be disabled/removed in favor
  of the ToS-clean Booli API path only, accepting lower coverage?
- **B6:** is bridging the standalone `location_intelligence`/
  `market_intelligence` Python engines into the live product in scope for
  *this* launch, or should launch scope be explicitly the current
  TypeScript provider set, with the Python engines relabeled as a
  post-launch roadmap item (so PROJECT_STATUS.md stops implying they're
  live)?
- **B1:** what does "customer" mean today — is there an existing signup
  flow to gate behind, or does auth need to be built from scratch beyond
  the current dev-only `devAdmin.ts` gate?

---

## HIGH

- **No per-customer data isolation — every signed-in user can see every
  other user's analyses.** `properties`/`analyses` have no owner column
  (confirmed absent from both migrations); B1's auth fix requires *a*
  login but doesn't scope queries to *whose* login. Needs a `user_id` (or
  a join table, since properties are deduped globally by address and
  might legitimately be viewed by multiple customers) plus matching RLS
  and dashboard-query changes. Effort: M.
- **Booli field mapping (`frontend/src/lib/analysis/providers/booli.ts`)
  still unverified against a live API response** — same open item since
  2026-07-16 (`docs/26_property_extraction.md`); degrades gracefully
  (`status: "error"`, no fabrication) but silently loses all Booli-sourced
  fields if the real schema differs. Effort: S once an API key is
  available.
- **Zero unit test coverage for the entire BRF profile/extraction
  pipeline** (`profile/{engine,merge,bridge,coverage}.py`,
  `extractor/*.py`, `discovery/booli_provider.py`,
  `discovery/official_website.py`) — the product's core logic ships
  untested. Effort: L.
- **Official-website discovery is ~0% effective in practice** (0/30 in the
  real test run); the tiered registry design meant to fix this
  (`docs/34_brf_registry_architecture.md`) is explicitly marked
  "design only — not implemented." Effort: L.
- **FastAPI `api/server.py` has no CORS/auth/rate limiting of its own** —
  compounds B1/B2 if this service is reachable independently of the
  Next.js app. Effort: S–M.
- **No Dockerfile/docker-compose for the frontend or `api/`** (only
  BRF-Scraper and Market_Intelligence_Engine have one) — no repeatable way
  to build/run the actual product. Effort: M.
- **No CI/CD for this project** (`.github/workflows` doesn't exist for
  real-estate). Effort: M.
- **No `/health` endpoint** anywhere (Next.js API or FastAPI) — nothing
  verifies DB/Supabase connectivity before traffic is routed. Effort: S.
- **Full provider pipeline runs sequentially, not in parallel**
  (`pipeline.ts:163-192`), so worst-case latency is additive across ~7
  providers' timeouts (up to ~60-90s) instead of bounded by the slowest
  one. Risks a platform request timeout (e.g. Vercel) on a slow run, with
  no client-side abort/timeout handling either. Effort: M.
- **No org-number lookup exists anywhere** — confirms PROJECT_STATUS's own
  claim; `bolagsverket_companies.py` is kommun-level aggregate stats only,
  not per-BRF resolution. Blocks BRF financial completeness more broadly.
  Effort: M/L.

## MEDIUM (new, found while implementing B6)

- **3 of `market_intelligence`'s SCB-backed providers return HTTP 400 from
  live SCB endpoints today** (`scb_macro_economy` (CPI/unemployment),
  `boverket_construction`-adjacent SCB construction query, and
  `mortgage_rates`'s SCB table call — confirmed via a live test run,
  errors like `GET .../tables/PR0101A/data ... returned 400`) — most
  likely upstream SCB table-schema drift since these providers were
  built, unrelated to the bridge added this pass. Worth a dedicated
  investigation (compare the failing table/query shape against SCB's
  current API docs) before relying on those specific findings. Effort: M.

## MEDIUM

- Address dedup key (`normalize.ts`) doesn't normalize street-number/
  apartment-suffix variants — same apartment submitted twice can create
  duplicate property rows. `pipeline.ts` already documents this as a known
  limitation.
- `classify.ts`/`booli.ts` Booli area-disambiguation has no address-
  similarity check before accepting Booli's first search result when a
  Hemnet municipality hint is missing — risk of a false-positive match on
  a common street name in the wrong city.
- `HemnetListingsProvider` (`src/market_intelligence/providers/housing_market_base.py`)
  has no live data source — always `NO_DATA` without a pre-fetched
  listings payload no caller supplies.
- Fake progress screen (`app/analyzing/page.tsx`) is a fixed ~3.1s timer
  that runs *after* the real analysis already finished — never reflects
  true provider latency.
- Pending (in-progress) analyses render the same "something went wrong"
  message as genuinely failed ones (`report/page.tsx`).
- Hardcoded fake market stats on the homepage (`app/page.tsx`
  `MARKET_STATS`/`CHART_VALUES`) presented under "Marknadsöversikt" with no
  backing data source.
- Leftover placeholder copy ("Detta är en förhandsvisning...") contradicts
  a fully working pipeline (`app/page.tsx`).
- No structured logging or error tracking (Sentry or equivalent) anywhere;
  errors only reach stdout/`console.error`.
- Env var validation is lazy (first-request-time), not startup-time, in
  both the Next.js app and `api/server.py` — a misconfigured deploy passes
  health checks and fails only on the first real request.
- No provider-level caching (only the 7-day whole-analysis cache exists);
  slow-changing sources like SCB/SMHI are refetched from scratch every
  non-cached run.
- Latent `NameError` in `merge.py`'s `_pick_winner`-adjacent fallback path
  — fixed as part of B5 (was reachable only outside `ProfileEngine.build()`'s
  normal path, but is now safe for any caller).

## LOW

- Booli URL-path regex (`classify.ts`) accepts only two known path shapes;
  a future Booli URL format change fails silently to `unsupported_provider`
  rather than erroring loudly.
- Two of ~11 registered `location_intelligence` providers (Trafikverket,
  Lantmäteriet) are honestly stubbed pending API keys/OAuth — not a defect,
  just incomplete, and only matters once B6 is addressed.
- Fake quota counter (`lib/placeholders.ts` `PLACEHOLDER_FREE_PREVIEWS`) is
  currently dead code (report page hardcodes `fullReportUnlocked = true`)
  but will show a fabricated "2 of 3 left" the moment that flag changes.
- Hardcoded local Supabase URL in `.env.example` with no documented
  production `.env` reference.
- Hardcoded personal email as a dev-admin fallback (`lib/auth/devAdmin.ts`)
  — correctly gated to `NODE_ENV==='development'`, but should move to an
  env var before release regardless.

---

## What changed in this pass

Six of ten BLOCKERs closed: **B5** (BRF financial extraction was silently
dead + would've crashed on fix), **B7** (fabricated area price-trend
number), **B9a** (PDF captured mid-animation), **B10** (frontend tree
committed to git), **B1** (auth gating on all API routes + `/report`, with
Puppeteer's PDF export updated to forward the session cookie so it still
works behind the new gate), and **B6** (location/market intelligence
engines bridged into the live pipeline via new `api/server.py` routes,
with one real analyzer connection — `futureDevelopment.ts` — wired end to
end and verified against live data, not mocks). Every fix was verified
with `py_compile`/`tsc --noEmit`/`npm run build`, and B1/B6 additionally
against the running dev server or a live `TestClient` call, not just
static checks.

**Explicit user decisions this pass:** keep the Hemnet/Booli scraping
fallback as-is, accepting the ToS risk (B3/B4 — no code change made);
commit the frontend tree now (B10 — done); implement auth now (B1 —
done); bridge the engines now (B6 — done).

Remaining BLOCKERs are genuinely large, multi-session work, not
oversights: **B8** (real scoring for the other 6 analyzers — needs
comparables/financial data sources, not code), **B9b** (a real print
layout for the PDF), and **B9c** (marking pending vs. negative findings
distinctly) — sequenced above, not silently deferred. Two new HIGH items
surfaced by this pass's work: per-customer data isolation (B1's
follow-on) and 3 SCB providers returning HTTP 400 (found while verifying
B6 live).
