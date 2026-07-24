# Acquisition Engine OSS Research — Finding BRF Websites & Annual Reports

**Date:** 2026-07-18
**Scope:** ONLY the two acquisition problems: (1) finding the correct official BRF website from a BRF name, (2) finding and downloading annual reports / financial documents from that website. OCR, PDF extraction, and AI are explicitly out of scope.
**Baseline (measured, not estimated):**
- Discovery: 3/5 correct on the 5-BRF live run (CRAWL_VERIFICATION_REPORT); structurally **0%** on SBC-hosted sites (~546 BRFs) because `_is_brf_url()` rejects platform domains (PRODUCTION_VALIDATION_SBC_REPORT).
- Crawler: **0/16 documents** on a JS SPA site (SBC) — httpx-only, no JS execution.
- Downloader: 8/8 downloads, unique SHA-256, no duplicates — the one subsystem that is already production-grade.

---

## 0. The strategic finding that reframes the problem

**Sweden's BRF universe is not "the open web." It is a small set of registries and hosting platforms.**

1. **Bolagsverket filing is now mandatory for BRFs.** For fiscal years beginning 2025-01-01 or later, ekonomiska föreningar (incl. bostadsrättsföreningar) *must* submit their annual report to Bolagsverket. Bolagsverket + SCB's **"värdefulla datamängder" API is free, no agreement, OAuth2** (live since 2025-02-03) and serves digitally submitted iXBRL annual reports — but digital filing is **not yet open to föreningar** (aktiebolag K2/K3 only today). Consequence: *today* BRF reports at Bolagsverket are paper/scan copies behind the paid e-service; *within 1–2 report cycles* a free, authoritative, name-independent source of every Swedish BRF annual report will exist. **We must build the website path now, but design it to be replaceable by the registry path, and watch that switch flip.**
2. **The free API already gives us the canonical entity list**: every BRF's exact legal name, organisationsnummer, and registered address. Discovery should start from a resolved entity (org-nr), never from a raw string.
3. **Most BRFs do not run their own domain.** They live on management-platform sites: SBC `hemsida.sbc.se/<slug>` (546 sites, public JSON API found in the validation), HSB/Riksbyggen subpages, SvenskBrf, Egrannar, WordPress — or their documents live on aggregators (allabrf.se / brfdata.se, which our own live run confirmed hosts 36–81 PDFs per BRF). Deterministic platform adapters will beat generic web search on accuracy for the majority of the market.

Everything below is evaluated against that reality: OSS helps most in the crawl/render/search layers; the accuracy moat is Swedish-specific and stays custom.

---

## 1. OSS project evaluations

Stars are approximate as of July 2026; verify at adoption time.

### 1.1 Crawlee for Python — the crawler replacement
- **Repo:** https://github.com/apify/crawlee-python
- **Purpose:** Production crawling framework: unified `HttpCrawler`/`BeautifulSoupCrawler`/`PlaywrightCrawler` with per-domain rate limiting, robots.txt, retries, persistent request queues, proxy/fingerprint hygiene, file downloads.
- **Stars:** ~9.3k · **Last update:** active weekly (Apify-backed) · **License:** Apache-2.0 · **Activity:** very high
- **Production readiness:** high (powers Apify platform actors)
- **Embed in BRF-Scraper?** Yes — plain Python library, async, Pydantic-friendly.
- **Replaces:** `crawler/engine.py`, `queue.py`, `rate_limiter.py`, `robots.py`, `worker.py` (~all of our hand-built crawl loop) **and** fixes the fatal SPA blindness via `PlaywrightCrawler` with automatic HTTP→browser escalation.
- **Stays custom:** what to crawl (per-BRF scope), document keyword heuristics, annual-report classification, storage/metadata.

