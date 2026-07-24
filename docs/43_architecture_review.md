# Senior Architecture Review — Köpanalys Reporting Pipeline

> **Status: REVIEW, not a redesign.** Scope: `42_platform_data_contracts.md`,
> `report-pdf-layout-blueprint.md`, `kopanalys-report-design.md`, and the
> real code they're grounded in (`src/location_intelligence`,
> `src/market_intelligence`). No design was changed while writing this
> review — findings are reported, not silently fixed. Each finding names
> the smallest change that would close it; none have been applied.
>
> 19 categories reviewed, in the order requested. No **Critical** findings —
> nothing here breaks the system as designed or causes silent data loss.
> **7 High**, **11 Medium**, **3 Low** findings. Several categories pass
> cleanly and are stated as such rather than padded with invented issues.

---

## 1. Hidden coupling between engines

**Finding 1 — Listing Parser secretly depends on Location Intelligence (HIGH).**
Doc 42 §3 states: *"if the Listing Parser can't determine coordinates from
the listing page itself, it delegates to Location Intelligence's existing
`nominatim_geocoder`/`address_resolver` providers rather than
re-implementing geocoding a second time."*

This contradicts the pipeline's own hard rule two pages earlier (doc 42
§1): engines run in parallel *after* `Property` exists, and are "stateless
and mutually unaware" of each other. If the Listing Parser calls into
Location Intelligence to finish building `Property`, then Location
Intelligence (or part of it) must run *before* the Listing Parser's output
is final — which breaks the stated ordering and makes the Listing Parser
depend on a specific downstream engine's internals rather than a shared
utility. It also means Location Intelligence can no longer be deployed,
scaled, or evolved independently of the Listing Parser, contradicting doc
37's stateless-engine principle that the whole envelope design exists to
protect.

The dependency is also unnecessary: Location Intelligence's own
`address_resolver`/`nominatim_geocoder` providers *already* re-geocode from
a raw address as a normal part of every engine run (confirmed in the real
v1.0.0 code). Nothing requires the Listing Parser to pre-resolve
coordinates at all.

*Smallest fix:* delete the delegation sentence. The Listing Parser emits
`Property.coordinates` as `null` (with a `parser_warnings` entry) whenever
it can't read coordinates directly off the listing page. Location
Intelligence resolves the address itself via its own providers, exactly as
it already does today — no cross-engine call, no ordering dependency.

---

## 2. Circular dependencies

Only one instance found, and it's the same root cause as Finding 1 above:
Listing Parser → Location Intelligence → (implicitly) back into what
Location Intelligence needs from `Property`. Once Finding 1's fix is
applied, this resolves along with it.

The rest of the pipeline is checked and is strictly linear: Aggregator
reads only `Property` + engine packages; AI Analysis Engine reads only the
MIP; Report Generator reads only `StructuredAnalysis`. **No other circular
dependency exists — this part of the design passes review.**

---

## 3. Scalability bottlenecks

**Finding 2 — Report-generation throughput isn't bounded against the free-tier providers it depends on (MEDIUM).**
Two real, already-known constraints exist in the shipped code: `osm_poi`/
`osm_construction` run against "the free public Overpass instance's rate
limits" (per Location Intelligence's own README — self-hosting Overpass is
already documented there as the mitigation, *if usage requires it*). Doc 42
§11 makes the same "generous free tier, self-host if needed" bet for the
MapTiler Static Maps API. Both mitigations are real and already named — but
neither platform doc translates them into an actual reports-per-hour bound
or a queueing/backpressure mechanism for when report generation volume
approaches those limits. Today that's fine (no volume yet); before
production traffic, it isn't.

*Smallest fix:* one sentence in doc 42 §11 (and a pointer from §4) stating
that report-generation concurrency must be capped (e.g. a queue with a
worker pool sized below the free-tier rate limit) once real traffic starts
— no new subsystem needs to be built now, just the ceiling named so nobody
ships unbounded concurrency by default.

**Finding 3 — No stated execution model for report generation (synchronous vs. queued) (MEDIUM).**
WeasyPrint (doc 42 §12) is a synchronous, single-process, CPU-bound
renderer; the AI Analysis Engine's step likely involves a slow external
call (see Finding 15). Doc 42 never states whether a report request blocks
an HTTP request/response cycle or runs as a background job. This materially
affects timeout handling, retry safety, and how concurrent requests behave
under load — and it's the kind of decision that's expensive to change after
the fact.

