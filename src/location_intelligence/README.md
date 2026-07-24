# Location Intelligence Engine

Collects, normalizes, and packages location intelligence for a Swedish
property. **No analysis, no scoring, no ranking, no recommendations** —
this engine emits evidence; a separate analysis layer judges it.

Design source of truth:

- `docs/36_location_intelligence_engine.md` — data-source research
- `docs/37_platform_architecture.md` — platform contracts (Intelligence
  Package, honest-absence rules, trust tiers)
- `docs/38_location_engine_implementation_plan.md` — provider catalog and
  the wave-by-wave backlog this package follows
- `docs/39_future_development_intelligence.md` — municipal planning/
  detaljplan source research (supersedes the "no viable API" note below)
  and the `lantmateriet_detaljplan` provider it produced
- `docs/40_location_engine_validation_report.md` — Version 1 validation:
  27 real addresses, 54 live runs, one bug found and fixed, readiness verdict

## Status: Version 1 — production-ready (12 providers, validated)

All 12 providers are built and registered in `default_registry()`.
Every finding — from every provider — carries standardized proximity
metadata (`latitude`/`longitude`/`distance_m`/`radius_bucket`/
`inside_requested_radius`) via the shared `proximity.py` module, on top
of the source/trust-tier/freshness provenance every finding has always
carried.

Validated (doc 40) against 27 real Swedish addresses spanning dense city
centers, suburbs, rural locations, a newly-relocated town center
(Kiruna), and sparse-data kommuner: 54/54 live runs produced a valid
package, address/geocoding/municipality resolution was correct in every
case, and one real bug was found and fixed (`HttpClient` wasn't retrying
HTTP 429 — it now does, honoring `Retry-After`). The only remaining
instability (`osm_poi`/`osm_construction` under sustained load against
the free public Overpass instance) is an external dependency's reliability
characteristic, handled by the engine exactly as designed (an honest
`timeout` status, never fabricated data) — see doc 40 for the full
root-cause investigation.

**Note on the "Skipped, documented gap" row below** (Boverket
Planbestämmelsekatalogen, logged during the earlier future-value build):
that specific catalog is still unreachable/low-value as described, but
doc 39 found a *different*, genuinely live source for the same customer
need — Lantmäteriet's national digital-detaljplan platform — now built
as `providers/lantmateriet_detaljplan.py`. The gap that row describes is
closed, just not by the source that row names.

## Status history: future-value stage (customer-priority build, post-Wave-3)

Built past Wave 3 in the customer-value order requested (planned
construction → urban development → infrastructure → transit expansion →
schools → environmental risks → local news → crime → companies):

