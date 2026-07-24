# Data Source Inventory — Swedish Real Estate (Stockholm-first)

**Date:** 2026-07-13 · **Sprint:** 2 · **Status:** inventory only — no
evaluation of sufficiency, no algorithm design, no code.

This is a catalogue of every realistic data source identified for the
Sweden / Stockholm real-estate project. Facts already verified during
prior research (see `data-sources.md`, Sprint prior to this one) are
carried over; new entries are marked accordingly. Where a detail could
not be confirmed it is marked *(verify)*.

Reliability scale: ★★★ authoritative/official register, ★★ commercial
but curated, ★ best-effort / community / fragmented.

---

## 1. Booli

- **Owner:** Booli Search Technologies AB (majority-owned by SBAB, a
  state-owned bank)
- **Information:** active listings, sold prices (slutpriser), object
  attributes (m², rooms, floor, year built), listing photos/text
- **API available:** Yes — key issued on request
- **Free or paid:** Free tier (capped volume); commercial/high-volume tiers paid
- **License:** Proprietary terms — non-commercial-competition clause,
  mandatory "powered by Booli" attribution
- **Update frequency:** Daily
- **Geographic coverage:** Most of Sweden; slutpriser large but not complete
- **Long-term reliability:** ★★ — commercial company, terms/key access
  can change or be revoked
- **Legal commercial use:** Conditional — free tier explicitly restricts
  competitive/commercial use; a commercial launch likely requires a paid
  agreement *(verify current contract terms before launch)*
- **Confidence:** High (terms and API existence verified)

## 2. Hemnet

- **Owner:** Hemnet Group AB (listed company)
- **Information:** ~90% of all Swedish property listings, the de facto
  market reference
- **API available:** Broker-integration API only (for brokers to publish
  listings), not for consuming/reading data
- **Free or paid:** N/A — not accessible as a data source
- **License:** Terms of use explicitly ban scraping **and explicitly ban
  use of Hemnet data for ML/AI**
- **Update frequency:** N/A
- **Geographic coverage:** ~90% of Sweden
- **Long-term reliability:** ★★★ as a market institution, but irrelevant
  since access is prohibited
- **Legal commercial use:** **No.** Explicitly prohibited by ToS. Treat as
  unusable under any circumstance.
- **Confidence:** High (ToS text verified)

## 3. Lantmäteriet (Swedish mapping, cadastral and land registration authority)

- **Owner:** Lantmäteriet (state agency)
- **Information:** addresses, buildings, property boundaries, maps,
  elevation, orthophotos; Fastighetsprisregistret (property price
  register — fastighet/house sales only)
- **API available:** Yes — OAuth2 via API-portal, plus bulk download
- **Free or paid:** Open geodata free since Feb 2025 (CC0); price
  register access historically fee-based via resellers *(verify current
  terms)*
- **License:** CC0 for the open-data program; specific/commercial terms
  for the price register
- **Update frequency:** Continuous
- **Geographic coverage:** National
- **Long-term reliability:** ★★★ — state authority, authoritative source
- **Legal commercial use:** Yes for CC0 open-data layers; price register
  terms need re-verification per product use
- **Confidence:** High for open geodata; Medium for price-register terms
  (*verify*)

**Important structural gap:** a bostadsrätt (co-operative apartment)
sale is a share transfer in the housing association, not a property
transfer, so it is never recorded in Fastighetsprisregistret. Apartment
sold prices do not exist in this or any other public register in
Sweden.

## 4. Bolagsverket

- **Owner:** Bolagsverket (Swedish Companies Registration Office, state agency)
- **Information:** BRF (housing co-operative) annual reports
  (årsredovisningar) — balance sheets, debt, fees, maintenance plans
- **API available:** Yes — "värdefulla datamängder" (high-value
  datasets) API
- **Free or paid:** Free
- **License:** Open (EU high-value-datasets regime)
- **Update frequency:** On filing (continuous, per BRF)
- **Geographic coverage:** National — all digitally filed reports
  (coverage rising over time; older/paper-filed reports missing)
- **Long-term reliability:** ★★★ — state authority
- **Legal commercial use:** Yes
- **Confidence:** High

## 5. SCB (Statistics Sweden)

- **Owner:** Statistiska centralbyrån (state statistical agency)
- **Information:** demographics, income, population growth, migration,
  housing stock, mortgage-rate statistics (with Finansinspektionen)