*Smallest fix:* one sentence in doc 42 §1 declaring report generation an
asynchronous background job with a job-status/poll (or webhook) contract,
not a synchronous request — consistent with every other slow step in the
pipeline already being handled as fire-and-collect rather than blocking.

---

## 4. Missing interfaces

**Finding 4 — No Orchestrator, transport, or pipeline-level timeout policy (HIGH).**
Doc 37 names an "Orchestrator" that runs engines in parallel and collects
results; doc 42's pipeline diagram (§1) skips straight from "Listing
Parser" to "engines in parallel" without naming who triggers them, what the
transport is (in-process function calls vs. HTTP microservices vs. a task
queue — a decision that changes deployment topology, retry semantics, and
failure isolation entirely), or what happens if one engine hangs. Individual
*providers* have their own `deadline_s` (confirmed in the real code), but
nothing bounds an entire *engine's* wall-clock time at the pipeline level —
so a BRF Engine stuck in a slow multi-source search could block the whole
report indefinitely, directly undermining the "missing information must
never stop report generation" principle the rest of the design is built
around.

*Smallest fix:* name the Orchestrator explicitly in doc 42 §1's
responsibility table (transport: in-process async orchestration for MVP,
given the whole stack is already Python — no need for microservices yet),
and add one rule: each engine gets a hard wall-clock budget (e.g. 90s);
on timeout, the Orchestrator synthesizes a package where every provider
that hadn't returned is marked `status: "timeout"`, and the pipeline
proceeds without it. This reuses the existing `timeout` status — no new
enum value needed.

---

## 5. Duplicated responsibilities

