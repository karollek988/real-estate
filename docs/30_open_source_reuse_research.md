# Open Source Reuse Research — Köpanalys

**Date:** 2026-07-18
**Author role:** Senior Software Architect / OSS Research Engineer
**Scope:** Curated open-source components for the Swedish housing-decision platform (bostadsrätter, villor, BRF:er, Swedish addresses/municipalities). Optimized for fastest path to a functional website, not perfect architecture.

---

## Executive Summary

Three findings dominate everything else:

1. **Our two validated gaps map directly onto mature OSS.** The production validation (2026-07-18, SBC site) proved document *acquisition* fails on JS-rendered sites, and the earlier audit proved document *extraction* is 0% implemented. Both problems are solved, production-grade, MIT/Apache-licensed: **Playwright/Crawlee** for acquisition, **Docling + Instructor** for extraction. We should not write another line of custom crawler-parsing code before adopting these.

2. **There is no open-source BRF analysis engine.** Every Swedish competitor (aibrf.se, brfkollen.io, lusa.se) is closed SaaS. The nyckeltal extraction, risk scoring, and decision logic is our moat — build it, keep it proprietary, and note that since 2023 Swedish law mandates 7 standardized nyckeltal in every BRF annual report, which makes extraction targets well-defined.

3. **Sweden-specific OSS is thin but the data layer is rich.** GitHub has only hobby-grade Hemnet/Booli scrapers (and Hemnet scraping is off-limits for us per our earlier legal review). The real Swedish leverage is open *data* + generic OSS: SCB PxWeb API (already live in our pipeline), OSM Sweden extracts (Geofabrik), Trafiklab GTFS for all Swedish transit, Bolagsverket's iXBRL digital annual reports, and self-hosted geocoding (Photon) over Swedish OSM data.

---

## Top 16 Recommended Open Source Projects (ranked)

### 1. Docling — score 9.5
- **URL:** https://github.com/docling-project/docling
- **License:** MIT (companion Granite-Docling model Apache-2.0) · **Language:** Python · **Popularity:** ~61k stars · **Maintenance:** very active; LF AI & Data Foundation project, started by IBM Research
- **Why:** Converts PDFs (incl. scanned, with OCR) to structured Markdown/JSON with table extraction and layout understanding. This is the entire missing `extractor/` module of BRF-Scraper.
- **Sweden fit:** BRF annual reports are Swedish-language PDFs with tabular balance sheets — exactly Docling's use case; it is language-agnostic for layout/table work.
- **Time saved:** 2–3 months (building PDF/table/OCR extraction from scratch).
- **Advantages:** MIT for commercial use, native LangChain/LlamaIndex integrations, active ecosystem, self-hostable server (docling-serve).
- **Limitations:** Heavy dependencies (ML models); GPU helps for scanned docs; table extraction still needs downstream validation for financial figures.

### 2. Playwright (Python) — score 9
- **URL:** https://github.com/microsoft/playwright-python
- **License:** Apache-2.0 · **Language:** Python bindings · **Popularity:** de-facto standard, Microsoft-maintained · **Maintenance:** very active
- **Why:** The SBC validation proved our httpx crawler is blind to SPA sites (0/16 documents on hemsida.sbc.se). Playwright renders JS. **Already installed in BRF-Scraper's venv with a dormant `browser/` provider module — zero new dependencies, just wiring.**
- **Time saved:** ~2 weeks vs building/vetting alternative browser automation; the provider module already exists in our repo.
- **Advantages:** Handles SPA/hosted-platform BRF sites (SBC alone = 546 sites); auto-wait semantics; headless or headful.
- **Limitations:** ~10x slower and heavier than raw HTTP; keep HTTP-first with browser fallback.

### 3. Instructor — score 9
- **URL:** https://github.com/567-labs/instructor
- **License:** MIT · **Language:** Python · **Popularity:** ~13k stars, 3M monthly downloads · **Maintenance:** very active
- **Why:** Validated, retried structured extraction from LLMs straight into Pydantic models. **Our `FinancialData`/`BoardInfo`/`PropertyInfo` Pydantic models already exist, fully specified and unused** — Instructor + Claude turns Docling's Markdown output into those models with ~50 lines of code.
- **Sweden fit:** Prompting handles Swedish accounting terms (soliditet, belåning kr/kvm, avgift) without training data; the 7 legally mandated nyckeltal give a fixed extraction schema.
- **Time saved:** 1–2 months vs regex/rule-based financial parsing (which would be brittle across layout variants of hundreds of BRFs).
- **Advantages:** Tiny API surface; validation + automatic retries; works with Claude.
- **Limitations:** Per-document LLM cost (~öre-level per report at current pricing); needs a numeric sanity-check layer (balance-sheet sums, year consistency).

