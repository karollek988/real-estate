# Platform Data Contracts — Köpanalys Reporting Pipeline

> **Status: Version 1.0 — RATIFIED CONTRACT, implementation-ready.** Every
> schema in this document is an implementation decision, not a proposal.
> Field names, enums, and the pipeline shape are fixed. An engineer
> implementing any component below should not need to ask an architectural
> question — if something is genuinely undecided, it is called out
> explicitly as **OPEN** (search for that word); everything else is final.
>
> This document formalizes the architecture decisions given for the
> reporting pipeline and supersedes the "unknowns" sections of
> [`report-pdf-layout-blueprint.md`](./report-pdf-layout-blueprint.md) and
> the ambient assumptions in
> [`kopanalys-report-design.md`](./kopanalys-report-design.md). Where those
> documents describe report *content* or *layout*, this document is the
> single source of truth for the *data* that fills them.
>
> Reviewed under a senior-architecture pass
> ([`43_architecture_review.md`](./43_architecture_review.md)); every
> finding classified as a documentation clarification or small
> architectural improvement has been applied — Orchestrator/timeout policy
> (§1.1), authentication/rate-limiting expectations (§15), privacy/data
> retention (§16), caching strategy (§17), and undefined-field/failure-
> behavior fixes throughout §3, §7, and §8. A handful of lower-priority
> findings (envelope deduplication, observability, retries, version
> policy) were deliberately deferred — see that review's Disposition
> section — as hardening work that doesn't block implementation.

---

## 1. Pipeline

```
Hemnet URL
    │
    ▼
Listing Parser ──────────────────────► Property object
    │
    ├──────────────┬──────────────┬───────────────┐
    ▼               ▼              ▼               ▼
Location        Market          BRF          (future engines,
Intelligence   Intelligence   Engine         same envelope)
Engine          Engine
    │               │              │               │
    └───────────────┴──────────────┴───────────────┘
                        │
                        ▼
                  Aggregator ──────► Master Intelligence Package (MIP)
                        │
                        ▼
              AI Analysis Engine ──► Structured Analysis (verdict, risk,
                        │             opportunities, trends, narrative)
                        ▼
                Report Generator ──► HTML (Jinja2 templates)
                        │
                        ▼
                   HTML/CSS → PDF (WeasyPrint)
```

Every engine runs in parallel against the same `Property` object and is
**stateless and mutually unaware** of every other engine (per
`37_platform_architecture.md` §1.2) — this document's envelope is what makes
that possible without per-engine special-casing downstream.

**Component responsibility, restated as hard rules:**

| Component | May do | Must never do |
|---|---|---|
| Orchestrator | Trigger the Listing Parser, then run every engine in parallel against its output; enforce per-engine timeouts; hand completed/timed-out packages to the Aggregator | Interpret, merge, or score anything — it moves packages, it doesn't read them |
| Listing Parser | Parse one Hemnet listing into a `Property` object | Fetch from any other data source; interpret or score anything |
| Location / Market / BRF Engines | Fetch, normalize into `Finding`s, self-report status | Call each other; know the MIP exists; make cross-domain judgments |
| Aggregator | Merge, dedup, normalize units, preserve conflicts, compute per-finding `confidence` | Generate prose; assign a verdict, risk level, or opportunity; call an LLM |
| AI Analysis Engine | Read the MIP and only the MIP; produce verdicts, risk levels, opportunities, trend labels, narrative text, statistical interpretation | Fetch external data; patch a gap by "knowing" something not in the MIP; format anything for display |
| Report Generator | Map `StructuredAnalysis` fields onto HTML templates; format numbers/dates for Swedish locale; render citation footnotes | Compute a ratio, decide a severity, write a sentence, or otherwise originate content not already present in its input |

The Report Generator's single input, concretely: **the AI Analysis Engine's
`StructuredAnalysis` object (§8)**, which itself embeds everything the
Aggregator produced. This is how "Report Generator receives one fully
structured JSON object from upstream" and "AI Analysis Engine sits between
Aggregator and Report Generator" are both true simultaneously — the object
the Report Generator reads is produced by the AI Analysis Engine, which
produced it by consuming the Aggregator's MIP and passing its evidence
forward untouched.

### 1.1 Orchestration, timeouts, and execution model

The Orchestrator is the one component that runs the *shape* of the pipeline
without reading its contents — it exists so that no individual engine has
to know about parallelism, deadlines, or what happens when a sibling engine
is slow. Transport for MVP is **in-process async orchestration**: the whole
stack is already Python (every engine, the Aggregator, and the Report
Generator), so there is no reason to introduce network calls between
pipeline stages yet. This is a starting point, not a constraint on ever
splitting components out later — the envelope (§2) is what makes that split
possible without a rewrite, whenever it's actually needed.

**Timeout policy:** each engine gets a hard wall-clock budget from the
Orchestrator (default 90 seconds — comfortably above any single provider's
own `deadline_s`, since providers already run in parallel within an
engine). If an engine hasn't returned when its budget expires, the
Orchestrator synthesizes a package for it where every provider that hadn't
reported back is marked `status: "timeout"` — reusing the status value that
already exists in the envelope (§2.2), not a new one — and the pipeline
proceeds to the Aggregator without that engine's missing providers. This is
what makes "missing information must never stop report generation" (§6)
true at the pipeline level, not just within a single engine that chooses to
report `no_data` on its own.

