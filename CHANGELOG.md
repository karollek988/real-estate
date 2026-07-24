# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] — 2026-07-20

### Location Intelligence Engine — first stable release

The Location Intelligence Engine collects, normalizes, and packages
location-based facts for a Swedish property address. It performs no
analysis, scoring, ranking, or recommendation — it is a pure evidence
layer for a separate analysis engine to consume.

**Added**

- 12 providers, all registered in `default_registry()`:
  `address_resolver`, `nominatim_geocoder`, `osm_poi`, `scb_municipality`,
  `kolada`, `osm_construction`, `trafikverket_infrastructure`,
  `skolverket_schools`, `svt_local_news`, `polisen_crime`,
  `bolagsverket_companies`, and `lantmateriet_detaljplan` (new this
  release — Sweden's national digital-detaljplan platform: municipal
  detailed development plans, ongoing planning status, and public
  consultation phase, all in one source).
- A shared proximity framework (`location_intelligence.proximity`):
  every finding with a location now carries standardized
  `latitude`/`longitude`/`distance_m`/`radius_bucket`/
  `inside_requested_radius` metadata, computed once from a single shared
  haversine implementation — no duplicated distance math across
  providers.
- The Intelligence Package envelope: versioned, validated at
  construction (a finding without source/timestamp/trust-tier is
  rejected, not silently accepted), with honest per-provider statuses
  (`ok`/`partial`/`no_data`/`error`/`not_connected`/`disabled`/`timeout`)
  and a package-level freshness/status summary.

**Fixed**

- `HttpClient` treated HTTP 429 (Too Many Requests) as a permanent
  client error, identical to a genuine 400/404, and never retried it.
  429 is now retried with exponential backoff, honoring a `Retry-After`
  header when the server sends one. Found during Version 1 validation
  against 27 real addresses; 5 regression tests added.

**Validated**

- 27 real Swedish addresses (Stockholm, Solna, Sundbyberg, Göteborg,
  Malmö, Uppsala, Västerås, Linköping, Örebro, Helsingborg, Jönköping,
  Umeå, Luleå, Visby, Kiruna, plus rural/sparse-data kommuner), 54 total
  live engine runs. Address resolution, geocoding, and municipality
  detection correct in all 27 cases. Distance/proximity calculations
  independently recomputed and verified to within 0.1m. See
  `docs/40_location_engine_validation_report.md` for the full report.

**Known limitations (acceptable for v1)**

- `osm_poi`/`osm_construction` depend on the free public Overpass API
  instance; under sustained load this instance can return 429/504,
  which the engine reports honestly as `timeout`/`error` rather than
  fabricating data. Self-hosting Overpass is the documented mitigation
  if this becomes a recurring production issue (not needed for v1).
- `trafikverket_infrastructure` and `lantmateriet_detaljplan` require
  API credentials (a free key and an OAuth2 client-credentials pair,
  respectively) that were not available during this validation pass;
  both degrade honestly to `not_connected` without them, but their live
  behavior with real credentials remains unverified.
- Provider response caching (`ProviderCache`) exists and is tested, but
  no provider has a production `cache_ttl` wired in yet — every request
  hits the network. Not a correctness issue, but the leading
  performance/cost improvement for the next iteration.
