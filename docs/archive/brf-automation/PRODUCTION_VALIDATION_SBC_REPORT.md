# Production Validation Report — S K F:s Anställdas Brf nr 2 (SBC-hosted site)

**Date:** 2026-07-18
**Target BRF:** S K F:s Anställdas Brf nr 2 (org.nr 757201-9003, Göteborg)
**Known official website:** https://hemsida.sbc.se/s-k-fs-anstalldas-brf-nr-2
**System under test:** BRF-Scraper exactly as committed — no code modified. Per-page data was captured with an external observer wrapper around `CrawlerWorker.crawl` that records each request/response and then calls the unchanged original method.

**Bottom line: FAIL at both ends.** Discovery cannot find this site (its own URL filter rejects the correct result that DuckDuckGo returned), and even given the correct URL, the crawler finds **0 of the 16 documents** on the site because the site is a JavaScript SPA and the crawler does not execute JavaScript.

---

## Objective 1 — Can Discovery find the website from the name alone?

**NO. Verified by running the production CLI:**

```
.venv/Scripts/brf-scraper.exe crawl "S K F:s Anställdas Brf nr 2"
→ FAIL, exit code 1, failed at stage: discovery
→ Discovery confidence: LOW (0.28) — pipeline refuses to crawl (by design)
```

### What actually happened, step by step

The pipeline (`crawl_pipeline.py:183-206`) ran `SearchEngineDiscovery` (DuckDuckGo, the only live engine — no Google/Bing keys configured) with the query `BRF S K F:s Anställdas Brf nr 2 årsredovisning`, then `SeedUrlDiscovery` (empty; the 23-URL seed file has no SBC entries). The verified-website registry was checked first and was empty.

**DuckDuckGo returned the correct answer.** Raw results, re-fetched with the provider's own client and filtered with the provider's own `_is_brf_url()`:

| # | Result | URL | Filter verdict |
|---|--------|-----|----------------|
| 1–2 | (ads) | ludvig.se, arsredovisning-online.se | REJECTED |
| 3 | **Dokument – S K F:s Anställdas Brf nr 2 – SBC** | `hemsida.sbc.se/s-k-fs-anstalldas-brf-nr-2/documents` | **REJECTED** |
| 4 | PDF (broker copy of ÅR) | storage.googleapis.com/…/_F_ORG_T1041_5678.pdf | REJECTED |
| 5 | allabolag.se company page | allabolag.se/7572019003/… | PASS |
| 6 | allabolag.se company page (alt) | allabolag.se/foretag/skf… | REJECTED |
| 7 | PDF (broker copy, staging) | storage.googleapis.com/… | REJECTED |
| 8 | allabrf.se directory page | allabrf.se/s-k-f-s-anstalldas-brf-nr-2-goteborg/dokument | PASS |
| 9 | lusa.se directory page | lusa.se/brf/… | REJECTED |
| 10 | ratsit.se registry page | ratsit.se/7572019003-… | PASS |
| 11 | bolagsverket.se e-service page | bolagsverket.se/sjalvservice/… | PASS |
| 12 | **S K F:s Anställdas Brf nr 2 – SBC** (official homepage) | `hemsida.sbc.se/s-k-fs-anstalldas-brf-nr-2` | **REJECTED** |

**Root cause (verified in code):** `_is_brf_url()` at `search_engine.py:297-331` only accepts URLs matching one of four regex patterns: `brf[\w\-]*\.` (requires a dot after "brf", i.e. "brf" in a *domain name*), `bostadsratt`, `rsredovisning`, `forening`. The official URL `hemsida.sbc.se/s-k-fs-anstalldas-brf-nr-2` matches none of them — "brf-nr-2" ends the path without a dot. So the filter, written to *find* BRF sites, systematically discards every BRF site hosted on a management-company platform (SBC, and by the same logic HSB/Riksbyggen-style hosted sites) because the platform domain contains no BRF keywords.

The four candidates that passed the filter are all directory/registry sites, not official sites. The confidence engine (`confidence.py`) scored the best of them (allabrf.se, name similarity 1.00) at 0.28 — LOW — because of the low search-engine source prior (0.40), a single agreeing source, and no org-number/city data. The pipeline then refused to crawl (`crawl_pipeline.py:212-220`).

**Two separate judgments follow from this:**
1. The **confidence gate worked exactly as designed** — it refused to crawl a directory page that was not the official site. No false positive was crawled.
2. The **URL filter destroyed a correct discovery**. The right answer — including its `/documents` page — was in hand and thrown away before scoring. Discovery for SBC-hosted BRFs is structurally impossible with the current filter, regardless of search engine quality.

