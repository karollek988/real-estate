# Sprint 2: Booli Engine Audit + Fix

Date: 2026-07-22 · Scope: `frontend/src/lib/analysis/providers/booli.ts` and its
one line of contact with the rest of the pipeline (`identityTrust.ts`). Hemnet's
engine (`listing/hemnet.ts`, `listing/hemnetPage.ts`, `providers/hemnetPage.ts`)
was not modified.

## 1. Pipeline traced

```
Booli API v2 (api.booli.se, HMAC-signed)
  ↓ providers/booli.ts :: booliListingProvider.collect()
  ↓  (writes property.attributes.*, gated by identityTrust.ts)
engine/buildAnalysis.ts  (reads attributes.* into AnalysisReport.property)
  ↓
engine/analyzers/{price,negotiation,risk,market,housingAssociation}.ts
  ↓
AnalysisReport → report/page.tsx
```

`AnalysisReport.property` only exposes a fixed set of named columns (`types.ts`);
anything a provider writes to `attributes` that isn't one of those columns is
still persisted and available to analyzers/a future AI report, but isn't
rendered by the current report UI. That distinction is marked per field below.

## 2. What was actually wrong (found by live-probing `api.booli.se`, not by reading docs)

`curl` against the real endpoint (no product code touched Hemnet or scraped
booli.se — this hit Booli's own sanctioned API host and only read its
standard error-contract responses):

```
$ curl https://api.booli.se/listings
FAILURE_MISSING_PARAM - Parameter missing. Request must contain callerId, unique, time and hash.
```

The previous `booli.ts` never sent `unique`, and its `sign()` hash omitted it
too. **Every authenticated request this provider ever made would have failed
outright**, independent of whether `BOOLI_CALLER_ID`/`BOOLI_API_KEY` were
valid — a bug that had zero chance of being caught without either a live key
or this kind of probing, since `not_connected` (no key) and "would 403 anyway"
(wrong signature) look identical from the outside.

Cross-checked (not guessed) against three independent, pre-existing
open-source Booli API v2 clients — `rbooli` (R), `booli-api` (npm), and
`peterstark72/booli` (Go) — which agree byte-for-byte on:
- `hash = sha1(callerId + time + apiKey + unique)`
- the `Property` JSON schema shared by both `/listings` and `/sold`
- `/sold` and `/areas` existing as separate resources alongside `/listings`

Also fixed: on a non-2xx response the old code discarded the body and
reported only `Booli responded 403`. Booli's error bodies are a diagnostic
plain-text code (`FAILURE_IDENTITY_NOT_FOUND`, `FAILURE_QUOTA_EXCEEDED`, …) —
now surfaced in `detail`, which is the only debugging signal available once a
real key is issued.

**Not resolved:** no `BOOLI_CALLER_ID`/`BOOLI_API_KEY` exists in this
environment, so an authenticated 200 response was still never observed. The
fix is verified two ways instead: live error-contract probing (above) and a
fixture-based test (`booli.verify.mjs`) built from the cross-confirmed schema.

## 3. Coverage table

Status legend: **✅ extracted** (reaches `attributes`, gated correctly) · **🆕
new this sprint** · **⚠️ attribute-only** (in `attributes`, not yet in
`AnalysisReport.property` or an analyzer) · **❌ never implemented** · **🚫
removed** (previously guessed, confirmed not to exist on the real object).

