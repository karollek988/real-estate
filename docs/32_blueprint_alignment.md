# Blueprint ↔ Codebase Alignment — Köpanalys

**Date:** 2026-07-18 · Companion to `BLUEPRINT.md` (governing document) and `docs/31_mvp_integration_audit.md`.
Purpose: map every blueprint engine onto the code that exists today, and record the points
where the blueprint conflicts with the current implementation or with earlier decisions —
flagged here per the blueprint's own rule, before any code changes.

---

## 1. Engine-by-engine conformance map

| Blueprint stage | Existing implementation | Status |
|---|---|---|
| Property Identification | `frontend/src/lib/analysis/listing/hemnet.ts` (URL-slug parse, no fetching — ToS-safe), `listing/manual.ts`, `listing/classify.ts` | **Partial.** Slug gives address/municipality/type/rooms/floor. Fee, price, area, year, operating costs, land ownership must come from Booli (uncalibrated) or the user. Booli-URL input not supported by `classify.ts` yet. |
| Property Data Engine | `providers/booli.ts` (coded, never exercised — no API key), manual-entry attributes, `providers/geocoding.ts` | **Partial.** Blocked on Booli key + calibration (audit Phase 4 item, arguably earlier). |
| BRF Engine | `BRF-Scraper/` (discovery/crawl/download; extraction **empty**), `analyzers/housingAssociation.ts` (stub awaiting `brf_debt_per_m2_sek`), placeholder `brf_financials` | **The critical gap.** Audit roadmap Phases 1–3 (SBC adapter → Docling+Instructor → provider) build exactly this. BRF Health Score = the analyzer going live. |
| Price Engine | `analyzers/price.ts` + SCB price statistics | **Partial — see Conflict C2** (sold-comps data source). |
| Fee Engine | **Does not exist.** Current analyzer registry: area, confidence, futureDevelopment, housingAssociation, market, negotiation, price, risk — no fee analyzer | **New build required** (see Gap G1). The architecture supports it: one new module in `analyzers/` + registry entry. |
| Area Engine | `analyzers/area.ts` + `providers/osm.ts` (amenities presence/counts). Crime, noise, flood, school-quality = honest placeholders with documented API blockers | **Partial — see Conflicts C3/C4.** |
| Future Development Engine | `analyzers/futureDevelopment.ts` + `providers/trafikverket.ts` (implemented). Municipal plans = placeholder (no unified national API — verified 2026-07-16) | **Partial.** Trafikverket path exists; municipal detaljplaner stay honest-missing for MVP. |
| Market Engine | `analyzers/market.ts` + `providers/riksbanken.ts`, `providers/scb.ts` | **Live.** |
| Risk Engine | `analyzers/risk.ts` | **Live** (grows automatically as more sources connect). |
| Decision Engine | `engine/decisionEngine.ts` — confidence-weighted, shrink-to-neutral, never single-factor (matches blueprint requirement) | **Live — see Conflict C1** (verdict vocabulary). |
| Report Generator | `frontend/src/app/report/page.tsx` + `components/report/*` (score ring, data-sources grid) | **Partial.** No charts/maps yet (MapLibre is post-MVP per audit; blueprint asks for maps/charts — see Conflict C5). |

**Architecture verdict: the blueprint maps 1:1 onto the existing provider/analyzer pipeline.**
No redesign is needed or permitted — every blueprint "engine" is either an existing analyzer,
an existing provider cluster, or one new analyzer module. The two structures are the same
thing under different names.

---

## 2. Conflicts (flagged before any code changes, per blueprint rule)

**C1 — Decision verdict vocabulary.** Blueprint mandates `Buy / Buy with caution / Negotiate / Avoid`.
Code ships `Very Good Purchase Opportunity / Promising — Verify Key Factors / Requires a Closer
Look / Caution Advised` (`decisionEngine.ts:16-21`). Also note "Negotiate" is not a severity level —
it's orthogonal advice (the `negotiation` analyzer already exists for this). *Proposed resolution:*
adopt the blueprint's four labels, derive "Negotiate" from the negotiation analyzer's signal rather
than a score band. Needs your confirmation since it changes user-facing semantics.