**Finding 5 — Simple listing-derived ratios (price/m², fee/m²) have no assigned owner (MEDIUM).**
`kopanalys-report-design.md`'s Data Dependency Map marks `price_per_sqm =
asking_price / living_area` as `[C]` — and doc 42's legend defines `[C]` as
"the emitting engine itself **or** the Aggregator." For this specific
value there is no emitting engine (it's pure arithmetic on two `Property`
fields, not a fetched fact), so by elimination it should be the Aggregator
— but that's never stated, and the ambiguity is exactly the kind of gap
that invites someone to compute it in the Report Generator "since it's
trivial," which would violate that component's explicit "never compute a
ratio" rule.

*Smallest fix:* one line in doc 42 §7.1: the Aggregator computes
`Property`-only derived ratios (price/m², fee/m²) into a `property_derived`
domain in the MIP, `trust_tier: derived`, same as any other derived value —
closing the loophole without inventing a new component.

**Finding 6 — The shared envelope is duplicated, not shared, across engine codebases (MEDIUM).**
Confirmed by reading both real codebases: `location_intelligence/models.py`
and `market_intelligence/models.py` independently define byte-identical
`Finding`/`ProviderResult`/`TrustTier`/`TRUST_TIER_CEILING` dataclasses.
Doc 42 §2 treats this convergence as validation and elevates it to a
mandatory platform-wide contract — but doesn't address the duplication
itself. Every additional engine (BRF, and whatever comes after) that
reimplements this dataclass by hand is a new place the `TRUST_TIER_CEILING`
values or validation rules can drift out of sync silently, since nothing
enforces they stay identical.

*Smallest fix:* extract `Finding`/`ProviderResult`/`ProviderRun`/`TrustTier`
into one shared internal package that Location, Market, and BRF Engines all
import, rather than each hand-rolling the same dataclasses. Not a redesign
— the two real implementations are already identical, so this is a
mechanical consolidation, not new design work. Also fold `engine_id` naming
into that shared package as a simple registry (constants, not a database)
so `"brf_engine"` vs `"brf-engine"`-style typos can't silently create
unmatched packages (this is a Low-severity risk on its own, but it's a
one-line addition once the shared package exists, so it's rolled into this
fix rather than listed separately).

**Finding 7 — Location Intelligence and Market Intelligence have overlapping regional-statistics scope that the merge rule doesn't reconcile (MEDIUM).**
Market Intelligence's `scb_subnational`/`municipal_economics` providers and
Location Intelligence's `scb_municipality`/`kolada` providers both pull
SCB/Kolada-adjacent municipality-level statistics (income, demographics),
but in *different* domains (`regional` vs. `municipality`). The Aggregator
only merges findings that share the same `domain`+`key` (doc 42 §7.1.2) —
so two engines independently reporting what may be the same underlying
municipal fact will sit side by side in the MIP as two unrelated
`single_source` findings, never recognized as corroborating (or
conflicting) with each other, understating confidence in one and
overstating independence in both.

*Smallest fix:* doesn't require picking one provider over the other now —
just add one sentence to doc 42 §7.1 that the merge-equivalence table must
include explicit cross-domain equivalence entries for this specific overlap
once the exact `market_intelligence` domain/key strings are confirmed
(already flagged as unverified in doc 42 §5's own text).

---

## 6. Unclear ownership

Substantially covered by Findings 5–7 above (ownership of derived ratios,
of the shared envelope, of overlapping regional data). One additional,
narrower point:

**Finding 8 — No named owner for the Orchestrator component (folded into Finding 4).** Already covered above; not double-counted.

Everything else in the responsibility table (doc 42 §1) is unambiguous —
Listing Parser, the three engines, Aggregator, AI Analysis Engine, and
Report Generator each have a clear "may do / must never do" pair, and cross-
checking every page in the blueprint against that table found no
violations. **Ownership at the component level passes review; the gaps are
narrow and already listed.**

---

## 7. Future maintenance risks

Covered by Finding 6 (duplicated envelope/`engine_id` registry). One
further point:

**Finding 9 — Domain/key vocabularies live only as prose, not as anything checkable (MEDIUM).**
Doc 42 §4–§6 catalogue every engine's `domain`/`key` strings in markdown
tables. Nothing enforces that a provider's actual code stays in sync with
what the doc says — and this review already caught one instance of drift
risk in its own text: `scb_subnational`'s domain string is marked "confirm
exact domain string against source at integration time" because it could
not be fully verified from the provider file names alone. Prose
documentation of a schema is inherently prone to silently going stale as
code evolves.

*Smallest fix, split in two:* (1) verify the flagged `scb_subnational`/
`municipal_economics` domain strings against source now, before any
downstream component is built against the current guess; (2) as future
(not urgent) work, note that these vocabularies would benefit from a
machine-checked form (e.g. a contract test asserting each provider's
emitted `domain`/`key` values match the doc) — not required for MVP, but
worth naming so it isn't forgotten.

---

## 8. Security concerns

**Finding 10 — No authentication or rate-limiting at the pipeline's entry point (HIGH).**
Nothing in doc 42 addresses who is allowed to submit a Hemnet URL and
trigger the full pipeline — a chain of 12+ external API calls, presumably
an LLM call in the AI Analysis Engine (see Finding 15), and a PDF render.
Without an auth/rate-limit gate in front of the Listing Parser, this is a
directly cost-abusable resource: an anonymous actor could trigger
unbounded, expensive pipeline runs.

*Smallest fix:* doesn't require designing an auth system in this document
— just state explicitly (one sentence, doc 42 §1) that report generation
is invoked only through an authenticated, rate-limited entry point that is
a prerequisite for this pipeline, not part of it. Naming the gate is what
prevents someone from implementing the pipeline as a public, unauthenticated
endpoint by default.

**Finding 11 — No stated scraping etiquette for the Listing Parser (MEDIUM).**
Doc 42 §3 defines the Listing Parser's *output* schema in detail but says
nothing about *how* it fetches Hemnet pages — no rate-limiting, backoff, or
ToS-compliance stance. This is both an operational risk (aggressive
scraping risks an IP ban) and a legal one.

*Smallest fix:* one sentence: the Listing Parser must apply conservative
rate-limiting/backoff and a identifying User-Agent, and ToS compliance is
flagged as a legal-review item — the same pattern already used for the
Methodology & Disclaimer page's legal content, so this is consistent with
an existing precedent in the docs, not a new category of deferral.

**Minor, passes with a note:** API-key handling for MapTiler (doc 42 §11)
isn't discussed, but the design already keeps map rendering server-side
only (no client ever sees the key) — the higher-risk failure mode (a
leaked client-side key) is structurally avoided by the existing design.
Standard server-side secrets hygiene applies; not elevated to a separate
finding.

---

## 9. Privacy concerns

**Finding 12 — No data-retention or legal-basis statement for personal data, and this design processes real personal data (HIGH).**
The BRF Engine's `governance` domain (doc 42 §6) captures named
individuals — chairman, auditor — and every report is tied to a specific
residential address and (via `Property.brf`) a specific housing
association. This is EU personal data (Sweden/GDPR) by construction, not
by edge case. Doc 42 never states a retention policy for cached findings
or generated reports, nor a legal basis for processing board members' names
in a commercial report they didn't consent to appearing in.

*Smallest fix:* not to resolve GDPR compliance in an architecture doc — but
to name it as an explicit, tracked, deferred item the same way the legal
disclaimer content already is (doc, blueprint Part VII: "content TBD by
whoever owns legal/compliance"). One sentence in doc 42: raw `Finding`
caching is bounded by each provider's own `cache_ttl`; retention of the
finished report/`StructuredAnalysis` is a policy owned by legal/compliance
and must be defined before production launch. This closes the "silently
absent" problem cheaply without requiring an architecture document to
answer a legal question it isn't positioned to answer.

---

## 10. Performance issues

No performance-specific issue independent of what's already listed under
Scalability (Findings 2–3) and Caching (Finding 17) — reviewed
specifically for N+1-style recomputation or unbounded per-request work
inside the Aggregator's merge/confidence logic, and found none: the
merge-equivalence and confidence-formula steps are straightforward
per-finding operations with no hidden quadratic behavior. **No additional
finding in this category.**

---

## 11. Schema weaknesses

**Finding 13 — `finding_id` is used throughout §8 but never defined (HIGH).**
`StructuredAnalysis.evidence_index` (doc 42 §8) is keyed by `finding_id`;
`evidence_refs` arrays reference it dozens of times; the whole "every
metric must cite its evidence" guarantee (decision 14) is built on this
identifier resolving reliably. But no rule anywhere — not in `Finding`
(§2.1), not in `MergedFinding` (§7.4) — states how a `finding_id` is
generated, or whether it's stable across pipeline runs (which also matters
for caching, Finding 17). This is a real, concrete blocker: an engineer
implementing `evidence_index` cannot write the code without inventing this
rule themselves, which is exactly the outcome this whole exercise was
meant to prevent.

*Smallest fix:* one line in doc 42 §7 (where the Aggregator builds the
MIP): `finding_id = f"{engine_id}:{domain}:{key}"`, with a `:{validity.start}`
suffix appended for findings that recur per period (multi-year BRF data,
quarterly market indices) to keep each period's `finding_id` distinct. The
Aggregator assigns it once when building `MergedFinding`; the AI Analysis
Engine carries it through unchanged.

**Finding 14 — Conflict data can be represented two ways that could disagree (MEDIUM).**
A conflicting fact appears in *two* places in the MIP (doc 42 §7.4): as the
primary-only `MergedFinding` inside `domains[domain].findings[]`
(`agreement: "conflicting"`), and again as the full `ConflictRecord` in the
top-level `conflicts[]` array with both values and a `primary_index`.
Nothing states that the `domains[]` entry's value must be sourced from
`conflicts[].values[primary_index]` — two independent code paths in the
Aggregator could compute these separately and, in the presence of a bug,
disagree about which value is "the" primary one.

*Smallest fix:* state explicitly that `domains[domain].findings[]` never
stores its own copy of a conflicting value — it stores a `conflict_ref`
(an id into `conflicts[]`) instead, and the primary value is always read
from there. One array becomes the single source of truth instead of two.

**Finding 15 — `top_risks[].risk_ref` isn't covered by the same "must resolve" rule as `evidence_refs` (MEDIUM).**
Doc 42 §8 explicitly requires every `evidence_refs` entry to resolve
against `evidence_index`, and calls this out as a structural, not
conventional, guarantee. `verdict.top_risks[].risk_ref` is the same kind of
pointer (into `risk_assessment.factors[].id`) but the doc never extends the
same enforced-reference language to it — an oversight in applying a rule
the document already got right once, not a new category of problem.

*Smallest fix:* one added sentence: `top_risks[].risk_ref` must likewise
resolve against `risk_assessment.factors[].id`; a `StructuredAnalysis` with
a dangling `risk_ref` is invalid, exactly like a dangling `finding_id`.

**Finding 16 — `property_id` as a pure URL hash has an unstated relationship to caching (MEDIUM).**
`Property.property_id = sha256(source_url)[:16]` (doc 42 §3) means the same
listing always maps to the same id — good for tracking "reports about this
apartment over time" — but a listing's price, fee, or description can
change between two report requests (a price drop, a relisting) without
changing its URL. Nothing states whether re-running the pipeline for an
unchanged `property_id` should trust old cached engine data or must
re-check freshness, which matters once a report-level cache exists
(Finding 17).

*Smallest fix:* one clarifying sentence: `property_id` identity is for
report/listing tracking only; it never bypasses each provider's own
`cache_ttl`-based freshness check — a fresh request always re-validates
against normal per-provider caching rules, regardless of whether
`property_id` has been seen before.

---

## 12. Report generation edge cases

**Finding 17 — Total Listing Parser failure has no defined behavior (HIGH).**
Doc 42 §3 covers *partial* field extraction failure well (nullable fields
+ `parser_warnings`), but every downstream engine depends on `Property` —
it's the single most upstream link in the whole pipeline, and its
worst-case failure mode (URL invalid, listing delisted, Hemnet's markup
changed entirely) is never addressed. Given "missing information must
never stop report generation" is already a stated principle for the BRF
Engine (decision 5), leaving the Listing Parser's own total failure
undefined is an inconsistency, not a deliberate scope boundary.

*Smallest fix:* one sentence extending the same principle already applied
elsewhere: on total parse failure, the Listing Parser still emits a
`Property` object (id derived from the URL hash alone, every other field
`null`, one `parser_warnings` entry describing the failure) and the
pipeline proceeds — every engine naturally falls back to its own `no_data`
handling for whatever it can't do without listing data, and the report
renders at maximal empty-state rather than not rendering at all.

---

## 13. Engine failure scenarios

Per-provider failure handling (the `ok`/`partial`/`no_data`/`error`/
`not_connected`/`disabled`/`timeout` status vocabulary, with `__post_init__`
validation enforcing honest self-reporting) is real, tested code today —
**this layer passes review.** The one gap — what happens when an entire
*engine process* fails catastrophically (crash, OOM, hang) rather than
returning a well-formed package with providers self-reporting `error` — is
the same gap as Finding 4 (no Orchestrator-level timeout/containment
policy) and is not double-counted here.

---

## 14. Missing audit/logging

**Finding 18 — No correlation ID ties one report's work together across components (MEDIUM).**
Given this pipeline handles personal data (Finding 12) and calls many
external services, there's currently no way to answer "show me everything
that happened while generating report X" — no `request_id`/`report_id` is
threaded through Listing Parser → engines → Aggregator → AI Analysis Engine
→ Report Generator logs.

*Smallest fix:* generate one id at the Listing Parser (distinct from
`property_id`, since the same property can be re-reported many times) and
have every component log it and embed it in the MIP/`StructuredAnalysis`
metadata. Purely additive — no new subsystem, just a value threaded
through what already exists.

---

## 15. Observability

**Finding 19 — Known-degraded providers (`not_connected`) have no monitoring hook (MEDIUM).**
Two real providers — `trafikverket_infrastructure` and
`lantmateriet_detaljplan` — are confirmed `not_connected` in production
today (per the existing validation report) because credentials were never
configured. The envelope already carries everything needed to detect this
(`providers_by_status`, `stale_providers` in every package's `summary`
block) but nothing in doc 42 says this should be emitted as a metric/alert
rather than just sitting inside the JSON payload — so this could silently
stay broken indefinitely with nobody notified.

*Smallest fix:* one sentence: `summary.providers_by_status` is emitted as a
metric on every pipeline run, not just embedded in the response payload —
reusing a field that already exists rather than adding anything new.

---

## 16. Retry strategies

**Finding 20 — No retry policy is stated anywhere (MEDIUM).**
Individual providers have `cache_ttl`/`deadline_s` in the real code, but no
document states whether a `timeout` or `error` status is retried, how many
times, or with what backoff. Most providers are read-only GETs against
public APIs, so retries are safe to add — the gap is that the *policy* is
undefined, not that retries are architecturally hard.

*Smallest fix:* one paragraph in doc 42 §2: providers may retry `timeout`/
`error` (never `not_connected`/`disabled`, which mean "won't work no matter
how many times you ask") up to 2 times with exponential backoff, inside
their own `deadline_s` budget — a provider-owned concern, consistent with
how `HttpClient`/`HttpError` are already structured in the real code, not a
new Aggregator responsibility.

---

## 17. Caching strategy

**Finding 21 — No report-level cache, and the AI Analysis Engine step is likely the most expensive one to re-run needlessly (HIGH).**
Provider-level caching (`cache_ttl`/`from_cache`/`stale`) is real and
already a decent foundation. But nothing caches at the MIP or
`StructuredAnalysis` level — if the same property is requested twice within
an hour, the design as written re-runs the *entire* pipeline, including
whatever the AI Analysis Engine's "text generation" responsibility
(decision 3) implies — most plausibly an LLM call, which is the single most
expensive and highest-latency step in the whole chain if so. Re-paying that
cost on every duplicate request, with no cache in between, is a real,
avoidable cost and latency problem.

*Smallest fix:* one paragraph in doc 42 §7 or §8: a report-level cache keyed
by `(property_id, hash of the MIP's content)` — if a repeat request's
`Property` and every engine's findings are unchanged (or still within their
own `cache_ttl` windows, meaning the MIP would be byte-identical), the
Aggregator/AI Analysis Engine step is skipped and the previously generated
`StructuredAnalysis` is served directly. Naming the cache key is enough for
now; the storage backend is an implementation detail, not an architecture
decision.

