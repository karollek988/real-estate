# 38 — Location Intelligence Engine: Implementation Plan

**Date:** 2026-07-20 · **Status:** implementation plan — design only, no code in this doc.
**Predecessors:** `docs/36` (source research), `docs/37` (platform architecture), `docs/28` (proven `DataProvider` pattern + live-verified sources).

---

## 0. Scope contract (read this before building anything)

This engine has **one responsibility: collect, normalize, and package**
location intelligence for a Swedish property.

It does **not** analyze, score, rank, conclude, or recommend. Doc 36 §4.3
sketched a score/rank pipeline inside this engine — **that is superseded
by doc 37**: scoring and ranking belong to the Aggregator/AI layers. What
survives here from that sketch is only the *metadata* that makes later
scoring possible: every finding carries source, trust tier (doc 36 §4.4
including the new `DERIVED` tier), fetch time, coordinates/distance, and
coverage notes. Tagging is collection; weighing is not.

**Input:** a property address *or* lat/long.
**Output:** a Location Intelligence Package — the doc 37 envelope filled
with every finding the providers could collect, plus honest
`no_data`/`error`/`not_connected` statuses for everything they couldn't.

**Language/runtime decision:** standalone **Python package**
(`location_intelligence/`), not an extension of the existing TypeScript
frontend pipeline. Reasons: the unlock dependencies are Python (OWSLib
for WMS/WFS, feedparser, shapely/GeoPandas, PostGIS tooling per docs
30/36); doc 37 requires engines to be independently deployable; and the
existing TS providers' *query logic* (Overpass queries, SCB PxWeb
handling incl. the three real bugs fixed in doc 28) ports in hours, while
their learnings port for free. The TS pipeline keeps running unchanged
until the platform consumes this engine's packages.