| Built | What | Priority |
|---|---|---|
| `providers/osm_construction.py` | PARALLEL: `construction=*`/`building=construction`/`landuse=construction` Overpass query, 1500m radius, named nearest 10 sites with construction type; `DIRECTORY` tier (community-tagged, honest that absence ≠ nothing planned) | 1. Planned construction |
| — | **Skipped, documented gap**: Boverket Planbestämmelsekatalogen has no live-discoverable public API today (technical-description PDF link dead, app is now a Blazor SPA with no reachable REST endpoint found); the ÖP-katalog API is still demo-stage per Boverket's own announcement. Even when reachable, doc 36 already flags this catalog as *plan-provision rules*, not per-address plan status — low value even if unblocked. Revisit if Boverket re-publishes stable docs. | 2. Urban development |
| `providers/trafikverket_infrastructure.py` | PARALLEL: Situation/Deviation API (roadworks, rail projects incl. transit-line construction), 2000m radius, validity window distinct from fetch time. **Requires a free key** (`TRAFIKVERKET_API_KEY`, self-service at data.trafikverket.se) — honestly `not_connected` without one; request/response shape verified live against the real 401 auth-error path | 3. Infrastructure |
| — | Folded into the Trafikverket provider above: its Situation data already covers rail/transit infrastructure projects (new metro/rail lines under construction). No separate keyless official "planned network expansion" API exists — Trafiklab's ResRobot is journey-planning, not expansion plans, and needs its own key/signup for a different question. | 4. Transit expansion |
| `providers/skolverket_schools.py` | PARALLEL: Skolverket school-unit register (v1, keyless). Kommun-level counts by status (active/dormant/**planned**); named planned schools (`Status=Planerad`) with address, start date, and real distance when coordinates are available. **Verified live that the documented `kommunkod` filter param doesn't actually filter server-side** — this provider fetches the bulk list once and filters client-side | 5. Schools |
| — | **Deferred**: MSB flood WMS / Länsstyrelsen EBH contamination — genuinely valuable (doc 36's #1 pick) but needs an OWSLib WMS/WFS client and, per doc 36, a local geodata ingest for point-in-polygon lookups at scale; bigger lift than the keyless REST/JSON sources above, sequenced next | 6. Environmental risks |
| `providers/svt_local_news.py` | PARALLEL: SVT Nyheter Lokalt RSS, län-level, 20 of 21 län mapped and verified live (Gotland has no dedicated SVT feed — reported as an honest gap, not guessed). Parsed with stdlib `xml.etree` rather than adding a `feedparser` dependency for one well-formed feed. `MANAGER_PORTAL` tier (0.85) | 7. Local news |
| `providers/polisen_crime.py` | PARALLEL: Polisen.se public events API, keyless. County-level (`locationname` filter verified to match county, not kommun/address); recent-30-day count computed from real timestamps + most recent 15 events. Explicitly *not* BRÅ crime statistics — BRÅ has no API and needs a separate periodic-ingest pipeline, flagged as follow-up rather than substituted | 8. Crime |
| `providers/bolagsverket_companies.py` | PARALLEL: `ftgstat_oppna.csv` monthly open-data dump (60MB, ~7s fetch+parse), kommun-level new-registration / deregistration / active-stock counts, all-forms + aktiebolag-only. **Field-meaning caveat**: Bolagsverket's own code-definitions document is CAPTCHA-gated; the three `handelse` codes are labeled from the data's own magnitude pattern (verified live — stock values run ~100-1000x the flow values for the same legal form), not from official documentation — every finding says so | 9. Companies |
| `providers/lantmateriet_detaljplan.py` | PARALLEL: Lantmäteriet's national digital-detaljplan platform (doc 39) — per-plan status (`påbörjad`/`samråd`/`granskning`/`antagen`/`överklagad`/`tillsyn`/`laga kraft`/`upphävd`/`avslutad`), key dates, and document links, 2000m radius. **Requires OAuth2 client credentials** (`LANTMATERIET_CLIENT_ID`/`_SECRET`, organization account via Geotorget) — honestly `not_connected` without them; field mapping grounded in the live OpenAPI/JSON-Schema spec, axis-order self-corrected since it couldn't be verified live (see doc 39) | 10. Municipal planning / ongoing planning processes / public consultation |
| `http_client.py` thread-safe rate limiting | Fixed a real concurrency bug found during this stage's live demo: the per-host rate limiter's check-then-sleep-then-write wasn't atomic, so two providers hitting the same host concurrently (osm_poi + osm_construction, both on Overpass) raced past the guard and got 429'd. Now reserves the next slot under a lock before sleeping. | cross-cutting |
| `http_client.py` 429 retry (doc 40) | Fixed a real bug found during Version 1 validation: HTTP 429 was treated as a permanent client error (never retried), same bucket as 400/404. It's now retried like a 5xx, honoring a `Retry-After` header when present. | cross-cutting |

Demonstrated end-to-end on Dalagatan 30, Stockholm: 10/11 providers `ok`
(the 11th, Trafikverket, honestly `not_connected` pending a free key),
66 findings, zero errors, zero timeouts. (Historical snapshot from this
stage's own demo, predating the 12th provider above — see doc 40 for the
current, full 12-provider validation results.)

## Status history: Wave 3 (proven ports) complete

| Built (Wave 3) | What |
|---|---|
| `providers/osm_poi.py` | PARALLEL, `min_precision=street`: one Overpass query covering 18 categories (restaurants, cafés, grocery, schools, preschools, pharmacies, hospitals, health centers, gyms, parks, playgrounds, bus stops, subway/train stations, charging stations, parking, libraries, sports facilities) — exact counts within 1000m plus the nearest 5 named POIs per category with real haversine-computed distances (never a fake "nearest" from unsorted Overpass order) |
| `providers/scb_municipality.py` | PARALLEL: population, 5-yr population growth, median income, post-secondary education share — port of the proven `scbDemographicsProvider` TS logic with its metadata-driven year/column resolution bugs pre-fixed |
| `providers/kolada.py` | PARALLEL: 10 decision-relevant municipal KPIs (population change, tax rate, school results, unemployment, safety index, rental housing share, preschool group size, voter turnout, bike paths, income/wealth index) — latest period resolved from each KPI's own data, never assumed |
| `http_client.py` POST support | `post_bytes`/`post_text` added for Overpass (form-encoded query) and SCB PxWeb (JSON body) — same retry/backoff/User-Agent contract as GET |

Demonstrated end-to-end on Dalagatan 30, Stockholm: 5/5 providers `ok`,
51 findings, zero errors.

## Status history: Wave 2 (pre-stage) complete

| Built (Wave 2) | What |
|---|---|
| `municipality.py` + `data/kommun_register.json` | SCB-derived register: all 290 kommuner + 21 län, conservative name→code matching (exact, suffix, genitive; never guesses). Refresh: `python -m location_intelligence.tools.refresh_kommun_register` |
| `providers/address_resolver.py` | PRE-stage, offline: parses raw input, extracts postal code + kommun identity (SCB register), honest warnings for what it couldn't parse |
| `providers/nominatim_geocoder.py` | PRE-stage: forward geocoding for addresses, reverse for coordinates; declares geocode precision (rooftop/street/postal/municipality); kommun *code* always from the SCB register, never from Nominatim |
| Precision gate (runner + `Provider.min_precision`) | Radius-based providers are visibly skipped with a reason when the geocode is too coarse — a 1 km count around a kommun centroid would be incorrect, not just vague |

**Assumptions:** Swedish addresses only (`countrycodes=se`); Nominatim
rate-limited to 1 req/1.1 s with a proper User-Agent; city districts
("Vasastan") intentionally do not resolve to a kommun; unknown names
return nothing rather than a guess. Overpass is a shared public instance
(best-effort, 2s per-host politeness interval); OSM/Kolada data is
kept uncached today (`cache_ttl=None`) pending a real refresh-cadence
decision.

## Status history: Wave 1 (foundation) complete

| Built | What |
|---|---|
| `models.py` | Package envelope: `Finding` (validated provenance/trust/freshness), `ProviderResult` (honest statuses), trust tiers incl. `DERIVED` |
| `context.py` | `AddressContext` — the input every provider receives; pre-stage enrichment via `patched()` |
| `providers/` | `Provider` contract (stage, trust tier, cache TTL, deadline) + registry with `DISABLED_PROVIDERS` support |
| `http_client.py` | Shared client: User-Agent always, bounded backoff retry on 5xx/transport only, per-host rate limiting |
| `cache.py` | File-backed per-provider cache; TTL per provider; stale-if-error retention |
| `runner.py` | Sequential pre-stage → parallel providers, per-provider deadlines, full isolation, visible disabled/timeout statuses |
| `builder.py` | Deterministic `LocationIntelligencePackage` assembly (golden-master tested) |
| `conformance.py` | The admission gate: mechanical checks every provider must pass |
| `__main__.py` | CLI: `python -m location_intelligence "Dalagatan 30, Stockholm"` |

The default registry is **empty** — real providers arrive in Wave 2+
(Address Resolver, Geocoder) and Wave 3 (OSM, SCB, Kolada).

## Running

```bash
python -m location_intelligence "Dalagatan 30, Stockholm"
python -m location_intelligence "59.343, 18.049" -v --no-cache
```

Configuration (env): `DISABLED_PROVIDERS`, `LI_CACHE_DIR`,
`LI_HTTP_TIMEOUT_S`, `LI_MAX_WORKERS`, `LI_DEFAULT_DEADLINE_S`.

## Tests

```bash
pytest tests/location_intelligence
```

Every future provider must pass `conformance.check_provider` — the
`test_conformance.py::test_default_registry_providers_pass` test enforces
this automatically for anything added to `default_registry()`.