### 4. Crawlee for Python — score 8.5
- **URL:** https://github.com/apify/crawlee-python
- **License:** Apache-2.0 · **Language:** Python · **Maintenance:** very active (Apify)
- **Why:** Production crawling framework: unified HTTP + Playwright crawlers, per-domain rate limiting, robots handling, retries, proxy rotation, fingerprint/anti-bot hygiene, persistent queues. It is a superset of everything BRF-Scraper's crawler/queue/rate-limiter/robots modules do by hand — and it doesn't have our query-string-dedup and `_is_internal` bugs.
- **Time saved:** replaces ~2,000 lines of our own crawler maintenance forever; 3–4 weeks immediate.
- **Advantages:** One framework for both fetch modes; battle-tested at Apify scale.
- **Limitations:** Migration cost — our 133 crawler/downloader tests wrap our own abstractions; adopt for new acquisition paths first rather than big-bang rewrite.

### 5. PostGIS — score 8.5
- **URL:** https://github.com/postgis/postgis
- **License:** GPL-2.0 (server-side use, no copyleft exposure for SaaS) · **Language:** C/SQL extension · **Maintenance:** 20+ years, extremely stable
- **Why:** Every location feature — "distance to school/water/transit", municipality joins, neighborhood polygons — as SQL. Runs inside Supabase (already our chosen platform; enable with one click).
- **Time saved:** weeks per geo-feature vs application-side geometry.
- **Limitations:** none material for us.

### 6. MapLibre GL JS — score 8
- **URL:** https://github.com/maplibre/maplibre-gl-js
- **License:** BSD-3 · **Language:** TypeScript · **Maintenance:** very active community fork of Mapbox GL
- **Why:** The map on every property/analysis page, free of Mapbox licensing. Works with free OSM-based vector tiles (e.g., OpenFreeMap) or Swedish raster tiles.
- **Time saved:** 1–2 weeks; instant professional map UX.
- **Limitations:** tile hosting choice matters at scale (self-host vs free tiers).

### 7. Photon (komoot) — score 8
- **URL:** https://github.com/komoot/photon
- **License:** Apache-2.0 · **Language:** Java · **Maintenance:** active; public demo + weekly country dumps from GraphHopper
- **Why:** Self-hosted, typo-tolerant, search-as-you-type geocoding — the address-entry box for "paste/type your address" is a solved problem. A **Sweden-only index is small** (country dumps downloadable; no 95GB planet install needed).
- **Sweden fit:** Built on Nominatim/OSM; Swedish address coverage in OSM is good in urban areas; supplement later with Lantmäteriet data if needed.
- **Time saved:** 3–4 weeks vs building address search; avoids per-request costs of commercial geocoders.
- **Limitations:** Java service to run; OSM address completeness in rural areas varies. (Nominatim itself, GPL-2, is the heavier alternative if we need full reverse-geocoding fidelity.)

### 8. pgvector — score 7.5
- **URL:** https://github.com/pgvector/pgvector
- **License:** PostgreSQL license · **Language:** C extension · **Maintenance:** very active; built into Supabase
- **Why:** Semantic search over extracted annual-report text ("what does the report say about the roof?") without a separate vector DB. Enables the RAG part of the Inspection Assistant premium feature.
- **Time saved:** 1–2 weeks + one less service to operate.
- **Limitations:** none at our scale.

### 9. Meilisearch — score 7.5
- **URL:** https://github.com/meilisearch/meilisearch
- **License:** MIT · **Language:** Rust · **Popularity:** ~57k stars · **Maintenance:** very active, monthly releases
- **Why:** Instant, typo-tolerant search over our BRF registry ("SKF anställdas" → S K F:s Anställdas Brf nr 2 — exactly the fuzzy-name problem our Discovery validation exposed). Handles Swedish diacritics well.
- **Time saved:** 1–2 weeks vs Postgres trigram tuning.
- **Limitations:** Another service; for MVP, Postgres `pg_trgm` may suffice — adopt when the BRF index exceeds a few thousand entries. (Typesense, GPL-3, is the comparable alternative.)

