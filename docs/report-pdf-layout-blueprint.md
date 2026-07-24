# Köpanalys — PDF Report Layout Blueprint

> **Status: Version 1.0 — IMPLEMENTATION-READY** (reviewed alongside
> [`43_architecture_review.md`](./43_architecture_review.md); no findings
> from that review required changes to this document). This defines how
> the report *looks and
> is paginated* as a printable A4 PDF. It does not define report *content* —
> that is specified in [`kopanalys-report-design.md`](./kopanalys-report-design.md)
> (10 content sections, data dependencies, minimum-data thresholds, risk
> taxonomy). This document takes that content and lays it out on physical
> pages.
>
> It also does not define how the content gets computed. Per
> [`37_platform_architecture.md`](./37_platform_architecture.md) §1.5, the
> **Report Generator renders a finished, structured analysis — it contains
> zero analysis logic.** Verdicts, risk severities, trend directions, and
> confidence scores arrive already computed from the AI Analysis Engine.
>
> Every schema, field name, and open question referenced below is now fixed
> in [`42_platform_data_contracts.md`](./42_platform_data_contracts.md),
> the ratified data contract for the whole pipeline (Listing Parser →
> Engines → Aggregator → AI Analysis Engine → Report Generator → HTML/CSS →
> PDF). This document was written before that contract existed and has been
> updated throughout to match it — where the two might ever seem to
> disagree, doc 42 is authoritative.

---

## 0. What this blueprint is grounded in, and what it isn't

Before laying out pages, it matters which of the report's future data sources
are real today and which are aspirational, because the blueprint must not
pretend an engine exists that doesn't.

| Source | Status | Grounds which pages |
|---|---|---|
| **Location Intelligence Engine** (`src/location_intelligence`) | **Released, v1.0.0.** Concrete `Finding`/`ProviderResult` schema, 12 providers, tested. | Part V (The Area). |
| **Market Intelligence Engine** (`src/market_intelligence`) | Built, real code, same envelope — **uncommitted / unreleased**. Domain/key vocabulary now catalogued in doc 42 §5, including the explicit gap: no comparable-sales/liquidity provider exists yet. | Part IV (Price & Market). |
| **BRF Engine** | No code exists. **Full domain/key contract now defined** (doc 42 §6) so implementation can start without further design work. | Part III (The Association). |
| **Aggregation Engine (MIP)** | No code. **Full MIP schema, conflict-resolution algorithm, and confidence formula now defined** (doc 42 §7). | Governs how multi-engine data reaches the report; no longer an open question. |
| **AI Analysis Engine** | No code. **Full `StructuredAnalysis` output schema now defined** (doc 42 §8) — this is the Report Generator's entire input. | Owns every verdict, severity, trend label, and confidence number this blueprint displays. |
| **Report Generator itself** | No code. **Rendering pipeline decided**: Jinja2 → HTML/CSS → WeasyPrint (doc 42 §12). | Confirms every layout idea below is technically buildable with the chosen renderer. |

Given this, the blueprint retains its original three confidence tiers for
traceability, but every 🟡/🔴 item below now has a concrete schema behind it
in doc 42 — "not yet backed by code" no longer means "not yet specified":

- 🟢 **Grounded** — field names and structure traceable to real, released code (Location Intelligence), or to the ratified contract in doc 42.
- 🟡 **Contract fixed, engine not yet built** — doc 42 defines the exact schema; the engine producing it doesn't exist yet (BRF Engine, most of Market Intelligence's Part IV needs).
- 🔴 *(retired)* — every item previously marked 🔴 (no upstream spec at all) is now resolved in doc 42 and re-tagged 🟡 or 🟢 below.

---

## 1. Visual system

### 1.1 Format & grid

