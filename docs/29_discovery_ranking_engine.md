# 29 — Discovery Ranking Engine (Architecture)

Status: **Design only — not implemented.**

## 1. Problem statement

Live verification showed crawling is no longer the bottleneck; **Discovery accuracy** is. Today's discovery pipeline (`src/brf_scraper/discovery/`) has three problems, confirmed by reading the current code:

1. **Candidate generation is broad, not targeted.** `SearchEngineDiscovery` runs generic Swedish queries ("bostadsrättsförening årsredovisning"), not per-BRF queries built from the specific name/org number/city we're trying to resolve.
2. **Confidence is a static per-source constant**, not a computed score. Seed URL = 1.0, Directory = 0.8, Google/Bing = 0.7, DuckDuckGo = 0.6 — regardless of whether the candidate actually matches the target BRF.
3. **Selection ignores the best available signal.** `matching.py::match_brf_by_name` is a cascading string-similarity heuristic over the *name* only. It never looks at `organization_number`, `city`, `municipality`, or `address`, even though `BRF` carries all of them. There is also no page-fetch/verification step — nothing checks that the candidate site actually contains this BRF's identity.

The fix is not "search better" — it's **generate multiple candidates, verify each against ground truth we already have (org number, name, city), score them, and only accept a result once confidence clears a bar.** This is a ranking problem, not a lookup problem.

## 2. Pipeline overview

```
BRF record (name, org_number, city, municipality, address)
        │
        ▼
 ┌─────────────────────┐
 │ 1. Candidate         │  multiple independent generators, deduped
 │    Generation        │
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │ 2. Candidate         │  fetch page(s), extract structured signals
 │    Enrichment        │
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │ 3. Scoring Model     │  per-candidate weighted signal score
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │ 4. Ranking +         │  order candidates, compute confidence
 │    Confidence         │
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │ 5. Verification      │  cheap independent check before accepting
 │    Strategy          │
 └─────────┬────────────┘
           ▼
 ┌─────────────────────┐
 │ 6. Fallback /        │  what happens below the confidence bar
 │    Failure Handling  │
 └──────────────────────┘
```

This replaces the current flat "engine merges provider results → `match_brf_by_name` picks one" flow with an explicit generate → enrich → score → rank → verify pipeline. The existing `DiscoveryEngine`/provider abstraction (`base.py`, `engine.py`) is kept — it's the right shape, it's just missing stages 2–5.

## 3. Candidate generation

Goal: maximize recall of the *correct* URL somewhere in the candidate set. Precision is the scorer's job, not the generator's.

Generators, all producing `DiscoveredBRF` candidates tagged with source + the exact query/method that found them (needed later for scoring and for ML training data):

| Generator | What's new vs. today | Notes |
|---|---|---|
| **Targeted search queries** | Build queries *from the specific BRF*, not generic ones: `"{brf_name}" {org_number}`, `"{brf_name}" {city} hemsida`, `"{brf_name}" årsredovisning`, `"{brf_name}.se"` | Reuses `SearchEngineDiscovery`'s DDG/Google/Bing backends, just changes query construction. Highest expected recall improvement for near-zero cost. |
| **Domain-guess probing** | Generate likely domains from the BRF name (slug + `.se`/`brf{slug}.se`/`{slug}.se`) and HEAD-check existence | Swedish BRFs very often own `brf<name>.se`. Cheap, high-precision when it hits. |
| **Property-manager portal lookup** | Query HSB, Riksbyggen, Nabo, SBC member/förening directories by name — these portals host pages *for* BRFs that use them as manager, even if the BRF has no own site | Currently entirely absent. Also yields a strong "managed by X" signal usable later regardless of whether the portal page becomes the accepted URL. |
| **Directory scraper** (existing) | Keep `allabrf.se` / `brforeningen.se`, but also fetch the directory's *detail page* per BRF (not just the listing card) if the listing links deeper — richer `raw_data` for scoring | |
| **Seed URLs** (existing) | Keep as-is; still highest prior | |
| **Sitemap/link-following (secondary pass)** | If a top-ranked but unverified candidate domain is found, crawl its sitemap.xml / nav links one hop for an "om oss"/"kontakt"/"styrelse" page — improves enrichment, not generation, but can also surface sibling BRF sites in shared-portal cases | Only run on already-plausible candidates, not the whole pool — cost control. |