- **API available:** Yes — PxWeb API
- **Free or paid:** Free
- **License:** Open, CC0-like
- **Update frequency:** Yearly/quarterly (mortgage stats monthly)
- **Geographic coverage:** National, down to DeSO (small statistical
  area) level
- **Long-term reliability:** ★★★
- **Legal commercial use:** Yes
- **Confidence:** High

## 6. Region Stockholm

- **Owner:** Region Stockholm (regional government)
- **Information:** regional planning data, healthcare facility
  locations, some public-transport governance context (SL is a Region
  Stockholm-owned company — see Trafiklab/SL entry); Nya tunnelbanan
  (subway expansion) plans, routes, station locations, timelines
- **API available:** No unified API; published plans/GIS datasets per
  initiative
- **Free or paid:** Free
- **License:** Public documents; specific GIS license *(verify per dataset)*
- **Update frequency:** On milestone/plan update
- **Geographic coverage:** Stockholm county
- **Long-term reliability:** ★★★ — government body
- **Legal commercial use:** Yes, generally (public sector information),
  *(verify per specific dataset license)*
- **Confidence:** Medium — existence confirmed, exact API/license terms
  not itemized per dataset

## 7. Stockholms Stad Open Data

- **Owner:** City of Stockholm
- **Information:** municipal geodata portal — detaljplaner (zoning),
  building permits (bygglov) case data (partial), municipal boundaries,
  planning documents
- **API available:** Yes for geodata layers (Stockholm's open-data/geodata
  portal); bygglov case data only partially published *(verify current
  portal scope)*
- **Free or paid:** Free
- **License:** Mostly CC/public *(verify per layer)*
- **Update frequency:** On plan/case change
- **Geographic coverage:** Stockholm municipality only (other
  municipalities vary widely and mostly lack equivalent portals)
- **Long-term reliability:** ★★ — municipal, generally stable but scope
  and format can change without national standard
- **Legal commercial use:** Likely yes, *(verify per layer)*
- **Confidence:** Medium

## 8. OpenStreetMap (OSM)

- **Owner:** OpenStreetMap Foundation / community
- **Information:** points of interest, roads, footways, general
  geographic features
- **API available:** Yes — Overpass API, plus bulk extracts
- **Free or paid:** Free
- **License:** ODbL (share-alike — attribution and share-alike
  obligations apply to derived data)
- **Update frequency:** Continuous (community-edited)
- **Geographic coverage:** National; urban Sweden (incl. Stockholm) is
  well-mapped
- **Long-term reliability:** ★★ — depends on volunteer community, no
  formal SLA
- **Legal commercial use:** Yes, under ODbL terms (share-alike obligation
  on the derived database, not on outputs generally — *(verify ODbL
  interpretation with legal counsel before commercial launch)*)
- **Confidence:** High on data existence/access; Medium on license
  interpretation for this specific product

## 9. Trafikverket

- **Owner:** Trafikverket (Swedish Transport Administration, state agency)
- **Information:** road and rail infrastructure, national infrastructure
  investment plans, traffic information (Lastkajen, trafikinfo API)
- **API available:** Yes
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Continuous
- **Geographic coverage:** National
- **Long-term reliability:** ★★★ — state agency
- **Legal commercial use:** Yes
- **Confidence:** High

## 10. Polisen (Swedish Police Authority)

- **Owner:** Polismyndigheten (state agency)
- **Information:** reported police events feed (not full crime
  statistics), coarse locations
- **API available:** Yes
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Continuous
- **Geographic coverage:** National, coarse location precision
- **Long-term reliability:** ★★ — event feed, not a curated statistical
  product; coverage/format has changed in the past
- **Legal commercial use:** Yes
- **Confidence:** Medium — good for event-level signals, not a substitute
  for BRÅ statistics

## 11. SMHI (Swedish Meteorological and Hydrological Institute)

- **Owner:** SMHI (state agency)
- **Information:** weather observations/forecasts, climate data,
  flood/climate-risk data relevant to property risk assessment
- **API available:** Yes — open data API
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Continuous (observations), periodic (climate
  projections)
- **Geographic coverage:** National
- **Long-term reliability:** ★★★ — state agency
- **Legal commercial use:** Yes
- **Confidence:** Medium — relevance to valuation not yet assessed (out
  of scope for this sprint), but access terms are straightforward

## 12. Riksbanken (Sveriges Riksbank)

