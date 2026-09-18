# Price & Civic Data Source Research

> Research pass (2026-09-18) evaluating Swedish APIs/open datasets to
> strengthen Price Analysis (comparable sold properties, price/m²
> benchmarks, historical price development, transaction-level comparison)
> and secondary Area Analysis data (BRF economics, crime/safety,
> demographics, schools, transport, environment, planning, elections).
> Two independent web-research passes plus direct verification against
> this repo's existing code. See PROJECT_STATE.md §2b for what was
> actually implemented as a result.

## Key structural finding: Sweden has no transaction register for apartments

Swedish property transactions split into two legally distinct pipelines:

- **Fastigheter (houses/plots)** transfer via **lagfart** (title deed
  registration) at Lantmäteriet — a real government register.
- **Bostadsrätter (co-op apartments — most urban transactions)** are share
  transfers, not real-property transfers. **There is no government
  transaction register for them at all.** Every apartment price data
  source (Booli, Hemnet, Valueguard, SCB's own apartment tables)
  ultimately traces back to **brokers' own reporting** via Svensk
  Mäklarstatistik.

Confirmed directly from an SCB release: for bostadsrätter, free public
tables stop at county/metro level; kommun-level breakdown is a **paid
custom order**. This means: **no free, official, non-scraped Swedish
source gives granular apartment comparables.** That capability exists only
behind paid commercial licenses.

## Price / transaction data sources

| Source | Comparable sales | Price/m² benchmark | Historical trend | Access | Cost | Verdict |
|---|---|---|---|---|---|---|
| **Svensk Mäklarstatistik** | Yes, ~100+ fields, DeSO-level, both tenures | Yes | Yes | Real REST API, "paying customer only" | Paid, opaque, sales-conversation-only | Best fit overall, needs a business decision |
| **Lantmäteriet Fastighetsprisregistret** | Yes (houses only) | Derivable | Yes | Bulk extract/feed via Geotorget | Paid, LMFS fee schedule + reseller agreement | Good but houses-only, registration-lag |
| **SCB (PxWebApi v2)** | No | Coarse (national/county; kommun for houses only) | Yes (national/regional index) | Real REST API, CC0, no key | **Free** | Implemented this session — see below |
| **Booli** | Historically yes | Historically yes | Historically yes | **Self-serve API closed since ~2018** (docs page 404s) | Enterprise-only (Booli Pro), opaque | Not viable today despite being the obvious brand |
| **Hemnet** | No third-party access | — | — | None (BostadsAPI is broker→Hemnet publishing, not data-out) | N/A | Not usable; ToS explicitly bans scraping |
| **Valueguard (HOX index)** | No (index only) | No | Yes, quality-adjusted, ~2000 local sub-indices | Subscription (API/file/Excel) | Paid, custom | Good for a credible trend number specifically |
| **Värderingsdata** | Via AVM | Via AVM | — | Documented APIs | Paid B2B/enterprise | Alternative if budget allows |
| Scraping (any) | — | — | — | — | — | **Excluded per project preference — violates Booli/Hemnet ToS** |

**What this repo already has**: `providers/booli.ts` is a real, correctly-signed
integration against Booli's sanctioned API (fixed 2026-07-22, see
docs/45) that already implements comparable sales, price/m² benchmark,
and quarterly trend — **it just has no `BOOLI_CALLER_ID`/`BOOLI_API_KEY`
configured in this environment**, and self-serve signup for new keys
appears closed. This is a credentials/business question, not a missing
feature. `providers/parseBotBooli.ts` (a scraping-as-a-service fallback)
was **disabled this session** — confirmed broken (its location search
ignores the query entirely) and flagged as a legal risk by
`docs/legal-data-migration-plan.md`.

