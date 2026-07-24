# 37 — Köpanalys Platform Architecture

**Date:** 2026-07-20 · **Status:** architecture design only — no code, no APIs, no plugins built.
**Role:** Chief Platform Architect sprint. Successor to `docs/36_location_intelligence_engine.md` (research phase).

---

## 0. Executive summary

Köpanalys is not a single application. It is an **ecosystem of independent
intelligence engines**, each with one responsibility, each ignorant of every
other engine, each emitting a uniformly-shaped **Intelligence Package**. A
thin Orchestrator fans an address out to the engines in parallel; an
Intelligence Aggregator validates, merges, deduplicates, conflict-resolves,
and traces their packages into one **Master Intelligence Package (MIP)**;
the AI Analysis Engine reasons over the MIP — and *only* the MIP — to
produce a Decision Report.

```
Property Address
      ↓
 Orchestrator ──────────────────────────────┐
      ↓ (parallel fan-out)                  │ run manifest, budgets,
 ┌────────┬─────────┬────────┬─────────┐    │ cache policy, timeouts
 Location  Crime     BRF      Price  … N    │
 Engine    Engine    Engine   Engine        │
 └───┬────┴────┬────┴───┬────┴────┬────┘    │
     ↓         ↓        ↓         ↓         │
 Intelligence Packages (one per engine)     │
      ↓                                     │
 Intelligence Aggregator ←──────────────────┘
      ↓
 Master Intelligence Package (MIP)
      ↓
 AI Analysis Engine  (reasons only — never fetches)
      ↓
 Report Generator → Decision Report
```

This design is not invented from zero. It **generalizes patterns this
codebase already earned**:

| Existing pattern | Where | Becomes |
|---|---|---|
| `DataProvider` interface — one module per source, independent try/except, honest `not_connected` | `docs/28` | The *internal* structure of every engine's plugins |
| Analyzer registry — id/weight/`analyze(ctx)`, count-agnostic orchestrator, `null` score over guessed score | `docs/27` | The engine registry + the "honest absence" rule platform-wide |
| generate→enrich→score→rank + confidence bands (High/Medium/Low/Conflicting) | `docs/29` | Aggregator conflict resolution + package confidence |
| Trust tiers (REGISTRY_AUTHORITY → MANAGER_PORTAL → DIRECTORY → USER) | `docs/34`/`35` | Evidence-priority order during merge |

---

## Task 1 — Layer responsibilities

### 1.1 Orchestrator

The Orchestrator is a **traffic controller, not a brain**. It:

- Accepts one canonical input: a resolved address (geocoded once, up
  front — engines receive coordinates + address identity, they never
  geocode independently, or 25 engines produce 25 disagreeing geocodes).
- Builds a **run manifest**: which engines run, with what timeout, what
  cache policy, what cost budget. The manifest is data, not code — adding
  an engine changes the manifest, never the Orchestrator.
- Fans out to all selected engines **in parallel**, collects packages as
  they complete, and enforces per-engine deadlines.
- Records the run: engine started/finished/failed/timed-out/skipped-cached,
  and hands the package set plus the run record to the Aggregator.

The Orchestrator explicitly does **not**: interpret data, merge data,
score anything, know what "crime" or "BRF" means, or contain any
per-engine logic beyond the manifest entry. If the Orchestrator ever
needs an `if engine == "crime"` branch, the design has been violated.

### 1.2 Intelligence Engines

An engine is an **independent expert with one domain and no colleagues**.

- **One responsibility.** The Crime Engine knows crime. It does not know
  prices exist. Doc 27's analyzer discipline, promoted a level up.
- **One uniform input**: the canonical address context (identity,
  coordinates, kommun/län codes, run parameters).
- **One uniform output**: an Intelligence Package (Task 2). Always — on
  success, partial success, and failure. A failed engine returns an empty
  package with an honest status, never nothing, never fabricated data.
