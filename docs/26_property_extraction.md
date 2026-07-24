# Property Data Extraction Layer

**Date:** 2026-07-16 · **Milestone:** launch prep, priority #1 · **Status:** implemented, Booli untested against live traffic

## What this milestone is (and isn't)

Goal: when a user submits a Hemnet URL, extract as much **real** property
data as possible before any scoring happens. This is the extraction layer
only — not the Decision Engine, and not AI scoring. See
`25_analysis_pipeline.md` for the pipeline this plugs into.

```
Hemnet URL
    ↓  URL-slug parsing only (Hemnet itself is never fetched — ToS ban,
    ↓  docs/data-source-inventory.md entry 2)
Property Extraction  →  address, type, rooms, floor, listing id (best-effort)
    ↓
Provider Pipeline (ordered, modular — src/lib/analysis/providers/)
    ├── Nominatim geocoding   (real)  → coordinates, canonical municipality, postal code
    ├── Booli listing          (real, key-gated) → price, fee, area, rooms,
    │                                    building year, BRF name, energy
    │                                    class, description, image URLs
    └── 11 remaining placeholders (SCB, municipality plans, infrastructure,
        BRF financials, crime, schools, transit, environment, ...)
    ↓
Property object (persisted: dedicated columns + attributes jsonb)
```

Each provider **enriches the same property**, never replaces it — this was
already the registry pattern from milestone 1; this milestone makes it
actually work end-to-end (see "Bug fixed" below) and adds the first
economically-real provider.

## Why Hemnet itself is never fetched

`docs/data-source-inventory.md` entry 2 is unambiguous: Hemnet's ToS bans
both scraping **and** using Hemnet data for ML/AI, full stop, no
commercial-use path. `listing/hemnet.ts` therefore only parses the URL
slug (already true before this milestone) — it cannot supply price, fee,
living area, BRF name, description, or images. Those fields, requested in
this milestone, only exist in this codebase via **Booli**, which the
inventory identifies as the source that actually carries them and has a
real (if commercially conditional) API.

## New: real Booli provider (`providers/booli.ts`)

Implements Booli's documented Listing API v2 request signing
(`callerId` + unix time + HMAC-SHA1 of `callerId|time|apiKey`) and searches
by address + municipality. Extracts, only when actually present in the
response (never a default/guess):

`asking_price_sek`, `monthly_fee_sek`, `operating_costs_sek`,
`living_area_m2`, `rooms`, `building_year`, `housing_association`,
`energy_class`, `description`, `image_urls` (URLs only, capped at 10 — no
binary fetch, "metadata only" as requested).

**Key-gated, not faked**: without `BOOLI_CALLER_ID` / `BOOLI_API_KEY` set,
the provider reports `status: "not_connected"` with an explicit reason —
exactly the "mark unavailable values explicitly" requirement, and the
honest default in every environment until real credentials exist (none
were available while building this).

**Calibration warning — read before enabling in production**: the field
mapping (`FIELD_PATHS` inside `booli.ts`) is written against Booli's
commonly-documented v2 shape but has **not** been exercised against a real
API response, since no key was available. To compensate:

- Field extraction is defensive (tries multiple plausible key spellings,
  e.g. `listPrice`/`askingPrice`/`price`) and only sets a value when a key
  is actually present — never zero-fills or guesses.
- If Booli returns a listing but *none* of the expected keys match, the
  provider reports `status: "error"` (not `"ok"` with empty/wrong data) so
  a mapping problem is visible in `data_sources`, never silently wrong.
- Verified locally by pointing the real provider code at a fake HTTP server
  shaped like the documented response (see test transcript in the session
  this was built in) — confirms the signing/parsing code path works
  end-to-end, but **not** that it matches Booli's actual live JSON shape.
  **Before enabling in any real environment: get one real API key, run one
  real query, and diff the response against `FIELD_PATHS`.**

## Bug fixed: provider data was collected but never used

Milestone 1's `ProviderResult.data` (the actual values a source found) was
computed but only its *field names* ever reached the report — the values
themselves were discarded. `pipeline.ts` now merges `result.data` from any
`status: "ok"` result into `properties.attributes` (never from
not_connected/error/no_data results, even if one accidentally returned
data). This is what makes the Property object in the database actually
contain the values providers report, not just their names.

## Schema change

One additive migration
(`20260716130000_property_postal_code.sql`): `properties.postal_code`.
Postal code is a core address fact (Nominatim resolves it directly,
alongside municipality) — kept as a dedicated column rather than buried in
`attributes`, consistent with how municipality/coordinates are stored.
Everything else new (price, fee, area, BRF name, description, images,
energy class, operating costs) lives in the existing `attributes` jsonb
column, unchanged schema shape.

## Engine changes (v0.1.0 → v0.2.0)

- `AnalysisReport.property` gained `postalCode`, `askingPriceSek`,
  `monthlyFeeSek`, `operatingCostsSek`, `livingAreaM2`, `energyClass`,
  `description`, `imageUrls` — populated from real data only, `null`/`[]`
  when unavailable. **Not rendered by the report UI yet** (no UI redesign
  this milestone, per instruction) — they're on the persisted Property
  object for the future Decision Engine to consume.
- `factorsAnalyzed` no longer double-counts: previously it added both the
  merged fact count *and* each real source's field count, which would have
  double-counted every Booli-sourced fact once Booli went live. Now it's a
  single dedup'd count of everything the property record actually holds.
- The score's neutral-band cap (60) lifts once `booli_listing` reports
  `status: "ok"` — real market data existing is exactly the condition the
  cap comment always said would lift it. This does **not** add new
  price-based scoring logic (still out of scope — Decision Engine is a
  separate future milestone); it only stops capping a score that already
  has real backing.

## Registry after this milestone

`providers/registry.ts`: `[nominatimGeocoder, booliListingProvider,
...placeholderProviders]` — 2 real, 11 placeholder. Adding the next real
source (e.g. SCB) means: implement `DataProvider` in its own module,
insert it into the registry array, delete its entry from
`placeholders.ts`. Nothing else in the pipeline, engine, or store changes
— this is the pattern milestone 1 designed and this milestone exercises
for the first time with a second real source.

## What's still explicitly unavailable (by design, not oversight)

Balcony, elevator, parking as *verified* facts (only ever user-asserted
via manual entry — no source in the inventory confirms these reliably per
`docs/22_user_input_flow.md` §4). Energy class, description, images,
operating costs are wired but return `null`/`[]` until a Booli key is
configured. Lantmäteriet, SCB, Bolagsverket, crime, schools, transit,
environment, infrastructure, interest rates all remain placeholders —
unchanged from milestone 1, out of scope for this one.
