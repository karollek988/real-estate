# 36 — Location Intelligence Engine (Research & Architecture)

Status: **Research and architecture design only — no code written, no implementation.**

## 1. Executive summary

This document scopes a **Location Intelligence Engine**: a plugin-based
subsystem that answers, for any Swedish address, "what information about
this location can influence a home-buying decision?" It aggregates signal
from many independent topic domains — urban planning, transit,
environment, crime, schools, local news, new businesses, construction,
property announcements — into one scored, ranked, source-attributed
output the Decision Engine can consume.

**What this doc is:**
- A catalog of Swedish data sources per topic, distinguishing what's
  already covered/implemented elsewhere (reused, not re-researched) from
  what's genuinely new research this pass.
- A ranked table of relevant open-source repos not already listed in
  `docs/30_open_source_reuse_research.md`.
- A plugin architecture that reuses three already-designed patterns in
  this codebase: the `DataProvider` interface (`docs/28`), the
  generate→enrich→score→rank pipeline (`docs/29`), and the trust-tier
  model (`docs/34`/`docs/35`).
- A prioritized build roadmap with caching/refresh-interval reasoning.

**What this doc is NOT:**
- No code, no schemas, no API client implementations.
- Not a re-derivation of sources already fully documented — Trafikverket,
  Trafiklab/GTFS/SL/ResRobot, Skolverket, BRÅ/Polisen, SMHI (weather),
  Kolada, Region Stockholm/Stockholms Stad Open Data, OSM/Overpass,
  Lantmäteriet, and Bolagsverket (identity) are cited from `docs/28`,
  `docs/29`, `docs/30`, `docs/34`, `docs/35` and `docs/data-source-inventory.md`
  with depth added only where those docs flagged an explicit gap.
- Not a business/pricing decision — commercial/paid options are noted
  only as fallback context, consistent with this project's free-first
  posture (`docs/28`).

---

## 2. Data source catalog

Legend for **Reused?** column: **Reused** = already documented in an
existing doc, cited verbatim/summarized here for completeness;
**New** = researched fresh this pass to close a named gap;
**Extended** = existing doc named it but didn't research depth (e.g. MSB
flood, mentioned-but-unused) — this pass adds real access-model detail.

### 2.1 Urban development & municipal planning

| Source | Access type | Reliability | Update freq. | License | Scrape difficulty | Maintenance burden | Auth | Coverage | Reused? |
|---|---|---|---|---|---|---|---|---|---|
| Region Stockholm / Stockholms Stad Open Data, Nya tunnelbanan | Open Data portal, mixed formats | Medium — fragmented per source | Irregular | Open (varies) | Medium | Medium | None | Stockholm region only | Reused (`docs/28` §`municipality_plans`) |
| **Boverket Planbestämmelsekatalogen** | API (XML/JSON) + Excel | High — official national registry of plan provisions (~3,650 entries) | Periodic, tied to plan updates | Open data, source attribution required | Low (documented API) | Low | None | National, but only *plan provisions*, not per-address plan status | New |
| **Boverket ÖP-katalogen (översiktsplaner) API** | API | High | Irregular (per-kommun plan revision cycle, years) | Open data | Low | Low | None | National catalog of municipal comprehensive plans, metadata not full-text search per address | New |
| **Boverket Plan- och byggenkäterna (lov/bygglov statistics)** | Open data downloads | Medium — aggregated survey data from Länsstyrelser/kommuner, not case-level | Annual | Open data | Low | Low | None | National, statistical only | New |
| **Kommun bygglov/detaljplan diarium (e.g. Stockholms stad "Bygg- och plantjänsten")** | HTML e-service, case search by address/diarienummer | Medium — real per-case data exists but no bulk API found | Continuous (per case) | Unclear/no explicit open license | High — one bespoke e-service per kommun (~290), Stockholm's uses session-based search, no documented API | High — 290 municipalities, each different system (many run on Castor/ByggR/Vision-type vendor platforms) | None for search, but no batch export | Per-kommun, requires per-kommun adapter | New |
| Vendor case-management platforms behind kommun bygglov portals (ByggR, Castor, Vision) | HTML only, vendor-proprietary | Unknown — not independently verified | Continuous | Vendor-controlled | High | High | None documented | Used by many but not all of 290 kommuner | New (named, not deep-verified — flagged for follow-up) |

