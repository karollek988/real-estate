# Technical Integration & MVP Audit — Köpanalys

**Date:** 2026-07-18 · **Role:** Lead Architect / CTO · **Basis:** full repository inspection (frontend, BRF-Scraper, supabase, api/, src/, tests, docs) + the 2026-07-18 production validation + docs/30 OSS research. Every claim below is grounded in code read today.

---

## 1. Executive Summary

The repository is **two good half-products that have never met**:

- A **Next.js product shell** (`frontend/`, ~7,700 LOC TS) that is genuinely well-built: Supabase auth, versioned append-only analyses, a clean provider/analyzer pipeline with honest "not_connected" reporting, a confidence-weighted decision engine, dashboard and report UI. Its fatal gap: **the BRF pillar — the paid value proposition — is a stub** waiting for financial data that nothing supplies, and payments are UI-only.
- A **Python acquisition engine** (`BRF-Scraper/`, ~11,600 LOC, 403 passing tests) that can discover/crawl/download BRF documents from static sites, has a validated failure mode on SPA/hosted sites (fixable cheaply), and **stops dead at "PDF on disk"** — the extractor module is empty.

Nothing connects them: different languages, different databases (SQLite vs Supabase), zero shared data flow. The MVP is therefore not "polish what exists" — it is **build the bridge**: acquisition fix → Docling/Instructor extraction → Supabase → the already-waiting `housingAssociation` analyzer. That bridge is 6–8 weeks of the ~11-week plan; the rest is payments and hardening.

**Readiness estimate: ~35–40%** (details §9). The distance to MVP is dominated by one pipeline, not by breadth.

---

## 2. Repository Audit (what actually exists)

| Component | State | Evidence |
|---|---|---|
| `frontend/` Next.js 16 + React 19 + Supabase | **Real product shell.** Auth (SSR + middleware), dashboard, buy page (mock payments — no payment SDK in package.json), report + analyzing pages, API routes (`/api/analyses` POST/GET, per-property listing) | 7.7k LOC; RLS-locked tables, service-role-only writes |
| `frontend/src/lib/analysis/` | **The analysis engine.** Pipeline: URL/manual extract → property upsert (normalized-key dedupe, race-safe) → 7-day cache → providers → analyzers → versioned persist. 7 implemented providers (Nominatim geocoding, Booli **coded but never exercised — no API key**, SCB, OSM, Riksbanken, SMHI, Trafikverket) + 8 honest placeholders. 8 analyzers; decision engine shrinks score toward neutral 50 in proportion to measured confidence — good design | `pipeline.ts`, `providers/registry.ts`, `decisionEngine.ts:35-56` |
| BRF pillar | **Stubbed.** `housingAssociation.ts` weight 0.15, waits for `attributes.brf_debt_per_m2_sek`; placeholder `brf_financials` documents the blocker: "no BRF-name-to-org-number match exists yet" | `analyzers/housingAssociation.ts:26-54`, `providers/placeholders.ts:32-45` |
| `BRF-Scraper/` | Working discovery/crawl/download for static sites (403 tests); validated failures: URL filter rejects hosted-platform sites, no JS rendering; `extractor/` empty; `browser/` Playwright module dormant | 2026-07-18 validation report; earlier audit |
| `supabase/migrations/` | 3 clean migrations: profiles (RLS owner policies), properties + analyses (append-only, versioned, `engine_version` stamped, RLS no-policy = service-role only), postal-code patch | migration SQL read |
| `api/` | **Empty directory** | `find api -type f` → nothing |
| `src/real_estate/` + root `pyproject/tests/notebooks/data` | **Empty skeleton** — six `__init__.py`, one smoke test, README-only dirs; leftover from the 2026-07-13 monorepo restructure | file listing |
| `docs/` | 30 docs, current and high quality — a real asset | — |
| Tests | Python: 403 (BRF-Scraper). **Frontend: zero** (no test script in package.json) | package.json |

---

## 3. KEEP / REFACTOR / REPLACE / DELETE