---

## Objective 2 — Full pipeline run

Per the protocol, Discovery did **not** succeed, so the production pipeline correctly halted at the discovery stage (0 pages crawled, exit 1). This is the honest production behavior.

To answer Objectives 3–6, the **crawler stage was tested in isolation** against the known official URL, using the exact production configuration from `crawl_pipeline.py:244-251` (`max_depth=2, max_pages=20, max_concurrent=3, delay=0.5s, respect_robots_txt=True, timeout=15s`). This is labeled as a stage test — the URL was *not* injected into Discovery.

---

## Objective 3 — Detailed crawl report (stage-isolation run)

Robots.txt: `User-agent: * / Disallow:` (everything allowed; sitemap advertised). 0 pages blocked by robots, 0 fetch failures.

| # | URL | Depth | Status | Content-Type | Links found | PDFs found |
|---|-----|-------|--------|--------------|-------------|------------|
| 1 | `/s-k-fs-anstalldas-brf-nr-2` (homepage) | 0 | 200 | text/html | 8 | 0 |
| 2 | `/chunk-IOX44WHQ.js` | 1 | 200 | text/javascript | 0 | 0 |
| 3 | `/chunk-MNTM3Z4X.js` | 1 | 200 | text/javascript | 0 | 0 |
| 4 | `/polyfills-D5OGI5N6.js` | 1 | 200 | text/javascript | 0 | 0 |
| 5 | `/styles-H6AF7S5Q.css` | 1 | 200 | text/css | 0 | 0 |
| 6 | `/assets/favicon.svg` | 1 | 200 | image/svg+xml | 0 | 0 |
| 7 | `/` (site root, from `<base href="/">`) | 1 | 404 | — | 0 | 0 |
| 8 | `/chunk-TC7O5F2L.js` | 1 | 200 | text/javascript | 0 | 0 |
| 9 | `/main-NVLH2QLX.js` | 1 | 200 | text/javascript | 0 | 0 |

- **The 8 "links" on the homepage are the SPA's own static assets** — extracted by the `src=`/`href=` regexes in `link_extractor.py:72-76`. Not one is a content page.
- **Skipped/ignored pages:** none skipped by robots or dedup; there was simply nothing else to visit. The known content pages (`/page/arstamma`, `/documents`) never entered the queue because no served HTML references them.
- Final metrics: **9 pages crawled, 0 PDFs found, 0 annual reports detected, 0 downloads.**

For completeness: the `/page/arstamma` validation page was fetched directly outside the scraper — it returns the **byte-identical 8,746-byte HTML shell** as the homepage. Crawling it directly would also have yielded nothing.

---

## Objective 4 — Does the crawler naturally discover the expected documents?

**No. It discovers none of them. 0 of 16.**

Ground truth, established by reading the SPA's backend API directly (base `/api/public/website`, discovered in the site's JS bundle; `clientId=3015` from `/configs/s-k-fs-anstalldas-brf-nr-2`):

| Category | Documents that exist on the site | Found by crawler |
|----------|----------------------------------|------------------|
| Årsredovisningar | 2019, 2020, 2021, 2022 (two versions), 2023, 2024, 2025 (signed) — **8 files, 7 years** | **0** |
| Stämmoprotokoll | Protokoll 2022, Protokoll 2023, Extrastämma 2025 | **0** |
| Stadgar | Stadgar 2018 | **0** |
| Other financial/technical | Energideklaration, Underhållsplan | **0** |
| Forms | Andrahandsuthyrning, Fullmakt | **0** |

(18 download references; 16 unique files after matching duplicate file tokens across the two endpoints.)

**Why:** the site is an Angular SPA. The server returns an empty `<app-root></app-root>` shell for every route; all navigation and all document lists are fetched client-side from `/annual-reports/{clientId}` and `/documents-with-folders/{clientId}` and rendered by JavaScript. The crawler fetches with plain `httpx` (`worker.py:41-52`) and parses only the served HTML (`worker.py:111-143`). It never executes JavaScript, so it never sees the navigation, the document pages, or a single download link. This is not a tuning problem — no depth, keyword, or page-limit setting changes the outcome.

---

## Objective 5 — Root causes (each verified in code)

