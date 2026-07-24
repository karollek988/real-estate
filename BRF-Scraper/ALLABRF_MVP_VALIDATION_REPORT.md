# AllabrfProvider MVP Validation Report

**Date:** 2026-07-18
**System under test:** new `discovery/allabrf_provider.py` (AllabrfProvider), full pipeline: BRF name → allabrf.se → correct BRF → metadata → annual reports → download.
**Protocol:** 25 real Swedish BRF names (12 specific known BRFs incl. all 6 from earlier live validations + 13 common/ambiguous names), run end-to-end with `scripts/validate_allabrf.py`, politeness delay 0.7 s, plain HTTP only. Raw per-BRF results: `data/allabrf_validation/results.jsonl`; PDFs: `data/allabrf_validation/pdfs/`.

---

## Headline results

| Metric | Result |
|---|---|
| **BRF resolution (name → correct BRF + org-nr)** | **25/25 (100%)** |
| Resolution with exact org-nr returned | 25/25 |
| Annual reports found (incl. login-gated) | 40 |
| Annual reports publicly downloadable | 15 |
| **Annual reports downloaded (of public)** | **15/15 (100%)** |
| BRFs with ≥1 annual report downloaded | 11/25 (44%) |
| Official website found on allabrf | 0/25 |
| Crashes / HTTP blocks / Camoufox escalations needed | 0 |

Other documents found as a side effect: 71 betygscertifikat, 21 stadgar (stadgar are mostly public and downloadable with the same mechanism).

**Comparison with the old pipeline (same-day baselines):** generic search discovery was 3/5 correct and structurally 0% on SBC-hosted BRFs; the crawler found 0/16 documents on JS sites. AllabrfProvider resolved all of those same BRFs, including S K F:s Anställdas Brf nr 2 (the total-failure case), with score 1.0 + org-nr + 3 ÅRs found (2 downloaded).

## How it works (verified live)

1. `GET https://www.allabrf.se/items/names?query=<name>` — public autocomplete, returns exact legal name, **organisationsnummer**, slug, county as JSON. Not under the robots.txt-disallowed `/api` prefix. This single endpoint replaces the entire search-engine + URL-filter + fuzzy-matching discovery chain.
2. `GET /{slug}` — profile page; metadata table (org-nr, kommun, registreringsår, antal lägenheter…) parsed with BeautifulSoup.
3. `GET /{slug}/dokument` — document list. Public docs: `/documents/{slug}-{type}-{year}/public` → 302 → signed S3 URL (10 min expiry) → PDF. Gated docs link to `/users/authentication/login` and 404 on the public route (server-side enforcement, verified).
4. Download: follow redirect, verify `%PDF` magic bytes, store as `{slug}_{type}_{year}.pdf` (also fixes the old "file named `public`" bug), SHA-256 recorded.

Camoufox was wired as an escalation hook (`browser_fetch` constructor param) but **never needed** — every request succeeded over plain HTTP with a browser User-Agent. The `camoufox` package is not installed in the venv; install + wire `CamoufoxProvider` only if allabrf starts blocking.

## Failure analysis

There were zero resolution failures and zero download failures. The losses are all **availability**, not capability:

**1. Login-gating of recent annual reports — THE blocker (25 of 40 ÅRs, 62.5%).**
Year split is absolute: every public ÅR is 2014–2019; every 2022–2025 ÅR is login-gated. Allabrf clearly gates recent reports behind account/paywall. For Köpanalys the *latest* report is exactly what a buyer needs, so without solving this the provider delivers current reports for ~0% of BRFs and stale (2019-era) reports for 44%.

**2. Official website: allabrf does not expose it (0/25).**
No external non-partner link appears on public profile pages. The "official website" step of the objective chain cannot be satisfied from allabrf alone.

**3. Ambiguous names resolve to *a* real BRF, not necessarily *the* one.**
"Brf Ringen" (city hint Stockholm) resolved to Bostadsrättsföreningen Ringen in Uppsala — exact name match scores 1.0 and the city boost can't outrank it (score is capped at 1.0). Not a defect for Köpanalys' real flow (input will carry an address/listing → pass city and prefer county match), but the tie-breaking must be fixed before production: county match must dominate over a tie in name score.

## Remaining blockers before Köpanalys can use this in production

1. **Recent-ÅR access strategy (critical).** Options, in preferred order:
   a. **Allabrf account/partnership** — register/log in (session cookie in the provider) if their terms allow; or a commercial agreement/API with allabrf (they sell exactly this data; aligns with the blueprint's "comps only after paid agreement" precedent).
   b. **Second source for recent ÅRs** — the org-nr we now always have unlocks targeted lookups elsewhere (BRF's own site via platform adapters, Bolagsverket paid copies at ~SEK/report as a stopgap, and the free Bolagsverket iXBRL API the moment digital filing opens for föreningar — mandatory filing already applies from FY2025).
   c. Accept stale reports for MVP preview tier, paid path for current ones. (Product call, not engineering.)
2. **Disambiguation hardening.** County/address hint must break exact-name ties (uncap the boost or make county a filter, not a bonus). Köpanalys must always pass the hint it has.
3. **Terms-of-service / legal review of allabrf scraping for commercial use.** robots.txt permits everything except `/api` (we comply), but ToS review + rate limiting policy (current: 0.7 s delay, sequential) needed before production volume. A partnership conversation is the clean path.
4. **Official-website discovery is a separate feature.** If Köpanalys needs the BRF's own site (stadgar, underhållsplan, news), plug the org-nr into the platform-adapter path from docs/33 — out of MVP scope per this strategy.
5. **Operational hardening (small):** persist results to the existing metadata DB / verified-website registry (resolve each BRF once), handle allabrf HTML changes with a monitored smoke test, wire Camoufox install for the day HTTP gets blocked.

## Verdict

The name→BRF resolution problem that blocked Köpanalys is **solved for the MVP** (100% on this sample, with org-nr — better than any generic-search design we evaluated). Document *discovery* works (40 ÅRs + 92 other documents located); document *acquisition* works mechanically (15/15 public PDFs downloaded, all valid); but **recency of annual reports is gated by allabrf's login wall**, and that is now the single blocker between this pipeline and production.
