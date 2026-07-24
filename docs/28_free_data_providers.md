# Free Data Providers

**Date:** 2026-07-16 · **Milestone:** real data pipeline, free sources only · **Status:** implemented, verified against live APIs

## What this milestone is (and isn't)

Goal: replace as many `not_connected` placeholders as possible with real,
free, keyless (or free-key) data sources, without changing the UI,
purchase flow, or the Decision Engine's architecture. No paid APIs.

Every new provider follows the existing pattern from milestones 1-3
exactly: implement `DataProvider` in its own module, register it, never
fabricate a value, mark what's unavailable explicitly (omit the attribute
key — the established convention — rather than inventing a placeholder
number). Nothing in `engine/` was touched; new providers write into
`attributes` under the *same* forward-contract keys the analyzers already
expected, so a couple of them started producing real scores automatically
(see "Decision Engine effects" below) — exactly what "paid sources can
replace or enrich these later without changing the Decision Engine" was
designed to guarantee.

**Enable/disable, per provider, without a code change**: set
`DISABLED_PROVIDERS=<id>,<id>` in the environment (comma-separated ids).
Every provider is also independent at the architecture level — each
`collect()` call is individually try/caught in `pipeline.ts`, so one
provider erroring or being disabled never affects the others.

## Which providers work today (no key required)

| Provider (id) | Source | Verified live | Fields set |
|---|---|---|---|
| `scb_area_statistics` | SCB PxWeb API | Yes — Stockholm and Uppsala municipalities queried live | `population_total`, `area_population_growth_pct` (real 5-year change), `median_income_sek_thousands`, `share_post_secondary_education_pct` |
| `osm_amenities` | OpenStreetMap Overpass API | Yes | `grocery_count_within_1000m`, `school_count_within_1000m`, `restaurant_count_within_1000m`, `park_count_within_1000m`, `transit_count_within_1000m`, `hospital_count_within_1000m`, `highway_major_count_within_1000m`, `distance_to_city_center_m` |
| `interest_rates` | Riksbanken SWEA API | Yes | `policy_rate_pct`, `policy_rate_date`, `policy_rate_change_12m_pct_points` (real 12-month change) |
| `smhi_climate` | SMHI metobs API | Yes | `weather_station_name`, `weather_station_distance_m`, `current_temperature_c` |
| `nominatim_geocoding` | OpenStreetMap Nominatim (from milestone 1) | Yes | `latitude`, `longitude`, `municipality`, `postal_code` |

## Which providers require a free API key (implemented, untested live)

| Provider (id) | Source | Key env var | Status without key | Note |
|---|---|---|---|---|
| `booli_listing` | Booli Listing API v2 | `BOOLI_CALLER_ID` + `BOOLI_API_KEY` | `not_connected` (honest, from milestone 2) | Field mapping unverified against a live response — see `docs/26_property_extraction.md` |
| `infrastructure_projects` | Trafikverket Open API v2 | `TRAFIKVERKET_API_KEY` | `not_connected` | Endpoint confirmed real (401 "Invalid authentication" without a key, verified live 2026-07-16); field mapping unverified against a live response — same calibration caveat as Booli, documented in `trafikverket.ts` |

## Which stayed placeholders, and why (verified, not assumed)