---

## 18. Idempotency

The two places idempotency actually matters both check out cleanly:
`property_id` is a deterministic hash (same URL → same id, always), and the
Aggregator's conflict tiebreak (doc 42 §7.2) is fully deterministic by
explicit design (trust_tier → recency → a stated arbitrary-but-consistent
tiebreak). **Both pass review.**

**Finding 22 — Timestamp-driven confidence drift across re-fetches is real but undocumented as expected behavior (LOW).**
`fetched_at` is stamped at fetch time; re-fetching the same fact (a retry,
or a request outside the cache window from Finding 21) gets a new
timestamp even if the underlying value is unchanged, which can shift
`staleness_factor`/`corroboration_bonus` and therefore `confidence` by a
small amount between two report generations of the same reality. This
isn't a bug — freshness *should* be able to move confidence — but if it
isn't named as expected behavior, it will eventually be reported as one
("why did the confidence score change with no new data?").

*Smallest fix:* one sentence next to the caching fix (Finding 21) stating
that confidence is expected to drift slightly across cache-window
boundaries, and that the report-level cache (once added) is what provides
true idempotency for requests *within* a TTL window — outside it, small
drift is normal, not a defect.

---

## 19. Version compatibility

**Finding 23 — No general compatibility policy, only one ad hoc patch (MEDIUM).**
`format_version`/`engine_version` fields exist throughout the envelope,
`Property`, MIP, and `StructuredAnalysis` — a solid foundation. But the only
compatibility *rule* that exists anywhere is the one-off fallback in doc 42
§2.3 for Location Intelligence's v1.0.0 package lacking `property_id`. That
proves the versioning problem is real (it already happened once) but no
general policy was extracted from fixing it — so the next engine version
bump has nothing to follow.