All generators emit into the same `DiscoveredBRF` shape; `DiscoveryEngine` dedupes by normalized URL (strip scheme/www/trailing slash) as today, but must **keep provenance from all sources that hit the same URL** — multi-source agreement is itself a scoring signal (see §4).

## 4. Scoring model

Each surviving candidate gets **enriched** (single page fetch of the homepage + up to 2 likely subpages: `/kontakt`, `/om`, `/styrelse`, `/dokument`, `/arsredovisning`, discovered via nav-link text matching, not brute-force crawling) and then scored as a weighted sum of independent signals, each normalized to [0, 1]:

| Signal | Weight (illustrative) | How computed | Why it's strong/weak |
|---|---|---|---|
| **Organization number match** | 0.30 | Regex-extract 10-digit org numbers (format `NNNNNN-NNNN`) from fetched page text; exact match against `BRF.organization_number` | Strongest possible signal — org numbers are unique and rarely appear by accident. Near-zero false positive rate. |
| **BRF name similarity** | 0.15 | Token-normalized similarity (existing logic in `matching.py`, reused) between `BRF.name` and page `<title>`, `<h1>`, and visible header text | Current sole signal; still useful but weak alone — many "Brf Björken"-style near-duplicates exist across Sweden. |
| **City/municipality match** | 0.10 | `BRF.city`/`municipality` found in page footer/contact/address block | Disambiguates the "same name, different town" collision case that name-only matching cannot. |
| **Address match** | 0.10 | Street-level fuzzy match if `BRF.address` present on page (contact/kontakt page) | High precision when available, but often absent — weight kept modest because coverage is low, not because signal quality is low. |
| **Property manager mention (HSB/Riksbyggen/Nabo/SBC)** | 0.05 | Page or portal-lookup states "förvaltas av HSB" etc.; cross-checked against portal-lookup generator hit | Corroborating context signal, also useful for downstream data enrichment later. |
| **Annual report / PDF presence** | 0.10 | Page links to a PDF matching pattern `årsredovisning|arsredovisning` or a document library exists | A real BRF site almost always publishes annual reports; a squatted/wrong/generic site usually doesn't. |
| **Domain quality** | 0.05 | Heuristics: `.se` TLD, domain contains BRF-name slug, not a known aggregator domain (allabrf.se, hitta.se, ratsit.se, eniro.se, hemnet.se, booli.se blocklist), not a social-media/facebook page, has valid TLS cert, site is not parked/for-sale | Filters out obviously-wrong domains (directories, listing aggregators, unrelated businesses) cheaply before spending signal budget elsewhere. |
| **Structured metadata (JSON-LD/OpenGraph Organization)** | 0.05 | If page exposes `schema.org/Organization` or `LocalBusiness` JSON-LD with matching `name`/`address`, treat as strong corroboration | Rare in practice for small BRF sites, but decisive when present — essentially free ground truth the page author asserts about itself. |
| **Multi-source agreement** | 0.05 | Bonus if ≥2 independent generators (e.g. targeted search *and* domain-guess *and* directory) converge on the same normalized URL | Independent methods agreeing is itself evidence, orthogonal to any single page's content — classic ensemble signal. |
| **Contact page existence** | 0.05 | Site has a reachable kontakt/contact page at all | Weak solo signal (most business sites have one) but useful as a tie-breaker and as a "is this a real, maintained site" quality proxy. |

Weights sum to 1.0; these are starting priors to tune once labeled data exists (§8), not fixed constants. Org number match should realistically **dominate**: consider making it a near-deterministic override — e.g. `score = 0.95 + 0.05*other_signals` when org number matches exactly, versus the weighted sum otherwise — because a confirmed org-number match is close to ground truth on its own, while its *absence* should not be scored as strongly negative (many legitimate small BRF sites never publish their org number).

## 5. Ranking algorithm

1. Compute the weighted score per candidate as above.
2. Sort descending.
3. Compute **confidence**, not just a score — the gap to the runner-up matters as much as the absolute score:

```
confidence = f(top_score, gap_to_second)
```

Concretely: `confidence = top_score * clamp(gap_to_second / gap_norm, 0.5, 1.0)`, where `gap_norm` (e.g. 0.15) is the minimum gap treated as "clearly separated." A high top_score with a near-tied second candidate should *not* be reported as high confidence — that's exactly the "two BRFs with the same name in different towns" failure mode. This also naturally handles the single-candidate case (no second candidate → gap is maximal → confidence ≈ top_score).

