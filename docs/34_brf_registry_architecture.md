# 34 — Self-Growing BRF Registry (Architecture)

Status: **Design only — not implemented.**

## 1. Problem statement

Today's discovery path (`src/brf_scraper/discovery/`) treats every job as cold: `DiscoveryStage` re-runs `AllabrfAcquisitionStage` / search-engine discovery for every request, and `SqliteVerifiedWebsiteRegistry` (`discovery/registry.py`) is a passive cache keyed by exact BRF name/org number that nothing populates except a successful HIGH-confidence discovery run.

We are changing the target architecture: discovery is no longer "try to find every BRF website in advance." It becomes **verify-on-demand, cache forever**:

1. A user pastes a Hemnet listing.
2. We identify the BRF (name, org number, municipality) — reuses `HemnetProvider` (`discovery/hemnet_provider.py`).
3. We check the registry for a verified website for that BRF.
4. **Hit** → crawl only the verified site. No discovery, no guessing.
5. **Miss** → run a small, ordered set of *trusted-source* providers (org-number lookup, HSB/SBC/Riksbyggen/Nabo portals, allabrf.se) to find and verify a website; on success, persist it and proceed to crawl.
6. **Still miss** → return `website_missing`, let the user submit a URL or upload the annual report directly, and persist whatever they gave us so the *next* user asking about this BRF gets an instant hit.

The registry is the product. Every job that completes — automatically or via user submission — makes the next job for a nearby BRF cheaper. This document defines the schema, module layout, plugin contract, and verification/integration flow for that system. `discovery/registry.py`'s `VerifiedWebsiteRegistry` is the direct ancestor of this design and is superseded by it, not replaced from scratch — see §7.

## 2. Workflow overview

```
Hemnet URL
    │
    ▼
┌─────────────────────┐
│ 1. Identify BRF      │  HemnetProvider -> BrfIdentity
│    (existing)        │  (name, org_number?, address, municipality)
└─────────┬────────────┘
          ▼
┌─────────────────────┐
│ 2. Registry lookup   │  RegistryLookupService.get(identity)
└─────────┬────────────┘
          │
    ┌─────┴─────┐
    │ HIT        │ MISS
    ▼            ▼
┌─────────┐  ┌───────────────────────┐
│ 3a. Use  │  │ 3b. Resolve on demand │  ProviderPipeline runs registered
│ verified │  │                       │  DataProviderPlugins in priority
│ website  │  │                       │  order until one verifies
└────┬─────┘  └──────────┬────────────┘
     │                   │
     │             ┌─────┴─────┐
     │             │ found?     │
     │             ▼            ▼
     │        ┌─────────┐  ┌───────────────┐
     │        │ save to │  │ website_missing│
     │        │ registry│  │ -> user prompt │
     │        └────┬────┘  └───────┬────────┘
     │             │               │
     │             │        ┌──────┴───────┐
     │             │        │ user submits  │
     │             │        │ URL or PDF    │
     │             │        └──────┬───────┘
     │             │               │ (URL) save to registry
     │             │               │ (PDF)  attach directly, skip crawl
     ▼             ▼               ▼
┌─────────────────────────────────────┐
│ 4. Crawl verified website            │  existing CrawlStage/DownloadStage
│    (skipped if PDF uploaded directly)│  or AllabrfAcquisitionStage
└─────────────────────────────────────┘
```

This slots into the existing `JobRunner` stage model (`jobs/runner.py`) as one new stage — `RegistryResolutionStage` — placed before `CrawlStage`, replacing today's `AllabrfAcquisitionStage` + `DiscoveryStage` pairing (see §7).

## 3. Database schema