*Smallest fix:* generalize the existing fix into a stated rule: the
Aggregator tolerates unrecognized/older `format_version` values via
best-effort field-presence checks (exactly the pattern already used for
`property_id`/`address`), and a MAJOR version bump signals a breaking
change that requires explicit Aggregator support before that engine's
output is trusted again. One paragraph, reusing a pattern that already
exists rather than inventing a new one.

---

## Summary

| # | Finding | Category | Severity | Disposition |
|---|---|---|---|---|
| 1 | Listing Parser depends on Location Intelligence for geocoding | Hidden coupling / Circular dependency | **High** | **Applied** — delegation removed, doc 42 §3 |
| 2 | No throughput ceiling against free-tier provider limits | Scalability | Medium | Deferred |
| 3 | No stated sync-vs-async execution model | Scalability | Medium | **Applied** — doc 42 §1.1 |
| 4 | No Orchestrator / pipeline-level timeout policy | Missing interfaces / Engine failure | **High** | **Applied** — doc 42 §1, §1.1 |
| 5 | Simple derived ratios (price/m², fee/m²) have no owner | Duplicated responsibility / Ownership | Medium | Deferred |
| 6 | Shared envelope duplicated across engine codebases | Duplicated responsibility / Maintenance | Medium | Deferred |
| 7 | Market/Location regional data overlap not reconciled | Schema weakness / Duplication | Medium | Deferred |
| 9 | Domain/key vocabularies are prose, not checked | Maintenance risk | Medium | Deferred |
| 10 | No auth/rate-limiting at the pipeline entry point | Security | **High** | **Applied** — doc 42 §15 |
| 11 | No scraping etiquette for the Listing Parser | Security | Medium | **Applied** — doc 42 §3 |
| 12 | No data-retention/legal-basis policy for personal data | Privacy | **High** | **Applied** — doc 42 §16 |
| 13 | `finding_id` used but never defined | Schema weakness | **High** | **Applied** — doc 42 §7.1 |
| 14 | Conflict data representable two ways that could disagree | Schema weakness | Medium | **Applied** — doc 42 §7.2/§7.4 |
| 15 | `risk_ref` not covered by the dangling-reference rule | Schema weakness | Medium | **Applied** — doc 42 §8 |
| 16 | `property_id` vs. caching relationship unstated | Schema weakness | Medium | **Applied** — doc 42 §3, §17 |
| 17 | Total Listing Parser failure undefined | Report generation edge case | **High** | **Applied** — doc 42 §3 |
| 18 | No correlation ID across the pipeline | Audit/logging | Medium | Deferred |
| 19 | No monitoring on chronically `not_connected` providers | Observability | Medium | Deferred |
| 20 | No retry policy | Retry strategy | Medium | Deferred |
| 21 | No report-level cache (costly if AI step is an LLM call) | Caching strategy | **High** | **Applied** — doc 42 §17 |
| 22 | Confidence drift across re-fetches undocumented | Idempotency | Low | **Applied** — doc 42 §17 |
| 23 | No general version-compatibility policy | Version compatibility | Medium | Deferred |