### KEEP (well-designed, leave alone)
- **Frontend analysis architecture** — provider interface with honest statuses, analyzer registry, confidence-weighted scoring, append-only versioned analyses, cache-with-staleness. This is exactly the "modular data adapters, explain-don't-score" vision (docs/24) implemented. Do not rewrite in Python; the TS pipeline stays the serving path.
- **Supabase schema + RLS posture** (service-role-only pipeline tables, owner-only profiles).
- **Hemnet URL-slug-only extraction** (`listing/hemnet.ts`) — legally careful, never fetches; correct given the ToS ban.
- **BRF-Scraper downloader/storage/metadata** — SHA-256 dedup at the DB constraint level, race-safe, proven 8/8 in production run.
- **Discovery confidence gating** (`pipeline.py` LOW/MEDIUM/HIGH) — it correctly refused to crawl wrong sites twice in validation. Keep the gate; fix what feeds it.
- **docs/** — keep maintaining.

### REFACTOR (good bones, targeted fixes)
1. **Discovery URL filter** (`search_engine.py:297-331`): loosen `_is_brf_url` (drop the keyword requirement, keep the exclusion list), let the confidence engine judge. *Validated root cause of the SBC discovery failure. ~1 day.*
2. **CrawlerWorker**: wire the dormant `browser/` Playwright provider as a fallback when a page yields 0 content links (SPA signature: links are all `.js/.css` assets). *~3–5 days.*
3. **Crawler bugs found in validation**: query-string-stripping dedup (`queue.py:33`) and `_is_internal` referencing the first *document's* domain (`engine.py:213-221`) — fix when touched; both have failing-case evidence.
4. **Filename source**: use Content-Disposition / adapter-supplied names before URL-path guessing (`downloader.py:35-48`) — prerequisite for classifying `download.php`-style URLs. *~1 day.*
5. **Booli provider**: request an API key, calibrate `FIELD_PATHS` against one real response (the file itself warns it's unexercised). *~1–2 days once key arrives.*
6. **`is_likely_annual_report`** lives in `smoke_test.py` but is imported by production `crawl_pipeline.py` — move to a real module.

### REPLACE (with OSS from docs/30)
| Ours | Replaced by | Why | Migration |
|---|---|---|---|
| The *planned* custom PDF parsing (never built) | **Docling + Instructor** | 0 lines exist to replace — this is pure green-field avoided; targets our existing Pydantic `FinancialData` models | None — additive |
| Future new crawlers | **Crawlee (Python)** for *new* platform adapters only | Our crawler works for static sites and is protected by 133 tests; a big-bang rewrite burns 3–4 weeks for no user-visible gain | Incremental, post-MVP |
| Nothing else | — | The TS pipeline, decision engine, and Supabase layer are better than any generic substitute | — |

### DELETE (today, ~30 minutes total)
| Path | Why | Replaced by |
|---|---|---|
| `api/` (empty dir) | Dead; implies a service that doesn't exist | Frontend API routes already serve this role |
| `src/real_estate/*`, root `pyproject.toml`, `tests/test_smoke.py`, `notebooks/`, `data/` (README-only) | Empty skeleton from the restructure; every empty package invites misplaced code | Nothing — recreate if/when a Python analysis service is actually needed |
| `BRF-Scraper/src/brf_scraper/main.py` TODO commands: `serve`, `extract` (stub), `db-init`, `db-migrate`, `db-upgrade`, `schedule` (main.py:66-77, 281-296, 322-356) | Six commands that print "implementation pending" — noise that erodes CLI trust | `extract` returns when Docling lands |
| `CrawlerEngine.get_all_links()` (engine.py:223-229) | Returns `[]` unconditionally — dead | — |
| **`configs/seed_urls.yaml` unverified entries** | 23 hand-written domains, several apparently fabricated, served at **confidence 1.0** — an actively dangerous wrong-data source if any domain squats | Empty seed file; registry fills from verified runs |
| `domain_receipt/simplycom-4741528.pdf` | A purchase receipt doesn't belong in a git repo | Private storage |

---

## 4. OSS Integration Plan (the five named technologies)

**1. Playwright — keep our scraper, upgrade it.** Do not replace: 403 tests, working static-site path, and the validation showed the gap is *rendering*, not architecture. Wire `browser/playwright_provider` into `CrawlerWorker` as an automatic fallback (trigger: HTML page whose extracted links are exclusively static assets). Pair with the **SBC platform adapter** (2 keyless GETs → all documents with real filenames — validated), which for SBC's 546 sites bypasses the browser entirely. Browser fallback = generic safety net; adapters = fast path.

**2. Docling — nothing becomes obsolete, because nothing exists.** `extractor/` is two lines. New pipeline: `PDF (stored_path) → Docling convert (Markdown + tables JSON) → stage 2 (Instructor) → validated FinancialData → Supabase`. No parsers disappear; the only casualty is the *plan* to hand-write them. Run Docling in the Python worker (CPU fine for born-digital PDFs; most ÅRs post-2019 are born-digital — OCR path only for scanned older reports).

**3. Instructor — belongs in `brf_scraper/extractor/`, stage 2.** It binds directly to the already-defined-and-never-instantiated models in `models/brf.py:93-193` (`FinancialData`, `BoardInfo`, `PropertyInfo`). Contract: Docling Markdown in → `client.chat.completions.create(response_model=FinancialData)` with Claude → deterministic validators (balance-sheet sums, kr/m² ranges, year sanity, the 7 mandated nyckeltal present-or-flagged) → persist. The extracted record then flows to the frontend as `attributes.brf_debt_per_m2_sek` etc. — the exact forward contract `housingAssociation.ts` already documents.

**4. PostGIS — yes, enablement is one migration, no schema breakage.** `create extension if not exists postgis;` then a generated column on the existing lat/lon: `location geography(Point,4326) generated always as (case when longitude is not null then ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography end) stored` + GiST index. Migrations to create: `2026…_postgis.sql` (extension + column + index). Nothing else changes; OSM/area analyzers get real distance SQL when they want it. *Half a day. Do it in Phase 2 idle time.*

**5. pgvector — later, decisively.** No live embedding use-case exists; the Inspection Assistant (premium, post-launch) is the first real one. Enabling early = maintaining an index nobody queries. Revisit at first RAG feature. *Not MVP.*

---

## 5. Updated Architecture

```
User
 ↓
Frontend (Next.js 16 · Vercel)                     [KEEP]
 ↓
API routes (/api/analyses · Supabase auth)          [KEEP]
 ↓
Analysis pipeline (TS)                              [KEEP]
 ├─ Providers: Nominatim · Booli(calibrate) · SCB · OSM · Riksbanken · SMHI · Trafikverket
 ├─ NEW brf_financials provider ── reads ──┐        [replaces placeholder]
 ↓                                          │
Decision Engine (8 analyzers, conf-weighted)│       [KEEP; housingAssociation goes live]
 ↓                                          │
Supabase Postgres (+ PostGIS)  ◄────────────┤       [3 new tables: brfs, brf_documents, brf_financials]
 ↑ writes (service role)                    │
BRF Worker (Python, scheduled)              │
 ├─ Discovery (filter fixed, gate kept)     │
 ├─ Platform adapters (SBC first)  [NEW]    │
 ├─ Crawler + Playwright fallback  [WIRED]  │
 ├─ Downloader/Storage (SHA-256)   [KEEP]   │
 └─ Extractor = Docling → Instructor(Claude) → validators   [NEW]
 ↓
Report UI (report/page.tsx + BRF health section)    [extend]
```

Bridge rule (kills the two-stack risk): **the Python worker's only interface to the product is writing the three `brf_*` tables in Supabase** (service role). Frontend never calls Python; Python never touches frontend tables. One writer per table, ever.

---

## 6. Missing Features

**Required before MVP**
1. BRF acquisition→extraction→analyzer chain (the product) — §7 Phases 1–3
2. BRF-name → organisationsnummer resolution v0 (the placeholder's own documented blocker; DDG/allabolag results in our validation carried org numbers — a lookup step + manual-confirm UI is enough for v0)
3. Payments: Stripe Checkout + credits table + quota enforcement (3 free previews/month per the purchasing model) — the buy page UI already exists, it just sells nothing
4. Booli API key + field calibration (asking price/fee/area feed 4 analyzers)
5. Production deploy (Vercel + Supabase prod project + Python worker on a scheduler) with Sentry on both stacks
6. Legal minimum: privacy policy, terms, GDPR data-deletion path (we store user accounts + addresses)
7. A dozen smoke/e2e tests on the money path (submit → report → pay)

**Can wait until after launch**
Photon self-hosted geocoding (public Nominatim + cache survives MVP volume; respect 1 rps) · Meilisearch fuzzy BRF search (pg_trgm first) · r5py/Trafiklab travel times · OSMnx batch walkability · pgvector + Inspection Assistant · admin dashboard (Supabase Studio suffices) · email beyond auth (transactional analysis-ready emails) · more platform adapters beyond SBC · Crawlee migration · school-quality/crime/flood providers (placeholders already report them honestly).

---

## 7. MVP Roadmap (~11 weeks, small team)

**Phase 0 — Cleanup & deploy skeleton (wk 1, ~3 days)**
Deletes from §3; deploy frontend+Supabase to prod; Sentry; CI running both test suites. *Deliverable: clean repo, live (empty) product. Deps: none.*

**Phase 1 — Reliable acquisition (wk 1–2, ~6 days)**
Discovery filter fix · SBC adapter · Playwright fallback wiring · Content-Disposition filenames · org-number resolution v0 · re-run the SKF validation (target: 16/16). *Deliverable: given a BRF name, its ÅR PDFs land on disk with real names. Deps: none.*

**Phase 2 — Extraction (wk 3–5, ~2.5 wks)**
Docling in worker · Instructor+Claude → `FinancialData` · deterministic validators · golden set: 20 real ÅRs hand-labeled, measure field accuracy · `brfs/brf_documents/brf_financials` migrations (+ PostGIS enablement) · worker writes Supabase. *Deliverable: structured, validated nyckeltal in the product DB, with a measured accuracy number. Deps: Phase 1.*

**Phase 3 — Product connection (wk 5–7, ~2 wks)**
`brf_financials` TS provider (delete its placeholder) · real `housingAssociation` scoring against SBAB/Lusa-style benchmarks (debt kr/m², fee trend, savings) · report UI BRF section with explanations · address→BRF link on analyses. *Deliverable: a Köpanalys report with real BRF health — the sellable thing. Deps: Phase 2.*

**Phase 4 — Monetization & hardening (wk 7–9)**
Stripe Checkout + credits + preview quota · Booli calibration · rate limits · provider caching (SCB/Riksbanken responses) · failure alerting · private beta (~20 users incl. real purchases). *Deliverable: the purchasing model live end-to-end. Deps: Phase 3 (sellable report must exist).*

**Phase 5 — Launch (wk 9–11)**
Beta feedback fixes · onboarding polish · legal pages final · load sanity check · coverage stats on landing page ("we cover N associations") · public launch. *Deliverable: Köpanalys v1 public.*

---

## 8. Technical Debt (prioritized)

1. **Two-stack, two-database split** (Python/SQLite ↔ TS/Supabase) — biggest architectural risk. Mitigation: the §5 bridge rule; Supabase becomes the single product DB; SQLite stays worker-internal (crawl bookkeeping only).
2. **Fabricated seed URLs at confidence 1.0** — wrong-data risk baked into config. Delete (in §3).
3. **Frontend has zero tests** while carrying all product logic. Add pipeline + decision-engine unit tests and one e2e in Phase 0/4 — the decision engine is 56 pure-function lines, trivially testable.
4. **LLM extraction correctness** — not yet debt, but will be the product's reputation surface. Golden set + validators + "confidence: verify these figures" UI honesty (already the house style) contain it.
5. **Booli contract risk** — free tier restricts commercial use (the provider file itself flags this). Verify terms before launch; Phase 4 checkpoint.
6. Crawler micro-bugs (queue dedup, `_is_internal`) — fix opportunistically in Phase 1.
7. Public Nominatim dependency — acceptable at MVP volume with caching; Photon when volume justifies.

---

## 9. Launch Readiness

| Area | Done |
|---|---|
| Product shell (auth, dashboard, report UI, API routes) | ~75% |
| Analysis framework (pipeline, providers, decision engine) | ~70% (of framework — not of data coverage) |
| **BRF value chain (acquire→extract→score)** | **~15%** (acquisition partial; extraction 0%; scoring stub) |
| Data coverage (real providers exercised in prod) | ~40% |
| Monetization | ~10% (UI only) |
| Ops (deploy, monitoring, legal) | ~10% |
| **Overall, weighted by importance to a paid MVP** | **~35–40%** |

**1. Build first tomorrow morning:** the Phase-1+2 spike in one stroke — SBC adapter fetching S K F:s Anställdas Brf nr 2's seven ÅRs, piped through Docling+Instructor into `FinancialData`, validated against the hand-read 2024 report. One week, and the entire value chain is proven on the exact BRF that failed yesterday. Everything else is scaling that line.

**2. Postpone:** everything in the "can wait" list — most temptingly-shiny items (Photon, Meilisearch, r5py, pgvector, Crawlee, admin tools) are all post-launch.

**3. Current MVP blockers:** (a) no extraction layer, (b) no acquisition path for hosted-platform sites, (c) no name→orgnr resolution, (d) no payments. (a) dominates — it's the audit's repeated conclusion, now with a concrete OSS answer.

**4. Delete today:** the §3 DELETE table — empty `api/`, the `src/real_estate` skeleton, six TODO CLI commands, dead `get_all_links`, the confidence-1.0 fake seed URLs (genuinely risky, not just untidy), the receipt PDF.

**5. Three biggest technical risks:** ① LLM extraction accuracy on Swedish financial PDFs (mitigate: golden set, deterministic validators, the 2023 mandated-nyckeltal standardization, honest confidence UI); ② BRF coverage — the name→orgnr→documents chain only covers BRFs whose documents are reachable (mitigate: SBC first = big slice, honest "not covered yet" states, coverage grows adapter by adapter); ③ the two-stack bridge eroding into spaghetti (mitigate: single-writer table contract, worker writes only `brf_*`).

**6. Distance to production MVP: ~35–40%**, with the missing 60% concentrated in one well-understood pipeline plus Stripe — not scattered.

---

## 10. Final CTO Recommendation

Stop treating this as two projects. The frontend is the product and is nearly good enough; BRF-Scraper is a supplier and needs exactly two upgrades (browser fallback, SBC adapter) plus the extraction layer it never had. Adopt precisely three OSS pieces now — **Playwright (wire what's installed), Docling, Instructor** — enable PostGIS in passing, and refuse everything else until after launch. Delete the skeleton directories today so the repo tells the truth about what exists. Then execute §7 in order: the one-week spike proves the value chain, weeks 2–7 industrialize it, weeks 7–11 monetize and launch. A negative result on the extraction golden set would be the only finding that changes this plan — measure it in week 4, not week 10.