- **Internally plugin-based**: inside an engine, each *source* is a
  `DataProvider`-style plugin (doc 28/36). The Location Engine has
  `plugins/planning/`, `plugins/news/`, etc.; the platform never sees
  below the engine boundary. Two-level modularity: platform → engines,
  engine → source plugins.
- **Stateless per run** from the platform's view. Engines may own private
  caches/registries (e.g. the BRF Engine's registry, doc 34), but the
  platform contract is: address in, package out, no shared mutable state.

### 1.3 Intelligence Aggregator

The **only component that sees everything**, and therefore the only place
where cross-engine concerns are legal: validation, merge, dedup, conflict
resolution, traceability, confidence calculus (Task 3). It is mechanical
and deterministic — same packages in, same MIP out. No LLM calls, no
creativity, no fetching.

### 1.4 AI Analysis Engine

The **only reasoning layer**. It receives the MIP and nothing else (Task 4).
It weighs evidence, connects cross-domain signals ("planned metro station
+ rising bygglov activity + stable BRF debt = appreciation thesis"),
surfaces what a buyer should worry about, and states uncertainty honestly
using the confidence data the Aggregator computed. It never calls an API,
never fetches, never patches gaps by "knowing" things — a gap in the MIP
is reported as a gap.

### 1.5 Report Generator

Presentation only. Takes the AI's structured analysis and renders the
Decision Report (web report today; PDF, email, API response tomorrow).
Owns formatting, layout, language, disclaimers, and the traceability
footnotes ("source: Polisen händelser, fetched 2026-07-19"). Contains
zero analysis logic — if the Report Generator computes anything beyond
formatting, that logic is in the wrong layer.

---

## Task 2 — The Intelligence Package (philosophy, not JSON)

Every engine returns the **same envelope around different contents**. The
envelope is the platform's contract; the contents are the engine's domain.

**Philosophy:**

1. **Envelope uniformity buys ignorance.** Because every package has the
   same shape, the Orchestrator, Aggregator, storage, and observability
   layers handle N engines with zero per-engine code. Uniformity is what
   makes "no engine knows about any other engine" *cheap* instead of
   heroic.

2. **A package is a witness statement, not a verdict.** An engine reports
   *evidence from its domain* — findings, each carrying its source, trust
   tier, fetch time, and confidence. It does not say "buy" or "don't buy";
   it says "here is what my domain knows about this address." Judgment is
   the AI layer's monopoly.

3. **Every finding is traceable or it doesn't exist.** Each claim carries
   its provenance: which source, which plugin, when fetched, what trust
   tier (doc 34's REGISTRY_AUTHORITY→USER ladder). A number with no
   source is not intelligence, it's rumor — the Aggregator rejects it.

4. **Honest absence over fabricated presence.** Doc 27's `null`-score rule
   and doc 28's `not_connected` rule, made a platform law: a package says
   "no data" when there is no data. Empty is a valid, first-class result.
   The confidence machinery *depends* on absence being trustworthy.

5. **Self-describing quality.** A package carries its own metadata: engine
   version, per-source freshness, coverage notes ("Polisen feed covers
   polisregion, not per-address"), and the engine's own confidence
   self-assessment. The Aggregator audits this; it doesn't guess it.

6. **Domain-scoped, no trespassing.** The Crime Engine never includes a
   price observation "because it saw one." Overlap is resolved by the
   Aggregator, not prevented by engines coordinating — engines coordinating
   is exactly the coupling this architecture exists to forbid.

So: **Location Engine → Location Intelligence Package; Crime Engine →
Crime Intelligence Package; BRF Engine → BRF Intelligence Package; Price
Engine → Price Intelligence Package** — four different bodies of evidence,
one identical envelope, one identical set of quality guarantees.

---

## Task 3 — The Intelligence Aggregator, step by step

**Step 1 — Collect.** Receive every package the Orchestrator gathered,
including empty/failed ones, plus the run record. Missing engines are
recorded as absent — absence must be visible downstream, not papered over.

**Step 2 — Validate.** Mechanical admission control per package: envelope
shape correct; every finding has source + timestamp + trust tier;
freshness within the source's declared tolerance; values in sane domains.
Invalid *findings* are quarantined (logged, excluded, reported), not
silently dropped, and one bad finding never discards the whole package.

**Step 3 — Merge compatible information.** Findings that describe the
same real-world fact from different engines are grouped by (subject,
attribute, time-relevance). Compatible observations reinforce each other
and merge into one enriched fact carrying *all* contributing sources —
agreement across independent sources is itself signal and raises
confidence.

**Step 4 — Deduplicate.** The same underlying record often arrives twice
(the Location Engine's news plugin and a future News Engine both catch
the same kommun press release; OSM appears inside several engines).
Dedup keys on the *underlying source record*, not the reporting engine.
One fact, many witnesses — witnesses noted, fact stated once.

**Step 5 — Resolve conflicts.** When findings disagree (Booli says 62 m²,
kommun record says 58 m²), apply doc 29/34's earned machinery, in order:
(a) **trust tier** — registry-authority beats directory beats user-supplied;
(b) **freshness** — newer beats older within a tier;
(c) **specificity** — per-address beats per-area beats per-kommun.
If still unresolved, **keep the conflict**, marked `Conflicting` (doc 29's
fourth band), with both values and both provenances. A visible conflict
is information; a silently picked winner is a lie with good posture.

**Step 6 — Preserve traceability.** Every fact in the MIP keeps its full
chain: source → plugin → engine → merge/conflict decisions applied. This
is what lets the final report print footnotes, lets debugging answer
"why does the report say X," and lets a source retraction be traced
forward to every affected analysis.

**Step 7 — Calculate confidence.** Two levels: per-fact (from trust tier,
freshness, source agreement count, and the engine's self-assessment) and
per-domain (coverage-weighted roll-up: "crime picture: Medium — regional
statistics only, no per-address granularity"). Output uses doc 29's bands
(High/Medium/Low/Conflicting) so every downstream consumer speaks one
confidence language.

**Step 8 — Prepare the MIP.** Assemble validated, merged, deduplicated,
conflict-annotated, confidence-scored facts into one package organized by
domain, with a global quality summary (which engines contributed, which
failed, overall freshness, weakest domains). Deterministic: same inputs,
same MIP, byte-for-byte — which makes the Aggregator fully testable
without any live source.

---

## Task 4 — The Master Intelligence Package, and why the AI only reads

The MIP is the **complete, frozen, self-contained evidence file** for one
address at one moment: every surviving fact with provenance and
confidence, every conflict with both sides, every gap explicitly named,
plus the run-quality summary. The AI receives the MIP and nothing else.
**The AI never calls APIs. The AI never fetches data.** Why this is a
load-bearing law and not a style preference:

1. **Determinism and auditability.** MIP + prompt version → reproducible
   analysis. When a customer challenges a report, we replay the exact
   evidence the AI saw. An AI that fetched mid-reasoning saw a world we
   can never reconstruct.
2. **Hallucination containment.** The AI's job is constrained to
   *interpreting listed evidence*. Every claim in the report must trace to
   a MIP fact. "Reason over this file" is checkable; "go find out about
   this address" is not.
3. **Separation of *truth* from *judgment*.** What is true (Aggregator,
   deterministic, testable) is firewalled from what it means (AI,
   probabilistic). Data bugs and reasoning bugs never hide inside each
   other.
4. **Cost and latency control.** Fetching lives in cacheable, budgeted,
   parallel engines. AI calls are expensive and sequential — letting the
   AI trigger I/O makes cost and latency unboundable.
5. **Security and blast radius.** The AI layer holds zero source
   credentials and has zero network reach. A prompt-injection attempt in
   scraped content can, at worst, distort interpretation of one file — it
   cannot exfiltrate keys or trigger fetches.
6. **Swappability both directions.** Any model can be evaluated on a
   frozen MIP corpus (regression-test the reasoning layer like the
   betting project regression-tested models); any engine change is
   invisible to the AI as long as the MIP contract holds.
7. **Honest uncertainty.** The MIP names its gaps and confidence bands,
   so the AI can say "no BRF financials were available" instead of
   improvising from training-data priors about "typical" Swedish BRFs —
   the platform version of doc 27's `null`-over-guess rule.

---

## Task 5 — Communication rules

**Engines never talk to each other. Ever.** No engine imports, calls,
reads the output of, or knows the existence of another engine. All
communication is vertical (Orchestrator → engine → Aggregator), never
horizontal. If engine B seems to need engine A's output, either that data
belongs in the canonical address context (like geocoding — computed once,
upstream), or B is mis-scoped, or the need is really a cross-domain
inference that belongs in the AI layer.

**Failure handling — degrade, never abort:**

- An engine failure yields an empty package with an honest failure
  status; the run continues. **Reports can always be generated** — the
  MIP marks the domain absent, the AI names the gap, the report's
  confidence reflects it. A missing Crime Engine weakens the crime
  section; it does not take down Köpanalys.
- Timeouts are failures with a budget: the Orchestrator enforces
  per-engine deadlines and moves on. One slow kommun website must never
  hold the whole analysis hostage.
- Inside an engine, the same rule recurses: doc 28's per-provider
  try/except means one dead source degrades one engine's coverage, not
  the engine.
- **Stale-if-error:** if an engine fails but a previously cached package
  exists within its validity window, the Orchestrator may serve it,
  visibly marked stale. Old-but-honest beats absent.

**Synchronous or asynchronous?** Engines run **concurrently** within a
bounded request (fan-out/fan-in with a deadline) — the user experience
stays "request → report." Long-running work (BRF registry building,
kommun-diarium crawls, news indexing) runs as **background pipelines
inside the owning engine**, so engine runtime at request time is mostly
cache/registry reads, and slow scraping never sits on the request path.

**Retries:** yes, but bounded and layered. Source plugins retry transient
errors a small number of times with backoff (respectfully — these are
mostly free public services; doc 28's posture). The Orchestrator does
*not* re-retry a failed engine within a run (double-retry storms), but
may schedule a background refresh so the *next* analysis benefits.

---

## Task 6 — Orchestration strategy

**Start simultaneously?** Yes — all manifest-selected engines launch in
parallel at t=0. With no inter-engine dependencies, total latency ≈
slowest engine, not the sum.

**Dependencies?** Only the shared **address-resolution pre-stage**
(geocode, kommun/län codes, property/BRF identity candidates) which runs
before fan-out and is part of the platform, not an engine. Zero
engine→engine dependencies by design. If a genuine one ever appears, the
answer is to promote the shared datum into the pre-stage context — never
to let engines chain.

**Independent caching?** Essential, and per-engine because refresh
economics differ wildly (doc 36's per-source cadence analysis):

| Engine (examples) | Sensible package TTL | Why |
|---|---|---|
| Location/planning | ~weeks | plans move slowly |
| Crime | ~days–weekly | feeds are rolling |
| Price/listings | hours–days | market moves |
| BRF financials | ~annual + event-driven | annual reports |
| News | ~hours | news is news |

Cache key: (address identity, engine, engine version). Every cached
package is served with visible freshness — the MIP always shows data age.

**Incremental runs?** Yes — this is the payoff of per-engine caching. A
re-analysis re-runs only expired/failed engines and reuses fresh
packages; the Aggregator can't tell and doesn't care. Also enables
**partial re-aggregation**: when one engine refreshes, rebuild the MIP
from 1 new + N cached packages instead of re-running the world.

**Skipping expensive engines?** Yes, three legitimate mechanisms, all
manifest-driven: (a) product tiering — a quick free look runs 5 cheap
engines, the full report runs all; (b) cost budgets — the Orchestrator
skips over-budget engines, and the MIP/report say so ("BRF deep analysis
not included in this run"); (c) progressive delivery — serve a report
from fast engines, upgrade it when slow engines land. A skipped engine is
always *visibly* skipped — indistinguishable-from-missing is forbidden.

---

## Task 7 — Scalability: 10 → 25 → 50 → 100 engines

The **contracts** (package envelope, engine interface, MIP) are designed
to never change across this growth. What evolves is infrastructure
around them:

**~10 engines (now → near future).** Everything in one process; the
Orchestrator is a parallel fan-out; the registry is a manifest file;
caching is the existing store (Supabase/Postgres). Doc 27's registry
pattern at engine scale. Build nothing speculative beyond the contracts —
the contracts are cheap now and near-impossible to retrofit later.

**~25 engines.** Process isolation starts to pay: engines become
separately deployable workers behind a queue ("analyze address X" →
per-engine tasks → packages to a collection point). Per-engine caching
becomes mandatory. Observability (Task 8) becomes load-bearing. The
engine registry gains metadata: owner, cost class, SLA, default TTL.
Because engines never talked to each other, moving them out of process
changes *where they run*, not *how anything works* — that is the
dividend of the horizontal-communication ban.

**~50 engines.** Engine *tiering* in the manifest (core always-run /
standard default / premium on-demand). Fleet heterogeneity is normal
(scrapers, GIS/WFS services, registries) — fine, because only the
package contract is shared, not the tech stack. Contract testing becomes
the backbone: a shared conformance suite every engine must pass
(envelope validity, honest-failure behavior, timeout behavior) replaces
integration-testing all pairs — pairs don't exist here.

**~100 engines.** The platform is internal infrastructure with a control
plane: dynamic engine registry (register/deprecate/version without
platform deploys), fleet-wide budget and freshness management, canary
runs for engine upgrades (shadow-run v2, diff its packages against v1
on a reference address corpus before promotion). Aggregator sharding by
domain group if MIP assembly grows heavy — legal because aggregation is
deterministic and associative by design.

**The invariant across all four stages:** an engine written at stage 1
still runs unmodified at stage 4, because it only ever knew "address
context in, package out." Scaling changes the *harness*, never the
*engines*.

---

## Task 8 — Observability

Built around one spine: the **run record**. Every analysis has a run ID;
every engine invocation, package, aggregation decision, and AI call links
to it.

- **Which engine failed?** Per-engine terminal status per run (success /
  partial / failed / timeout / skipped-cached / skipped-budget), queryable
  fleet-wide: "BRF Engine: 12% failure rate this week, started Tuesday."
- **Which source was slow?** Engines report per-plugin timing inside
  package metadata (doc 28's per-provider structure gives this for free).
  Platform sees engine-level latency; engine metadata explains it:
  "Location Engine p95 41 s → kommun-diarium plugin, one municipality's
  site degraded."
- **Which package contains errors?** The Aggregator's validation
  quarantine *is* the error feed: every rejected finding logged with
  reason, package, plugin, run ID. Trend per engine — a rising quarantine
  rate is an early warning that a source changed its format *before*
  customers see wrong reports.
- **How long did each engine take?** Duration is package metadata,
  always. Dashboards: p50/p95/p99 per engine over time, cache-hit share,
  cost per run, budget-driven skip counts.
- **How fresh is every package?** Freshness is *in the data*, not in a
  side channel: every finding carries fetch time, every package carries
  age, the MIP carries a freshness summary, and the report can print it.
  Fleet-level freshness dashboards fall out of the same fields.
- **Cross-layer tracing:** because the MIP preserves full provenance
  chains (Task 3, step 6), any sentence in a customer report is
  traceable backwards — report claim → MIP fact → package → plugin →
  source fetch → timestamp. That closes the loop from "customer question"
  to "root cause" without archaeology.
- **Synthetic canaries:** a small fixed address corpus analyzed on a
  schedule; alert on engine failures, package-size collapse (a scraper
  silently returning nothing is worse than one that errors), confidence
  drift, and freshness decay.

---

## Task 9 — Future extensibility

The two-years-later test: Insurance, School Rating, Investment, Climate,
Noise Prediction, and Political Decision Engines should cost **almost
zero platform changes**. How each platform property pays for that:

1. **Uniform package envelope** → the Aggregator, storage, observability,
   and MIP assembly have no per-engine code. A new engine is new
   *content* in a known *shape*. Platform diff: one manifest/registry
   entry (name, owner, cost class, TTL, tier).
2. **No horizontal communication** → engine #51 cannot break engines
   1–50, because nothing connects them. The Political Decision Engine
   needing kommun documents that the Location Engine also reads is fine —
   overlap is the Aggregator's dedup problem (already solved once,
   generically), not a coordination problem.
3. **Domain-agnostic aggregation** → merge/dedup/conflict/confidence
   operate on provenance, trust tier, freshness, and specificity — never
   on domain semantics. Noise-prediction findings are handled by rules
   written years before noise prediction existed.
4. **MIP-only AI** → new domains appear to the AI as new evidence
   sections with the same confidence vocabulary. Prompt/config updated to
   *use* the new domain well; reasoning machinery untouched.
5. **Conformance suite as the gate** → "may this engine join the fleet?"
   is answered by the contract tests (envelope validity, honest failure,
   timeout compliance, provenance completeness), not by a human reading
   its internals. That keeps engine quality decentralized and platform
   trust centralized.
6. **Engines own their internals** → the Noise Prediction Engine can run
   ML models; the Political Decision Engine can parse kommunfullmäktige
   PDFs (doc 36's research); the Climate Engine can read MSB WMS layers.
   The platform doesn't know and doesn't care — tech-stack freedom inside
   the boundary is what keeps the boundary stable for decades.

The honest caveat: "almost zero changes" holds for the *platform*. The
*AI layer's* prompts and the *report's* layout will evolve with new
domains — that's content evolution, not architecture change, and the
layering confines it to exactly those two places.

---

## Task 10 — Challenging the architecture

**Single points of failure.**
- *Address-resolution pre-stage.* If geocoding/identity fails, no engine
  can run. Mitigations: multiple geocoding providers behind one interface
  (Nominatim + Photon are already in the stack, docs 28/30), aggressive
  caching of resolved addresses (addresses don't move), degraded
  coordinates-only mode.
- *Aggregator.* All value flows through it. Acceptable *logical*
  centralization — but it must stay deterministic and stateless-per-run so
  it can scale horizontally and be trivially retried. The moment someone
  adds hidden state or nondeterminism there, it becomes the platform's
  weakest point. Guard with golden-master tests (fixed packages in,
  byte-identical MIP out).
- *AI provider.* One vendor outage kills report generation (packages
  still collect — analysis stalls). Mitigations: MIP-corpus regression
  tests make an alternate model swappable; "evidence-only report"
  (structured MIP rendered without narrative) as an honest degraded mode.

**Performance bottlenecks.**
- *Slowest-engine latency.* Fan-out latency = max(engines). Mitigations
  already designed in: hard deadlines, stale-if-error, progressive
  delivery, background pipelines keeping request-path work to
  cache/registry reads. Watch p95 per engine (Task 8) and demote
  chronically slow engines to background-only refresh.
- *MIP size growth.* At 100 engines the MIP could exceed model context
  windows and inflate cost. Plan the mitigation *now* as contract, not
  retrofit: findings carry a salience/summary discipline so the MIP has a
  layered form (summary tier + full-evidence tier); the AI reads
  summaries and drills into full evidence per domain when warranted.
  This is the single most likely future contract amendment — version the
  MIP format from day one.
- *Aggregator merge cost.* O(findings²)-ish matching if implemented
  naively. Keep grouping keyed (subject/attribute indexing) — a known
  solved problem, but only if treated as one from the start.

**Maintenance risks.**
- *Scraper rot is the #1 ongoing cost.* Doc 36 catalogs ~35 sources;
  kommun sites and news pages change silently. The quarantine-rate and
  package-size-collapse alarms (Task 8) exist precisely for this. Staff
  reality: expect a permanent background budget of source-repair work;
  prefer API/WFS/RSS sources over HTML scraping wherever doc 36 found
  them, and treat every HTML scraper as a liability with an owner.
- *Contract drift.* The package envelope will feel "too tight" to some
  future engine author; ad-hoc extensions would slowly kill uniformity.
  Governance: envelope changes are versioned platform RFCs; the
  conformance suite enforces the current version mechanically.
- *290-kommun adapters.* The largest maintenance surface in the whole
  vision (doc 36 §2.1). Contain it: it lives inside *one* engine's plugin
  layer, is tiered (top-N kommuner by analysis volume first), and is
  never allowed to leak complexity above the engine boundary.

**Overengineering — what NOT to build yet.**
- No queues, no microservices, no control plane at ~10 engines. In-process
  parallel fan-out is honest and sufficient; the Task 7 ladder says when
  each upgrade *earns* itself.
- No universal ontology of all real-estate knowledge. The MIP organizes by
  domain with a thin shared fact structure; a grand unified schema is a
  tar pit. Let the shared structure grow from real merge collisions, not
  from anticipation.
- No engine marketplace/dynamic registration until there are external
  engine authors. A manifest file in the repo is the right registry for
  years.
- The Orchestrator must stay boring. Every tempting "smart" feature
  (adaptive scheduling, learned budgets) should be rejected until the
  boring version measurably fails.

**Hidden complexity — where it actually lives.**
- *Address identity.* "One address" is fiction: apartment vs building vs
  fastighet vs BRF; nearby-but-different coordinates; kommun spelling
  variants. The pre-stage owns this and it is *hard* — it deserves its
  own design doc before implementation (successor to doc 26's extraction
  work).
- *Time semantics.* "Planned metro 2030" vs "crime stats 2024" vs
  "listing price today" — facts have validity windows, not just fetch
  times. The envelope must distinguish observation time from validity
  period, or the AI will reason over silently mixed timeframes.
- *Conflict-resolution edge cases.* Trust-tier + freshness + specificity
  sounds clean; reality will produce ties and judgment calls. Keep the
  `Conflicting` band generous — when in doubt, *show* the conflict. The
  failure mode to fear is silent wrong winners, not visible ambiguity.

**Future migration risks.**
- *MIP format lock-in.* Reports, caches, and test corpora will all speak
  MIP. Version the format from the first byte; store packages with their
  format version; keep Aggregator-side up-converters for one version back.
- *AI-context economics.* Model context/pricing will change repeatedly
  over a decades-scale platform; the layered-MIP mitigation above is also
  the migration hedge — summary tier stays small regardless of fleet size.
- *Storage growth.* Millions of analyses × N packages × full provenance
  is real volume. Decide retention policy early (e.g. full MIP retained
  per delivered report for auditability; intermediate packages
  compacted/expired on TTL), so the traceability promise stays affordable.

**Improvements adopted into the design** (already reflected above):
stale-if-error caching; progressive report delivery; layered
(summary/full) MIP with versioning from day one; golden-master
determinism tests for the Aggregator; conformance suite as the engine
admission gate; canary corpus with package-size-collapse alarms; explicit
observation-time vs validity-window semantics in the envelope.

---

## Closing: build order for the platform skeleton (not code — sequencing)

1. **Contracts first**: package envelope + MIP format (versioned), the
   engine conformance rules, and the address-context definition. These
   are the decades-scale artifacts; everything else is replaceable.
2. **Aggregator second**: deterministic, fully testable with synthetic
   packages before any real engine exists.
3. **Two real engines third** (Location — doc 36's roadmap; BRF — docs
   34/35): the minimum number that makes merge/dedup/conflict real.
4. **Orchestrator + caching fourth**: trivial once engines exist.
5. **AI layer + Report Generator last**, against frozen MIP fixtures, so
   the reasoning layer is regression-testable from its first day.