### 10. OSMnx — score 7.5
- **URL:** https://github.com/gboeing/osmnx
- **License:** MIT · **Language:** Python · **Maintenance:** active, academic-grade quality
- **Why:** Walkability, street-network distances, and POI extraction (schools, parks, transit stops) from OSM with a few lines of Python. Feeds our location analyzers with real network distances instead of crow-flies.
- **Time saved:** 2–3 weeks per location-analysis feature.
- **Limitations:** batch/offline analysis speed; cache aggressively per municipality.

### 11. r5py — score 7
- **URL:** https://github.com/r5py/r5py
- **License:** MIT wrapper over Conveyal R5 (verify current terms before deep embed) · **Language:** Python/Java · **Maintenance:** active (Digital Geography Lab)
- **Why:** True multimodal travel-time analysis (walk + Swedish public transit). **Trafiklab publishes open GTFS for all Swedish transit**, which is exactly r5py's input format → "22 min door-to-door to T-Centralen" as a computed fact.
- **Time saved:** 4–6 weeks; this is essentially un-buildable from scratch in MVP timeframes.
- **Limitations:** JVM dependency, memory-hungry; post-MVP feature, precompute per listing.

### 12. GeoPandas — score 7
- **URL:** https://github.com/geopandas/geopandas
- **License:** BSD-3 · **Language:** Python · **Maintenance:** very active
- **Why:** The pandas of geodata — joins SCB grid statistics, municipality polygons, flood-risk shapefiles (MSB publishes these openly) onto our listings in the ingestion pipeline.
- **Time saved:** continuous; days per geo-ingestion task.
- **Limitations:** none material.

### 13. ixbrl-parse — score 7
- **URL:** https://github.com/cybermaggedon/ixbrl-parse
- **License:** per repo (small project — verify) · **Language:** Python · **Maintenance:** moderate
- **Why:** **Bolagsverket receives digital annual reports as iXBRL** (their published implementation guidelines v1.6–1.8). For BRFs that file digitally, iXBRL gives *exact tagged financial facts with zero OCR/LLM risk*. Parse iXBRL when available, fall back to Docling+Instructor for PDF-only reports.
- **Time saved:** 2–3 weeks, and structurally higher data quality for a growing share of reports.
- **Limitations:** Small project — treat as reference/starting point; Swedish K2/K3 taxonomy mapping is on us; not all BRFs file digitally yet.

### 14. pyscbwrapper / PxWeb API clients — score 6.5
- **URL:** https://github.com/kirajcg/pyscbwrapper (and SCB's own https://github.com/statisticssweden/PxWeb)
- **License:** MIT (small community project) · **Language:** Python · **Maintenance:** low-activity; note SCB launched PxWebApi 2.0 (Oct 2025), replacing v1
- **Why:** Convenience over SCB's statistical API (income, demographics, price indices per municipality/DeSO). We already call SCB directly in the Bostadsradar pipeline — a wrapper is optional sugar, and v2 wrappers are still young.
- **Time saved:** days.
- **Limitations:** Thin wrappers; our existing direct integration may already be the better asset. Keep our adapter, steal their query-builder ideas.

### 15. CCAO model-res-avm + OpenAVMKit — score 6.5 (as blueprints, not dependencies)
- **URLs:** https://github.com/ccao-data/model-res-avm · https://github.com/larsiusprime (OpenAVMKit — see project site)
- **License:** CCAO AGPL-family (verify), OpenAVMKit verify · **Language:** R (CCAO), Python (OpenAVMKit) · **Maintenance:** CCAO actively used in production government assessment
- **Why:** The Cook County Assessor's model is the most transparent *production* AVM in the world — feature engineering, LightGBM setup, validation methodology all public. OpenAVMKit is a young Python AVM toolkit. **Read for architecture; do not import.** Our Tier-1 product is deliberately a *labeled price estimate + decision support*, not a valuation clone — and our probability-engine (from the betting project) already covers calibration/validation patterns.
- **Time saved:** 2–4 weeks of design mistakes avoided when we eventually build price estimation.
- **Limitations:** US data assumptions; AGPL means don't copy code into proprietary engine.