Three tables, all owned by the new `registry` module. `verified_websites` (today's table) is renamed/migrated into `brf_registry`; the others are new.

### 3.1 `brf_registry` (was `verified_websites`)

The core cache: one row per known BRF, at most one *current* verified website.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `organization_number` | `CHAR(11)` UNIQUE NULLABLE | Canonical key when known — Swedish org numbers are unique and unambiguous. Format `NNNNNN-NNNN`. |
| `brf_name` | TEXT | Display name, latest known. |
| `brf_name_key` | TEXT INDEX | `normalize_brf_name()` (existing function, reused as-is). Fallback lookup key when org number is unknown. |
| `municipality` | TEXT NULLABLE | For disambiguating name collisions across towns. |
| `website_url` | TEXT NULLABLE | NULL is valid — see `status`. |
| `status` | ENUM | `verified` \| `unverified_pending` \| `website_missing` \| `user_submitted` \| `rejected`. See §5. |
| `verification_method` | ENUM | `automatic` \| `provider:<plugin_name>` \| `user_confirmed` \| `administrator`. Generalizes today's `VerificationMethod`. |
| `confidence` | FLOAT | Reuses `discovery/confidence.py` scoring where applicable; 1.0 for user/admin confirmation. |
| `source_provider` | TEXT NULLABLE | Which plugin resolved it (`allabrf`, `hsb_portal`, `user_submission`, ...). Denormalized from the winning `provider_attempts` row for fast reads. |
| `verified_at` | TIMESTAMP | |
| `last_checked_at` | TIMESTAMP | For future staleness re-verification (not built now, but the column earns its keep immediately as an audit trail). |
| `created_at` / `updated_at` | TIMESTAMP | |

Indexes: unique on `organization_number` (partial, `WHERE organization_number IS NOT NULL`), index on `brf_name_key`, index on `status` (the `website_missing` queue is a first-class query).

### 3.2 `provider_attempts`

Append-only audit log of every resolution attempt against every plugin, for a given BRF. This is what makes the plugin architecture debuggable and lets us tune provider ordering later from real data — it doesn't exist today and is the main net-new observability piece.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `brf_registry_id` | UUID FK → `brf_registry.id` NULLABLE | Null if the BRF didn't exist in the registry yet at attempt time. |
| `brf_name` | TEXT | Denormalized — survives even if the registry row is later merged/deleted. |
| `organization_number` | TEXT NULLABLE | |
| `provider_name` | TEXT | Plugin identity, e.g. `hsb_portal`. |
| `outcome` | ENUM | `verified` \| `candidate_found_unverified` \| `no_match` \| `error`. |
| `candidate_url` | TEXT NULLABLE | |
| `confidence` | FLOAT NULLABLE | |
| `raw_response` | JSON | Whatever the plugin returned, for debugging — bounded size, truncated if needed. |
| `error_message` | TEXT NULLABLE | |
| `attempted_at` | TIMESTAMP | |
| `duration_ms` | INT | |

### 3.3 `user_submissions`

Records of the "allow the user to submit" path — kept separate from `brf_registry` so a submission is reviewable/auditable before (optionally) being trusted at full confidence, and so we retain the *raw* user input even if we later normalize/reject it.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `brf_registry_id` | UUID FK → `brf_registry.id` | Row is created if it doesn't exist yet (status starts `website_missing`). |
| `submission_type` | ENUM | `website_url` \| `annual_report_pdf`. |
| `website_url` | TEXT NULLABLE | Set when `submission_type = website_url`. |
| `document_storage_key` | TEXT NULLABLE | Set when `submission_type = annual_report_pdf`; points into existing `storage/local.py` (or its successor) — no new storage layer. |
| `document_year` | INT NULLABLE | User-asserted, optional. |
| `submitted_by` | TEXT NULLABLE | Session/user id if auth exists; anonymous otherwise. |
| `job_id` | UUID FK → `jobs.id` NULLABLE | The job that prompted this submission. |
| `review_status` | ENUM | `auto_accepted` \| `pending_review` \| `accepted` \| `rejected`. Default policy in §5. |
| `submitted_at` | TIMESTAMP | |

A submitted `website_url` that gets `accepted` writes/updates a `brf_registry` row with `verification_method = user_confirmed`. A submitted PDF never touches `brf_registry.website_url` — it's evidence attached straight to the job's downloaded-documents result, independent of whether a website is ever found.

## 4. Module structure

New top-level package `src/brf_scraper/registry/`, sitting alongside `discovery/` (which keeps candidate-generation/crawling concerns; `registry/` owns *persistence and resolution policy*). `discovery/registry.py` is deleted once migrated (§7).

```
src/brf_scraper/registry/
├── __init__.py
├── models.py            # BrfRegistryEntry, ProviderAttempt, UserSubmission (pydantic)
├── store.py              # SQLAlchemy models + BrfRegistryStore (async CRUD, replaces registry.py's Sqlite class)
├── lookup_service.py      # RegistryLookupService — the single entry point other code calls
├── resolution_pipeline.py # ProviderPipeline: runs plugins in order, records provider_attempts
├── verification.py        # shared verification helpers (org-number extraction/match, confidence banding — reuses discovery/confidence.py signal functions)
├── submission_service.py  # accepts user URL/PDF submissions, applies review policy, writes registry + user_submissions
└── providers/
    ├── __init__.py
    ├── base.py            # WebsiteVerificationProvider protocol (the plugin contract, §5)
    ├── allabrf_plugin.py  # thin adapter wrapping existing AllabrfProvider
    ├── org_number_lookup.py # Bolagsverket/allabrf org-number cross-check as an independent trusted source
    ├── hsb_portal.py       # new: HSB "hitta din förening" member-portal lookup
    ├── sbc_portal.py       # new: SBC portal lookup
    ├── riksbyggen_portal.py# new: Riksbyggen portal lookup
    ├── nabo_portal.py      # new: Nabo portal lookup
    └── registry_plugins.py # PROVIDER_REGISTRY: ordered list wiring the above into resolution_pipeline
```

`RegistryLookupService` is the only class other modules (job runner, API) depend on — it hides whether an answer came from cache, a plugin, or a user submission behind one call:

```python
class RegistryLookupService:
    async def resolve(self, identity: BrfIdentity) -> RegistryResolution:
        """Registry hit -> return it. Miss -> run ProviderPipeline,
        persist a verified hit, or return website_missing."""
```

`RegistryResolution` is a small result type: `status` (`verified` / `website_missing`), `website_url | None`, `entry: BrfRegistryEntry | None`, `attempts: list[ProviderAttempt]` (for the job result / debugging UI).

## 5. Plugin architecture for data providers

### 5.1 Contract

```python
# registry/providers/base.py
class WebsiteVerificationProvider(Protocol):
    name: str                     # stable id, e.g. "hsb_portal"
    trust_tier: TrustTier         # see below — governs default confidence ceiling

    async def find_website(
        self, identity: BrfIdentity
    ) -> ProviderResult:
        """Look up `identity` against this source.

        Returns a ProviderResult with candidate_url + own confidence
        estimate, or a no-match result. Must not raise for "not found" —
        only for genuine transport/parse failures (caught by the pipeline
        and logged as `error` attempts, not fatal to the run).
        """
```

This is deliberately narrower than `discovery.base.BaseDiscoveryProvider` (which returns *ranked candidate lists* for generic search). Registry providers answer one question — "what is BRF X's *verified* website, if you know it" — because they're trusted-source lookups, not open web search. `AllabrfProvider` is wrapped by `allabrf_plugin.py` rather than reused directly, because its `discover()` contract (candidates + separate `acquire()` for documents) doesn't match this narrower shape; the adapter is a few lines that call `AllabrfProvider.search()` + `fetch_profile()` and translate the result.

### 5.2 Trust tiers

Providers are grouped by how much their own say-so is worth, independent of per-candidate scoring:

| Tier | Providers | Default confidence ceiling | Rationale |
|---|---|---|---|
| `REGISTRY_AUTHORITY` | Org-number lookup (Bolagsverket-backed) | 1.0 | Government-adjacent, unique key — closest thing to ground truth. |
| `MANAGER_PORTAL` | HSB, SBC, Riksbyggen, Nabo | 0.85 | These portals host pages *for* the BRFs they manage; the portal itself vouches for the mapping, but the "website" may be the portal page rather than the BRF's own domain — flagged via `BrfRegistryEntry.website_kind` (`own_domain` \| `manager_portal_page`). |
| `DIRECTORY` | allabrf.se | 0.6 | Existing prior from `confidence.py`'s `_SOURCE_PRIOR`, reused verbatim. |
| `USER` | User submission | 1.0 if auto-accepted, N/A if pending review | See §5.4. |

`resolution_pipeline.py` runs tiers in the order above (highest trust first) and **stops at the first candidate whose combined score clears `HIGH_CONFIDENCE_THRESHOLD`** (reusing `discovery/confidence.py`'s existing constant and signal functions — org-number match, name similarity, location match — scored against `identity` exactly as `score_candidates()` already does against a `BRF`). A `MANAGER_PORTAL` or `DIRECTORY` hit that scores MEDIUM is kept as the best-so-far candidate but the pipeline continues to the next tier; if nothing reaches HIGH, the MEDIUM candidate (if any) is what `website_missing` handling offers the user to *confirm* rather than blindly re-guessing (mirrors today's `DiscoveryDecision.needs_user_confirmation` in `discovery/pipeline.py`).

### 5.3 Registering a provider

Adding a new source is exactly: implement `WebsiteVerificationProvider`, add one line to `providers/registry_plugins.py`'s `PROVIDER_REGISTRY` list with its tier. Nothing else in the codebase changes — `resolution_pipeline.py` iterates the registry generically and `lookup_service.py` never names a concrete provider.

### 5.4 User submission as a plugin-adjacent path

Not a `WebsiteVerificationProvider` (it's synchronous-with-a-human, not queryable on demand), but shares the same output shape. Policy, configurable per deployment:

- `website_url` submission: **auto-accepted** at `confidence=0.7` (`MEDIUM` band, matching `DiscoveryDecision.needs_user_confirmation` semantics) and immediately usable for *this* job's crawl, but the `brf_registry` row is written with `status=user_submitted` rather than `verified` until either (a) a subsequent job's crawl actually finds the BRF's org number/name on the submitted site (auto-promotes to `verified`, mirroring `DiscoveryPipeline._persist_verification`), or (b) an administrator confirms it.
- `annual_report_pdf` submission: always `auto_accepted` for the *current job* (the user directly gave us the artifact we wanted) — it never implies anything about a website, so it doesn't touch `brf_registry` at all beyond optionally leaving `status=website_missing` as-is.

## 6. Verification flow (state machine)

`brf_registry.status` transitions:

```
                 ┌────────────────────────────────────────────┐
                 │                                             │
  (new BRF) ──▶ unverified_pending ──(provider HIGH match)──▶ verified
                 │        │                                    ▲  │
                 │        │(no provider clears HIGH)            │  │(re-resolution later
                 │        ▼                                     │  │ downgrades confidence /
                 │  website_missing ──(user submits URL)──▶ user_submitted
                 │        │                                        │
                 │        │(user submits PDF only)                 │(crawl confirms identity)
                 │        ▼                                        │
                 │  website_missing                                ▼
                 │  (unchanged; PDF attached to job only)      verified
                 │
                 └──(administrator marks bad URL)──▶ rejected ──(new resolution attempt)──▶ unverified_pending
```

`rejected` exists so a bad automatic/portal match discovered later (e.g. a crawl that finds zero matching signals on the "verified" site) doesn't silently keep being served — it's a dead end that forces re-resolution rather than an infinite trust loop. Detecting *when* to reject (e.g. `CrawlStage` finding no org-number/name match on a supposedly-verified site) is a policy hook noted here for the future but out of scope for this design; the schema just needs to support it (it already does, via `status`).

Every status transition is required to also insert a `provider_attempts` row (for automatic transitions) or a `user_submissions` row (for human ones) — `brf_registry` never changes without a corresponding audit record. This is enforced at the `store.py`/`submission_service.py` layer (single write path), not by a DB trigger, to keep the schema portable across SQLite (dev) and Postgres (prod), matching the existing `SqliteVerifiedWebsiteRegistry` dual-target pattern.

## 7. Integration with the existing BRF Scraper

### 7.1 `JobRunner` stage changes (`jobs/runner.py`)

Replace the current `[AllabrfAcquisitionStage(), DiscoveryStage(), CrawlStage(), DownloadStage()]` with:

```
[RegistryResolutionStage(), CrawlStage(), DownloadStage()]
```

`RegistryResolutionStage` absorbs what `AllabrfAcquisitionStage` and `DiscoveryStage` did, via `RegistryLookupService.resolve()`:

- On `verified` (cache hit or fresh resolution): sets `context.website_url`, `job.result.website_url`, `job.result.discovery_source = entry.source_provider`, and proceeds to `CrawlStage` exactly as today.
- On `website_missing`: sets a **new** `JobStatus.WEBSITE_MISSING` (terminal-but-not-failed — distinct from `FAILED`, since nothing errored) and stops the runner without raising `BRFScraperError`. `JobRunner.run`'s loop needs a small extension: a stage can request "stop here, not as failure," not just "raise to fail." (Today only `raise` exists; this is the one real control-flow change to `JobRunner`, everything else is additive.)
- `job.result` gains `registry_status: str | None` and `provider_attempts_summary: list[dict]` (compact form of `RegistryResolution.attempts`) so the API/UI can show *why* — which portals were tried — without a separate query.

`AllabrfAcquisitionStage` doesn't disappear — it becomes `providers/allabrf_plugin.py`'s implementation, reused inside the pipeline instead of as a standalone stage. Its existing direct-download behavior (`AllabrfProvider.acquire()` already fetches documents, not just a website URL) is preserved as an optimization: when the winning provider is `allabrf` specifically, `RegistryResolutionStage` can skip straight to `DownloadStage` with the documents `acquire()` already fetched, same as the current `context.allabrf_satisfied` shortcut — this behavior moves, it isn't lost.

### 7.2 Hemnet entry point (`discovery/acquisition_pipeline.py`)

`acquire_from_hemnet_url()` (built for the AllabrfProvider-only MVP) is superseded by routing through `RegistryLookupService` the same way jobs do, so the two entry points (ad-hoc script vs. production job) share one resolution path instead of diverging:

```
HemnetProvider.fetch_listing(url)
    -> BrfIdentity(name, org_number, municipality, address)
    -> RegistryLookupService.resolve(identity)
    -> (verified) crawl + download   |   (website_missing) surface submission prompt
```

`HemnetListing` (existing model) maps 1:1 to the new `BrfIdentity` value object (`registry/models.py`); no change needed to `HemnetProvider` itself.

### 7.3 User-facing submission surface

No API layer exists in this codebase yet (`jobs/` is the durable-work model; there's no `api/` package here, unlike the sibling `betting` project). This design assumes submission arrives through whatever thin interface calls `JobRunner` today (CLI/script) gains two new entry points calling `submission_service.py` directly:

- `submit_website(job_id, url)` → `SubmissionService.submit_website_url(...)`, then optionally re-runs `RegistryResolutionStage` + `CrawlStage` + `DownloadStage` for that job.
- `submit_annual_report(job_id, file)` → `SubmissionService.submit_pdf(...)`, writes straight into `job.result.downloaded_documents` via existing `storage/local.py`, no crawl needed.

If/when an HTTP API is added for this project (mirroring `projects/betting/api/`), these two calls are the entire surface a `routes/registry.py` needs to expose — the design intentionally keeps them as plain async functions with no framework dependency so that wiring is trivial later.

### 7.4 Migration of existing data

`discovery/registry.py`'s `verified_websites` table becomes `brf_registry` via a straight column-compatible migration (Alembic — this project already has `alembic/`): every existing row gets `status=verified`, `verification_method` mapped 1:1 (`automatic`→`automatic`, `user_confirmed`→`user_confirmed`, `administrator`→`administrator`), `source_provider` backfilled to `"legacy_discovery"` where unknown. `discovery/pipeline.py` (`DiscoveryPipeline`, confidence-gated resolve/confirm) and `discovery/confidence.py` are **not deleted** — `resolution_pipeline.py` calls into `confidence.py`'s scoring functions directly (§5.2), and `DiscoveryPipeline` itself is retired in favor of `RegistryLookupService` but its confidence-banding logic lives on inside the new module.

## 8. What this design deliberately leaves open

- **Re-verification cadence** for `last_checked_at` (websites go stale — BRFs change managers, redesign sites). Column exists; policy doesn't yet.
- **Admin review UI** for `pending_review` submissions and `rejected` entries — schema supports the queue (`status`/`review_status` indexes), no UI specified.
- **Rate limiting / politeness budget across manager portals** shared by `hsb_portal.py`/`sbc_portal.py`/etc. — each plugin owns its own client today (matching `AllabrfProvider`'s self-contained `httpx.AsyncClient` pattern); a shared budget is a future cross-cutting concern, not a blocker for the plugin contract itself.
- **Bolagsverket (or equivalent) integration specifics** for `org_number_lookup.py` — named as the `REGISTRY_AUTHORITY` tier's occupant, but which concrete API/dataset backs it is a separate research task (see `docs/28_free_data_providers.md`, `docs/33_acquisition_engine_oss_research.md` for prior art before building it).
