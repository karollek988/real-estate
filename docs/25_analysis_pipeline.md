# Persistent Analysis Pipeline (replaces the mock)

**Date:** 2026-07-16 · **Milestone:** launch prep · **Status:** implemented and verified end-to-end

## What changed

The Decision Preview is no longer rendered from `mockReport.ts` (deleted).
Submitting a listing now runs a real pipeline that persists every property
and every analysis in Supabase Postgres:

```
Hemnet URL / manual details
    ↓  POST /api/analyses
extract property facts        (URL-slug parsing or form fields — no scraping)
    ↓
upsert property               (each property exists exactly once)
    ↓
cache check                   (<7 days → return existing analysis immediately;
    ↓                          ≥7 days → return it flagged stale + "Update analysis")
run data providers            (real + placeholder, modular registry)
    ↓
build analysis report         (engine v0.1, honest about missing data)
    ↓
persist as new analysis version   (append-only — analyses are NEVER deleted)
    ↓
/analyzing → /report?id=...   (UI unchanged)
```

The UI (pages, animations, transitions, purchase flow) is untouched apart
from: forms actually submit to the API, the report renders the stored
analysis, and a stale-analysis banner with an **Update analysis** button
appears when the newest analysis is ≥ 7 days old (creates a new version;
old versions are kept forever).

## Database (supabase/migrations/20260716120000_properties_analyses.sql)

**`properties`** — one row per physical property. Dedupe identity is
`normalized_key` (folded address | municipality | apartment number) plus a
unique partial index on `hemnet_url`. Stores address, Hemnet URL,
coordinates, municipality, property type, apartment number, floor, a jsonb
`attributes` bag (rooms, living area, fees, condition, raw slug, ...) and
timestamps.

**`analyses`** — append-only, versioned per property
(`unique(property_id, version)`). Stores engine version, status
(pending/complete/failed), decision score, the full report json
(`result`), per-source outcomes (`data_sources`), error text, timestamps.

Protection:

- RLS enabled on both tables with **no policies** — only the service role
  (server-side pipeline) can touch them; browsers must go through the API.
- Because `auto_expose_new_tables` is off, the migration adds explicit
  `grant`s for `service_role` (deliberately **no** `delete` on analyses).
- A `before delete` trigger on `analyses` raises — even a superuser can't
  delete analysis history without disabling the trigger first.

Requires `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local` (see
`.env.example`; local value comes from `npx supabase status`).

## Code layout (frontend/src/lib/analysis/)

| Module | Responsibility |
|---|---|
| `types.ts` | Domain types: `ExtractedProperty`, `PropertyRecord`, `AnalysisRecord`, `AnalysisReport`, `DataSourceReport` |
| `normalize.ts` | `normalizedPropertyKey` — dedupe identity |
| `listing/classify.ts` | URL → hemnet / unsupported provider / not a listing / invalid |
| `listing/hemnet.ts` | Hemnet **URL-slug** extraction (type, rooms, municipality hint, street, floor, listing id). Never fetches the page — scraping is banned (docs/22 §1.4) |
| `listing/manual.ts` | Manual form fields → `ExtractedProperty` |
| `providers/types.ts` | `DataProvider` interface (`collect(ctx) → ProviderResult`) |
| `providers/geocoding.ts` | **Real** provider: OSM Nominatim geocoding (free, keyless; interim until Lantmäteriet) |
| `providers/placeholders.ts` | 12 planned sources (Booli, Lantmäteriet, Bolagsverket/BRF, SCB, municipality plans, infrastructure, interest rates, BRF register, crime, schools, transit, environment) reporting `not_connected` |
| `providers/registry.ts` | Ordered provider list — **adding a source = one module + one registry line** |
| `engine/buildAnalysis.ts` | Engine v0.1: deterministic score (capped at 60 while market data is missing), verdict bands, insights marked "Pending data" when their backing sources aren't connected |
| `store.ts` | All DB access (service-role client, camelCase mapping, version allocation with conflict retry) |
| `pipeline.ts` | Orchestration: extract → upsert → cache check → providers → engine → persist |

API routes (`src/app/api/`): `POST /api/analyses` (run or return cached,
body `{url}` or `{manual}`, `force` to override cache), `GET
/api/analyses/:id`, `GET /api/properties/:id/analyses` (version history =
score timeline), `POST /api/properties/:id/analyses` (update → new
version).

## Honesty rules (carried from the product principles)

- Placeholder data is **structurally separated**: every analysis records
  per-source `kind: real | placeholder` and status; the report footer
  shows "N of M data sources connected"; unbacked insights say "Pending
  data" instead of invented values. Remaining UI-level placeholder: the
  free-preview quota chip (`lib/placeholders.ts`, no quota system yet).
- The engine never claims a signal it can't back: score is capped in the
  neutral band until real market/BRF sources are connected;
  `factorsAnalyzed` counts actual known facts, not a marketing number.
- Hemnet is parsed from the URL only; unsupported providers (Booli, Boneo,
  ...) get an honest "not supported yet, enter manually" error per docs/22.

## Known limitations / next steps

1. **Cross-entry dedupe** relies on the geocoder canonicalizing the
   municipality (URL slugs carry genitive names like "stockholms"); the
   key is recomputed after geocoding with a conflict-safe fallback.
   Ungeocodable addresses entered two ways can still create two rows.
2. Nominatim is rate-limited (1 req/s) and usage-policied — fine for MVP
   volume, replace with Lantmäteriet for launch scale.
3. Analyses run synchronously in the POST (~1–3 s). Move to a job queue if
   providers get slower.
4. No per-user quota/auth binding yet; analyses are global by design
   (cache shared across users).
5. `npm run lint` is broken repo-wide (ESLint 9 needs a flat config; repo
   has `.eslintrc.json`) — pre-existing, not introduced here.