### 16. hempriser / hemnet-scrapy (reference only) — score 4
- **URLs:** https://github.com/pierrelefevre/hempriser · https://github.com/skaty5678/hemnet_scrapy · https://github.com/shymaseliza/hemnet-scraper
- **License/Maintenance:** hobby projects, low stars, variable upkeep
- **Why listed:** Proof of what Swedish listing scraping + price-model pipelines look like end-to-end; useful field notes on Hemnet/Booli page structures.
- **Why not adopted:** Hemnet scraping conflicts with our data-source decision (Hemnet disallowed per our 2026-07-13 research; Booli has an official API route instead). Quality below our bar. Ideas only.

**Explicitly skipped after review:** LangGraph/CrewAI/DSPy (agent frameworks are overkill — extraction is a single structured call; revisit for Inspection Assistant), marker/surya (excellent quality but GPL-3 code + revenue-capped model-weights license vs Docling's clean MIT), Selenium/Puppeteer (superseded by Playwright), Typesense (Meilisearch's MIT beats GPL-3 for us), dedicated vector DBs (pgvector suffices).

---

## Top 3 Projects for the MVP

### 1. Docling — the extraction engine
- **Why first:** The Lead-Engineer audit concluded PDF extraction is *the* single biggest blocker: today a downloaded ÅR is "a PDF with metadata." Nothing downstream (BRF analysis, risk, scoring, decisions) exists until this layer does. We already have 8 real PDFs on disk to validate against.
- **Enables:** ÅR → structured text + tables → the entire analysis product.
- **Saves:** 2–3 months.
- **Fits:** New `extractor/` implementation inside BRF-Scraper; output persisted to Supabase.
- **Permanent or MVP:** Permanent.

### 2. Instructor (+ Claude API) — the structuring layer
- **Why first:** Bridges Docling's output to our already-defined `FinancialData` Pydantic schema; the 7 legally mandated BRF nyckeltal make the extraction contract small and testable. Without it, Docling output is prose; with it, it's queryable data.
- **Enables:** Nyckeltal database, risk flags, BRF health report — the paid product.
- **Saves:** 1–2 months vs rule-based parsing, with better robustness across layouts.
- **Fits:** `extractor/` second stage; results validated by deterministic checks (sums, ranges, year sanity) before entering the Decision Engine.
- **Permanent or MVP:** Permanent (deterministic validators grow around it over time).

### 3. Playwright wiring (with Crawlee for new acquisition paths) — the acquisition fix
- **Why first:** Production validation showed 0/16 documents acquired from an SBC-hosted site; SBC alone hosts 546 BRF sites. Playwright is *already installed with a dormant provider module in our repo* — this is days of wiring, not a build. Pair with the LOW-effort SBC API adapter identified in the validation report.
- **Enables:** Document acquisition from the large hosted-platform segment of Swedish BRF sites.
- **Saves:** 3–4 weeks, and unblocks the input pipeline that feeds picks 1 and 2.
- **Fits:** `CrawlerWorker` browser fallback + platform adapters in `discovery/`.
- **Permanent or MVP:** Permanent (browser fallback); Crawlee adoption can grow incrementally.

---

## What We Should Build Ourselves (the moat — never outsource to OSS)

1. **The BRF Decision Engine** — nyckeltal interpretation, risk scoring, "explain-don't-score" analysis, benchmarks per kommun/year. No OSS exists (verified); competitors keep theirs closed. This *is* the product.
2. **The Swedish data-adapter layer** — SBC/platform adapters, Bolagsverket flows, SCB/OSM/Riksbanken/SMHI providers (6 already live in our pipeline), address→BRF resolution. The connector knowledge is accumulated competitive advantage.
3. **The Decision Preview / Premium Analysis product layer** — report generation, purchasing model (3 free previews, paid premium), confidence communication. Product identity.
4. **Extraction validation rules** — Swedish accounting sanity checks (K2/K3 quirks, tomträtt, progressive avskrivning history) that make LLM extraction trustworthy. This turns commodity OSS into a defensible pipeline.

---