### 1.2 Scrapy — the alternative crawler
- **Repo:** https://github.com/scrapy/scrapy
- **Purpose:** The mature Python crawling framework; `FilesPipeline` gives checksummed, deduplicated file downloads out of the box.
- **Stars:** ~57k · **License:** BSD-3 · **Activity:** high (Zyte-maintained, 15+ years)
- **Production readiness:** highest in class
- **Embed?** Possible but awkward: Twisted-based, its own process model, JS rendering only via `scrapy-playwright` add-on. Our codebase is asyncio/httpx/Pydantic — Crawlee fits it strictly better.
- **Verdict:** reference for `FilesPipeline` design ideas; do not adopt.

### 1.3 Katana (ProjectDiscovery) — headless crawling as a tool
- **Repo:** https://github.com/projectdiscovery/katana
- **Purpose:** Fast Go CLI crawler; `-headless` mode executes JS and extracts URLs/endpoints from SPAs, JS bundles, XHR calls.
- **Stars:** ~14k · **License:** MIT · **Activity:** high
- **Production readiness:** high as a CLI; it is a security-recon tool, not a library.
- **Embed?** Only as a subprocess emitting URL lists. Useful as a **diagnostic/fallback** ("what does this site actually contain?") and for one-off site audits; not as our engine (Go binary, no per-BRF semantics).
- **Verdict:** optional utility, not a dependency.

### 1.4 ACHE — the focused-crawler blueprint
- **Repo:** https://github.com/VIDA-NYU/ache
- **Purpose:** Domain-specific focused crawler: page classifiers decide relevance, link classifiers prioritize the frontier, and **SeedFinder** auto-generates seed URLs from search queries.
- **Stars:** ~450 · **License:** Apache-2.0 (≥0.11) · **Activity:** moderate (academic, NYU)
- **Production readiness:** medium; Java service + Docker.
- **Embed?** No — running a JVM crawler next to a Python codebase for per-BRF crawls of <50 pages is disproportionate.
- **Steal instead:** two ideas map 1:1 to our accuracy problem: (a) *page-content classification* as the relevance oracle (vs our URL-regex filter that destroyed correct results), (b) *SeedFinder*: issue targeted search queries per entity, harvest candidate URLs, classify pages — exactly the shape our per-BRF discovery should have.

### 1.5 SearXNG — the search layer
- **Repo:** https://github.com/searxng/searxng
- **Purpose:** Self-hosted metasearch aggregating 70+ engines (Google, Bing, DDG, Mojeek, …) with a JSON API (`/search?q=…&format=json`).
- **Stars:** ~20–33k · **License:** AGPL-3.0 · **Activity:** very high
- **Production readiness:** high (one Docker container)
- **Embed?** As a **sidecar service**, not a library — AGPL stays isolated behind HTTP, no license exposure to our proprietary code.
- **Replaces:** our fragile `html.duckduckgo.com` HTML scraping in `SearchEngineDiscovery` (single engine, single point of failure, breaks on DDG layout changes, IP-blockable).
- **Why it raises accuracy:** multi-engine results feed our existing `multi_source_agreement` signal with real independent sources; result diversity directly improves recall for obscure BRFs.
- **Stays custom:** query templates ("<name> årsredovisning", org-nr queries), result classification, ranking.

### 1.6 ddgs — the zero-infra search fallback
- **Repo:** https://github.com/deedy5/ddgs (PyPI `ddgs`, ex-`duckduckgo-search`)
- **Purpose:** Python metasearch client (DDG, Bing, Google backends), no API key.
- **License:** MIT · **Activity:** high but inherently unstable (unofficial scraping; the 2023 DDG layout change broke predecessors; rate-limit exceptions common)
- **Production readiness:** medium — fine as fallback, not as the only path.
- **Embed?** Trivially (`pip install ddgs`). Replaces our hand-rolled DDG parser immediately with ~20 lines.
- **Recommendation:** ddgs now (cheap win), SearXNG when we deploy infrastructure, plus **one paid/keyed engine (Google Programmable Search or Brave Search API) for the accuracy-critical first-position results** — accuracy is stated as more important than cost/speed.