- **A4 portrait**, 210×297mm. Margins: 22mm top/bottom, 20mm left/right (generous — this is a document to be read slowly, not a dashboard).
- **Single column** for narrative and verdict pages; **12-column grid** for data-dense pages (statements, ratio tables, comparison tables) so tables and side-by-side metric cards can align precisely.
- **8pt baseline spacing unit.** All vertical rhythm (paragraph gaps, card padding, table row height) is a multiple of 8pt. This is what makes a print report feel engineered rather than assembled — auditors and banks over-index on this kind of consistency even if they can't name why it feels trustworthy.
- One page = one purpose. If a page's content is thin (e.g., a BRF with only 1 year of data and half the ratios stated as "insufficient data"), the page is allowed to be visually sparse with generous white space — never stretched or padded with filler to look fuller. Emptiness is honest; padding is not.

### 1.2 Typography

Two-family system (exact font choice deferred to whoever owns brand — this specifies *character*, not a licensed name):

- **Headline serif** — for the report title, section dividers, and the verdict sentence on the Executive Summary. A humanist serif with some weight (e.g., in the character family of Source Serif / Tiempos / GT Sectra) — this is what signals "bank/auditor," not "SaaS product." Used sparingly: titles and the single verdict sentence only.
- **Body/data grotesk** — for everything else: body copy, tables, labels, captions. Neutral, high x-height, tabular figures required for numeric alignment in financial tables (e.g., in the character family of IBM Plex Sans / Inter / Söhne).
- **Numerals**: tabular (fixed-width) lining figures everywhere money or counts appear in a table, so columns of SEK values align on the decimal/thousands separator without eyeballing.
- Type scale (approx., print pt): Report title 28/34, Section title 18/24, Page title 14/20, Body 9.5/14, Table body 9/13, Caption/footnote 7.5/11, Footer 7/10.

### 1.3 Color

The web app's palette (`design-system.md`) is a **dark SaaS dashboard palette** — correct for a product UI, wrong for a printed due-diligence document that needs to read as neutral and auditor-like, not as a marketing surface. Recommendation: keep the same **hue family** for brand continuity, invert for print.