**Execution model:** report generation is an asynchronous background job,
not a synchronous request/response. The entry point that accepts a Hemnet
URL returns a job/report id immediately; the caller polls or is notified
when the `StructuredAnalysis` (and rendered PDF) are ready. This follows
directly from the timeout policy above — a component that may legitimately
take up to several engine-timeouts' worth of wall-clock time has no
business blocking an HTTP request.

---

## 2. The shared envelope

Location Intelligence (released) and Market Intelligence (built,
unreleased) **already independently converged on the same envelope shape** —
`Finding` / `ProviderResult` / `ProviderRun`, the same `TrustTier` ladder,
the same `PACKAGE_FORMAT_VERSION`. That convergence is treated here as
validation, not coincidence, and is now made the **mandatory platform
contract**: every current and future engine, including BRF, emits this
shape.

### 2.1 `Finding` — one fact with provenance

Core fields, identical across all engines:

```json
{
  "domain": "string",
  "key": "string",
  "value": "<any JSON-serializable>",
  "unit": "string | null",
  "source": { "name": "string", "url": "string|null", "license": "string|null" },
  "trust_tier": "registry_authority | manager_portal | directory | user | derived",
  "trust_ceiling": "number (looked up from trust_tier, not set by the engine)",
  "fetched_at": "ISO-8601 string",
  "coverage": "string | null",
  "validity": { "start": "ISO date|null", "end": "ISO date|null" } | null,
  "detail": "string | null"
}
```

`trust_ceiling` values are fixed platform-wide (already implemented
identically in both real engines): `registry_authority`=1.0,
`manager_portal`=0.85, `directory`=0.6, `user`=0.5, `derived`=0.5.

**Geo-context extension (engine-specific, both variants sanctioned):**

- *Point-radius engines* (Location Intelligence — a `Finding` is anchored to
  a specific point and optionally a distance from the property): add
  `latitude`, `longitude`, `distance_m`, `radius_bucket`,
  `inside_requested_radius`.
- *Regional/statistical engines* (Market Intelligence — a `Finding` describes
  a geography, not a point): add `country`, `region`, `county`,
  `municipality`, `postal_code`.
- BRF Engine `Finding`s carry neither extension — they're scoped to the BRF
  itself, identified by `organization_number` on the package's `subject`
  (§2.3), not by geography.

A `Finding` failing validation (missing domain/key/source/trust_tier, bad
`fetched_at`, non-serializable `value`) **must be rejected at construction**,
exactly as both existing engines already enforce in `__post_init__`. This is
not new — it's now a cross-engine requirement, not an implementation detail
of one engine.

### 2.2 `ProviderResult` / `ProviderRun`

Unchanged from both existing implementations:

```json
{
  "provider_id": "string",
  "status": "ok | partial | no_data | error | not_connected | disabled | timeout",
  "detail": "string | null   (required, non-null, whenever status is partial or error)",
  "findings": ["Finding, ... (must be empty when status = no_data)"],
  "duration_ms": "int",
  "from_cache": "bool",
  "stale": "bool"
}
```

### 2.3 The package envelope — generalized `subject`

Location Intelligence's package keys itself by `address` only. Because BRF
and Market packages are not always addressed the same way, the platform
envelope generalizes this to `subject`: a **reference back to fields on the
`Property` object (§3)**, never a redefinition of them. Every engine embeds
just enough of `Property` to unambiguously identify what it analyzed, so the
Aggregator can join packages without a separate ID-negotiation step.

```json
{
  "format_version": "1.0",
  "engine_id": "location_intelligence | market_intelligence | brf_engine | ...",
  "engine_version": "string",
  "built_at": "ISO-8601 string",
  "property_id": "string  (Property.property_id — the join key, always present)",
  "subject": {
    "address": "... (Location Intelligence: AddressContext, as today)",
    "organization_number": "... (BRF Engine)",
    "geography": "... (Market Intelligence: country/region/municipality context)"
  },
  "providers": ["ProviderRun, ..."],
  "summary": {
    "providers_total": "int",
    "providers_by_status": { "<status>": "int" },
    "findings_total": "int",
    "oldest_finding_fetched_at": "ISO-8601 | null",
    "newest_finding_fetched_at": "ISO-8601 | null",
    "stale_providers": ["provider_id, ..."]
  }
}
```

`property_id` is the field the Aggregator actually joins on. `subject` is
carried for engine-local debugging/display, never for joining.

**Migration note (not a question, a instruction):** Location Intelligence's
existing `address` field on the package root is kept as-is for backward
compatibility with its released v1.0.0 output; the Aggregator reads
`property_id` when present and falls back to resolving `address` against the
`Property` object when it isn't (i.e., for any v1.0.0 package produced
before this contract existed). New engines emit `property_id` from day one.

---

## 3. `Property` — the Listing Parser's output

The Listing Parser is a new, dedicated component. **Every engine consumes
this object instead of touching Hemnet itself** — no engine scrapes the
listing independently.

**Input:** one Hemnet listing URL.