- **Owner:** Sveriges Riksbank (central bank)
- **Information:** policy rate, SWESTR reference rate, historical rate series
- **API available:** Yes
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Daily
- **Geographic coverage:** National (macro)
- **Long-term reliability:** ★★★ — central bank
- **Legal commercial use:** Yes
- **Confidence:** High

## 13. Svensk Mäklarstatistik

- **Owner:** Mäklarsamfundet and industry partners
- **Information:** aggregated sold-price statistics by area/segment
  (HOX-adjacent), price indices
- **API available:** Yes, but partner/media access only; free monthly
  aggregate figures published on the public website
- **Free or paid:** Free aggregates only; full API is partner-only
  (paid/contractual)
- **License:** Proprietary
- **Update frequency:** Monthly
- **Geographic coverage:** National, area-level aggregation (not per-object)
- **Long-term reliability:** ★★★ — established industry statistics body
- **Legal commercial use:** Aggregates on the public site likely usable
  with attribution *(verify)*; full API requires a commercial partner
  agreement
- **Confidence:** Medium

## 14. Valueguard (HOX index)

- **Owner:** Valueguard-KTH AB
- **Information:** Swedish housing price indices (HOX)
- **API available:** Yes
- **Free or paid:** Index values public; underlying micro-data paid
- **License:** Commercial
- **Update frequency:** Monthly
- **Geographic coverage:** National, by segment/region
- **Long-term reliability:** ★★★ — established, used by Riksbank/media
- **Legal commercial use:** Index values likely citable; micro-data
  requires a paid license
- **Confidence:** Medium

## 15. allabrf.se (BRF-Data)

- **Owner:** allabrf.se
- **Information:** parsed BRF financials, ratings, ~25,000 BRFs including
  some sales data
- **API available:** Yes, as a commercial product (BRF-Data)
- **Free or paid:** Website lookups free; API/bulk access paid
- **License:** Commercial
- **Update frequency:** Monthly
- **Geographic coverage:** National, ~25,000 BRFs
- **Long-term reliability:** ★★ — commercial vendor, dependent on their
  continued parsing pipeline
- **Legal commercial use:** Only under a paid commercial agreement
- **Confidence:** Medium

## 16. Skatteverket (Swedish Tax Agency)

- **Owner:** Skatteverket (state agency)
- **Information:** taxeringsvärde (tax assessment value) for real property
- **API available:** Limited *(verify)*
- **Free or paid:** Mostly free via public-register lookup
- **License:** Public-register rules
- **Update frequency:** Yearly assessment cycles
- **Geographic coverage:** Houses/fastigheter (not bostadsrätter, since
  co-op apartments are not separately real-property-taxed the same way)
- **Long-term reliability:** ★★★ — state agency
- **Legal commercial use:** Yes, within public-register access rules
  *(verify bulk-access terms)*
- **Confidence:** Medium — API mechanics not fully confirmed

## 17. Boverket (energideklarationer / EPCs)

- **Owner:** Boverket (National Board of Housing, Building and Planning)
- **Information:** energy performance certificates (energideklarationer)
  for buildings
- **API available:** Register lookup exists; bulk/API access *(verify)*
- **Free or paid:** Free
- **License:** Public
- **Update frequency:** On declaration (declarations are periodic per
  building, roughly every 10 years)
- **Geographic coverage:** All buildings with a filed declaration
- **Long-term reliability:** ★★★ — state agency
- **Legal commercial use:** Yes
- **Confidence:** Medium — bulk/API access mechanics not fully confirmed

## 18. Kolada

- **Owner:** RKA (Council for Municipal Analysis, jointly owned by SALAR
  and the Swedish state)
- **Information:** municipal-level KPIs — economy, education, environment,
  social services, housing-adjacent indicators
- **API available:** Yes
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Yearly
- **Geographic coverage:** All Swedish municipalities
- **Long-term reliability:** ★★★ — public-sector consortium, long-running
- **Legal commercial use:** Yes
- **Confidence:** High

## 19. BRÅ (Brottsförebyggande rådet — National Council for Crime Prevention)

- **Owner:** BRÅ (state agency)
- **Information:** official crime statistics
- **API available:** No general API; structured downloads; limited API
  access for some datasets *(verify)*
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Yearly
- **Geographic coverage:** Municipality/region level (not per-address, by
  design — statistical disclosure control)