| Role | Value | Rationale |
|---|---|---|
| Page background | `#FFFFFF` (or `#FDFDFB` if a warmer "paper" feel is wanted) | Printable, ink-efficient, neutral |
| Primary ink | `#1A1A1A` | Near-black, not pure black — softer on a printed page, standard print convention |
| Secondary ink | `#5B5F5A` | Captions, footnotes, source citations |
| Rule / hairline | `#E4E4E0` | Table borders, section dividers |
| Brand accent | `#16A34A` (same green-600 as the web app) | Used *only* for: the verdict badge, section-opener rule, chart accent line, active/positive indicators. Never as a background fill. |
| Risk — Critical | `#B91C1C` (deep red, not the web app's brighter `#F87171` — print needs more contrast at small sizes) | |
| Risk — High | `#C2410C` (deep amber-orange) | |
| Risk — Medium | `#B45309` (amber) | |
| Risk — Low / Positive | `#15803D` (deep green) | |
| Info / neutral data | `#0369A1` (deep sky, darker than web app's `#38BDF8`) | Non-judgmental data (e.g. area statistics with no risk valence) |

This keeps continuity with the product's identity while meeting the "bank/auditor/valuation company" brief — the accent is a signal color used sparingly, not a design surface.

### 1.4 Page template (every page)

```
┌──────────────────────────────────────────────────────┐
│ [tiny wordmark]              PART III · THE ASSOCIATION│ ← running header, 7pt, secondary ink
│ ────────────────────────────────────────────────────  │ ← hairline rule, full width
│                                                        │
│                                                        │
│                     page content                      │
│                                                        │
│                                                        │
│ ────────────────────────────────────────────────────  │
│ Köpanalys · kopanalys.se · Analys genererad 2026-07-20 │  ← footer, 7pt
│ Konfidentiell — endast för mottagarens eget bruk   14/22│
└──────────────────────────────────────────────────────┘
```

- **Watermark placement (decided)**: not a diagonal ghost overlay across the page body. A large diagonal watermark reads as "draft/leaked," which works against the "professional due-diligence report" brief. Instead: a small, permanent **footer wordmark** (`Köpanalys · kopanalys.se`) on every page, paired with a **tiny corner mark** (registered mini-logo, ~4mm) in the header — this satisfies "every page, subtle, never reduces readability" while staying in bank-report territory rather than SaaS-marketing territory.
- **Running header** states which Part the reader is in (not the page-level title — that's the page's own H1) so a reader flipping through a printed stack always has orientation.
- **Footer** carries page number, generation date, and a one-line confidentiality note — standard for anything positioned as a due-diligence deliverable.
- **Logo placement**: full wordmark/logo appears once, on the cover, at real size. Every interior page gets only the small corner mark — restraint here is part of what makes it feel like an auditor's report rather than a pitch deck.

### 1.5 Recurring components

| Component | Use | Notes |
|---|---|---|
| **Confidence/trust badge** | Next to any figure sourced from an engine finding | Two-part badge, both fields sourced directly from `evidence_index[id]` (doc 42 §8/§10) — never computed by the Report Generator. **Trust dot + one-word label** from the real `trust_tier` enum 🟢 (`registry_authority`→"Myndighetskälla", `manager_portal`→"Förvaltare", `directory`→"Register", `user`→"Egen uppgift", `derived`→"Beräknat"; `null` for AI-derived claims, badge shows confidence only). **Confidence percentage** alongside it (e.g. "92%"), from `evidence_index[id].confidence` — required on every displayed metric per doc 42 §10, not just an optional flourish. |
| **Risk chip** | Any risk factor, wherever it appears | Colored left-border card, 4 severities per `kopanalys-report-design.md` §7 🟡 / doc 42 §8 `risk_assessment.factors[].severity`: Low/Medium/High/Critical. Same visual token used identically in BRF, Debt, Price, and Area sections, then collected in Part VI. |
| **Trend arrow** | Any multi-year metric | ↑ improving / → stable / ↓ declining / ∿ volatile / — insufficient data — matches `StructuredAnalysis.trends[key].direction` (doc 42 §8) exactly, five states, no others. Never shown with fewer than 2 data points in `series` — the arrow is simply omitted, not shown as "—", when data is insufficient, to avoid it reading as a data point itself. |
| **Metric card** | Per-apartment metrics, ratios | Label, value, one-line "what this means," optional healthy-range bracket visual (a thin horizontal bar with a marked healthy zone and a pin for this BRF's value — not a gauge/speedometer, which reads as consumer-dashboard rather than financial-statement). |
| **Source citation footnote** | Bottom of any page with cited data | Renders `evidence_index[id].citation_sv` verbatim (doc 42 §8) — a pre-formatted Swedish string, e.g. `Källa: Polisen, händelser · hämtat 2026-07-19`. The Report Generator never assembles this string itself; it only displays what the AI Analysis Engine already formatted. |
| **Callout box** | Section-level caveats, missing-data notices | Neutral gray box, not colored — reserve color for risk severity only, so callouts don't visually compete with actual risk chips. |
| **Empty-state block** | Any page/section whose backing engine returned no data | See §2 pagination rule below — never a blank page, never fabricated content. Heading/body microcopy fixed verbatim in doc 42 §9. |

---

## 2. Pagination rule: how missing data collapses pages

Because BRF financials, market comparables, and some Location Intelligence
providers (`trafikverket_infrastructure`, `lantmateriet_detaljplan`) can
legitimately return `no_data`/`not_connected` 🟢, page count is **not
fixed**. Rule, applied uniformly:

1. If a page's minimum-data threshold (already defined per-section in
   `kopanalys-report-design.md`'s "Minimum Data Requirements" table) isn't
   met, the page still appears (never silently dropped — disappearing
   sections would look like the report is hiding something) but renders a
   **compact empty-state**: page title, one sentence stating what's missing
   and why it matters, and a pointer into Part VII (Missing Data) rather than
   an attempt to fill the page. This keeps the empty-state visually distinct
   from a normal thin page (§1.1) — it's explicitly "not computed," not just
   "brief."
2. Sibling sub-pages with no content at all (e.g., no upcoming loan
   maturities to chart) collapse into the parent page rather than reserving
   an empty page of their own.
3. Every render still produces the same page *order and numbering scheme*
   (Part → page purpose), so two reports for two different properties are
   structurally comparable even when their page counts differ — this matters
   for a buyer comparing two reports side by side.

---

## 3. Page-by-page blueprint

Organized into seven Parts, mirroring `kopanalys-report-design.md`'s ten
content sections but split into physical page units and given print-specific
treatment. Each entry states purpose, hierarchy, visual elements, engine
contribution, and empty-state behavior.

### Front matter

**Cover**
- *Purpose*: identify the property and set tone in under 3 seconds.
- *Content*: property address (large, serif), one photo (`Property.images[0]`), price (`Property.asking_price_sek`), Köpanalys wordmark (full size, only place it appears at full size), generation date, report ID (`Property.property_id`).
- *Hierarchy*: photo dominant (top 55% of page), address/price as the only text competing with it.
- *No charts, no icons, no map on this page* — it is deliberately the calmest page in the report.
- *Source*: 🟢 the Listing Parser's `Property` object (doc 42 §3) exclusively — no intelligence engine contributes to the cover.

**Table of Contents & How to Read This Report**
- *Purpose*: orientation, and a one-time legend so every later page can use compact symbols without re-explaining them.
- *Content*: Part list with page numbers; legend defining the confidence/trust badge, trend arrow, and risk chip once, so they never need inline explanation again.
- *Hierarchy*: two-column — TOC left, legend right.

### Part I — The Verdict

**Executive Summary** (`kopanalys-report-design.md` §1, "Besked")
- *Purpose*: the 30-second answer.
- *Content*: verdict badge (`verdict.label_sv`), one-sentence verdict in the headline serif (`verdict.headline_sentence_sv`), 3 reasons (`verdict.top_reasons`), 3 risks (`verdict.top_risks`), confidence statement (`verdict.confidence`).
- *Hierarchy*: verdict badge + sentence own the top third of the page alone — nothing competes with it. Reasons/risks below as two parallel 3-item lists (positive left, risk right), not a table.
- *Charts*: none — this page is verdict, not data.
- *Confidence gate*: driven directly by `verdict.confidence_gate_passed` (doc 42 §8) — when `false`, this page instead renders the fixed banner text from doc 42 §9 rather than a verdict. Same page slot, different content, never suppressed.
- *Source*: 🟡 `StructuredAnalysis.verdict` (doc 42 §8) — schema fixed, AI Analysis Engine not yet built. This page cannot render real content until that engine exists, but its template can be built now against the fixed schema.

### Part II — The Property

**Property Overview** (§2 "Objektet")
- *Purpose*: establish exactly what's being bought.
- *Content*: fact table (address, type, rooms, area, floor, features), price-per-m² vs. area/BRF median (small horizontal comparison bars, not a chart), monthly cost breakdown (fee + interest estimate + amortization estimate → total), one small floor-plan or listing photo if available.
- *Hierarchy*: facts as a clean two-column definition list (label/value pairs), cost breakdown as a stacked horizontal bar (three segments, one bar) — visually simple, immediately legible.
- *Sources*: property facts 🟢 from `Property` (Listing Parser, doc 42 §3); interest-rate estimate 🟡 from Market Intelligence's `macro_economy` domain (`riksbank_interest_rate` provider, doc 42 §5 — real code, unreleased); area/BRF median price-per-m² 🔴 **gap** — Market Intelligence has no comparable-sales provider yet (doc 42 §5), so this row renders the missing-data placeholder (`Uppgift saknas`) until that provider exists.
- *Empty-state*: if BRF median unavailable, show area comparison only and say so — never omit the row silently. Today, expect **both** to be unavailable (see gap above), so design and test this page primarily against its empty-state, not its populated state.

### Part III — The Association (BRF)

Everything in this Part is 🟡 — the BRF Engine's full domain/key contract is
fixed (doc 42 §6), but no BRF financial-extraction engine exists yet to
populate it. Field references below point directly at that contract so the
templates can be built now, ahead of the engine.

**BRF Overview & Governance**
- Fact table (`brf_overview` domain: `name`, `organization_number`, `municipality`, `apartment_count`, `commercial_unit_count`, `rental_apartment_count`, `construction_year`, `property_designation`) + governance table (`governance` domain: `chairman`, `auditor`, `auditor_firm`, `board_meeting_frequency`, `member_count`).
- One small honesty note if org number can't be cross-verified at Bolagsverket — i.e. if `brf_overview.organization_number`'s only contributing source has `trust_tier` below `registry_authority`.

**Financial Statements**
- Income statement (`income_statement` domain) and balance sheet (`balance_sheet` domain) as two side-by-side tables (12-col grid earns its keep here), each year as a column (grouped by each `Finding.validity.start`/`.end`) so multi-year read-across is possible on one page without flipping.
- Per-apartment metric cards below (`apartment_metrics` domain: `debt_per_apartment_sek`, `equity_per_apartment_sek`, `revenue_per_apartment_sek`, `cost_per_apartment_sek`, all `trust_tier: derived`) — four metric cards in a row.

**Financial Health Scorecard**
- The six ratios from `financial_ratios` domain (`equity_ratio`, `operating_margin`, `interest_coverage_ratio`, `debt_ratio`, `cost_per_sqm`, `fee_sustainability_ratio`), each as a metric card with the healthy-range bracket visual (§1.5).
- This is the single most "bank credit officer" page in the report — deliberately the densest data page, but organized as a uniform card grid so density doesn't read as clutter.

**Loan Portfolio**
- Table of individual loans (`loan` domain, one `Finding` per loan, `key = "loan_<n>"`, structured value: `{lender, original_amount_sek, remaining_amount_sek, interest_rate_pct, maturity_date, amortisation_requirement}`) plus a **maturity timeline** — a simple horizontal timeline with loan amounts stacked at their `maturity_date` year, so refinancing-cliff risk is visible at a glance without reading every row.
- *Chart*: this timeline is the one chart in the report I'd prioritize building first if only one chart budget exists — refinancing risk is otherwise very hard to absorb from a table.

**Multi-Year Trends** (§8 "Utveckling", BRF portion)
- One multi-line trend chart per metric group, sourced from `StructuredAnalysis.trends[key]` (doc 42 §8): (revenue, operating profit) together since they share a scale; (equity, debt) together; fee alone (different unit, SEK/month vs SEK).
- Each chart annotated with its `direction`/`direction_sv` classification and `commentary_sv` if present.
- *Minimum data rule enforced*: `trends[key].series` with <2 points renders the empty-state variant (§2), not a flat/misleading single-point chart — this is a schema-level guarantee (doc 42 §8), not just a template convention.

### Part IV — Price & Market

🟡 — Market Intelligence exists in code (unreleased/untracked) and its real
provider domains are catalogued in doc 42 §5, but that catalogue also names
a concrete, currently-unfilled gap that this Part depends on directly — see
below.

**Price Assessment** (§4)
- Comparable-sales table (address/BRF, price, price/m², sold date), a position marker showing this listing's price/m² against the comparable range (a simple number-line style visual, marker + range band — not a scatter plot, which would overstate precision given typically small comparable counts).
- **Named gap (doc 42 §5):** no `comparable_sales` provider exists in Market Intelligence yet — every real provider built so far (`scb_housing_market`, `riksbank_interest_rate`, `boverket_construction`, etc.) is macro/regional statistical data, not individual sold-listing transactions. Until a Booli/Hemnet-sold or Mäklarstatistik provider is built, this table always renders the empty-state (§2) — build and test against that state, not a populated mock.
- Negotiation leverage as a short annotated list (days on market, price reductions, competition level), not a table — these are qualitative signals, tabling them would overstate their precision. Same gap applies: no listing-level supply/demand provider exists yet either.

**Fees & Operating Costs** (§5)
- Fee comparison (this apartment vs. area median vs. BRF median) as the same horizontal-bar style used on the Property Overview page, for visual consistency.
- Fee sustainability ratio as a metric card (reuses the Part III card style).
- "What the fee covers" as a compact icon checklist (heating, water, insurance, etc.) — the one place in the report where icons carry real information density rather than decoration.

### Part V — The Area

The only Part groundable in a released, field-level schema (Location
Intelligence 🟢). Structure below is organized around the engine's actual
provider domains, not `kopanalys-report-design.md`'s more abstract §9
subsections — the two are compatible but I'm following the real schema where
they diverge.

**Location Overview & Access**
- Small static map (property pin, centered, muted basemap) + distance/precision statement sourced from `AddressContext.precision` 🟢 (rooftop/street/postal/municipality — and if precision is coarser than "street," this page must say so, since it changes how much weight the area analysis deserves).
- *Map rendering (decided, doc 42 §11)*: static PNG via the MapTiler Static Maps API, property pin + category-colored `osm_poi` pins within the requested radius, rendered server-side by the Report Generator during HTML assembly. Self-hosted `tileserver-gl` is the documented fallback if usage/cost ever requires leaving the third-party API.
- Infrastructure/transit findings from `trafikverket_infrastructure` 🟢 *if connected* — this provider currently degrades to `not_connected` without credentials (confirmed in `40_location_engine_validation_report.md`), so this page's empty-state is the realistic default today, not an edge case.

**Amenities & Services**
- POI findings from `osm_poi` 🟢 grouped by category (grocery, healthcare, restaurants, parks, etc.), each with distance and `radius_bucket`/`inside_requested_radius` 🟢. Rendered as a category list with icon + count + nearest distance, not a dense map pin-cloud (illegible at print resolution).
- Schools from `skolverket_schools` 🟢 as a small table.

**Safety**
- `polisen_crime` 🟢 findings — event counts by type, with the `fetched_at`/`coverage` fields surfaced as a citation, since crime-data recency materially affects how much weight a reader should give it.
- No crime *trend* claim unless the provider actually returns multi-period data — content doc's "never conclude without evidence" rule applies as strictly here as in the BRF sections.

**Municipality & Demographics**
- `scb_municipality` and `kolada` 🟢 findings — population, income, education-level context at municipality granularity (the engine resolves to municipality, not neighborhood, per `AddressContext.municipality_code` 🟢 — the page should say "municipality-level context," not imply hyper-local precision it doesn't have).

**Future Development**
- `osm_construction` 🟢 (nearby construction activity) and `lantmateriet_detaljplan` 🟢 *if connected* (also `not_connected` without credentials today). `bolagsverket_companies` 🟢 findings (local business registrations) as a minor secondary signal for area economic activity, not a headline metric.
- Local news from `svt_local_news` 🟢 as 2-3 recent relevant headlines with dates — kept small, clearly dated, framed as color/context rather than analysis.
- **Environmental risk** (flood risk, contamination) is in Location Intelligence's architectural scope but **no provider exists for it yet** (doc 42 §4 — a named gap, not a design ambiguity). Reserve a small subsection here for it now; it renders the empty-state (§2) until that provider ships.

### Part VI — Risk

**Consolidated Risk Assessment** (§7)
- Every risk chip generated across Parts II–V, collected here ordered by severity (Critical → Low), rendering `StructuredAnalysis.risk_assessment.factors[]` directly (doc 42 §8: `category`, `severity`, `description_sv`, `evidence_refs`, `buyer_impact_sv`, `mitigating_factors_sv`).
- Overall risk level banner at the top (`risk_assessment.overall_level_sv`), same visual weight as the Executive Summary's verdict badge — this page is effectively "the verdict, risk-only."
- 🟡 schema fixed (doc 42 §8), owned entirely by the not-yet-built AI Analysis Engine — this page's template can be built now; it cannot render real content until that engine exists.

### Part VII — Trust & Evidence

**Missing Data & Confidence** (§10)
- The report's honesty page. Table rendering `StructuredAnalysis.missing_data[]` (doc 42 §8: `domain`, `key`, `impact_sv`, `how_to_obtain_sv`), grouped by BRF/Market/Area (matches content doc §10.1–10.3), plus the confidence summary. Fixed placeholder microcopy throughout uses doc 42 §9 verbatim.
- Visually: this page is intentionally plain — a table, not a design set-piece. Over-designing the "what we don't know" page would undercut its function.

**Supporting Evidence / Data Sources**
- Full citation list, walking `StructuredAnalysis.evidence_index` (doc 42 §8) end to end: every source, `fetched_at`, license, trust tier, and confidence — the single source of truth for every citation footnote used anywhere in the report, not a separate re-derivation.
- Includes the Aggregator's `conflicts[]` (doc 42 §7.2) where applicable: both disputed values shown side by side with their sources and the `resolution` label explaining which was preferred and why.
- This is where the trust-tier/confidence legend (§1.5) earns its keep — a reader who wants to audit any single claim in the report traces it here.

**Methodology & Disclaimer**
- Plain-language description of how the report is produced (which engines ran, that findings are evidence not advice, standard legal disclaimer language — content TBD by whoever owns legal/compliance, not designed here).
- Back cover: wordmark, contact info, generation metadata repeated once more for a report that may be printed and separated from its cover.

---

## 4. Print production notes (constraints on the above, not new design)

- Must survive **grayscale office printing** — every risk-severity/trend-arrow encoding above uses shape or label in addition to color, never color alone, so the report degrades gracefully off a mono laser printer.
- Charts should be **vector-renderable at print resolution** (300dpi-equivalent) — rules out anything that assumes a screen's pixel density.
- Every page must be self-sufficient in isolation (running header states Part + property address) because these reports get printed and pages get separated.

---

## 5. Resolved implementation decisions

Every question this blueprint originally raised is now closed. Each is
restated below with its resolution and where the concrete schema lives, so
the history of *why* is preserved without leaving anything open.

1. **Report Generator input contract** → Fixed: `StructuredAnalysis` (doc 42 §8), produced by the AI Analysis Engine from the Aggregator's MIP. This is the Report Generator's entire input — no other data source is read at render time.
2. **Verdict/scoring ownership** → Confirmed exactly as read: verdicts, risk severities, trend classifications, opportunities, and all narrative text are computed upstream (AI Analysis Engine); the Report Generator only maps `StructuredAnalysis` fields onto templates (doc 42 §1 responsibility table). This blueprint contains zero scoring logic, deliberately.
3. **BRF engine schema** → Fixed (doc 42 §6), mapped 1:1 onto `kopanalys-report-design.md` §3's tables. Part III above references the concrete domain/key names directly. The content doc is the frozen source of truth for *what* the section says; doc 42 is the frozen source of truth for *what field* backs each statement.
4. **Market Intelligence status** → Its real domain/key vocabulary is catalogued (doc 42 §5), grounding Part IV like Location Intelligence grounds Part V. Its one material limitation — no comparable-sales/liquidity provider yet — is named explicitly rather than hidden, and Part IV's Price Assessment page is designed against that gap.
5. **Language** → Swedish only for MVP, confirmed (doc 42 §14). Every field in `StructuredAnalysis` that reaches the page is `_sv`-suffixed; there is no English fallback path today.
6. **Map rendering** → MapTiler Static Maps API, server-side rendered PNGs during HTML assembly; self-hosted `tileserver-gl` is the documented scaling path (doc 42 §11).
7. **Rendering pipeline** → Jinja2 → print-media HTML/CSS → WeasyPrint, with headless-Chromium/Playwright as a documented fallback if chart/SVG fidelity requires it (doc 42 §12). Charts are server-rendered inline SVG — no client-side JS charting library, since there is no client at render time.
8. **Branding** → Canonical product name is **Köpanalys** (display), domain **kopanalys.se** (footer/URL form), superseding the "Bostadsradar" / "Property Analyzer" names found elsewhere in the codebase, for report-facing purposes (doc 42 §13).
9. **Listing ingestion** → A dedicated Listing Parser component, Hemnet URL in, normalized `Property` object out (doc 42 §3). Every engine — including this report's own Cover and Property Overview pages — consumes that object instead of touching Hemnet independently.
10. **Conflict display** → The Aggregator always preserves both disputed values (never silently resolves away a disagreement) and picks a `primary` for downstream calculations via a fixed, deterministic algorithm (doc 42 §7.2). The Report Generator has an explicit visual pattern for this: the Evidence page (Part VII) shows both values, their sources, and the resolution label.