**Output:**

```json
{
  "property_id": "string — stable hash of source_url, e.g. sha256[:16]",
  "source_url": "string",
  "parsed_at": "ISO-8601 string",
  "parser_version": "string",
  "address": {
    "raw": "string",
    "street": "string | null",
    "postal_code": "string | null",
    "city": "string | null"
  },
  "municipality": "string | null",
  "municipality_code": "string | null",
  "county": "string | null",
  "county_code": "string | null",
  "coordinates": {
    "latitude": "number | null",
    "longitude": "number | null",
    "precision": "rooftop | street | postal | municipality | null"
  },
  "asking_price_sek": "number | null",
  "monthly_fee_sek": "number | null",
  "living_area_sqm": "number | null",
  "rooms": "number | null",
  "floor": "string | null",
  "construction_year": "number | null",
  "brf": {
    "name": "string | null",
    "organization_number": "string | null"
  },
  "images": [{ "url": "string", "caption": "string | null" }],
  "description": "string | null",
  "operating_costs_sek_per_year": "number | null",
  "property_facts": {
    "property_type": "string | null",
    "balcony": "bool | null",
    "elevator": "bool | null",
    "storage": "bool | null",
    "parking": "bool | null",
    "energy_class": "string | null"
  },
  "parser_warnings": ["string, ... — fields Hemnet's markup didn't cleanly yield; never silently null without a warning"]
}
```

`coordinates.precision` reuses Location Intelligence's existing
`AddressContext.precision` enum verbatim (`rooftop`/`street`/`postal`/
`municipality`) so downstream consumers of both `Property.coordinates` and
Location Intelligence's own address findings compare like with like. The
Listing Parser does **not** call Location Intelligence, or any other
engine, to fill this in — if it can't read coordinates directly off the
listing page, it emits `coordinates: null` and records a
`parser_warnings` entry. Location Intelligence already re-geocodes from a
raw address as a normal part of its own `address_resolver`/
`nominatim_geocoder` providers, so nothing upstream needs to pre-resolve
this. (Earlier drafts of this document had the Listing Parser delegate to
Location Intelligence's geocoders directly — removed: it created a
dependency cycle and an ordering requirement that contradicts §1's
stateless, mutually-unaware engine model, and was never necessary in the
first place.)

**Missing-field policy:** every field is nullable. A missing field is never
an error — it is recorded once in `parser_warnings` and every downstream
consumer treats `null` as "not available," using the shared missing-data
policy (§9).

**Total failure policy:** if the Listing Parser cannot extract *anything*
usable from a URL (page structure entirely changed, listing delisted, URL
invalid) it still emits a `Property` object — `property_id` derived from
the URL hash alone (this never depends on page content), every other field
`null`, and a single `parser_warnings` entry describing the total failure.
The pipeline proceeds exactly as it does for any partial failure: every
engine that needs a field it didn't get falls back to its own `no_data`
handling, and the report renders at maximal empty-state rather than not
rendering at all. This is the same "missing information must never stop
report generation" principle already binding on the BRF Engine (§6),
applied to the one component every other component depends on.

`property_facts` is an intentionally open, sparse dict — Hemnet listings
vary in which facts they publish; do not extend the schema for every new
fact type, add keys as needed and treat unknown keys as "not shown on this
page's fact table."

**`property_id` and caching, disambiguated:** `property_id` being a pure
hash of `source_url` means the same listing always resolves to the same id
— that identity is for tracking "reports about this apartment over time,"
nothing more. It never bypasses freshness checking: a listing's price, fee,
or description can change between two requests without its URL changing,
so a request for a previously-seen `property_id` still re-validates every
engine's data against that engine's own `cache_ttl` normally (§17). Seeing
a familiar `property_id` is not, by itself, a reason to trust old data.

**Scraping etiquette:** the Listing Parser fetches Hemnet pages directly
and is the only component that does — no other engine touches Hemnet. It
applies conservative rate-limiting/backoff and a clearly identifying
User-Agent when doing so. Compliance with Hemnet's Terms of Service is a
legal-review item, flagged here rather than resolved here, the same way
the report's legal disclaimer content is (blueprint Part VII).

---

## 4. Location Intelligence Engine — domain/key vocabulary (real, released)

Ground truth, not a proposal — read directly from
`src/location_intelligence/providers/*.py` (v1.0.0/`ENGINE_VERSION=0.1.0`).
Listed here so the report and Aggregator layers have one place to look up
domain/key strings instead of re-reading provider source.

| Provider (`provider_id`) | `domain` | Covers | Live today? |
|---|---|---|---|
| `address_resolver`, `nominatim_geocoder` | `address` | Geocoding, precision | Yes |
| `osm_poi` | `poi` | Amenities (grocery, healthcare, restaurants, parks, etc.), each with `distance_m`/`radius_bucket` | Yes (rate-limited on the free Overpass instance) |
| `scb_municipality`, `kolada` | `municipality` | Population, income, education, demographics | Yes |
| `osm_construction` | `construction` | Nearby construction activity | Yes (same Overpass caveat) |
| `trafikverket_infrastructure` | `infrastructure` | Transit, planned infrastructure | **`not_connected`** — needs API credentials not yet configured |
| `skolverket_schools` | `schools` | School locations/quality data | Yes |
| `svt_local_news` | `news` | Local news headlines | Yes |
| `polisen_crime` | `crime` | Crime events by type | Yes |
| `bolagsverket_companies` | `companies` | Local business registrations | Yes |
| `lantmateriet_detaljplan` | `planning` | Zoning/detailed development plans | **`not_connected`** — needs API credentials not yet configured |