4. Emit a ranked list, not just a winner — `DiscoveryResult` should carry the top-N candidates with scores, not silently drop them. This is needed for (a) human review UI later, (b) the verification step below, (c) future ML training labels.

## 6. Verification strategy

Before a top-ranked candidate is accepted automatically (as opposed to only as the best current guess), run one cheap independent check that isn't already baked into the score, to guard against the scorer's own blind spots:

- **Reverse check**: does the candidate page's extracted org number, if present, resolve via a Bolagsverket/allabolag lookup to the *same BRF name* we started with? (Independent registry cross-check rather than trusting page text alone — guards against a page that names the wrong org number.)
- **Negative check**: does the candidate NOT match any *other* BRF already resolved in our database at higher confidence? (Prevents two different target BRFs from both claiming the same site due to a shared scoring blind spot.)
- Only candidates that pass verification are marked `verified=True` / auto-accepted. A high-scoring but unverified candidate is still stored and surfaced, just flagged for review rather than treated as ground truth.

Verification is deliberately a *separate, smaller* check from scoring — scoring answers "which is most likely," verification answers "is there a specific reason to distrust the winner," so it should catch different failure classes, not duplicate the same signals.

## 7. Fallback and failure handling

| Confidence band | Action |
|---|---|
| **High** (e.g. ≥ 0.80 and verified) | Auto-accept as `website_url`. Store full candidate list + scores in `metadata` for auditability. |
| **Medium** (e.g. 0.50–0.80, or high score but unverified) | Store as best guess, flag `needs_review=True`. Surface in an internal review queue rather than silently trusting it. Never presented to end users as ground truth. |
| **Low** (below 0.50, or no candidates at all) | No `website_url` set. Discovery result records *why*: no candidates found vs. candidates found but all scored low vs. candidates tied. This distinction matters for prioritizing which generators to improve next. |
| **Conflicting** (two+ candidates within the confidence gap threshold) | Treat as low confidence regardless of top score — ambiguity is itself the failure mode, not a scoring problem to average away. |

Failure handling should always **degrade gracefully to "no answer" rather than a wrong answer** — for a paid decision-support product, a missing BRF website is a minor gap; a wrong one silently poisons every downstream analyzer (annual reports, board data, property info) with the wrong BRF's data. This mirrors the project's existing data-leakage discipline: prefer an honest gap over a confident wrong signal.

## 8. Path to ML, without requiring ML today

The architecture above is deliberately built so every stage produces **labeled, structured data as a byproduct** of normal operation, even though scoring today is a fixed weighted-sum heuristic:

- Every candidate, its per-signal values, its final score, and (once verification or human review runs) its accept/reject outcome are stored — this *is* a training set (features = signal values, label = correct/incorrect) accumulating for free from day one.
- Because signals are already independent, normalized [0,1] features, the fixed weighted-sum can later be replaced by a learned model (logistic regression first — interpretable, low-data-hungry, easy to sanity-check against the hand-set weights; gradient-boosted trees later if enough volume warrants it) **without changing the pipeline shape**, only the scoring function in stage 3.
- Human review decisions on medium-confidence candidates (§7) become the highest-quality labels, since they're the hardest cases and the ones a hand-tuned heuristic is least likely to get right — exactly where a learned model adds the most value.
- Multi-source agreement and verification outcomes double as *implicit* weak labels even before any human reviews anything, enabling semi-supervised bootstrapping.
- Longer-term: page-fetch content (title, body text) already captured in enrichment could feed a learned text-similarity signal (embedding-based name/address matching) instead of hand-rolled string heuristics — a drop-in replacement for the "name similarity" and "address match" rows in §4, again without touching the surrounding pipeline.

The key design discipline enabling this: **keep signal computation, scoring, and thresholding as separate, swappable stages**, and log every intermediate value. That's what turns "we made a heuristic" into "we accumulated a dataset" for free.

## 9. What this does NOT include (explicitly out of scope for this design)

- No code changes yet — this is the architecture to review before implementation.
- No OCR — that remains the next phase after discovery accuracy is fixed, per the stated priority.
- No commitment to specific weight values — §4 weights are priors to be tuned once labeled outcomes exist (§8).
- No new external paid data sources — all generators/signals above use free/already-integrated sources (DDG/Google/Bing search, directory sites, property-manager portals, page fetches, Bolagsverket-style registry lookups already used elsewhere in this project).