- **Long-term reliability:** ★★★ — state agency, authoritative crime statistics
- **Legal commercial use:** Yes
- **Confidence:** High

## 20. Skolverket (National Agency for Education)

- **Owner:** Skolverket (state agency)
- **Information:** school unit register, school results (Salsa),
  admissions data
- **API available:** Yes — school-unit register API, results datasets
- **Free or paid:** Free
- **License:** Open
- **Update frequency:** Yearly
- **Geographic coverage:** All Swedish schools
- **Long-term reliability:** ★★★ — state agency
- **Legal commercial use:** Yes
- **Confidence:** High

## 21. Trafiklab (GTFS Sverige 2, SL APIs, ResRobot)

- **Owner:** Samtrafiken (public-transport industry consortium)
- **Information:** national public-transport timetables and realtime
  data (GTFS format), including SL (Stockholm public transport) feeds,
  journey-planning (ResRobot)
- **API available:** Yes
- **Free or paid:** Free, rate-limited tiers; higher volume requires
  registration
- **License:** Open (CC-based terms)
- **Update frequency:** Daily (static), realtime feeds continuous
- **Geographic coverage:** All Swedish public transport
- **Long-term reliability:** ★★★ — industry-standard consortium, widely used
- **Legal commercial use:** Yes, within stated rate-limit tiers; higher
  volume needs registration/agreement
- **Confidence:** High

## 22. Parse.bot (Booli.se API)

- **Owner:** Parse.bot (third-party scraper-as-a-service marketplace,
  unaffiliated with Booli)
- **Information:** the same class of data as entry 1 (Booli) — active
  listing details, sold/comparable listings, area price trends — reached
  via Parse.bot's own scrape of booli.se rather than Booli's own API.
  Integrated as `providers/parseBotBooli.ts` (2026-07-23), one hop of
  indirection behind the direct Booli API and behind Hemnet's own page
  scrape in identityTrust.ts's trust order.
- **API available:** Yes — `https://parse.bot/marketplace/e0286288-9caf-40e1-83f2-eb4dbbc95fab/booli-se-api`,
  key-based auth (`X-API-Key` header)
- **Free or paid:** Free tier: 100 credits/month, 5 req/min; paid tiers
  for higher volume
- **License:** Parse.bot's own terms as a scraping intermediary; not a
  Booli-issued agreement — re-verify before any commercial commitment
- **Update frequency:** Live (each call performs an on-demand scrape —
  measured 7-42s response time per request, not a cached lookup)
- **Geographic coverage:** Same as Booli (most of Sweden)
- **Long-term reliability:** ★ — third-party scraper of another company's
  site; more fragile than a direct API (subject to booli.se's own layout
  changes breaking the scraper, independent of any Booli-issued terms)
- **Legal commercial use:** *(verify)* — inherits Booli's own terms
  question (see entry 1) plus Parse.bot's own terms as an intermediary
- **Known limitations (verified live, not from docs alone):** no image or
  floor-plan URL field anywhere in the API (only id/width/height/label);
  no broker/agent person name (only a numeric, unresolved agent id); most
  significantly, `search_listings_for_sale`'s `query` parameter does **not**
  filter by location despite being documented as "Location search
  (municipality, area, street)" — confirmed by three different real
  requests returning the same (or, paginated, a different but still
  clearly nationwide-unfiltered) result set regardless of query text. In
  practice this means address-based lookups rarely succeed today; the
  detail/photo endpoints return correct data once you already have a
  `listing_id`, so this is specifically a search/discovery defect, not a
  data-quality one.
- **Confidence:** High (endpoints, auth, and field shapes confirmed via
  live calls against real listings, 2026-07-23) — but see the search
  limitation above before relying on this for address matching.

---

## Notes on scope and gaps

- This inventory does not evaluate whether these sources are *sufficient*
  for any specific product capability — that assessment is out of scope
  for this sprint (see `data-sources.md` for the prior capability-level
  assessment, which should be revisited once this inventory is agreed).
- No algorithm or pipeline design is included here by design.
- Several license/API-mechanics details are marked *(verify)* and should
  be re-confirmed against the current live terms/documentation before any
  commercial commitment, since state-agency and vendor terms can change
  (Lantmäteriet's own terms changed materially as recently as Feb 2025).
- Additional sources may exist per-municipality (e.g. building permits,
  zoning) that were not itemized individually beyond Stockholm; national
  building-permit data is fragmented across 290 municipalities with no
  common API.