**Environmental risk** is in this engine's architectural scope (flood risk,
contamination, etc.) but **no provider exists for it yet**. This is a real
gap, not a report-design ambiguity — until a provider is built, any report
page referencing environmental risk renders the missing-data empty-state
(§9). Building that provider is future engine work, out of scope for this
document.

---

## 5. Market Intelligence Engine — domain/key vocabulary (built, unreleased)

Ground truth from `src/market_intelligence/providers/*.py` — the package is
real code (same envelope, confirmed identical `Finding`/`TrustTier`
implementation) but **untracked in git**, so treat field names here as
correct-as-of-inspection, not yet frozen by a release tag the way Location
Intelligence's are.

| Provider (`provider_id`) | `domain` | Example `key`s | Grain |
|---|---|---|---|
| `scb_housing_market` | `housing_market` | `house_price_index`, `transactions`, `new_construction` | National, quarterly time series |
| `riksbank_interest_rate` | `macro_economy` | `financial_soundness.<indicator_code>` | National, quarterly |
| `scb_macro_economy` | `macro_economy` | (CPI, inflation-adjacent indicators) | National |
| `scb_subnational`, `municipal_economics` | `regional` (by inspection pattern; confirm exact domain string against source at integration time) | Regional/municipal economic indicators | County/municipality |
| `boverket_construction` | `construction` | Regional construction activity/permits | County/municipality |
| `eurostat_housing_price` | `housing_market` | Cross-country price comparison | Country |
| `mortgage_rates` | `macro_economy` | Mortgage rate benchmarks | National |
| `energy_prices` | `macro_economy` | Energy price indices | National |

**Important, stated plainly rather than left implicit:** every provider
built so far is **macro/regional statistical data** — price indices,
transaction *counts*, construction permits, interest/mortgage/energy rates.
**None of them provide individual comparable-sale transactions**
(specific sold addresses/prices), **listing-level supply/demand** (active
listings count, days-on-market), or **liquidity** at the area/BRF grain that
`kopanalys-report-design.md` §4 (Prisbedömning) and the report blueprint's
Part IV require.

This is a **known, named gap**: a `comparable_sales` provider (Booli sold-
listings API, Hemnet completed-sales data, or Mäklarstatistik) does not
exist in code yet and must be built before Part IV's comparable-sales page
can render real data. Until then, that page renders the missing-data
empty-state — this is expected, not a bug, and not something the Report
Generator should work around.

---

## 6. BRF Engine — domain/key vocabulary (contract only, no code yet)

**Input:** `brf.name`, `brf.organization_number`, `address` — all sourced
from the `Property` object (§3), never scraped independently.

**Output:** one package in the shared envelope (§2), `engine_id =
"brf_engine"`, `subject.organization_number` as the join identity. Domain/key
vocabulary below maps 1:1 onto `kopanalys-report-design.md` §3, so that
content doc's tables can be read directly as this engine's field list.

| `domain` | `key`s | Notes |
|---|---|---|
| `brf_overview` | `name`, `organization_number`, `municipality`, `apartment_count`, `commercial_unit_count`, `rental_apartment_count`, `construction_year`, `property_designation` | One `Finding` per key, `trust_tier = registry_authority` if sourced from Bolagsverket, `manager_portal` if from the BRF's own annual report |
| `income_statement` | `revenue_sek`, `operating_costs_sek`, `operating_profit_sek`, `financial_income_sek`, `financial_costs_sek`, `profit_before_tax_sek`, `profit_after_tax_sek` | One `Finding` per key **per fiscal year** — year goes in `validity.start`/`validity.end`, not encoded into the key. This is what makes multi-year trend rendering (blueprint Part III, Multi-Year Trends) a simple query over `validity`, consistent with how Market Intelligence already does time series. |
| `balance_sheet` | `total_assets_sek`, `total_equity_sek`, `total_liabilities_sek`, `long_term_debt_sek`, `short_term_debt_sek` | Same per-year pattern |
| `apartment_metrics` | `debt_per_apartment_sek`, `equity_per_apartment_sek`, `revenue_per_apartment_sek`, `cost_per_apartment_sek` | `trust_tier = derived` — these are computed by the BRF Engine itself from the two domains above, not extracted. The engine, not the Aggregator or Report Generator, does this arithmetic, because it's domain-specific and doesn't require cross-engine data. |
| `financial_ratios` | `equity_ratio`, `operating_margin`, `interest_coverage_ratio`, `debt_ratio`, `cost_per_sqm`, `fee_sustainability_ratio` | `trust_tier = derived`, same reasoning |
| `loan` | one `Finding` per individual loan, `key = "loan_<n>"`, `value = {lender, original_amount_sek, remaining_amount_sek, interest_rate_pct, maturity_date, amortisation_requirement}` | Structured object value — matches the existing envelope's "any JSON-serializable value" allowance, same pattern Location Intelligence already uses for compound POI values |
| `governance` | `chairman`, `auditor`, `auditor_firm`, `board_meeting_frequency`, `member_count` | |