**Finding:** there is still no unified national bygglov/detaljplan case-level
API — this confirms and extends `docs/28`'s `municipality_plans` gap.
Boverket's *catalogs* (plan provisions, ÖP metadata) are real, structured,
and free, but they describe planning *rules*, not per-address case status.
Getting per-address "is there a new development planned near this address"
signal still requires either (a) a per-kommun scraper against the
diarium/e-service the kommun happens to run, or (b) OSM-derived proxies
(construction sites tagged `construction=*`, already partially covered by
`osm_amenities`'s pattern in `docs/28`). Recommendation: treat kommun-level
scraping as tier-2 (see §5), start with Boverket's structured catalogs +
OSM proxies for tier-1.

### 2.2 Public transportation

| Source | Access type | Reliability | Update freq. | License | Reused? |
|---|---|---|---|---|---|
| Trafiklab (GTFS Sverige, ResRobot, SL realtime) | API/GTFS static+realtime | High | Static: periodic; realtime: live | Open (Trafiklab terms) | Reused (`docs/28` §`public_transport` gap note, `docs/30`) |
| OSM transit stop presence (`osm_amenities`) | Overpass API | High (community-maintained) | Continuous, community-edited | ODbL | Reused (`docs/28`, implemented) |

No new research needed — `docs/28` already scoped Trafiklab as the richer
follow-up to OSM's stop-presence-only signal; still unbuilt but understood.

### 2.3 Schools

| Source | Access type | Reliability | Update freq. | License | Reused? |
|---|---|---|---|---|---|
| Skolverket (school register + quality/results API) | API | High, official | Annual (results), rolling (register) | Open | Reused (`docs/28` §`school_ratings`) |
| OSM school presence/count (`osm_amenities`) | Overpass API | Medium (presence only, no quality) | Continuous | ODbL | Reused, implemented |

No new research needed.

### 2.4 Restaurants / amenities

| Source | Access type | Reliability | Reused? |
|---|---|---|---|
| OSM `osm_amenities` (restaurant/grocery/park counts) | Overpass API | High for presence, no ratings | Reused, implemented |

Restaurant *quality* (ratings, cuisine popularity trends) has no free
Swedish-specific structured source; out of scope beyond OSM presence per
`docs/28`'s existing honest-gap framing.

### 2.5 Crime

| Source | Access type | Reliability | License | Reused? |
|---|---|---|---|---|
| BRÅ (bra.se) static tables | Static download only, no API | High content, low granularity (no per-address, statistical-disclosure-controlled) | Open | Reused (`docs/28` §`crime_statistics`, verified `api.bra.se` doesn't resolve) |
| Polisen.se local event reports | RSS/HTML "händelser" per polisregion | Medium — near-real-time local incident log, not crime *statistics* | Open, unclear machine-readable terms | New (adds depth: Polisen publishes a public "händelser i Sverige" RSS-like feed by region, closer to hyperlocal signal than BRÅ's static regional tables, though still not per-address and needs verification of feed stability) |

### 2.6 Infrastructure (roadworks etc.)

| Source | Access type | Reliability | Reused? |
|---|---|---|---|
| Trafikverket Open API v2 | API, free key on request | High (confirmed live, 401 without key) | Reused (`docs/28` §`infrastructure_projects`) |

### 2.7 Local news

| Source | Access type | Reliability | Update freq. | License | Scrape difficulty | Coverage | Reused? |
|---|---|---|---|---|---|---|---|
| **Mitt i (mitti.se)** | HTML, no confirmed public RSS found this pass | Medium — genuine hyperlocal Stockholm-region coverage per stadsdel | Continuous | Unclear, publisher copyright | Medium — needs per-article scraping or an unverified/undocumented feed | Stockholm region (multiple local editions) | New |
| **SVT Nyheter Lokalt (per-län sections, e.g. svt.se/nyheter/lokalt/stockholm)** | Confirmed RSS feeds exist for SVT local sections | High — public broadcaster, stable | Continuous | Public-service content, check reuse terms | Low (RSS is structured) | All 21 län | New |
| Kommun press-release pages (e.g. "Nyheter" section on kommun.se sites) | HTML, occasionally RSS | Medium | Irregular | Kommun-owned, generally reusable for factual info | Medium — per-kommun template variance | Per-kommun, 290 potential adapters | New |
| Regional/local newspaper sites (Norrtelje Tidning, Vi i Sollentuna, etc., via feedspot-style aggregator directories) | RSS where available | Variable | Continuous | Publisher-owned, often paywalled beyond headline | Medium | Fragmented, per-outlet | New (named as a category, not exhaustively enumerated — genuinely too fragmented for one canonical list; recommend building a feed *registry* keyed by kommun rather than hardcoding sources) |

**Finding:** no single Swedish "local news API" exists (expected, same
structural gap pattern as `municipality_plans`). SVT's local RSS feeds are
the most reliable, lowest-maintenance starting point (public broadcaster,
stable URLs, genuine per-län granularity) even though their granularity is
coarser than a single kommun. Everything else in this category is
long-tail and should be modeled as a *pluggable feed registry* (kommun →
list of known RSS/HTML sources), not individually hardcoded providers —
this keeps the maintenance burden bounded as coverage grows.

### 2.8 New businesses / company activity

| Source | Access type | Reliability | Update freq. | License | Reused? |
|---|---|---|---|---|---|
| Bolagsverket identity/org lookup | API, requires org number | High | Rolling | Official (agreement/paid tier for some) | Reused (`docs/28`/`docs/34`, identity only, blocked on org-number matching prerequisite) |
| **Bolagsverket new/closed company statistics (`ftgstat_oppna.csv`)** | Open data CSV | High, official | Monthly (1st business day) | CC BY 2.5 SE | New |
| **Bolagsverket "Notifications about changes" service** | API (push/poll notification of registered changes per org number) | High, official | Near-real-time per subscribed org number | Official API terms | New — useful for *tracking* a known company, not *discovering* new ones near an address |
| **Bolagsverket "Valuable Data Sets" API (SNI codes, digitally submitted annual reports)** | API | High, official, EU high-value dataset | Weekly | Free | New |

**Finding:** none of these give a direct "new restaurant opened at this
address" signal — Bolagsverket data is registration-event-level
(company formed/closed, SNI industry code, no street-level "new business
opened near you" feed exists in Sweden today). The best proxy remains
OSM's amenity presence deltas over time (diffing `osm_amenities` snapshots
across analysis runs) — a derived signal this engine can compute itself
rather than sourcing externally, worth noting for the plugin design in §4.

### 2.9 Environmental risks (beyond weather)

| Source | Access type | Reliability | Update freq. | License | Scrape difficulty | Coverage | Reused? |
|---|---|---|---|---|---|---|---|
| **MSB Översvämningsportalen (flood mapping)** | WMS (INSPIRE-compliant) + downloadable Shapefile/GeoTIFF | High, official | Irregular (per remapping cycle) | Open, MSB-published | Medium — WMS integration is standard GIS work, needs an OWS client (see §3) | National, flood-relevant areas (rivers/lakes with mapped risk, not universal) | Extended (named as unused in `docs/28`; this confirms real WMS/download access exists) |
| **Länsstyrelsen EBH-stödet (potentially/confirmed contaminated land, "förorenade områden")** | WMS + downloadable Shapefile via Länsstyrelsernas GeodataKatalog | High, official (MIFO-classified sites) | Irregular, per-inventory update | Open (per Länsstyrelse) | Medium — same WMS/geodata-catalog pattern as MSB | National, per-län geodata catalog entries | New |
| **Naturvårdsverket/SLB-analys air quality (Stockholm, Gothenburg, Malmö)** | Real-time station data (SLB-analys), some via dataportal.se; SMHI Luftwebb aggregates on behalf of Naturvårdsverket | High for the 3 major metro areas; sparse elsewhere | Real-time (hourly-ish) for stations; regional dispersion models less frequent | Open (varies by publisher) | Medium — station-based, not full spatial coverage; interpolation would be needed for arbitrary addresses | 3 major metros only; national coverage thin | New |
| **Naturvårdsverket strategic noise maps (bullerkartläggning, EU Noise Directive Lden/Lnight)** | Downloadable via Naturvårdsverkets Metadata Catalog for Geodata; Shapefile | High, official, EU-mandated (Cnossos-EU methodology) | Every 5 years (EU directive cycle) | Open | Medium — geodata catalog + GIS processing | Major roads/rail/airports and municipalities >100k residents only | New |
| Stockholm-specific noise map (Miljöbarometern bullerkarta, 2D/3D) | Interactive web map, unclear if machine-accessible beyond the map viewer | Medium | Continuous updates layered on 2022 base | Stockholms Stad open data terms likely apply | Medium-high (may require reverse-engineering map tile/API endpoints) | Stockholm municipality only | New |

**Finding:** this is the deepest genuine gap in the whole catalog. All
four true environmental-risk facets (flood, contamination, air, noise)
**do have real, free, official Swedish data**, contradicting the
implicit assumption in `docs/28` that this space is entirely blocked —
it's not blocked, it's just **geodata-shaped** (WMS/WFS + Shapefile/GeoTIFF)
rather than REST/JSON, which is why it wasn't picked up in a
free-keyless-API sweep. This is exactly the kind of source an
`OWSLib`-based plugin (see §3) unlocks without needing any new commercial
vendor.

### 2.10 Government projects / construction

| Source | Access type | Reliability | Reused? |
|---|---|---|---|
| Trafikverket infrastructure projects | API, free key | High | Reused (`docs/28`) |
| OSM `construction=*`/`building=construction` tags | Overpass API | Medium — community-tagged, coverage varies, but free and already integrated pattern | New use of existing provider — extend `osm_amenities`-style query set rather than a new source |
| Kommun bygglov diarium (per §2.1) | HTML, per-kommun | Medium, high maintenance | New, same source as §2.1 |

### 2.11 Property-related announcements (auctions, evictions, zoning appeals)

| Source | Access type | Reliability | Update freq. | License | Coverage | Reused? |
|---|---|---|---|---|---|---|
| **Kronofogden Auktionstorget (exekutiv auktion — forced property sales)** | HTML web platform only; no documented API found this pass | High content, free, public | Continuous (live listings) | Government site, no explicit open-data license found | National | New |
| Kommun press releases re: zoning appeals (överklagande av detaljplan) | HTML, per-kommun, no structured feed | Low-medium | Irregular | Kommun-owned | Per-kommun | New (folded into §2.1/§2.7 kommun-adapter pattern, not a separate source type) |

**Finding:** Kronofogden's Auktionstorget is a real, valuable, address-adjacent
signal (a forced sale near/at an address is materially relevant to a buyer)
but has **no API** — scraping the public listing pages is the only path,
and no rate-limit/ToS documentation was found this pass (flagged for legal
review before building, consistent with this project's scraping-discipline
precedent in `docs/35` §5-6).

---

## 3. GitHub OSS repo ranking table

Cross-checked against `docs/30_open_source_reuse_research.md`'s existing
16 (Docling, Playwright, Instructor, Crawlee, PostGIS, MapLibre, Photon,
pgvector, Meilisearch, OSMnx, r5py, GeoPandas, ixbrl-parse, pyscbwrapper/
PxWeb, model-res-avm/OpenAVMKit, hemnet scrapers) — none of those are
repeated below. Only genuinely new repos relevant to this doc's scope.

| GitHub URL | Stars (approx.) | Language | Last update | License | Why useful | Use it? |
|---|---|---|---|---|---|---|
| [geopython/OWSLib](https://github.com/geopython/OWSLib) | ~420 | Python | Active | BSD-3 | Standard OGC client for WMS/WFS/WCS/CSW — the single unlock for MSB flood maps, Länsstyrelsen EBH, Naturvårdsverket noise-map geodata catalogs, all of which are WMS/WFS-shaped, not REST APIs | **Yes** |
| [DinoTools/python-overpy](https://github.com/DinoTools/python-overpy) | ~260 | Python | Active | MIT | Structured Overpass API result wrapper (typed nodes/ways/relations) — could replace hand-rolled Overpass query/parse code as `osm_amenities` grows more query types (construction tags, new-business proxies) | Maybe — only if the existing `osm_amenities` Overpass client becomes a maintenance burden; not a blocker today |
| [kurtmckee/feedparser](https://github.com/kurtmckee/feedparser) | ~2,300 | Python | Active | Multiple (BSD-ish) | The de facto standard RSS/Atom parser — needed for SVT local news, kommun press releases, and any local-news feed registry (§2.7, §4) | **Yes** |
| [geopy/geopy](https://github.com/geopy/geopy) | ~4,800 | Python | Active | MIT | Unified geocoder interface across many backends (Nominatim, Photon, etc. already chosen in `docs/30`) — useful as a thin abstraction layer if a second geocoder is ever added as fallback, not a replacement for Photon | Maybe — only if multi-geocoder fallback becomes a requirement |
| [Toblerity/rtree](https://github.com/Toblerity/rtree) | ~680 | Python (ctypes over libspatialindex) | Active | MIT | Fast in-memory spatial index — useful for "which planning/environmental-risk polygons contain this point" lookups when doing bulk/offline WFS-derived polygon joins, complementary to PostGIS (already chosen) for local/batch processing without a DB round-trip | Maybe — PostGIS already covers the served/production path; rtree only adds value for local batch scripts (e.g. offline MSB polygon pre-processing) |
| [uber/h3-py](https://github.com/uber/h3-py) | ~790 | Python (C bindings) | Active | Apache-2.0 | Hexagonal spatial indexing — useful for pre-aggregating dense signals (news mentions, business openings) into fixed-size cells for caching/refresh-interval bucketing at scale (see §5 caching notes) | Maybe — valuable specifically at the "millions of analyses" scale target in §5, premature for MVP |

**Assessment:** the two clear additions are **OWSLib** (structurally
necessary — it's the only way to consume the flood/contamination/noise
geodata found in §2.9 without hand-rolling WMS/WFS XML parsing) and
**feedparser** (necessary for the local-news plugin in §2.7). The other
three are reasonable future-scale tools, not MVP blockers — flagged
"maybe" rather than "yes" to avoid over-recommending infra ahead of need,
consistent with `docs/30`'s existing discipline of a lean MVP stack.

---

## 4. Plugin-based architecture design

### 4.1 Directory shape

```
location_intelligence/
├── plugins/
│   ├── planning/          # Boverket catalogs, kommun bygglov diarium adapters
│   │   ├── boverket_planbestammelser.py
│   │   ├── boverket_op_katalog.py
│   │   └── kommun_diarium/            # one adapter per kommun vendor system, added incrementally
│   │       └── stockholm_byggplantjansten.py
│   ├── traffic/            # reuse existing Trafikverket provider
│   ├── transit/            # reuse existing Trafiklab scope (unbuilt per docs/28)
│   ├── schools/            # reuse existing Skolverket scope (unbuilt per docs/28)
│   ├── restaurants/        # reuse existing osm_amenities
│   ├── crime/
│   │   ├── bra_static.py           # existing gap, static tables only
│   │   └── polisen_handelser.py    # new: local incident feed
│   ├── news/
│   │   ├── feed_registry.py        # kommun -> [feed sources], data-driven not hardcoded
│   │   ├── svt_lokalt.py
│   │   └── mitti.py
│   ├── companies/
│   │   ├── bolagsverket_stats.py       # new/closed company CSV
│   │   └── osm_amenity_delta.py        # derived: diff osm_amenities snapshots over time
│   ├── environment/
│   │   ├── msb_flood_wms.py
│   │   ├── lansstyrelsen_ebh_wms.py
│   │   ├── slb_air_quality.py
│   │   └── naturvardsverket_noise.py
│   ├── construction/
│   │   └── osm_construction_tags.py    # extends osm_amenities query set
│   └── property_announcements/
│       └── kronofogden_auktionstorget.py
├── trust/
│   └── source_tiers.py     # reuses docs/34's REGISTRY_AUTHORITY/MANAGER_PORTAL/DIRECTORY/USER shape
├── ranking/
│   └── pipeline.py         # reuses docs/29's generate→enrich→score→rank→verify shape
└── registry.py             # DataProvider registration, DISABLED_PROVIDERS env toggle (docs/28 pattern)
```

### 4.2 How each plugin conforms to the `DataProvider` pattern (doc 28)

Every plugin implements the same `collect()` contract already established:
independent, try/caught per-call in the orchestrator, writes into the
shared `attributes` dict under forward-contract keys (e.g.
`nearby_planned_projects`, `environmental_risk_score`,
`local_news_mentions_90d`, `days_since_last_forced_sale_nearby`), honest
`not_connected`/`no_data`/`partial` status rather than fabricated values,
and toggleable independently via `DISABLED_PROVIDERS`. WMS/WFS-backed
plugins (environment/*) are a variant of the same interface — `collect()`
internally does an OWSLib `GetFeatureInfo`/`GetFeature` call instead of a
REST GET, but the external contract (attributes dict, status field) is
identical, so the Decision Engine and orchestrator need zero awareness of
the transport difference.

### 4.3 How results merge/score/rank (doc 29 pattern reused)

For topics where **multiple sources can answer the same question** (e.g.
"is there planned development near this address?" could come from
Boverket catalogs, a kommun diarium adapter, or an OSM construction-tag
proxy), the doc-29 generate→enrich→score→rank→verify pipeline applies
directly:

```
Address + coordinates
        │
        ▼
 1. Candidate Generation   — each relevant plugin proposes 0..N signals
        │                     (e.g. 3 planning sources may each report
        │                     a nearby project)
        ▼
 2. Candidate Enrichment   — normalize each signal (distance, date,
        │                     project type) to comparable fields
        ▼
 3. Scoring Model          — weighted by source trust tier (§4.4) +
        │                     recency + proximity, same normalized-[0,1]
        │                     signal approach as doc 29 §4
        ▼
 4. Ranking + Confidence   — top-N planned projects per address, with
        │                     doc 29's top_score/gap_to_second confidence
        │                     formula reused verbatim
        ▼
 5. Verification           — cross-check: does an OSM construction tag
        │                     exist near the same coordinates as a
        │                     Boverket/kommun-reported project? Agreement
        │                     raises confidence, exactly doc 29 §6's
        │                     pattern
        ▼
 6. Fallback               — High/Medium/Low/Conflicting bands, same as
                              doc 29 §7 — never fabricate "no planned
                              development" from absence of data; report
                              "no signal found" distinctly from "checked,
                              confirmed none"
```

Single-source topics (e.g. weather-adjacent air quality station reading)
skip straight to a thin score/status write, same as today's simpler
providers in `docs/28` — the pipeline is only invoked where genuine
multi-source disambiguation is needed.

### 4.4 Trust tiering (doc 34/35 pattern reused)

Applied to this engine's source mix:

| Trust tier (from docs/34 §5.2) | Location-intelligence occupants |
|---|---|
| `REGISTRY_AUTHORITY` (ceiling 1.0) | Boverket catalogs, Trafikverket, Skolverket, SCB, MSB WMS, Länsstyrelsen EBH WMS, Naturvårdsverket noise maps, Bolagsverket stats — all official-government sources |
| `MANAGER_PORTAL`-equivalent (ceiling 0.85) | SVT Nyheter Lokalt (public broadcaster, stable but not the primary-source authority itself) |
| `DIRECTORY`-equivalent (ceiling 0.6) | Kommun-specific diarium adapters, Mitt i and other publisher-owned local news, Polisen händelser feed (real but non-authoritative-format), Kronofogden Auktionstorget (official but no structured/versioned API to fully trust programmatically) |
| `USER` | Not applicable to this engine (no user-submitted signals in scope) |
| **New: `DERIVED`** (ceiling matches weakest input signal) | OSM construction-tag proxy, OSM-amenity-delta "new business" proxy — computed by this engine itself from a lower-trust community source (OSM, ODbL), so it must never outrank a same-topic `REGISTRY_AUTHORITY` signal even at high internal confidence |

Adding a `DERIVED` tier below `DIRECTORY` is this doc's one small proposed
extension to the doc-34 tier model — needed because this engine, unlike
BRF-website discovery, computes some of its own signals (deltas over time)
rather than only looking up external sources, and those computed signals
should never be trusted as highly as even a low-tier external one.

---

## 5. Prioritized implementation roadmap

Ranked by (a) data availability confirmed this pass, (b) reliability/
maintenance cost, (c) value to a home-buying decision, with caching
implications noted per source's real update frequency — important at the
"millions of analyses over years" scale this is meant to serve, since
most of these sources update far slower than a per-request fetch would
imply.

### Tier 1 — Build first (high value, low maintenance, data confirmed free)

1. **Environment plugin: MSB flood WMS + Länsstyrelsen EBH WMS.** Highest
   decision-relevance of anything in this doc's new research (flood risk
   and contaminated land are underwriting/insurance-relevant, currently a
   complete gap per `docs/28`). Both are official, free, stable WMS
   layers. **Cache aggressively** — flood/contamination maps update on
   the order of years; a point-in-polygon lookup result can be cached
   per-geometry-version for the lifetime of that MSB/Länsstyrelsen
   dataset revision, not per-analysis.
2. **Boverket planning catalogs (Planbestämmelser + ÖP-katalog).**
   Official, structured, already-documented APIs — lowest engineering
   risk in the whole planning category. Cache per catalog refresh cycle
   (irregular but infrequent); this is reference data, not per-address
   live data, so treat it as a periodically-refreshed local lookup table
   rather than a per-analysis API call.
3. **OSM construction-tag extension to `osm_amenities`.** Near-zero
   marginal engineering cost — same provider, same Overpass query
   pattern already proven reliable in `docs/28`, just an added tag
   filter. Gives an immediate, free "is something being built nearby"
   signal while the harder kommun-diarium path (below) is built out.

### Tier 2 — Build next (real value, moderate engineering)

4. **News plugin: SVT Nyheter Lokalt RSS.** Confirmed stable, structured,
   free, per-län. Lower granularity than a hyperlocal feed but the best
   cost/reliability ratio in the news category — same reasoning `docs/35`
   §6 used to rank allabrf.se first among BRF sources (best coverage for
   near-zero engineering cost). **Cache short** — news is the fastest-
   changing source in this catalog; a 24h refresh window is reasonable.
5. **Bolagsverket new/closed company statistics CSV.** Official, free,
   monthly cadence, directly answers "is business activity growing in
   this area" at the kommun/SNI-code level (not per-address, but a real,
   cheap area-level signal analogous to how SCB already enriches area
   context in `docs/28`). **Cache monthly**, matching the source's own
   update cadence exactly — polling more often than the source publishes
   is pure waste at scale.
6. **Environment plugin: SLB air quality + Naturvårdsverket noise maps.**
   Real and free, but geographically thin (3 metros for air; only
   >100k-resident municipalities + major infra for noise) — still worth
   building because Stockholm/Göteborg/Malmö cover a large share of
   likely users, but explicitly degrade honestly (`not_connected`/
   `no_data`, per `docs/28`'s established convention) outside covered
   areas rather than interpolating a fabricated estimate. **Cache**: air
   quality station readings are near-real-time (poll hourly-ish if ever
   surfaced live, but a daily/weekly rolling average is more decision-
   relevant than instantaneous readings for a buying decision); noise
   maps update on a 5-year EU-mandated cycle — cache essentially
   indefinitely per dataset version.

### Tier 3 — Build once Tier 1-2 prove out (high value, high engineering cost)

7. **Kommun bygglov/detaljplan diarium adapters, starting with
   Stockholm.** Real per-case data, but no bulk API — this is a scraper-
   per-kommun investment, same shape and cost profile as the
   `docs/35` §6 Tier-2/3 manager-portal build-out for BRF sources. Start
   with the single highest-population kommun (Stockholm), validate the
   adapter pattern, then decide whether to expand per-kommun or wait for
   a possible future national API. **Cache** per diarium case at whatever
   granularity the kommun's own case-update cadence allows (days-weeks,
   not real-time).
8. **Local news long tail (Mitt i, kommun press releases, regional
   papers) via a feed-registry model**, not individually hardcoded
   sources — mirrors this doc's §2.7 finding that the category is
   inherently fragmented. Build the registry mechanism once Tier-2's SVT
   plugin validates the news-plugin shape, then add feeds incrementally
   as demand justifies each kommun.
9. **Kronofogden Auktionstorget scraper** — real, valuable,
   address-adjacent signal, but no API and unverified ToS/robots.txt
   posture; needs a legal/scraping-policy check first (same discipline
   `docs/35` applied before recommending scraping any commercial/
   government portal). Sequence after Tier 1-2 prove the plugin
   architecture, not because the signal is low-value but because the
   access-risk needs resolving first.

### Top-level scaling note

Every Tier-1 and Tier-2 source updates on a cadence far slower than
"per home-buying analysis" (years for flood/planning/noise maps, months
for company stats, hours-to-a-day for news/air quality). At "millions of
analyses over years" scale, the dominant architectural decision is **not**
API rate limits — it's **decoupling ingestion cadence from analysis-request
cadence**: pull/refresh each source on its own natural update interval into
a local cache/store (reusing the PostGIS choice from `docs/30` for the
geodata sources), and serve every individual home-buying analysis from
that cache, never fetching live per-request. This is a direct extension of
the same discipline `docs/28`'s SCB/Riksbanken/SMHI providers already
follow implicitly (their data doesn't change per-request either) — this
doc makes the caching implication explicit because the WMS/geodata and
per-kommun-scraper sources introduced here have far coarser update
cadences than the REST APIs `docs/28` covered, making stale-cache risk
(serving flood data from before a remapping) the real failure mode to
design against, not staleness from under-fetching.