## Recommended Tech Stack (MVP)

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Python 3.13 + FastAPI | Team already ships FastAPI (betting API); BRF-Scraper is Python |
| Database | Supabase Postgres + **PostGIS** + **pgvector** + pg_trgm | Already chosen platform; both extensions one click away |
| Acquisition | BRF-Scraper + **Playwright** fallback + platform adapters; **Crawlee** for new crawlers | Fixes validated SPA gap with parts already in repo |
| Extraction | **Docling** → **Instructor**+Claude → deterministic validators; **ixbrl-parse** path for digital filings | The entire missing extractor layer |
| Geocoding | **Photon** (Sweden index), self-hosted | Typo-tolerant address box, no per-request fees |
| Geo analysis | **GeoPandas** + **OSMnx** (batch), PostGIS (serving); r5py post-MVP | Free Swedish data: OSM, Trafiklab GTFS, MSB, SCB |
| Frontend | Next.js/React + **MapLibre GL JS** | Standard, fast, free map layer |
| Search | pg_trgm for MVP → **Meilisearch** when BRF index grows | Defer a service until needed |
| LLM | Claude API (claude-sonnet-5 for extraction; claude-haiku-4-5 for cheap bulk) | Structured outputs via Instructor |

---

## Final Recommendation (CTO, 3 months to launch)

**Adopt (in order): Playwright wiring + SBC adapter (week 1–2) → Docling (week 2–4) → Instructor+Claude extraction to our existing Pydantic schema (week 3–6) → PostGIS/pgvector in Supabase (trivial, week 4) → Photon + MapLibre for the address-in/map-out UX (week 5–8) → GeoPandas/OSMnx batch location features (week 7–10).** That sequence turns the two *proven* blockers into working pipeline in the first six weeks, then wraps product around it.

**Skip for now:** Crawlee big-bang migration (incremental only), Meilisearch (pg_trgm first), r5py travel-time matrices (fantastic, but a v1.1 feature), all agent frameworks (one structured extraction call needs no LangGraph), marker (license), any AVM library (our Tier-1 strategy is decision support with a labeled estimate, not a Zillow clone — revisit CCAO's methodology when we get there), and every hobby Hemnet scraper (legal + quality).

**The one-sentence version:** buy the commodity layers with MIT/Apache OSS — browser automation, PDF understanding, structured extraction, geo, maps, geocoding — and spend 100% of scarce engineering time on the two things nobody will hand us: reliable Swedish BRF data plumbing and the decision engine that interprets it.

---

### Sources
- [docling-project/docling](https://github.com/docling-project/docling) · [Docling docs](https://docling-project.github.io/docling/)
- [apify/crawlee-python](https://github.com/apify/crawlee-python) · [crawlee.dev/python](https://crawlee.dev/python/)
- [567-labs/instructor](https://github.com/567-labs/instructor) · [useinstructor.com](https://python.useinstructor.com/)
- [datalab-to/marker](https://github.com/datalab-to/marker) · [datalab-to/surya](https://github.com/datalab-to/surya) · [marker-pdf on PyPI](https://pypi.org/project/marker-pdf/)
- [komoot/photon](https://github.com/komoot/photon) · [photon.komoot.io](https://photon.komoot.io/)
- [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch)
- [r5py](https://github.com/r5py) · [r5py accessibility tutorial](https://sustainability-gis.readthedocs.io/en/latest/tutorials/r5py_demo.html) · [UDST/urbanaccess](https://github.com/UDST/urbanaccess)
- [kirajcg/pyscbwrapper](https://github.com/kirajcg/pyscbwrapper) · [statisticssweden/PxWeb](https://github.com/statisticssweden/PxWeb) · [SCB PxWebApi](https://www.scb.se/en/services/open-data-api/pxwebapi/)
- [cybermaggedon/ixbrl-parse](https://github.com/cybermaggedon/ixbrl-parse) · [Bolagsverket iXBRL guidelines v1.8](https://bolagsverket.se/download/18.2733cf65187efcf5c7e5b974/1700048522993/implementation-guidelines-annual-reports-ixbrl-1-8.pdf)
- [ccao-data/model-res-avm](https://github.com/ccao-data/model-res-avm) · [OpenAVMKit announcement](https://progressandpoverty.substack.com/p/openavmkit-a-free-and-open-source)
- [pierrelefevre/hempriser](https://github.com/pierrelefevre/hempriser) · [skaty5678/hemnet_scrapy](https://github.com/skaty5678/hemnet_scrapy) · [shymaseliza/hemnet-scraper](https://github.com/shymaseliza/hemnet-scraper)
- BRF-analysis competitor scan (closed SaaS, no OSS): [aibrf.se](https://aibrf.se/) · [brfkollen.io](https://www.brfkollen.io/) · [lusa.se nyckeltal guide](https://lusa.se/guide/brf-nyckeltal)