**Missing-information policy, made concrete (per your instruction that this
must never block report generation):** if the BRF Engine cannot find an
annual report at all, it returns a package where every provider reports
`status: "no_data"` with a `detail` explaining what was searched and not
found (e.g. `"No annual report found for org. 769xxx-xxxx via Bolagsverket
or brf.se registry"`). The Aggregator records this as a `missing` entry
(§7); the Report Generator renders Part III with the compact empty-state
already specified in the blueprint. **This is not a special case the Report
Generator needs to know about** — it's the same `no_data` handling every
other engine already uses.

---

## 7. Aggregator — Master Intelligence Package (MIP)

The Aggregator is the **only** component permitted to see more than one
engine's output. Deterministic, no LLM calls (per `37_platform_architecture.md`
§1.3 — unchanged, reaffirmed here as binding).

### 7.1 Responsibilities, made concrete

1. **Normalize**: unify unit representations across engines (e.g. ensure
   every SEK figure is a plain number in SEK, not öre or thousands; ensure
   every date is ISO-8601).
2. **Merge**: findings from different engines that describe the *same fact*
   (same `domain`+`key`, or a documented equivalence — e.g. BRF Engine's
   `brf_overview.apartment_count` and any future Bolagsverket-sourced
   duplicate) become one `MergedFinding`.
3. **Resolve conflicts** per the rule below — **never silently drop a
   disagreeing value.**
4. **Compute per-finding `confidence`** (§7.3) — this is arithmetic over
   `trust_ceiling`, corroboration, and staleness, not analysis. It is legal
   at this layer because it doesn't require judgment, only the stated
   formula.
5. **Track what's missing**: for every domain/key the platform *expects*
   (defined by the union of what each engine's providers are capable of
   producing, whether or not they returned data this run), emit a `missing`
   entry when no engine actually supplied it.
6. **Assign `finding_id`**: every `MergedFinding` gets a stable identifier,
   generated exactly once, here — `finding_id = f"{engine_id}:{domain}:{key}"`,
   with a `:{validity.start}` suffix appended for findings that recur per
   period (multi-year BRF figures, quarterly market indices), so each
   period's finding has its own distinct id. This is the identifier
   `evidence_index` (§8) is keyed by and every `evidence_refs`/`risk_ref`
   entry points at — it is assigned here and carried forward unchanged by
   the AI Analysis Engine, never regenerated downstream.

### 7.2 Conflict resolution rule (concrete algorithm, not a principle)

When two or more contributing findings share the same `domain`+`key` (after
merge-equivalence, §7.1.2) but disagree in `value`:

1. **Both values are always preserved** in the `ConflictRecord` — this is
   non-negotiable per your instruction. Nothing is ever silently dropped.
2. A **primary** value is still selected, because downstream ratio
   calculations and the AI Analysis Engine need one number to reason about:
   - Higher `trust_tier` wins (registry_authority > manager_portal >
     directory > user > derived).
   - If `trust_tier` ties, the more recent `fetched_at` wins.
   - If both `trust_tier` and `fetched_at` are equal, the value from the
     numerically lower-ordered `engine_id` string wins (a deterministic,
     arbitrary tiebreak — the point is determinism, not correctness, since a
     true tie means the platform has no basis to prefer either).
3. `resolution` is labeled `"resolved_by_trust_tier"`,
   `"resolved_by_recency"`, or `"unresolved_tiebreak"` accordingly — the
   Report Generator's Evidence page (blueprint Part VII) surfaces this label
   verbatim next to both values so a reader can see *why* one was preferred,
   not just that one was.

```json
{
  "id": "string — conflict_ref target",
  "domain": "string",
  "key": "string",
  "values": [
    { "value": "...", "source": { "name": "...", "url": "...", "license": "..." },
      "trust_tier": "...", "confidence": "number", "fetched_at": "ISO-8601" }
  ],
  "primary_index": "int — index into values[] of the selected primary",
  "resolution": "resolved_by_trust_tier | resolved_by_recency | unresolved_tiebreak",
  "note_sv": "string — human-readable Swedish explanation for the Evidence page"
}
```

**Single source of truth:** a conflicting fact is never represented twice.
The `MergedFinding` for that domain/key inside `domains[...].findings[]`
(§7.4) does not carry its own copy of the chosen value — it carries a
`conflict_ref` pointing at this record's `id`, and its displayed value is
always read from `conflicts[conflict_ref].values[primary_index]`. This
means there is exactly one place a conflict's primary value is decided, not
two code paths that could disagree.

### 7.3 Confidence formula (the rule that makes decision-point 14 concrete)

Every displayed metric must carry a `confidence` value (0.0–1.0). This
document defines exactly one formula, applied uniformly:

```
confidence = trust_ceiling(trust_tier)
             × staleness_factor(fetched_at, coverage)
             × corroboration_bonus(agreement)
```