| Placeholder (id) | Why it's still `not_connected` |
|---|---|
| `brf_financials`, `brf_register` | Blocked on a missing prerequisite, not a missing API: Bolagsverket's lookup needs an `organisationsnummer`, and there's no BRF-name→org-number matching step yet (open gap noted in `docs/18_report_inputs.md`/`docs/22_user_input_flow.md` since milestone 1). Confirmed live: Bolagsverket's API is real (401 without credentials) but useless without an org number to look up. |
| `municipality_plans` | No unified national API exists (per `docs/data-source-inventory.md` entry 7, fragmented across 290 municipalities). Stockholm's own open-data portal (`dataportal.stockholm.se`) did not resolve when checked live on 2026-07-16. |
| `crime_statistics` | Verified live: BRÅ (bra.se) publishes only static downloadable tables — no query API exists (`api.bra.se` doesn't resolve). Per-address crime data doesn't exist in Sweden by design (statistical disclosure control, municipality/region level only). |
| `school_ratings` | Skolverket has a real API (per inventory) but wasn't built this round — OSM now covers school *presence/count*, which is a different, real signal from Skolverket's *quality ratings*; scoped out to keep this milestone's already-large surface bounded. |
| `public_transport` | Same reasoning as school_ratings: OSM covers stop *presence*, Trafiklab would add journey-time/schedule richness — scoped out this round. |
| `environmental_data` | SMHI's open API is weather, not flood/noise/air-quality risk (that needs SMHI Vattenwebb or MSB flood maps, a separate, more complex geodata service) — kept distinctly separate from the new `smhi_climate` provider so a connected weather source doesn't misleadingly imply flood-risk coverage. |
| `lantmateriet_address` | Out of this milestone's explicit list; Nominatim already covers the addresses/coordinates/postal-code role adequately for now. |

## Real bugs found and fixed while building this

1. **Providers didn't see each other's enrichment within one analysis
   run.** `pipeline.ts` was writing geocoding's coordinates/canonical
   municipality to the database only *after* every provider had already
   run — so `osm_amenities` and `smhi_climate` (which need coordinates)
   and `scb_area_statistics` (which needs the canonical municipality name,
   not the raw URL-slug hint) all failed with `no_data`/`error` the first
   time this was tested end-to-end, even though geocoding itself
   succeeded moments earlier in the same run. Fixed by keeping an
   in-memory `currentProperty` that's updated after every provider and
   passed to the next one — still exactly one database write per
   analysis, just correctly sequenced in memory first. This was a latent
   bug from milestone 1 that simply had no way to surface until a second
   provider actually depended on a first one's output within a single run.
2. **PxWeb (SCB) returns each row's `key` array ordered by the table's own
   declared column order, not the query's selection order** — the
   education-attainment aggregation read the wrong array index for the
   education-level dimension as a result, silently computing 0% for every
   municipality. Fixed by resolving the index from the response's own
   `columns` field instead of assuming a fixed position; caught by testing
   against Stockholm's real numbers and noticing 0% was implausible for a
   well-educated area, then confirming a real query only after fixing.
3. **SCB tables lag "this year" by 1-2 years** — the first version assumed
   `currentYear - 1` was always queryable and got `400 Bad Request` for
   2025 (population data's newest year was 2024). Fixed by resolving each
   table's own latest available `Tid` value from its metadata at runtime,
   same pattern already used for municipality-code resolution — no
   hardcoded year, works as SCB publishes new years going forward.
4. **Overpass API rejects requests with no `User-Agent` header** (406, not
   an error message that explains why) — fixed by sending the same
   `User-Agent` this app already uses for Nominatim.
5. **A partial OSM failure was being silently swallowed.** The provider
   makes two independent calls (Overpass for counts, Nominatim for
   distance-to-center); when Overpass failed but the distance lookup
   succeeded, the provider reported plain `"ok"` with no indication the
   counts were missing or why. Fixed to always attach a `detail` explaining
   a partial failure, even when overall status is still `"ok"` because
   some real data did come through.
6. **A "nearest amenity in meters" design would have been misleading.**
   The first OSM draft sampled up to 20 arbitrary elements per category
   and reported the minimum distance among them as "nearest" — but
   Overpass doesn't return results sorted by distance, and dense
   categories (525 restaurants within 1km of Dalagatan 30) would make that
   number essentially arbitrary, not a real "nearest." Caught before
   shipping; redesigned to report only an exact, real count within a fixed
   radius, plus the one genuinely single-point distance metric that was
   actually requested (distance to city center).

## Reliability note: OpenStreetMap Overpass

`overpass-api.de` is a free, best-effort public instance with informal
rate limiting. During this session's testing (many repeated queries in a
short window), it occasionally returned `504`/timeouts on requests that
succeeded moments before or after — confirmed transient, not a code
defect, by re-running the identical request. `osm_amenities` degrades
honestly when this happens (`status: "error"` with the real HTTP detail,
or a partial-success `detail` per bug #5 above) rather than retrying
aggressively against a shared free resource. For production volume,
consider a self-hosted Overpass instance or a paid geocoding/POI provider
as a drop-in replacement — same `DataProvider` interface, no engine
changes needed.

## Decision Engine effects (no engine code changed)

Two analyzers automatically gained real behavior purely from new
providers filling in their existing forward-contract attribute keys:

- **Area Analyzer** (`analyzers/area.ts`) now scores for real once SCB is
  connected — `area_population_growth_pct` is exactly the key it was
  already looking for. Previously always "No area data"; now produces a
  real score when population growth is available.
- All other analyzers (Price, Market, Housing Association, Risk, Future
  Development, Negotiation) still correctly report insufficient data —
  their forward-contract keys (`area_median_price_per_m2_sek`,
  `market_price_index_trend_pct`, `brf_debt_per_m2_sek`,
  `environmental_risk_score`, `nearby_planned_projects`,
  `days_on_market`) weren't targeted by this round's sources (SCB doesn't
  publish per-m² housing prices; BRF financials and market/infrastructure
  planning data remain blocked/placeholder per the table above). This is
  the expected, honest outcome — new context data landed in `attributes`
  and raises the Confidence Analyzer's score, but a provider must set the
  *specific* key an analyzer contracts on before that analyzer starts
  scoring, by design.

## Estimated coverage for a normal Swedish apartment (Stockholm-area test case)

Verified against a real address (Dalagatan 30, Vasastan, Stockholm) with
no paid keys configured:

- **Always available** (geocodable address, any Swedish municipality):
  coordinates, postal code, canonical municipality, population, 5-year
  population growth, median income, education attainment, current policy
  rate + 12-month change, nearby amenity counts (grocery/school/
  restaurant/park/transit/hospital/major-road), distance to city center,
  nearest-weather-station climate context. That's **~18 real data
  points** with zero API keys, zero cost, for any of Sweden's 290
  municipalities (SCB/Riksbanken/OSM/SMHI all resolve nationally, not
  just Stockholm — confirmed by testing Uppsala alongside Stockholm).
- **Available once free keys are obtained** (Booli, Trafikverket — both
  "key issued on request", no payment): asking price, monthly fee,
  living area, building year, BRF name, energy class, description, images,
  nearby road deviations/roadworks.
- **Still unavailable for free** (would need a document-parsing pipeline,
  a paid vendor, or doesn't exist at per-property granularity in Sweden at
  all): BRF debt/reserves/apartment count (Bolagsverket annual reports are
  PDF/XBRL, not structured API data), area price-per-m² comparables
  (Mäklarstatistik/Valueguard are paid; Booli's own comps would need a
  separate "sold listings" query not yet built), municipality detaljplan/
  bygglov status (no national API), school quality ratings, richer
  transit journey data, flood/noise/air-quality risk, per-address crime
  data (doesn't exist in Sweden by design).

Connected-source ratio for this test case: **6 of 13** registered
providers report `status: "ok"` with zero configuration (up from 2 of 13
after milestone 2); **2 more** (`booli_listing`, `infrastructure_projects`)
would join with free keys, bringing free-tier coverage to **8 of 13**
without ever paying for data.