**What was implemented this session**: `scb_housing_market.py`'s parser
had a real bug — it read the SCB price-index table as if `Tid` were the
only dimension, when the table now also carries a `Region` dimension
(national + 3 metro areas + 8 riksområden). It happened to still return
the correct national figures by coincidence (region "00" lands at index 0
in the flattened array), but silently discarded every other region. Fixed
to resolve cells by their actual dimension index; `marketIntelligence.ts`
now bridges the national trend into the Price chapter as a clearly-labeled
supplementary fact ("SCB's national price index changed by X% from A to
B") — not a replacement for real comparables, but a free, honest, always-
available fallback when comparables aren't connected.

**Recommended next step for genuine comparables**: contact Svensk
Mäklarstatistik (info@maklarstatistik.se) for pricing, or pursue a
`BOOLI_CALLER_ID`/`BOOLI_API_KEY` enterprise conversation with
Booli/SBAB. Both are business decisions outside what this session could
action.

## Civic / area data sources

| Category | Best source | Granularity | Access | Status in this repo |
|---|---|---|---|---|
| BRF economics | Bolagsverket (free doc retrieval, still unstructured) / Allabrf, UC (paid, structured) | Per-BRF | Free API for raw docs; paid for structured figures | No free structured source exists anywhere — validates keeping the existing OCR pipeline |
| Crime/safety | Kolada `safety_security_index` (kommun) + Polisen events (county, real-time log) | Kommun / county | Both free, real APIs | **Implemented this session** — bridged from `location_intelligence`, previously collected but discarded |
| Demographics | SCB PxWebApi | DeSO (~6,160 areas) | Free, CC0, no signup | Already integrated (`scbDemographicsProvider`) |
| Schools | Skolverket Skolenhetsregistret v2 | Per school unit | Free, CC0, no signup | Already integrated (`skolverketSchools.ts`) |
| Transport | Trafiklab (GTFS + ResRobot) | Stop-level, nationwide | Free self-service key | Already integrated (`commute.ts`) — the `public_transport` placeholder was stale and has been removed |
| Environment/flood/noise | SGU + SMHI + MCF (f.k.a. MSB) + Naturvårdsverket | Polygon/raster, partial coverage | Free but fragmented GIS (WMS/shapefile), not a clean per-address API | Not implemented — genuinely geodata-shaped work, not a quick integration |
| Planning/detaljplan | Lantmäteriet NGP digital detaljplan API | Per plan | Real API, but only ~22/162 kommuner actively delivering data | `lantmateriet_detaljplan` provider already scaffolded in `location_intelligence`, `not_connected` — needs OAuth2 credentials (a provisioning step, not a code gap) |
| Elections | Valmyndigheten (flat CSV/XML) + Kolada `voter_turnout_pct` (kommun) | Valdistrikt (Valmyndigheten) / kommun (Kolada) | Free, no auth | **Kolada turnout implemented this session** (factual, no scoring). Full per-party result breakdown via Valmyndigheten would need a valdistrikt geospatial match — deferred, see PROJECT_STATE.md |

**Why crime/elections were cheap to add**: both already flow through the
Python `location_intelligence` engine on every request (Kolada + Polisen
are existing, validated providers — docs/40, 54/54 live runs) — the
`locationIntelligenceProvider` TS bridge just discarded everything except
one unrelated signal (`nearby_planned_projects`). Widening what it
extracts was a same-day change; no new provider, no new credentials, no
new API relationship.

## Sources

- [SCB PxWebApi v2](https://www.scb.se/vara-tjanster/oppna-data/)
- [SCB fastighetsprisstatistik release noting the kommun-level paid-order constraint for bostadsrätter](https://www.scb.se/hitta-statistik/statistik-efter-amne/boende-bebyggelse-och-mark/fastigheter/fastighetspriser-och-lagfarter/pong/statistiknyhet/forsaljning-av-bostadsratter-2023-och-2024/)
- [Svensk Mäklarstatistik API](https://api.maklarstatistik.se)
- [Lantmäteriet Geotorget / Fastighetsprisuttag](https://www.lantmateriet.se/)
- [Booli API docs (404, self-serve closed)](https://www.booli.se/api/)
- [Hemnet user terms (scraping prohibited)](https://www.hemnet.se/om/anvandarvillkor)
- [Valueguard HOX index](https://www.valueguard.se/)
- [Bolagsverket värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)
- [Brå — no public API, static tables only](https://bra.se/om-bra/om-webbplatsen/data-fran-bra)
- [Polisen öppna data / events API](https://polisen.se/om-polisen/om-webbplatsen/oppna-data/api-over-polisens-handelser/)
- [Skolverket Skolenhetsregistret API](https://www.skolverket.se/om-skolverket/oppna-data/api-for-skolenhetsregistret)
- [Trafiklab APIs](https://www.trafiklab.se/api/our-apis/)
- [SGU geologiska data](https://www.sgu.se/produkter-och-tjanster/geologiska-data/)
- [MCF (f.d. MSB) översvämningsportalen](https://kartor.mcf.se/oversvamningsportal/)
- [Naturvårdsverket bullerkartläggning](https://www.naturvardsverket.se/vagledning-och-stod/buller/kartlaggning-av-buller/)
- [Lantmäteriet detaljplan (NGP)](https://www.lantmateriet.se/sv/nationella-geodataplattformen/datamangder/detaljplan/)
- [Valmyndigheten öppna data](https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data)
