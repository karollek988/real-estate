# Data-Source Research: Swedish Real-Estate Valuation Platform

**Date:** 2026-07-13 · **Status:** v1, pre-implementation research
**Market assumption:** Sweden, Stockholm first (the BRF and subway-expansion
requirements only exist in the Swedish market). Verified facts carry a
source link in [References](#references); everything else is assessed
knowledge and marked *(verify)* where confidence is lower.

---

## Executive summary / verdict

**A free-data MVP is feasible for property valuation and BRF-quality
analysis; it is NOT feasible for a *complete* underpriced-listing product,
because transaction-level apartment sold prices — the single most important
dataset — are only fully available commercially.**

- The **geography / socioeconomics / infrastructure layer is excellent and
  free**: Lantmäteriet (CC0 since Feb 2025), SCB, Kolada, Trafiklab,
  Trafikverket, OSM, Polisen. Sweden is one of the best countries in the
  world for this layer.
- **BRF financial health is a real, free differentiator**: digitally filed
  annual reports via Bolagsverket's API let us compute debt/m², fee
  trajectory, and maintenance risk — signals most buyers can't read.
- The **bottleneck is sold prices for bostadsrätter**: not in any public
  register (a bostadsrätt sale is a share transfer, not a property
  transfer, so Lantmäteriet never sees it). Free access = Booli's API
  under a non-commercial, attribution license; full-scale access = paid
  (Booli/allabrf/Mäklarstatistik partner agreements).
- **Hemnet is off-limits**: its terms prohibit scraping *and explicitly
  prohibit use of its data for ML/AI*. Plan as if Hemnet does not exist.

Recommended MVP path: build on Booli API (personal/non-commercial tier) +
free public layers, prove the valuation model works, and only then decide
whether the commercial data agreements are worth buying. This mirrors the
betting project's lesson (Sprint 50): the ceiling is set by data access,
so verify the ceiling before building the product.

---

## 1. Available datasets

"Free" means usable without payment at MVP scale. Reliability:
★★★ = authoritative register, ★★ = commercial but curated, ★ = best-effort.

### 1.1 Listings & sold prices (the core, and the bottleneck)

| Source | Owner | API | Open data | Free | License | Reliability | Coverage | Updates |
|---|---|---|---|---|---|---|---|---|
| Booli listings + slutpriser | Booli (SBAB) | Yes, key on request | No | Yes, capped | Non-commercial-competition clause, "powered by Booli" attribution required | ★★ | Most of Sweden; slutpriser large but not complete | Daily |
| Hemnet | Hemnet Group | Broker-integration API only (publishing, not consuming) | No | **No** | ToS bans scraping **and ML/AI use of its data** | ★★★ | ~90 % of Swedish listings | — |
| Svensk Mäklarstatistik | Mäklarsamfundet etc. | Yes, aggregated stats | No | Partner/media only; free monthly aggregates on site | Proprietary | ★★★ | All broker sales, aggregated (area-level, not per-object) | Monthly |
| Lantmäteriet Fastighetsprisregistret | Lantmäteriet (state) | Via API-portal / resellers | Partially (open-data program ongoing) | Historically fee-based *(verify current terms)* | Specific | ★★★ | **Houses/fastigheter only — no bostadsrätter** (share transfers, never registered) | Continuous |
| allabrf sales data | allabrf.se | Yes (BRF-Data product) | No | **No** (commercial product) | Commercial | ★★ | ~25 000 BRFs incl. sales | Monthly |
| Valueguard HOX index | Valueguard | Yes | No | Index values public, micro-data paid | Commercial | ★★★ | Price indices | Monthly |

### 1.2 Property metadata, addresses, BRF

| Source | Owner | API | Open data | Free | License | Reliability | Coverage | Updates |
|---|---|---|---|---|---|---|---|---|
| Lantmäteriet: addresses, buildings, property boundaries, maps, elevation, orthophotos | Lantmäteriet | Yes (OAuth2 via API-portal) + bulk download | **Yes, since Feb 2025** | Yes | **CC0** | ★★★ | National | Continuous |
| Bolagsverket annual reports (BRF årsredovisningar) | Bolagsverket | Yes ("värdefulla datamängder" API) | Yes (EU high-value-datasets regime) | Yes | Open | ★★★ | All digitally filed reports (rising share; older/paper ones missing) | On filing |
| allabrf BRF database (parsed financials, ratings) | allabrf.se | Yes | No | Website lookups free; API/bulk commercial | Commercial | ★★ | ~25 000 BRFs | Monthly |
| Skatteverket taxeringsvärde | Skatteverket | Limited *(verify)* | Partially | Mostly | Public-register rules | ★★★ | Houses (not bostadsrätter) | Yearly cycles |
| EPCs / energideklarationer | Boverket | Register lookup; bulk on request *(verify API)* | Partially | Yes | Public | ★★★ | All declared buildings | On declaration |

### 1.3 Geography, transport, infrastructure

| Source | Owner | API | Open data | Free | License | Reliability | Coverage | Updates |
|---|---|---|---|---|---|---|---|---|
| OpenStreetMap / Overpass | OSM community | Yes | Yes | Yes | ODbL | ★★ (urban Sweden: very good) | POIs, roads, footways | Continuous |
| Trafiklab (GTFS Sverige 2, SL APIs, ResRobot) | Samtrafiken | Yes | Yes | Yes (rate-limited tiers) | Open (CC) | ★★★ | All Swedish public transport, timetables + realtime | Daily |
| Trafikverket open API (Lastkajen, trafikinfo) | Trafikverket | Yes | Yes | Yes | Open | ★★★ | Roads, rail, national infrastructure plans | Continuous |
| Nya tunnelbanan (subway expansion: routes, stations, timelines) | Region Stockholm / FUT | No API; published plans/GIS | Partially | Yes | Public | ★★★ | Barkarby, Arenastaden, Nacka, Söderort lines | On milestone |
| Municipal detaljplaner (zoning) | Each municipality; Stockholm via open-data portal | Stockholm: yes (geodata APIs); other municipalities vary wildly | Partially | Yes | Mostly CC/public | ★★ | Per municipality | On plan change |
| Building permits (bygglov) | Municipalities | **No national API**; Stockholm publishes case data partially *(verify per municipality)* | Rarely | Yes where published | Public documents | ★★ | Fragmented | Irregular |
| Routing / distance / walkability | Self-hosted OSRM/Valhalla on OSM + GTFS | Yes (self-hosted = unlimited) | Yes | Yes (infra cost only) | ODbL inputs | ★★ | National | You control |

### 1.4 Socioeconomics, schools, safety, macro

| Source | Owner | API | Open data | Free | License | Reliability | Coverage | Updates |
|---|---|---|---|---|---|---|---|---|
| SCB (PxWeb API): demographics, incomes, population growth, migration, housing stock | Statistics Sweden | Yes | Yes | Yes | CC0-like open | ★★★ | National, down to DeSO areas | Yearly/quarterly |
| Kolada (municipal KPIs) | RKA | Yes | Yes | Yes | Open | ★★★ | All municipalities | Yearly |
| Polisen events API | Polisen | Yes | Yes | Yes | Open | ★★ (event feed, not statistics) | National, coarse locations | Continuous |
| BRÅ crime statistics | BRÅ | Downloads; limited API | Yes | Yes | Open | ★★★ | Municipality/region level (not per-address, by design) | Yearly |
| Skolverket school units + results | Skolverket | Yes (school-unit register API, Salsa/results) | Yes | Yes | Open | ★★★ | All schools | Yearly |
| Riksbanken API (policy rate, SWESTR) | Riksbank | Yes | Yes | Yes | Open | ★★★ | Rates, historical | Daily |
| SCB/FI mortgage-rate statistics | SCB / Finansinspektionen | Yes (PxWeb) | Yes | Yes | Open | ★★★ | Average actual lending rates | Monthly |

---

## 2. Data-quality assessment per capability

### 2.1 Property valuation (estimate market value of a given home)

| | |
|---|---|
| Required inputs | Object attributes (m², rooms, floor, year), location, comparable sold prices, BRF financials (fee, debt), micro-location quality |
| Available free | Object attributes from listings (Booli); location layers (all of §1.3–1.4); BRF financials (Bolagsverket); comparables **capped** by Booli API license/volume |
| Missing | Complete per-object sold-price history at commercial scale; interior condition/renovation state (only in listing text/photos) |
| **Confidence: MEDIUM-HIGH** | An area-level valuation model is clearly buildable free. Per-object precision competitive with Booli/Hemnet's own estimates needs the paid comparables firehose. |

### 2.2 Underpriced-property detection

| | |
|---|---|
| Required inputs | Everything in 2.1, *live*, plus asking prices and a well-calibrated fair-value model whose error is smaller than typical listing mispricing |
| Available free | Live asking prices (Booli API); fair-value model per 2.1 |
| Missing | Scale of comparables; and note Swedish pricing culture — systematic underpricing as bidding bait means "listed below model value" ≠ "buyable below value". The target must be **final-price vs model**, not asking-price vs model |
| **Confidence: MEDIUM** | Detectable signal, but validating it needs slutpriser at volume — exactly the constrained dataset. Same structural problem as betting's "beat the closing line": the benchmark data is the scarce asset. |

### 2.3 Negotiation estimate (expected final price vs asking)

| | |
|---|---|
| Required inputs | Historical asking→final price pairs per segment, days-on-market, demand indicators (bidding activity), season/rate environment |
| Available free | Booli exposes asking + slutpris pairs (capped); rates (Riksbanken); market temperature via Mäklarstatistik free aggregates |
| Missing | Bidding-history data (Hemnet/broker-side, effectively unobtainable); volume of pairs |
| **Confidence: LOW-MEDIUM** | A segment-level "expected premium/discount" model is feasible; a per-listing negotiation coach is not, without commercial data. |

### 2.4 Future value estimation

| | |
|---|---|
| Required inputs | Price indices per area, infrastructure pipeline (subway!), demographic/income trends, supply pipeline (permits/zoning), rate scenarios |
| Available free | **All of it**: Valueguard/Mäklarstatistik indices (aggregate), Nya tunnelbanan timelines, Trafikverket plans, SCB projections, municipal zoning (fragmented), Riksbank rates |
| Missing | Granular new-supply pipeline outside Stockholm (permit fragmentation); and honesty: long-horizon point forecasts are scenario analysis, not prediction |
| **Confidence: MEDIUM-HIGH** as scenario/driver analysis; presenting it as point forecasts would be pseudo-precision. |

---

## 3. Risk assessment

| # | Risk | Severity | Mitigation / alternative |
|---|---|---|---|
| 1 | **Booli API terms**: non-commercial-competition clause + attribution; volume caps; key can be revoked. The MVP's core dataset sits on a revocable free tier. | **High** | Build the ingestion behind our own `data/` interface (provider-swappable, as the betting engine did with odds providers). Budget for Booli Pro/allabrf commercial agreements as the known upgrade path. Cache everything we're licensed to store. |
| 2 | **Hemnet unavailability** (scraping + ML use banned). Any plan that quietly assumes Hemnet data is a plan to get sued. | **High** | Accept Booli's smaller coverage; it is largely a mirror of broker feeds anyway. Do not scrape. |
| 3 | **No public register for bostadsrätt transactions** — this is structural, not a missing API. | **High** | Combination: Booli slutpriser (free tier) + Mäklarstatistik aggregates for calibration + eventual commercial agreement. |
| 4 | **License compatibility**: ODbL (OSM) + CC0 (Lantmäteriet) + proprietary (Booli) in one model. | Medium | Keep source lineage per feature (the betting engine's feature-provider pattern already does this); take legal advice before any commercial launch. |
| 5 | **Building permits/zoning fragmentation** across 290 municipalities. | Medium | Stockholm-first scope makes this tractable; treat national coverage as post-MVP. |
| 6 | **Bias & freshness**: Booli slutpriser skew toward broker-listed urban stock; BRF reports lag up to ~18 months; crime stats are area-level by design (GDPR). | Medium | Model with explicit as-of dates (data-leakage principle); never present stale BRF finances as current. |
| 7 | **GDPR**: sold prices tied to addresses are personal data when linkable to individuals. | Medium | Store at object/area level without person identifiers; publication of per-address prices is established practice (Booli does it) but our re-publication needs its own review. |
| 8 | **Accuracy ceiling**: incumbents (Booli/SBAB, Hemnet) run valuation models on strictly more data. | Medium | Differentiate on what they *don't* surface: BRF financial health, infrastructure pipeline, negotiation context — not on beating their point estimate. |

---

## 4. Is a free-data MVP realistic?

**Yes, with one honest restriction.** The free ecosystem supports:

1. **Valuation** at area-to-object level (confidence: medium-high),
2. **BRF quality scoring** — free, authoritative, and a genuine gap in the
   market (confidence: high),
3. **Future-value driver analysis** around infrastructure and demographics
   (confidence: medium-high),

but a **commercial-grade underpriced-listing detector requires paid
transaction data**, and the free Booli tier is only enough to *prove or
disprove the model* — which is exactly what an MVP is for. Decision gate
recommendation (same discipline as the betting project): pre-register the
model-quality threshold that justifies paying for data *before* seeing
MVP results.

---

## References

- [Booli API — listings, key + terms](http://mashup.se/api/boolis-api-hitta-bostadsannonser-i-hela-sverige/) · [Booli slutpriser](https://www.booli.se/sok/slutpriser)
- [Hemnet terms of use (scraping/ML prohibition)](https://www.hemnetgroup.se/en/terms-of-use/) · [Hemnet BostadsAPI (broker publishing only)](https://integration.hemnet.se/documentation/v1)
- [Lantmäteriet open-data portal (CC0)](https://opendata.lantmateriet.se/) · [open-data program](https://www.lantmateriet.se/oppnadata) · [API portal](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktsupport/api-portalen/) · [Fastighetsprisregistret](https://www.lantmateriet.se/sv/fastighet-och-mark/information-om-fastigheter/Fastighetsprisregistret/)
- [Bolagsverket high-value-datasets API (annual reports)](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder/apiforvardefulladatamangder.5513.html)
- [allabrf BRF-Data (commercial)](https://sv.allabrf.se/brfdata)
- [Svensk Mäklarstatistik API (partner-only)](https://www.maklarstatistik.se/svensk-maklarstatistiks-api-aggregerad-statistik/)