| # | Root cause | Evidence | Affected stage |
|---|-----------|----------|----------------|
| 1 | **Discovery URL filter rejects hosted-platform BRF sites.** Patterns at `search_engine.py:319-324` require BRF keywords in the URL; SBC's `hemsida.sbc.se/<slug>` has none. | Runtime: DDG results #3 and #12 (the correct site) REJECTED; reproduced with the provider's own methods. | Discovery |
| 2 | **No JavaScript execution in the crawler.** `CrawlerWorker` uses `httpx` only; link extraction runs regex over served HTML. A complete `browser/` module (Playwright provider, fetch engine) exists in the repo and Playwright is installed, but **nothing imports it** — it is dormant. | Crawl run: 9 pages, only static assets found. `grep` confirms zero consumers of `brf_scraper.browser` outside the module. | Crawler |
| 3 | Not causal today, but latent: **queue dedup strips query strings** (`queue.py:29-37` normalizes to scheme+host+path). SBC download URLs differ only by query (`download.php?id=…`); if such URLs ever entered the crawl queue, all but the first would be silently dropped. They currently bypass the queue (documents list), so this did not fire. | Code inspection. | Crawler (latent) |
| 4 | Not causal today, but would fire next: **annual-report classification depends on filename/URL text** (`smoke_test.py:32-100`, path-derived filename via `pdf_detector.py:176-187`). Every SBC document URL's path is `…/download.php` — no `.pdf`, no year, no "årsredovisning". Even with JS rendering fixed, all 16 documents would be classified "not annual report" and the filename recorded for each would be `download.php`. Real filenames are only available in the API JSON / Content-Disposition header, which the downloader does not use for naming (`downloader.py:35-48`). | Code inspection against ground-truth URLs. | Classification / Download |

Explicitly ruled out (with evidence): robots.txt (allows everything, 0 blocked), crawl depth (depth-2 frontier was exhausted at 9 pages — there was nothing deeper to reach), page limit (20 allowed, 9 used), rate limiting, PDF detector (never received a candidate), duplicate detection (nothing to deduplicate).

---

## Objective 6 — Gap analysis

Every missing document has the same two upstream causes; per-category effort below assumes fixes are attempted with the current architecture.

| Missing | Why it wasn't found | Fix | Effort |
|---------|--------------------|----|--------|
| All 16 documents (root cause A) | Discovery filter discards the official site | Loosen/remove `_is_brf_url()` and let the confidence engine judge candidates (it already handled ranking correctly here); optionally add a hosted-platform pattern (`hemsida.sbc.se/*`) | **LOW** (filter change itself); **MEDIUM** to then reach HIGH-confidence auto-crawl, since scoring needs org-number/city signals to clear the 0.80 gate |
| All 16 documents (root cause B) | SPA; no JS execution | Wire the existing, dormant `browser/` Playwright module into `CrawlerWorker` for HTML fetches | **MEDIUM** (infrastructure exists; wiring, timeouts, and re-validation needed) |
| All 16 documents (alternative to B) | Site content lives in a clean, keyless JSON API (`/configs/{slug}` → `/annual-reports/{id}`, `/documents-with-folders/{id}`) | An SBC platform adapter: 2 GET requests return every document **with its real filename and category**, no crawling at all. The platform's sitemap lists **546 BRF sites** on `hemsida.sbc.se` — one adapter covers all of them | **LOW** |
| Correct filenames / ÅR classification (root cause 4) | Filename derived from URL path (`download.php`); year/keyword heuristic has nothing to match | Use Content-Disposition (or adapter-supplied filename) as the filename source before classification | **LOW** |

---

## Verdict (the question this sprint was run to answer)

**The existing crawler is not good enough for real BRF websites of this class, and this class is large.** On a fully permissive, well-structured, officially-known site holding 7 years of annual reports, the complete production system acquired **zero documents** — Discovery rejected the correct URL its own search returned, and the crawler is blind to JavaScript-rendered content. The earlier 3/5 verification run succeeded only on server-rendered static sites; SBC alone hosts 546 BRF sites that will all fail exactly this way, and other management-platform hosts likely behave the same.

What the sprint also showed, in the system's favor: the confidence gate did its job (no wrong site was crawled, the failure was honest and explained), robots/rate-limiting/dedup behaved correctly, and the highest-value fix is cheap — the SBC document API is open, keyless, and returns categorized documents with real filenames in two requests.

**Recommendation for the continue-vs-move-on decision:** document acquisition is *not* done. But the next step is not "improve the generic crawler" — it is (1) the LOW-effort discovery-filter fix and (2) the LOW-effort SBC platform adapter, which together convert this exact failure into full 16/16 acquisition for ~546 sites before any PDF-extraction work begins.

---

*Artifacts: per-page crawl log (`crawl_result.json`), raw DuckDuckGo result dump, ground-truth API responses (`gt_api_annual-reports.json`, `gt_api_documents-with-folders.json`), and fetched HTML shells were captured in the session scratchpad during this run. No repository code was modified.*