**C2 — Price Engine vs. the comps decision.** Blueprint compares against *sold apartments* and
*similar apartments*. The standing product decision (docs/23–24, 2026-07-16) was **comps only after
a paid data agreement** — free Booli tier restricts commercial use, Hemnet is banned. Until an
agreement exists, the Price Engine can honestly deliver: SCB area price levels/trends + current
listings + price-per-m² context, labeled as such — but not true sold-comps. *Blueprint and prior
decision can coexist if the MVP Price Engine is labeled "market-level, not comp-level"; full comps
become a paid-data milestone.*

**C3 — Crime in MVP Priority 1.** BRÅ has no query API (verified 2026-07-16, recorded in
`placeholders.ts:47-50`). *Resolution that satisfies the blueprint:* one-time ingestion of BRÅ's
static per-kommun tables into Supabase (batch job, LOW effort), honestly labeled "kommun-level,
year X". Blueprint P1 is achievable — at kommun granularity, not address granularity.

**C4 — Schools in MVP Priority 1.** OSM gives school presence/distance (live today). Quality
requires Skolverket data — open data exists (Skolenhetsregistret + statistics), no live provider
yet. *Resolution:* static/open-data ingestion like C3, MEDIUM-LOW effort. P1 achievable as
"nearby schools + Skolverket statistics", not ratings we invent.

**C5 — Report charts and maps in MVP.** The audit deferred MapLibre to post-launch; blueprint's
Report Generator asks for maps and charts. *Resolution:* charts (score/risk/trend) are cheap and
belong in P1; the interactive map is the one visual worth pulling forward only if time allows —
a static map image is an acceptable MVP stand-in. Flagged as a scope decision for you.

**C6 — MVP Priority 1 is broader than the audit's Phase 3.** The audit's launchable core was
property + BRF + price + decision. Blueprint P1 adds fee analysis, crime, schools, future
infrastructure. With C3/C4 resolved via static ingestion and G1 built, the delta is roughly
+2–3 weeks on the 11-week plan. The roadmap in docs/31 should be re-cut against Blueprint P1
once you confirm the resolutions above.

---

## 3. Gaps that are new-build (no conflict, just missing)

**G1 — Fee Engine.** New analyzer (`analyzers/fee.ts`): monthly fee per m² vs. SCB/area norms,
BRF debt (once extracted), building age. Depends on BRF extraction for its best signals; a
useful v0 works from fee-per-m² percentile alone. ~3–5 days including tests.

**G2 — BRF Health Score.** The `housingAssociation` analyzer's real scoring, fed by the
Docling+Instructor extraction (audit Phases 2–3). The blueprint's BRF Engine field list
(loans, savings, cash flow, apartment count, premises, renovations, fee history, board) is a
superset of `models/brf.py::FinancialData` — extend the Pydantic models to match the blueprint
list during Phase 2, not after.

**G3 — Booli-URL identification input.** `classify.ts` recognizes Hemnet only. Booli listing
URLs are the second paste-input users will try. Small addition once the Booli provider is calibrated.

**G4 — "What should I ask the agent?" report section.** Pure LLM-composition over existing
analysis output; cheap, high perceived value; fits the ExplanationEngine style. Post-P1 polish.

---

## 4. Standing obligations going forward

1. Every session touching architecture reads `BLUEPRINT.md` first (it now says so at the top).
2. Conflicting instructions → explain the conflict before changing code (this file is the template).
3. New functionality that changes the architecture → update `BLUEPRINT.md` in the same change.
4. The engine names in the blueprint are the canonical vocabulary for analyzers/providers going
   forward (e.g. new code and docs say "Fee Engine", implemented as `analyzers/fee.ts`).