- `staleness_factor`: `1.0` if `fetched_at` is within the domain's expected
  refresh window (e.g. 24h for market indices per their own `cache_ttl`,
  1 year for BRF annual reports), decaying linearly to `0.7` at 2× that
  window, floored at `0.7` (data doesn't become worthless just because it's
  old — a BRF's 2-year-old equity ratio is still meaningful, just slightly
  less current).
- `corroboration_bonus`: `1.0` for `single_source`; `1.05` (capped at 1.0
  overall) for `corroborated` (two-plus independent sources agree);
  `0.9` for `conflicting` (the primary value in an unresolved or
  recency-resolved conflict is slightly discounted, since disagreement
  itself is informative).

This formula is intentionally simple and auditable — it is arithmetic the
Aggregator performs, not a judgment call, which is why it's legal for this
layer to compute it rather than the AI Analysis Engine.

### 7.4 MIP shape

```json
{
  "format_version": "1.0",
  "aggregator_version": "string",
  "built_at": "ISO-8601",
  "property": { "...Property object, §3, pass-through" },
  "engine_packages": [
    { "engine_id": "...", "engine_version": "...", "built_at": "...",
      "status_summary": "{ providers_total, providers_by_status }" }
  ],
  "domains": {
    "<domain_name>": {
      "findings": ["MergedFinding, i.e. Finding (§2.1) + { finding_id: string, contributing_sources: [Source], agreement: single_source|corroborated|conflicting, confidence: number, conflict_ref: string|null — set only when agreement is conflicting, points at conflicts[].id, and the finding's own value field is then read from conflicts[conflict_ref].values[primary_index], never stored separately }"]
    }
  },
  "conflicts": ["ConflictRecord, §7.2"],
  "missing": [
    { "domain": "string", "key": "string | null (null = whole domain missing)",
      "expected_from": ["engine_id, ..."], "reason_sv": "string" }
  ],
  "summary": {
    "engines_total": "int", "engines_by_status": { "...": "int" },
    "findings_total": "int", "oldest_finding_fetched_at": "ISO-8601|null",
    "newest_finding_fetched_at": "ISO-8601|null", "stale_engines": ["engine_id, ..."]
  }
}
```

---

## 8. AI Analysis Engine — `StructuredAnalysis` (the Report Generator's only input)

The AI Analysis Engine reads the MIP and nothing else (`37_platform_architecture.md`
§1.4, reaffirmed). Its output is the **complete** and **only** input to the
Report Generator.

```json
{
  "format_version": "1.0",
  "analysis_engine_version": "string",
  "generated_at": "ISO-8601",
  "property": { "...pass-through from MIP.property" },

  "verdict": {
    "label": "buy | buy_with_reservation | negotiate | reconsider | avoid",
    "label_sv": "Köp | Köp med reservation | Förhandla | Tänk igen | Avstå",
    "headline_sentence_sv": "string",
    "confidence": "number 0-1",
    "confidence_gate_passed": "bool — false when confidence <= 0.50; Report Generator renders the low-confidence Executive Summary variant already specified in kopanalys-report-design.md §1 when false",
    "top_reasons": [{ "text_sv": "string", "evidence_refs": ["finding_id, ..."] }],
    "top_risks": [{ "text_sv": "string", "risk_ref": "risk_factor id" }]
  },

  "risk_assessment": {
    "overall_level": "low | moderate | elevated | high | critical",
    "overall_level_sv": "string",
    "factors": [
      {
        "id": "string",
        "category": "financial_health | debt | fee | structural | trend | market | area",
        "severity": "low | medium | high | critical",
        "description_sv": "string",
        "evidence_refs": ["finding_id, ..."],
        "buyer_impact_sv": "string",
        "mitigating_factors_sv": ["string, ..."]
      }
    ]
  },

  "opportunities": [
    { "id": "string", "category": "string", "text_sv": "string",
      "confidence": "number 0-1", "evidence_refs": ["finding_id, ..."] }
  ],

  "trends": {
    "<metric_key>": {
      "direction": "improving | stable | declining | volatile | insufficient_data",
      "direction_sv": "string",
      "series": [{ "period": "string", "value": "number" }],
      "commentary_sv": "string | null"
    }
  },

  "statistical_interpretation": {
    "<metric_key>": { "percentile": "number|null", "benchmark_comparison_sv": "string|null" }
  },

  "narrative_sections": {
    "<content_doc_section_id>": { "paragraphs_sv": ["string, ..."] }
  },

  "missing_data": [
    { "domain": "string", "key": "string|null", "impact_sv": "string",
      "how_to_obtain_sv": "string" }
  ],

  "evidence_index": {
    "<finding_id>": {
      "value": "...", "display_value_sv": "string — pre-formatted for Swedish locale, e.g. '1 250 000 kr'",
      "source": { "name": "...", "url": "...", "license": "..." },
      "trust_tier": "string | null — null for AI-derived narrative claims that don't map to one raw finding",
      "confidence": "number 0-1",
      "fetched_at": "ISO-8601",
      "citation_sv": "string — pre-formatted footnote, e.g. 'Källa: Polisen, händelser · hämtat 2026-07-19'"
    }
  }
}
```