### 1.7 trafilatura (spider + sitemaps) — focused-crawl utilities
- **Repo:** https://github.com/adbar/trafilatura
- **Purpose:** Web text/metadata gathering; includes `trafilatura.spider.focused_crawler()` and a battle-tested `sitemaps` module (also its URL-hygiene sister lib **courlan**).
- **Stars:** ~4.5k · **License:** Apache-2.0 · **Activity:** high (academic author, steady releases)
- **Production readiness:** high for the modules we'd use.
- **Embed?** Yes — pure Python. Use `sitemaps.sitemap_search()` for sitemap-first document discovery and courlan for URL normalization/filtering (replaces parts of `utils/urls.py` and the crawler's URL hygiene).
- **Stays custom:** which sitemap URLs matter (PDF/document filtering).

### 1.8 ultimate-sitemap-parser (GateNLP)
- **Repo:** https://github.com/GateNLP/ultimate-sitemap-parser
- **Purpose:** Robust recursive sitemap parsing: XML, index files, RSS/Atom, plain text; memory-safe on huge hierarchies.
- **Stars:** ~500 · **License:** GPL-3.0 — **server-side use is fine (no distribution), but keep it behind an interface** · **Activity:** maintained (GateNLP, Univ. of Sheffield)
- **Embed?** Yes, but given the license and overlap, prefer trafilatura's Apache-2.0 sitemap module unless we hit sitemap edge cases it can't handle.

### 1.9 RapidFuzz — name matching that actually works
- **Repo:** https://github.com/rapidfuzz/RapidFuzz
- **Purpose:** C++-speed fuzzy string similarity (Levenshtein, token_set_ratio, partial ratios).
- **Stars:** ~3.5k · **License:** MIT · **Activity:** high
- **Production readiness:** very high (ubiquitous dependency)
- **Embed?** One import. **Replaces `matching.name_similarity()`** (naive token overlap) inside both matching and the confidence engine's name signal.
- **Why it matters here:** "S K F:s Anställdas Brf nr 2" vs "SKF Anställdas BRF 2" scores near-zero on token overlap but high on `token_set_ratio` with normalization. This is precisely the failure class our validation exposed.
- **Stays custom:** the Swedish BRF normalizer (strip `brf`/`bostadsrättsföreningen`/`hsb`/`riksbyggen` prefixes, collapse initials, fold å/ä/ö, roman↔arabic numerals). No OSS knows Swedish BRF naming conventions.

### 1.10 Splink — entity resolution at registry scale
- **Repo:** https://github.com/moj-analytical-services/splink
- **Purpose:** Probabilistic record linkage (Fellegi-Sunter, DuckDB backend); links millions of records/minute; used by ONS/NHS.
- **Stars:** ~2k · **License:** MIT · **Activity:** high
- **Embed?** Yes, but **not now.** Our per-lookup matching is 1 name vs ≤20 candidates — RapidFuzz suffices. Splink becomes relevant when we bulk-link the ~30k-entity Bolagsverket registry against directory dumps (allabrf, SvenskBrf, hitta.se) to pre-resolve *every* BRF's website offline. Keep on the shelf for that batch job.

### 1.11 Playwright (already in repo, dormant)
- Covered in docs/30. Apache-2.0, Microsoft. The `browser/playwright_provider.py` module exists and is unwired. Crawlee uses Playwright underneath — adopting Crawlee *is* the wiring.

### 1.12 What does not exist as OSS (verified again)
- No "official website finder" of production quality: GitHub `company-url-finder` topic and `website-for-company-name`-style repos are hobby scripts around search + string match; commercial products (Clearbit, Apify actors) are closed. **Organization→official-website resolution with verification is ours to build** — and with org-nr on-page verification it is buildable to near-ground-truth for Sweden.
- No Swedish BRF scraping ecosystem: nothing reusable for allabrf/SBC/SvenskBrf (only generic `swe-scrapers` collections). Our platform adapters are proprietary value.

---

## 2. Subsystem verdicts

| Subsystem | Verdict | Why |
|---|---|---|
| **Discovery (orchestration)** | **KEEP OURS** | Registry-first → providers → scoring pipeline is sound and validated (the confidence gate correctly refused a wrong crawl). No OSS equivalent exists. |
| **Discovery (search provider)** | **REPLACE** | Hand-rolled DDG HTML scraping is fragile and single-source. Replace with ddgs now → SearXNG sidecar + one keyed engine (Google PSE/Brave) for accuracy. |
| **Discovery (URL filter `_is_brf_url`)** | **REPLACE (delete)** | Proven to destroy correct answers (rejected the official SBC URL). Keyword-regex pre-filtering is the wrong layer; candidate judgment belongs in confidence scoring on *page content* (ACHE's model). Keep only a hard blocklist (search engines, social media). |
| **Crawler** | **REPLACE** | Crawlee-python is a superset of our queue/rate-limit/robots/worker code and adds the Playwright escalation that turns 0/16 into full document visibility on SPA platforms. Keep our `CrawlConfig` semantics as a thin wrapper. |
| **Link extraction** | **REPLACE** | Regex over raw HTML grabbed `src=` JS chunks as "links" in production. Use real DOM extraction (Crawlee's parser / BeautifulSoup already in deps) + courlan URL hygiene; add **sitemap-first** discovery (trafilatura.sitemaps). Keep our Swedish document-keyword lists. |
| **PDF detection** | **KEEP OURS** | Small, layered (extension → content-type → content-disposition → magic bytes), correct, tested. No OSS does this better. |
| **Download manager** | **KEEP OURS** | Live-validated: atomic checksum dedup, 8/8, SQLite metadata. Only additions: filename fallback fix, PDF validity check, browser-context download fallback for 403-hostile hosts. |
| **Ranking** | **HYBRID** | Keep the explained-signal framework (it is good design). Swap the name signal to RapidFuzz + Swedish normalizer; add the decisive new signal: **on-page org-nr/name/address verification** of top candidates. |
| **Confidence** | **KEEP OURS** | Bands, gap discount, refuse-to-guess behavior all worked exactly as designed in production validation. Feed it better signals; don't replace it. |
| **Verified registry** | **KEEP OURS** | No OSS equivalent; this is the compounding asset (resolve each BRF once, forever). Extend it with the canonical Bolagsverket entity list so it starts life pre-populated with names/org-nrs. |

---

## 3. Top 10 roadmap (ranked by expected real-world accuracy impact)

Impact key: **W** = finding correct website, **R** = finding annual reports, **D** = download reliability.

| # | Improvement | Reuses | Impact | Effort |
|---|---|---|---|---|
| 1 | **Delete `_is_brf_url` keyword filter; let all non-blocklisted candidates reach confidence scoring** | — (removal) | W:★★★ | Hours. The single measured discovery-killer: it rejected the correct official site. |
| 2 | **Canonical BRF entity registry from Bolagsverket/SCB free "värdefulla datamängder" API** (name, org-nr, address for every BRF) — discovery keyed by org-nr, never raw strings | Bolagsverket free API (OAuth2, no agreement) | W:★★★ R:★★ | Days. Turns "fuzzy string" into "resolved legal entity"; org-nr becomes the verification anchor everywhere. |
| 3 | **Platform adapters, deterministic before search:** SBC public JSON API (`/api/public/website`, `clientId` — already reverse-engineered in the validation report), allabrf/brfdata document pages, SvenskBrf directory, HSB/Riksbyggen URL patterns + slug probing | custom (no OSS exists) | W:★★★ R:★★★ | Days per platform. SBC alone = 546 sites where the API returns the *document list itself* — no crawling needed. |
| 4 | **On-page verification signal:** fetch top 3 candidates, scan for org-nr / normalized name / address; org-nr match ⇒ near-ground-truth (our confidence engine already lets org-nr dominate) | RapidFuzz + our normalizer | W:★★★ | Days. Converts ranking from "plausible" to "verified"; ACHE's classify-the-page principle. |
| 5 | **Multi-engine search provider:** ddgs immediately; SearXNG sidecar + one keyed engine (Google PSE or Brave) as the accuracy path | ddgs (MIT), SearXNG (AGPL, sidecar) | W:★★ | Days. Feeds the existing multi-source-agreement signal with real independent engines. |
| 6 | **Adopt Crawlee-python with HTTP→Playwright escalation** for the crawl stage (SPA fix) | Crawlee (Apache-2.0), Playwright already installed | R:★★★ D:★ | 1–2 weeks incremental (new engine behind our `CrawlerEngine` interface; keep tests). |
| 7 | **Sitemap-first document discovery** (robots.txt `Sitemap:` → sitemap tree → PDF/document URLs) before BFS crawling | trafilatura.sitemaps (Apache-2.0) or USP (GPL, isolate) | R:★★ | Days. The SBC site *advertises a sitemap we never read*; many sites list PDFs directly. |
| 8 | **Swedish BRF name normalizer + RapidFuzz similarity** replacing token-overlap in matching + confidence | RapidFuzz (MIT) | W:★★ | Days. Fixes the "S K F:s" failure class measured in production. |
| 9 | **Directory harvest as high-prior source:** allabrf.se BRF pages expose org-nr and often the official website link; harvest into candidates with directory prior + org-nr verification | our DirectoryScraper + adapter work | W:★★ R:★ | Days. |
| 10 | **Download hardening:** title-derived filename fallback (kills the literal `public` files), `%PDF` validity check post-download, browser-context download fallback for 403 hosts | pypdf (BSD) + Crawlee/Playwright | D:★★ | Days. Downloader is already the strongest link; this closes the last gaps. |

**Standing watch item (not ranked, potentially decisive):** monitor Bolagsverket's opening of digital filing for ekonomiska föreningar. The moment BRF iXBRL reports flow into the free API, items 3/6/7 stop being the primary ÅR source and become the fallback for the long tail + non-financial documents (stadgar, protokoll, underhållsplan — which the registry will never carry). The architecture above (adapter pattern, registry-first) is designed so that switch is one new provider, not a rewrite.

**Suggested execution order** (accuracy-first, dependency-aware): 1 → 8 → 4 → 2 → 3 (SBC first) → 5 → 7 → 6 → 9 → 10. Items 1+8+4 alone should move name→website accuracy from 60% to the 85–90% band on non-platform BRFs; item 3 takes the platform-hosted majority to near-100% deterministically.

---

### Sources
- [apify/crawlee-python](https://github.com/apify/crawlee-python) · [scrapy/scrapy](https://github.com/scrapy/scrapy) · [projectdiscovery/katana](https://github.com/projectdiscovery/katana) · [VIDA-NYU/ache](https://github.com/VIDA-NYU/ache)
- [searxng/searxng](https://github.com/searxng/searxng) · [SearXNG Search API](https://docs.searxng.org/dev/search_api.html) · [ddgs on PyPI](https://pypi.org/project/ddgs/)
- [adbar/trafilatura](https://github.com/adbar/trafilatura) · [Trafilatura crawling docs](https://trafilatura.readthedocs.io/en/latest/crawls.html) · [GateNLP/ultimate-sitemap-parser](https://github.com/GateNLP/ultimate-sitemap-parser)
- [rapidfuzz/RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) · [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink)
- [Bolagsverket API för värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder/apiforvardefulladatamangder.5513.html) · [Avgiftsfri data-lansering (2025-02-03)](https://bolagsverket.se/apierochoppnadata/nyheterochreleaser/2025/avgiftsfridatanarbolagsverketochscblanserarvardefulladatamangder.5516.html) · [Obligatorisk inlämning för föreningar](https://bolagsverket.se/omoss/nyheter/nyhetsarkiv/nyhetsarkiv2025/nyhetsarkiv2025/obligatorisktforforeningarattlamnainsinarsredovisningtillbolagsverket.5514.html) · [Bolagsverket FAQ: digital inlämning gäller ej föreningar ännu](https://bolagsverket.se/en/sjalvservice/etjanster/lamnainarsredovisningendigitalt/vanligafragoromattlamnainarsredovisningendigitalt.1671.html)
- Internal: `BRF-Scraper/CRAWL_VERIFICATION_REPORT.md`, `BRF-Scraper/PRODUCTION_VALIDATION_SBC_REPORT.md`, `docs/30_open_source_reuse_research.md`