**Bugs from doc 28 that are now design rules** (each cost a debugging
session once already — don't pay twice):

1. Enrichment ordering: providers needing coordinates/kommun run *after*
   resolution, via an in-memory context object updated between stages.
2. PxWeb column order: always resolve indices from the response's own
   `columns` metadata.
3. SCB year lag: resolve latest available `Tid` from table metadata,
   never assume `currentYear - 1`.
4. Overpass requires a `User-Agent` header (406 without one).
5. Partial failure must carry a `detail` even when status is `ok`.
6. Report exact counts within a radius, never fake "nearest" from
   unsorted samples.

---

## 1. Provider catalog

Complexity: **S** ≈ ½–1 day, **M** ≈ 1–3 days, **L** ≈ 1–2 weeks.
Maintenance: expected ongoing attention once built.

### P1 — Address Resolver

| | |
|---|---|
| Collects | Canonical address identity from raw input: accepts free-text address *or* lat/long; produces normalized street/number/postal/kommun/län + input-type flag. No network calls itself — it parses, validates, and routes. |
| Sources | None (pure normalization); kommun/län code table from SCB's static register (bundled, refreshed rarely). |
| Access | Local logic + one bundled lookup table. |
| Output | An `AddressContext`: raw input, normalized fields, kommun + län codes, input mode (address-first vs coords-first), validation warnings. This object is the input every other provider receives. |
| Dependencies | None. |
| Independent / parallel | Independent yes; parallel n/a — it runs *first*, alone (doc 37's pre-stage). |
| Complexity | **S** |
| Maintenance | **Low** (kommun table changes ~never; parsing edge cases accrete slowly) |

### P2 — Geocoder

| | |
|---|---|
| Collects | Coordinates for an address (forward) or address for coordinates (reverse); postal code, kommun confirmation, OSM place identity. |
| Sources | Nominatim (proven live, doc 28); Photon as planned fallback (doc 30 stack) behind the same interface. |
| Access | REST API (keyless, User-Agent required, 1 req/s etiquette). |
| Output | lat/long + precision level (rooftop/street/postal/kommun-centroid), reverse-resolved address fields, geocoder used, disagreement warnings if fallback was consulted. Precision level is critical downstream metadata — a kommun-centroid geocode must never silently feed 1km-radius POI queries. |
| Dependencies | P1 (AddressContext). |
| Independent / parallel | Runs in the sequential pre-stage with P1; everything after it is parallel. |
| Complexity | **S** (port of existing `nominatim_geocoding`) |
| Maintenance | **Low** |

### P3 — OSM/POI Provider (shared client + thin query modules)

One Overpass client, several thin query modules that the user-facing
provider list (Restaurant, Grocery, School-presence, Healthcare,
Transit-stop, Park, POI) shares. They are separate *findings domains* but
one implementation family — build the client once, add query modules at
~30 min each.

| | |
|---|---|
| Collects | Exact counts within fixed radii (500m/1000m) per category: restaurants, cafés, grocery, schools/preschools, healthcare (hospital/vårdcentral/pharmacy), transit stops, parks/green space, gyms/sport, playgrounds, major roads; distance to city center; named nearest N POIs per category *with coordinates* (facts, not judgments). |
| Sources | OSM Overpass API (proven live, doc 28); Nominatim for city-center resolution. |
| Access | API (keyless, best-effort public instance — self-hosted Overpass is the documented scale-up path, doc 28). |
| Output | Per-category count + POI list findings, each tagged ODbL license, `DERIVED`-relevant trust tier (community data), radius used, snapshot timestamp (the timestamp enables P12's delta computation later). |
| Dependencies | P2 (coordinates + precision gate). |
| Independent / parallel | Yes / yes. |
| Complexity | **S–M** (client is a port; query modules are trivial increments) |
| Maintenance | **Low-Medium** (Overpass instance flakiness, tag-convention drift) |

### P4 — Municipality Provider

| | |
|---|---|
| Collects | Area context: population + 5-yr growth, median income, education attainment (all proven, doc 28), plus Kolada municipal KPIs (new: taxes, service quality metrics, demographics trend). |
| Sources | SCB PxWeb (proven); Kolada API (keyless, doc 36/inventory). |
| Access | API + API. |
| Output | Kommun-level statistical findings, explicitly tagged `coverage: kommun-level` (not per-address) so the analysis layer can't mistake granularity. |
| Dependencies | P1 (kommun code) — not P2; runs off address resolution alone. |
| Independent / parallel | Yes / yes. |
| Complexity | **S** (SCB is a port with known bugs pre-fixed; Kolada is a clean REST API) |
| Maintenance | **Low** |

### P5 — School Provider (quality, not presence)

| | |
|---|---|
| Collects | Schools near the address from the official register with quality signals: grades/meritvärde, teacher certification share, student counts, huvudman type. Complements (not replaces) P3's presence counts. |
| Sources | Skolverket school-register + statistics APIs (official, keyless per inventory; scoped out of doc 28's round, never built). |
| Access | API. |
| Output | Per-school findings with coordinates + distance, `REGISTRY_AUTHORITY` tier, school-year of the statistics as validity metadata. |
| Dependencies | P2. |
| Independent / parallel | Yes / yes. |
| Complexity | **M** (two Skolverket APIs to join: register + statistics; field exploration needed) |
| Maintenance | **Low** (official, versioned) |

### P6 — Public Transport Provider

| | |
|---|---|
| Collects | Journey-time realities P3's stop-counts can't give: travel time to city center / major hubs, departure frequency at nearest stops, transport modes available. |
| Sources | Trafiklab — ResRobot routing + GTFS Sverige static (free key, doc 28/36). |
| Access | API (free key registration). |
| Output | Journey-time and frequency findings tagged with measurement assumptions (weekday morning departure, etc.) as explicit metadata. |
| Dependencies | P2; `TRAFIKLAB_API_KEY`. |
| Independent / parallel | Yes / yes. |
| Complexity | **M** (routing API semantics; choosing representative query times without drifting into "analysis") |
| Maintenance | **Low-Medium** (key quota tiers, GTFS refresh) |

### P7 — Planning Provider

| | |
|---|---|
| Collects | Tier 1 (now): Boverket Planbestämmelsekatalogen + ÖP-katalog — what plan provisions and comprehensive-plan metadata exist for the kommun. Tier 3 (later): per-case bygglov/detaljplan from kommun diarium adapters, Stockholm first. |
| Sources | Boverket APIs (official, keyless, doc 36 §2.1); kommun e-services (HTML, per-kommun, no API). |
| Access | API now; HTML scraping later (contained in `kommun_diarium/` adapter subtree per doc 36 layout). |
| Output | Planning-context findings tagged honestly: Boverket data is *rules/metadata* coverage (kommun-level), diarium data (when built) is *case-level*. The "no unified national API" gap stays visible as a coverage note, never papered over. |
| Dependencies | P1 (kommun); diarium adapters also need P2 (address for case search). |
| Independent / parallel | Yes / yes. |
| Complexity | **S** (Boverket) + **L** (each diarium adapter family) |
| Maintenance | **Low** (Boverket) / **High** (diarium scrapers — the single largest long-term maintenance surface, doc 37 Task 10) |

### P8 — Infrastructure Provider

| | |
|---|---|
| Collects | Roadworks, rail/road projects, traffic disruptions near the address. |
| Sources | Trafikverket Open API v2 (implemented in TS, endpoint verified live, field mapping unverified — doc 28). |
| Access | API (free key). |
| Output | Per-project findings with geometry/distance, project timespan as validity window (doc 37's observation-time vs validity-period rule matters most here: "planned 2030" ≠ "exists now"). |
| Dependencies | P2; `TRAFIKVERKET_API_KEY`. |
| Independent / parallel | Yes / yes. |
| Complexity | **M** (port + first live field-mapping verification) |
| Maintenance | **Low** |

### P9 — Environmental Provider

| | |
|---|---|
| Collects | Flood-zone membership (MSB), contaminated-land proximity with MIFO class (Länsstyrelsen EBH), strategic noise-map values where mapped, air-quality context in the 3 metros. The deepest gap doc 36 closed — data is real, free, official, and WMS/WFS-shaped. |
| Sources | MSB Översvämningsportalen WMS; Länsstyrelsen EBH WMS/Shapefile; Naturvårdsverket noise geodata; SLB-analys air stations. |
| Access | WMS/WFS + downloadable geodata (OWSLib), station API for air. |
| Output | Point-in-polygon / proximity findings per risk facet, each with dataset *version* as the freshness key (these update in years — dataset revision, not fetch date, is what matters), and honest `no_data` outside covered geography (noise: >100k-resident kommuner only; air: 3 metros) — never interpolated. |
| Dependencies | P2; OWSLib; for downloaded layers, a one-time ingest into PostGIS (doc 30 stack) so per-analysis lookups are local, per doc 36's cache-decoupling rule. |
| Independent / parallel | Yes / yes. |
| Complexity | **M–L** (first WMS integration is new muscle; each additional layer after the first is M→S) |
| Maintenance | **Low** (official layers, years-long cadence) — the *best* maintenance profile in the catalog once built |

### P10 — Crime Provider

| | |
|---|---|
| Collects | Recent local police-reported events near the kommun/area (Polisen händelser feed) + kommun/region-level crime statistics context (BRÅ static tables, ingested periodically). Per-address crime data does not exist in Sweden by design (doc 28) — the package says so explicitly as a coverage note. |
| Sources | Polisen.se events feed (near-real-time, regional); BRÅ static downloads. |
| Access | API/RSS-like feed (Polisen) + static file ingest (BRÅ). |
| Output | Event findings (type, place name, date) + statistical context findings, granularity tags mandatory (`polisregion` / `kommun`), Polisen tier `DIRECTORY` (real but non-authoritative format), BRÅ `REGISTRY_AUTHORITY`. |
| Dependencies | P1 (kommun/region mapping). |
| Independent / parallel | Yes / yes. |
| Complexity | **M** (Polisen feed stability needs verification — flagged in doc 36; BRÅ ingest is S) |
| Maintenance | **Medium** (feed format not contractually stable) |

### P11 — News Provider

| | |
|---|---|
| Collects | Recent local news items for the address's län/kommun: headline, date, link, source, geographic scope. Collection only — no relevance judgment, no sentiment (that's analysis). |
| Sources | SVT Nyheter Lokalt RSS (confirmed stable, all 21 län) first; then a **feed registry** (kommun → known RSS/HTML sources: kommun press pages, Mitt i, regional papers) per doc 36's finding that this category must be registry-driven, not hardcoded. |
| Access | RSS (feedparser) + registry-driven HTML fallback adapters. |
| Output | News-item findings, län-level coverage tags for SVT, per-feed trust tier (SVT `MANAGER_PORTAL`-equivalent 0.85; others `DIRECTORY`). |
| Dependencies | P1 (län/kommun); feedparser. |
| Independent / parallel | Yes / yes. |
| Complexity | **S** (SVT RSS) + **M** (registry mechanism) |
| Maintenance | **Low** (SVT) / **Medium-High** (long-tail feeds — bounded by the registry design: a dead feed is a registry row, not a code change) |

### P12 — Company Provider

| | |
|---|---|
| Collects | Business-activity context: new/closed company statistics per kommun + SNI code (monthly official CSV); later, amenity-delta ("what appeared/disappeared near this address since last snapshot") computed from P3's stored snapshots — the best available "new business nearby" proxy, per doc 36 §2.8. |
| Sources | Bolagsverket `ftgstat_oppna.csv` (CC BY 2.5 SE, monthly); own P3 snapshot store. |
| Access | Open-data CSV download + internal derived computation. |
| Output | Kommun-level registration-trend findings (`REGISTRY_AUTHORITY`); delta findings tagged **`DERIVED`** tier (doc 36 §4.4) — engine-computed from community data, must carry that label so analysis never over-trusts it. |
| Dependencies | P1 (CSV part); P3 snapshot history ≥2 runs (delta part). |
| Independent / parallel | Yes / yes (delta part reads only its own store). |
| Complexity | **S** (CSV) + **M** (delta store + diff) |
| Maintenance | **Low** |

### P13 — Construction Provider

| | |
|---|---|
| Collects | Active construction near the address: OSM `construction=*`/`building=construction` tagged sites now; kommun bygglov case data later via P7's diarium adapters (shared source, separate findings domain). |
| Sources | OSM Overpass (P3's client, new query module); P7 tier-3 adapters when they exist. |
| Access | API (Overpass). |
| Output | Construction-site findings with coordinates/distance/tags, `DERIVED`-adjacent community-source tier, snapshot timestamp. |
| Dependencies | P2, P3's client. |
| Independent / parallel | Yes / yes. |
| Complexity | **S** (near-zero marginal cost — doc 36 Tier 1 #3) |
| Maintenance | **Low** |

### P14 — Property Announcements Provider

| | |
|---|---|
| Collects | Forced-sale (exekutiv auktion) listings near the address from Kronofogden Auktionstorget. |
| Sources | Kronofogden Auktionstorget — HTML only, no API, ToS/robots posture unverified (doc 36 §2.11). |
| Access | HTML scraping — **gated on a legal/ToS review task before any code** (doc 35's scraping-discipline precedent). |
| Output | Auction-listing findings (address, date, type), tier `DIRECTORY`. |
| Dependencies | P2; the legal-review gate. |
| Independent / parallel | Yes / yes. |
| Complexity | **M** |
| Maintenance | **Medium-High** (unversioned government HTML) |

### P15 — Intelligence Package Builder

| | |
|---|---|
| Collects | Nothing — assembles. Takes every provider's findings + statuses and emits the versioned Location Intelligence Package per doc 37's envelope: findings with provenance/trust/freshness/coverage, per-provider status (`ok`/`partial`/`no_data`/`error`/`not_connected`/`disabled`), engine version, per-provider timings, package-level freshness summary. Enforces the honesty rules mechanically: a finding without source+timestamp+tier is rejected at build time (doc 37 Task 3 validation, applied at origin). |
| Sources | Internal. |
| Access | n/a. |
| Output | The engine's single deliverable. Versioned format from the first byte (doc 37 Task 10). |
| Dependencies | The provider interface contract; runs last. |
| Independent / parallel | n/a — it is the fan-in point. |
| Complexity | **M** |
| Maintenance | **Low** (contract changes are versioned RFCs, doc 37) |

### Cross-cutting runtime (not a provider, but must exist)

Provider registry + `DISABLED_PROVIDERS` toggle (doc 28 pattern), shared
HTTP client (User-Agent, timeouts, bounded polite retry), per-provider
try/except isolation, **parallel runner** (all post-pre-stage providers
concurrently, per-provider deadline), per-provider **cache with
source-matched TTLs** (doc 36's cache-decoupling rule: years for
WMS layers, monthly for Bolagsverket CSV, daily for news, per-address for
geocodes), and the conformance test suite (envelope validity, honest
failure, timeout behavior — doc 37 Task 9's admission gate, applied to
our own providers first).

---

## 2. Optimal implementation order

Scored on the five stated criteria (customer value, ease, reliability,
official sources, low maintenance):

| # | Wave | Contents | Why this position |
|---|---|---|---|
| 1 | **Foundation** | Package envelope + provider contract + registry + runner + P15 skeleton | Everything depends on the contract; doc 37 orders contracts before engines. Testable with synthetic providers before any real source. |
| 2 | **Pre-stage** | P1 Address Resolver, P2 Geocoder | Hard dependency of all else; ports of proven code; official-ish, zero maintenance. |
| 3 | **Proven ports** | P3 OSM/POI (client + first 6 query modules), P4 Municipality (SCB + Kolada) | Highest ease (working TS logic + pre-fixed bugs), national coverage, immediate ~20 real findings per address — the fastest route to a demonstrable package. |
| 4 | **Official quality APIs** | P5 Skolverket, P8 Trafikverket (get key), P7 Boverket catalogs | All `REGISTRY_AUTHORITY`, all low-maintenance, all high buyer value (schools and infrastructure are top decision factors); Boverket is the lowest-risk planning signal available. |
| 5 | **Environmental geodata** | P9: OWSLib spike → MSB flood → EBH contamination → noise → air | Highest *new* customer value in the whole catalog (doc 36's #1 pick); moderate ease only because WMS is new muscle — hence after the quick wins, but the best value-per-maintenance ratio once built. |
| 6 | **Feeds & signals** | P10 Crime (Polisen + BRÅ), P11 News (SVT RSS), P13 Construction tags, P12 Companies CSV | Real value, small builds, medium reliability (feed stability) — better sequenced after the official backbone exists. |
| 7 | **Keyed & derived** | P6 Trafiklab transit, P12 amenity-delta | Trafiklab needs key + routing semantics; delta needs P3 snapshot history to exist — both naturally later. |
| 8 | **Long tail (gated)** | P11 feed registry, P14 Kronofogden (post legal review), P7 Stockholm diarium adapter | Highest maintenance and/or legal gates; only after the engine is proving value. Stockholm diarium is the first deliberate step onto the 290-kommun surface — take it once, validate, then decide. |

Rationale summary: waves 1–4 are almost entirely official APIs and ports
of proven code — maximum reliability per hour spent, and after wave 4 the
engine already ships a genuinely useful package (~30+ findings, national
coverage). Wave 5 is the differentiator no competitor-adjacent product
surfaces (flood/contamination/noise per address). Waves 6–8 broaden
coverage at increasing maintenance cost, deliberately last.

---

## 3. Development backlog

Tasks sized ~30 min–3 h. Effort in hours. "DoD" = Definition of Done.
Task IDs are stable references for sprint planning.

### Wave 1 — Foundation

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| F-01 | Define the Intelligence Package envelope as typed models (findings, provenance, trust tiers incl. `DERIVED`, statuses, freshness, coverage notes, format version) | — | 3h | Models exist with docstrings; a hand-built example package validates; an invalid finding (missing source/timestamp) is rejected with a clear error |
| F-02 | Define the `Provider` interface (id, `collect(context)`, declared TTL, declared trust tier) + registry with `DISABLED_PROVIDERS` env toggle | F-01 | 2h | Two dummy providers register; disabling one via env var excludes it without code change |
| F-03 | Shared HTTP client: User-Agent, timeout, bounded backoff retry, per-source rate-limit hooks | — | 2h | Unit tests cover timeout, retry-then-fail, and header presence (Overpass 406 regression guard) |
| F-04 | Parallel runner: pre-stage sequential, all other providers concurrent with per-provider deadline; one provider's exception never touches another | F-02 | 3h | Test: 3 dummy providers (fast/slow/crashing) → package contains ok + timeout + error statuses respectively, wall time ≈ slowest surviving deadline |
| F-05 | Package Builder v1 (P15): assemble findings + statuses + timings + freshness summary into a versioned package | F-01, F-04 | 3h | Golden-master test: fixed dummy-provider inputs → byte-identical package |
| F-06 | Per-provider cache layer with TTL from provider declaration; stale-if-error serve with visible `stale` marker | F-02 | 3h | Test: second run within TTL hits cache; expired TTL refetches; failed refetch serves stale-marked copy |
| F-07 | Conformance test suite runnable against any provider (envelope validity, honest failure on network error, deadline compliance) | F-02, F-04 | 2h | Suite passes for dummy providers; wired into CI; documented as the admission gate for every future provider |
| F-08 | Engine CLI entry point: address or lat/long in → package JSON out (the engine's demo/debug harness) | F-05 | 1h | `python -m location_intelligence "Dalagatan 30, Stockholm"` prints a valid (mostly-empty) package |

### Wave 2 — Pre-stage

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| A-01 | Bundle SCB kommun/län code register as a static lookup + refresh script | F-01 | 1.5h | Lookup resolves name→code and code→name for all 290 kommuner; refresh script re-derives the table from SCB |
| A-02 | Address Resolver (P1): parse free-text vs lat/long input into `AddressContext` with validation warnings | A-01 | 3h | Test matrix: clean address, address without number, coords-only, garbage input → correct mode/fields/warnings each |
| A-03 | Geocoder (P2) forward: port Nominatim logic incl. User-Agent and rate etiquette; emit precision level | F-03, A-02 | 2h | Dalagatan 30 resolves to known coordinates with `street`-or-better precision; conformance suite passes |
| A-04 | Geocoder reverse: coords-only input → address fields + kommun | A-03 | 1.5h | Known Stockholm coords reverse to correct street + kommun |
| A-05 | Precision gate: providers declare minimum required precision; runner skips (status `no_data` + reason) when unmet | A-03, F-04 | 1.5h | Kommun-centroid geocode causes radius-based dummy provider to skip with explicit reason in package |

### Wave 3 — Proven ports

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| O-01 | Overpass client: query builder, User-Agent, polite no-aggressive-retry posture, snapshot timestamping | F-03 | 2h | Live count query for a known address returns plausible numbers; 504 surfaces as honest `error` with detail |
| O-02 | POI query modules ×6: restaurants, grocery, schools-presence, healthcare, transit-stops, parks (exact counts @500m/1000m) | O-01, A-05 | 3h | Each category returns counts for Dalagatan 30 matching doc 28's magnitudes; each finding carries ODbL license + radius + timestamp |
| O-03 | POI query modules ×4: gyms/sport, playgrounds, major roads, named nearest-N list per category with coordinates | O-02 | 2h | Findings include named POIs with distances computed from real coordinates (no fake-nearest — rule 6) |
| O-04 | Distance-to-city-center module | O-01 | 1h | Stockholm test address returns known-plausible distance |
| O-05 | POI snapshot store: persist each run's raw category results keyed (location, category, timestamp) for future delta computation | O-02 | 2h | Two runs produce two retrievable snapshots; store schema documented |
| M-01 | SCB provider (P4a): port population/income/education queries with metadata-driven year + column resolution (rules 2–3) | F-03, A-02 | 3h | Stockholm + Uppsala return real values; regression tests lock the two ported bug fixes |
| M-02 | Kolada provider (P4b): select ~10 decision-relevant KPIs, fetch per kommun | F-03, A-02 | 2.5h | KPIs return for 3 test kommuner; each finding tagged `coverage: kommun-level` |
| W3-V | Milestone verification: full engine run on 3 addresses (Stockholm, Uppsala, small-kommun) produces valid packages with ~20+ findings each | all above | 1.5h | Packages validate; conformance suite green for all live providers; run recorded as fixture for Aggregator development (doc 37 build order) |

### Wave 4 — Official quality APIs

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| S-01 | Skolverket API spike: map register + statistics endpoints, fields, join key (school unit code) — findings written up in the provider module's docstring | — | 2h | Documented field map; sample responses saved as test fixtures |
| S-02 | Skolverket provider (P5): schools within radius from register, with coordinates + distance | S-01, A-05 | 3h | Known school near test address appears with correct distance; `REGISTRY_AUTHORITY` tier |
| S-03 | Skolverket quality join: attach meritvärde/teacher-certification/size per school with school-year validity metadata | S-02 | 2.5h | Quality fields present where Skolverket publishes them; absent (not zero) where suppressed |
| T-01 | Obtain Trafikverket key; verify doc 28's unverified field mapping against a live response | F-03 | 1.5h | Live response parsed; field-mapping doc updated; key in env not code |
| T-02 | Trafikverket provider (P8): projects/disruptions within radius, project timespan as validity window | T-01, A-05 | 3h | Known ongoing Stockholm project appears; findings carry validity period distinct from fetch time |
| B-01 | Boverket provider (P7a): Planbestämmelse + ÖP catalog fetch per kommun, cached as periodically-refreshed reference data | F-03, F-06, A-02 | 3h | Catalog findings for test kommun; cache TTL weeks; coverage note "plan rules/metadata, not per-address case status" present verbatim |
| W4-V | Verification run: 3-address fixture refresh; package now includes school quality, infrastructure, planning context | all above | 1h | Fixtures updated; all providers green in conformance suite |

### Wave 5 — Environmental geodata

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| E-01 | OWSLib spike: connect to MSB WMS, list layers, execute one GetFeatureInfo for known flood-mapped coordinates — findings documented | F-03 | 3h | Reproducible script-level proof + notes on layer names/SRS/quirks (kept as module docstring, not code) |
| E-02 | Geodata store: PostGIS (or SpatiaLite fallback) ingest path for downloaded layers, keyed by dataset version | E-01 | 3h | One MSB layer ingested; point-in-polygon query answers locally in <50ms |
| E-03 | MSB flood module (P9a): flood-zone membership per address from local store, dataset-version as freshness key | E-02, A-05 | 2h | Known flood-zone coordinate → positive finding; known-dry coordinate → explicit "checked, not in mapped zone" (distinct from `no_data`) |
| E-04 | Länsstyrelsen EBH module (P9b): contaminated-site proximity + MIFO class | E-02 | 3h | Known EBH site appears with distance + class; per-län ingest documented |
| E-05 | Naturvårdsverket noise module (P9c): Lden/Lnight where mapped; honest `no_data` + coverage note outside >100k kommuner | E-02 | 3h | Stockholm address returns values; small-town address returns coverage-note `no_data` |
| E-06 | SLB air module (P9d): nearest-station reading + rolling context, 3 metros only, honest elsewhere | F-03 | 2.5h | Stockholm returns station data with distance; non-metro returns coverage-note `no_data` |
| W5-V | Verification: environmental facets present in fixtures; cache TTLs confirmed (dataset-version keyed, effectively years) | all above | 1h | Fixtures show all 4 facets behaving per coverage rules |

### Wave 6 — Feeds & signals

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| C-01 | Polisen feed spike: verify feed shape/stability (doc 36 flag), document region mapping | F-03 | 1.5h | Feed parsed; kommun→polisregion mapping table drafted |
| C-02 | Crime provider (P10a): recent events for the address's region, granularity tags mandatory | C-01, A-02 | 2.5h | Events appear with type/place/date; every finding tagged `polisregion` granularity |
| C-03 | BRÅ ingest (P10b): periodic static-table ingest → kommun-level context findings | F-06 | 3h | Table ingested; findings tagged `kommun`/`region` granularity, `REGISTRY_AUTHORITY` |
| N-01 | SVT RSS provider (P11a) via feedparser: län feed → recent items, 24h cache | F-03, F-06, A-02 | 2h | Stockholm län returns current items; SVT tier 0.85; län-coverage tag present |
| K-01 | Construction module (P13): `construction=*` query on P3's client | O-01 | 1.5h | Known construction site near test address appears; community-source tier tagged |
| G-01 | Bolagsverket CSV provider (P12a): monthly `ftgstat_oppna.csv` ingest, kommun+SNI trend findings, monthly TTL | F-03, F-06 | 2.5h | CSV parsed; test-kommun trend findings present; cache honors monthly cadence |
| W6-V | Verification: fixture refresh; crime/news/construction/companies present with correct granularity + tier tags | all above | 1h | Fixtures green; conformance suite green |

### Wave 7 — Keyed & derived

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| X-01 | Trafiklab key + ResRobot spike: routing request semantics, representative-time choice documented as neutral collection parameters | F-03 | 2h | One journey-time query works; parameter choices written down |
| X-02 | Transit provider (P6): journey time to center + frequency at nearest stops | X-01, A-05 | 3h | Findings for test address with assumptions in metadata; key via env |
| X-03 | Amenity-delta module (P12b): diff two P3 snapshots → appeared/disappeared findings, `DERIVED` tier enforced | O-05 | 2.5h | Synthetic snapshot pair produces correct delta; tier is `DERIVED`, mechanically verified by F-01 validation |

### Wave 8 — Long tail (gated)

| ID | Goal | Deps | Est | Definition of Done |
|---|---|---|---|---|
| L-01 | News feed registry (P11b): kommun→feeds data table + generic RSS adapter; dead-feed detection as registry state | N-01 | 3h | Adding a feed = adding a row; dead feed auto-flagged, not crashing |
| L-02 | Kronofogden legal/ToS review: robots.txt, terms, precedent check (doc 35 discipline) — decision memo, **no code** | — | 1.5h | Written go/no-go memo in docs; provider built only on "go" |
| L-03 | Kronofogden provider (P14) *if approved*: auction listings with locality matching | L-02, A-02 | 3h | Live listings parsed; `DIRECTORY` tier; polite fetch cadence |
| L-04 | Stockholm diarium spike (P7b): map Bygg- och plantjänsten search flow, feasibility memo before adapter work | — | 3h | Memo: request flow, stability assessment, effort estimate for the adapter — explicit go/no-go for the 290-kommun surface's first step |
| L-05 | Stockholm diarium adapter *if approved*: case search by address → case findings | L-04, A-05 | 3h | Real case data for a test address; contained in `kommun_diarium/stockholm_*`; `DIRECTORY` tier |

**Totals:** ~50 tasks, ~110 h of estimated effort. Waves 1–3 (~45 h)
produce a working engine emitting real packages; through wave 5 (~75 h)
it includes the environmental differentiator; waves 6–8 are incremental
breadth that can interleave with Aggregator development, which doc 37's
build order says should begin as soon as W3-V's fixture packages exist.

---

## 4. What is explicitly out of scope

- Any scoring, ranking, weighting, or verdicts (Aggregator/AI layers).
- The Aggregator, MIP, AI analysis, and report layers (doc 37 owns them).
- Non-Stockholm diarium adapters (decision gate at L-04's memo).
- Commercial data sources (project free-first posture, doc 28).
- Self-hosted Overpass (documented scale-up trigger: sustained 504 rates
  from the public instance, doc 28's reliability note — not before).