**Why `evidence_index` is flat and referenced by ID:** every citable claim
in `verdict`, `risk_assessment`, `opportunities`, and `narrative_sections`
points at a `finding_id` rather than embedding the full evidence object
inline. This keeps the payload from duplicating the same source/timestamp
dozens of times and gives the Report Generator one place to render every
citation footnote and confidence/trust badge (blueprint §1.5) from — it
never needs to reach back into the MIP.

**Rule enforced by this schema, not by convention:** every `evidence_refs`
array must resolve against `evidence_index`, and every
`verdict.top_risks[].risk_ref` must likewise resolve against
`risk_assessment.factors[].id` — the same reference-integrity requirement
applies to both pointer types, not just the first one. A `StructuredAnalysis`
with a dangling reference of either kind is invalid — this is the mechanism
that makes "every metric shown to the user must include source, timestamp,
confidence, and optional citation" (decision 14) structurally impossible to
violate by omission, rather than a rule someone has to remember to follow
in the template.

`content_doc_section_id` values are the section slugs from
`kopanalys-report-design.md` (`besked`, `objektet`, `brf`, `prisbedomning`,
`avgifter`, `skuldsattning`, `riskbedomning`, `utveckling`, `omradet`,
`saknade_uppgifter`) — fixed, so template and analysis-engine code can agree
on them without a lookup table.

---

## 9. Missing-data policy (platform-wide, exact microcopy)

One rule, three renderings, all defined here so no two components invent
different wording:

| Situation | Rendering | Swedish microcopy (exact) |
|---|---|---|
| A single field/metric is missing | Inline replacement of the value | `Uppgift saknas` |
| A whole page/section is below its minimum-data threshold (thresholds are exactly `kopanalys-report-design.md`'s "Minimum Data Requirements" table) | Blueprint §2 compact empty-state block | Heading: `Otillräckligt dataunderlag` — body: the specific `missing_data[].impact_sv` string from `StructuredAnalysis`, always ending with a pointer: `Se "Kompletterande uppgifter" för detaljer.` |
| The Executive Summary's confidence gate fails (`confidence_gate_passed = false`) | Whole-report banner replacing the verdict | `Analysen saknar tillräckligt dataunderlag för ett tillförlitligt besked.` (verbatim from `kopanalys-report-design.md` §1, kept as the canonical string) |

No component — Aggregator, AI Analysis Engine, or Report Generator — invents
its own "not available" phrasing. This is the complete list.

---

## 10. Evidence display rule (resolves decision 14 completely)

Every number, claim, or statement rendered anywhere in the PDF falls into
exactly one of two cases, and both are fully specified:

1. **Pass-through fact** (a raw `Finding` value shown as-is, e.g. a crime
   count, a price index) → rendered with the **trust/confidence badge**
   (blueprint §1.5) using `evidence_index[id].trust_tier` +
   `evidence_index[id].confidence`, and the **citation footnote** using
   `evidence_index[id].citation_sv`.
2. **AI-derived claim** (a verdict, risk description, trend label, narrative
   sentence) → rendered with **only** a confidence badge
   (`evidence_index` entries backing it have `trust_tier: null`, since
   trust_tier is a source-trust concept and an AI-authored sentence has no
   single source) plus citation footnotes for **every** `finding_id` in its
   `evidence_refs` — a claim can and often will cite multiple underlying
   facts.

There is no third case, and no metric is ever displayed without going
through `evidence_index` — the schema in §8 makes bypassing this
structurally impossible, not just discouraged.

---

## 11. Maps

**Decision:** static rendered map images, generated server-side as part of
Report Generator's HTML assembly (not client-side, since the target is a
PDF, not an interactive page).

**Provider:** MapTiler Static Maps API (REST endpoint, PNG output, custom
muted/light basemap style consistent with the report's print palette,
generous free tier appropriate for this project's scale, and it handles OSM
attribution automatically — relevant because `osm_poi`/`osm_construction`
findings already carry `source.license` that must be honored).
**Self-hosted `tileserver-gl` over an OSM extract** is the documented
scaling path if usage or cost ever requires moving off a third-party API —
noted here as the known migration route, not built now.

**What gets rendered onto the map:** the property pin (from
`Property.coordinates`), plus category-colored pins for `osm_poi` findings
within the requested radius (`inside_requested_radius: true`) — reusing data
that already exists in Location Intelligence's output, no new provider
needed for the map itself, only for the tile rendering.

---

## 12. PDF rendering pipeline

**Decision:** Report Generator produces HTML via **Jinja2** templates (one
template per blueprint page/Part, matching `report-pdf-layout-blueprint.md`
§3's page list 1:1), styled with print-media CSS (`@page` rules for A4,
margins, running headers/footers, page-break control per the blueprint's
§4 production notes), rendered to PDF via **WeasyPrint** (pure-Python,
integrates directly into the same stack as every engine, has native CSS
Paged Media support for the header/footer/page-number/watermark treatment
specified in the blueprint).

**Documented fallback**, not built now: if WeasyPrint's chart/SVG fidelity
proves insufficient during implementation (its CSS support, while good for
Paged Media, is not full Chromium-grade), the fallback is a headless
Chromium print-to-PDF via Playwright against the same HTML/CSS — the
Jinja2 templates are written to be renderer-agnostic so this switch doesn't
require redesigning the templates, only swapping the render step.