| Field | Before this sprint | After this sprint | Source priority when both exist |
|---|---|---|---|
| asking_price_sek | ✅ but unreachable (signing bug) | ✅ gap-fill only | **Hemnet wins** (new: `identityTrust.ts`) |
| monthly_fee_sek | ✅ but unreachable | ✅ gap-fill only | Hemnet wins (new) |
| living_area_m2 | ✅ but unreachable | ✅ gap-fill only | Hemnet wins (new) |
| rooms | ✅ but unreachable | ✅ gap-fill only | Hemnet wins (new) |
| building_year | ✅ but unreachable | ✅ gap-fill only | Hemnet wins (new) |
| additional_area_m2 | ❌ never implemented | ✅ gap-fill only (new) | Hemnet wins (new) |
| lot_area_m2 (plot area) | ❌ never implemented | ✅ gap-fill only (new) | Hemnet wins (new) |
| floor | ❌ never implemented | ✅ gap-fill only (new) | Hemnet wins (new) |
| balcony / patio / elevator | ❌ never implemented | ✅ gap-fill only (new) | Hemnet wins (new) |
| listing_date (published) | ❌ never implemented | ✅ gap-fill only (new) | Hemnet wins (new) |
| operating_costs_sek | ✅ but unreachable, and guessed key never existed on the real schema | 🚫 removed | Hemnet-only (was never real on Booli) |
| energy_class | ✅ but unreachable, guessed key never existed | 🚫 removed | Hemnet-only |
| description | ✅ but unreachable, guessed key never existed | 🚫 removed | Hemnet-only (Booli's API doesn't carry broker copy) |
| image_urls | ✅ but unreachable, guessed key never existed | 🚫 removed | Hemnet-only (Booli's API doesn't carry photos) |
| housing_association / BRF name | ✅ trusted source in `identityTrust.ts`, but the real `Property` schema has no such field — trust was vacuous | ⚠️ still vacuous — documented, not changed (see §4) | Unchanged — flagged as a followup, not fixed this sprint |
| **Historical sold price (this unit)** | ❌ never implemented (`/sold` never called) | 🆕 `previous_sale_price_sek`, `previous_sale_date` — attribute-only | new field, no conflict possible |
| **Historical price trend (area)** | ❌ never implemented | 🆕 `area_sold_price_trend` (quarterly median SEK/m²) — attribute-only | new field |
| **Comparable sales** | ❌ never implemented | 🆕 `comparable_sales` (up to 15, address/price/date/area/rooms/SEK-per-m²), `comparable_sales_count` — attribute-only | new field |
| **`area_median_price_per_m2_sek`** | ❌ never implemented — but `engine/analyzers/price.ts` already had a dormant conditional branch waiting for exactly this attribute name | ✅ **wired** — computed from `comparable_sales`, price.ts's existing relative-comparison path now activates automatically | new field, fills a pre-existing hook |
| BRF information (name, board, financials) | ❌ never implemented via this provider | ❌ still never implemented via this provider (out of scope — this is BRF-Scraper's `booli_provider.py` domain, a different Booli integration entirely; see §5) | — |
| Address normalization | ❌ no identity check at all — first fuzzy-search hit was trusted blindly | ✅ `addressesMatch()` guard; a mismatched result is discarded and reported as an error detail, not merged | new safeguard |
| Coordinates | ❌ never implemented | ⚠️ attribute-only, **intentionally not** written to `property.latitude/longitude` — Nominatim (`geocoding.ts`) already owns those columns and Booli's match confidence doesn't warrant silently overriding it | not merged into identity columns by design |
| Property identifier (booliId) | ❌ never implemented | 🆕 `booli_id`, `booli_listing_url` — attribute-only | new field |
| Valuation data (Booli `valuation_low`/`high`) | ❌ never implemented — confirmed not present on the `/listings` or `/sold` `Property` object in any of the 3 cross-checked schemas either | ❌ still not implemented — no evidence this field exists on this API at all (the BRF-Scraper Python `booli_provider.py`'s `valuation_low/high` model fields are themselves never populated by any of its parsers — same gap on that side) | — |
| first_price_sek (price-drop signal) | ❌ never implemented | 🆕 attribute-only | new field, no Hemnet equivalent |
| new_construction / solar_panels / fireplace / bidding_open / mortgage_deed | ❌ never implemented | 🆕 attribute-only | new fields, no Hemnet equivalent |
| property_type_booli | ❌ never implemented | 🆕 attribute-only (cross-reference only) | new field |

## 4. Known followup (documented, not fixed this sprint)

`identityTrust.ts`'s `housing_association: "booli_listing"` entry designates
Booli as the trusted source for the BRF name — but the confirmed real
`Property` schema (§2) has no BRF/association field at all. Booli's actual
BRF linkage lives on a separate part of booli.se (a `/bostadsrattsforening/{id}`
page reached via breadcrumb navigation — see
`BRF-Scraper/src/brf_scraper/discovery/booli_provider.py`, a different,
browser-automation-based Booli integration for a different pipeline). This
provider structurally cannot supply `housing_association`, so the trust
assignment is currently a no-op (harmless — Hemnet's regex-guessed BRF name
just passes through unprotected, same as if the entry didn't exist). Left
unchanged since fixing it means either building page-scraping into this
provider (out of scope — "do not redesign unrelated code") or picking a new
trusted source, which is a product decision, not a bug fix.

## 5. Files changed

- `frontend/src/lib/analysis/providers/booli.ts` — rewritten: fixed signing
  (`unique` nonce added to both the request and the hash), added the `/sold`
  endpoint (comparables + the property's own sale history), added an
  address-identity guard, removed 4 fabricated field guesses, added error-body
  surfacing. Public interface (`DataProvider`) unchanged.
- `frontend/src/lib/analysis/identityTrust.ts` — added 11 field→source
  priority entries so Booli can only gap-fill listing-level facts Hemnet
  already owns, never overwrite them (additive; existing entry/behavior for
  `housing_association` untouched).
- `frontend/src/lib/analysis/providers/booli.verify.mjs` — new, mirrors the
  project's existing `.verify.mjs` convention (no test framework). Covers the
  address-match guard, full schema field mapping, and the sold/comparables
  split + median/trend derivation, all against fixtures built from the
  cross-confirmed real schema.
- `docs/45_booli_engine_audit.md` — this file.

No analyzer, `types.ts`, or `buildAnalysis.ts` change was made — new
attribute-only fields are available for future analyzer wiring but
deliberately not surfaced in `AnalysisReport.property` this sprint, per "keep
public interfaces unchanged." The one exception is `area_median_price_per_m2_sek`,
which isn't a new interface — it fills a parameter `price.ts` already reads.