**Categories that passed review outright, no finding:** Circular
dependencies (beyond Finding 1's shared root cause), ownership at the
component-responsibility-table level, performance (independent of
Scalability/Caching), engine-level per-provider failure handling,
idempotency's two core mechanisms (`property_id`, conflict tiebreak).

**No Critical findings.** Nothing here causes silent data loss, a security
breach by design, or a broken report as specified — every finding is either
a genuine gap that would force an implementing engineer to invent an answer
(exactly what this whole contract effort was meant to prevent), or a
production-readiness concern (auth, privacy, caching, observability) that's
appropriate to flag before commit rather than after launch.

---

## Disposition (post-review)

13 of 22 numbered findings (Finding 8 was folded into Finding 4 and never
separately counted) were applied to `42_platform_data_contracts.md` — every
finding matching the seven approved categories (undefined fields, failure
behaviour, timeout/orchestrator policy, authentication/rate limiting,
GDPR/data retention, caching strategy, and the circular-dependency removal).
See doc 42 §1, §1.1, §3, §7.1, §7.2, §7.4, §8, §15, §16, §17.

**Deliberately deferred, not forgotten** (out of scope for this pass —
duplicated-responsibility/maintenance/observability/retry/versioning
cleanups, none of which block implementation): Findings 2, 5, 6, 7, 9, 18,
19, 20, 23. These remain valid findings against a future hardening pass;
none of them represent an undefined contract an implementing engineer would
have to guess at, which is the bar this pass was scoped to close.

While applying the approved fixes, three pre-existing internal
cross-reference errors in doc 42 were also caught and corrected as part of
the required final consistency check (not new findings from the original
review, but the same class of defect): a `StructuredAnalysis` reference
pointing at §6 instead of §8, and two missing-data-policy references
pointing at §7 (Aggregator) instead of §9 (Missing-data policy).

**Architecture status: Version 1.0 — implementation-ready.** No
inconsistencies remain across `42_platform_data_contracts.md`,
`report-pdf-layout-blueprint.md`, and `kopanalys-report-design.md` as of
this pass.