Charts (trend lines, maturity timelines, comparison bars) are rendered as
inline SVG generated server-side in the Jinja2 templates — no client-side
JS charting library, since there is no client at render time.

---

## 13. Branding (final, not a placeholder)

- **Canonical product name:** Köpanalys (with ö — this is the display
  name used on the cover, page titles, and anywhere the product is named in
  running text).
- **Domain / URL form:** kopanalys.se (ASCII, no diacritic — this is what
  appears in the footer wordmark and any URL, matching normal domain-name
  convention).
- **Footer treatment** (updates `report-pdf-layout-blueprint.md` §1.4):
  `Köpanalys · kopanalys.se` — brand name and domain together, small,
  7pt, secondary ink.
- This supersedes the three inconsistent names found in the existing
  codebase (Bostadsradar in `design-system.md`, "Property Analyzer" in the
  live frontend's `<title>`, and Köpanalys used inconsistently elsewhere) —
  **Köpanalys is now the canonical name for anything report-facing.**
  Whether the wider product (web app, marketing site) also renames to match
  is outside this document's scope — it addresses the report only.

---

## 14. Language

Swedish only for MVP — confirmed, binding. Every `_sv`-suffixed field in
this document's schemas is mandatory, not optional. No English fallback
path is defined; if a future localization requirement appears, the schema
extension point is adding parallel `_en` fields, not restructuring these
schemas — noted so that future work doesn't need to redesign this contract,
only extend it.

---

## 15. Authentication & rate limiting

The pipeline described in this document (§1) is expensive to run once —
a Hemnet fetch, a dozen-plus external provider calls across three engines,
an AI Analysis Engine pass, and a PDF render. **Triggering it is gated by
authentication and per-user rate limiting; this document's pipeline begins
*after* that gate, not at it.** Concretely: the entry point that accepts a
Hemnet URL and starts a report job is only reachable by an authenticated
caller, and is rate-limited per account/session, not just per IP.

This document doesn't design that authentication system — it isn't a
pipeline component, it's a prerequisite the pipeline assumes is already
true by the time the Orchestrator (§1.1) is invoked. Naming it here exists
to prevent the pipeline from being implemented behind an open, unauthenticated
endpoint by default, which is the failure mode this section closes off.

Outbound rate limiting (how the Listing Parser talks to Hemnet, how
providers talk to their own upstream APIs) is a separate, already-covered
concern — see §3's "Scraping etiquette" and each provider's own
`cache_ttl`/`deadline_s`.

---

## 16. Privacy & data retention

This pipeline processes real personal data, not hypothetically — by
construction, not as an edge case:

- `Property.address` and `Property.coordinates` identify a specific
  residential property and, by extension, whoever currently lives there or
  is selling it.
- The BRF Engine's `governance` domain (§6) captures named individuals —
  chairman, auditor — who did not consent to appearing in a commercial
  report.

Both fall under GDPR (this is a Sweden/EU product). This document does not
set retention policy or legal basis — that is owned by legal/compliance,
the same way the report's legal disclaimer content is (blueprint Part
VII, Methodology & Disclaimer page) — but it does fix what's within its own
scope:

- **Raw `Finding` data** (cached provider responses) is retained no longer
  than each provider's own `cache_ttl` governs — there is no separate,
  longer-lived raw-data store implied by anything in this contract.
- **The finished report** (`StructuredAnalysis` and rendered PDF) is
  retained under a policy that must be defined by legal/compliance before
  production launch — this document flags that requirement rather than
  answering it, and no component described here should be built assuming
  indefinite retention by default.

---

## 17. Caching strategy

Provider-level caching already exists in the real code
(`cache_ttl`/`from_cache`/`stale` per provider, §2.2) and is sufficient at
that layer — it governs whether an individual provider re-fetches from its
upstream source. It does not, by itself, prevent the pipeline from re-doing
*everything downstream* of a fully-cached set of provider results.

**Report-level cache:** keyed by `(property_id, MIP content hash)`. If a
repeat request's `Property` and every engine's findings are unchanged (all
still within their own `cache_ttl` windows, so the Aggregator would produce
a byte-identical MIP), the Aggregator's confidence computation, the AI
Analysis Engine pass, and the PDF render are all skipped, and the
previously generated `StructuredAnalysis`/PDF is served directly. This
matters most for the AI Analysis Engine step specifically: "text
generation" (decision 3) is most plausibly backed by an LLM call, the
single most expensive and highest-latency step in the pipeline if so —
paying that cost again for a request that changed nothing is avoidable
cost, not necessary freshness. Naming the cache key here is sufficient for
implementation to proceed; the storage backend is not an architecture
decision.

**Confidence drift across cache-window boundaries is expected, not a bug.**
`Finding.fetched_at` is stamped at fetch time; a re-fetch outside the
report-level cache's window can shift `staleness_factor`/
`corroboration_bonus` (§7.3) by a small amount even when the underlying
value hasn't changed, since the *evidence* is fresher even if the *fact*
isn't. The report-level cache above is what provides true idempotency
*within* a TTL window; small confidence drift *across* that window is
normal and should not be treated as a defect when it's eventually noticed.
