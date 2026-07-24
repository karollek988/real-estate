# Decision Engine

**Date:** 2026-07-16 · **Milestone:** core intelligence, priority #1 · **Status:** implemented, UI untouched

## What this milestone is (and isn't)

Goal: turn collected property facts into structured, explained judgments —
not just display raw values. This replaces the old placeholder scoring
logic in `buildAnalysis.ts` with a real, modular Decision Engine. It is
**not** the AI report (a future milestone) — this engine produces the
structured `decisionFactors` that report will eventually narrate.

No UI changes: `report/page.tsx` was not touched. It still reads
`AnalysisReport.insights` (`{label, value, tone, pending}`) — the engine's
richer output is mapped onto that exact shape for the 6 existing cards.

```
Property Data (attributes + dataSources, from the extraction pipeline)
    ↓
Decision Engine (engine/decisionEngine.ts)
    ├── Price Analyzer              weight 0.25
    ├── Market Analyzer             weight 0.15
    ├── Housing Association Analyzer weight 0.15
    ├── Risk Analyzer               weight 0.15
    ├── Future Development Analyzer weight 0.10
    ├── Negotiation Analyzer        weight 0.10
    ├── Area Analyzer               weight 0.10
    └── Confidence Analyzer         meta, weight 0 (not in the score average)
    ↓
Decision Factors (DecisionFactorResult[] — score/confidence/status/
                   explanation/supportingData/missingData/weight, one per
                   analyzer, persisted in full on every analysis)
    ↓
Decision Score (confidence-weighted aggregate, see below)
    ↓
AI Report (future milestone — will narrate decisionFactors, not built yet)
```

## Code layout (`frontend/src/lib/analysis/engine/`)

| Module | Responsibility |
|---|---|
| `helpers.ts` | Shared: `numberOrNull`, `stringOrNull`, `clamp`, `formatSek`, `sourceOk`, `sourceLabel`, `insufficientDataFactor` (the standard "can't score this yet" return shape) |
| `analyzers/types.ts` | `Analyzer` interface (`id`, `label`, `weight`, `analyze(ctx)`), `AnalyzerContext` (`property`, `extracted`, merged `attributes`, `dataSources`) |
| `analyzers/price.ts` | Price Analyzer — real today (price/m² math once Booli connects) |
| `analyzers/area.ts` | Area Analyzer — two real confidence tiers (geocoded vs not) |
| `analyzers/housingAssociation.ts` | Housing Association Analyzer — two real tiers (BRF name known vs not) |
| `analyzers/market.ts`, `futureDevelopment.ts`, `negotiation.ts`, `risk.ts` | Honest single-state stubs today (no backing source connected yet) — see "Forward contracts" below |
| `analyzers/confidence.ts` | Confidence Analyzer (meta) — fully real, computed from `dataSources` + the other 7 factors' confidence |
| `analyzers/registry.ts` | The 7 substantive analyzers + documented weights (sum to 1.0) |
| `decisionEngine.ts` | Orchestrator: runs all 8, computes the weighted score, applies confidence-based shrinkage, picks a verdict |
| `buildAnalysis.ts` | Thin adapter: runs the engine, maps 6 factors onto `insights` (UI-unchanged), assembles `AnalysisReport` |

Adding an analyzer: implement `Analyzer` in its own module, add it to
`registry.ts` with a weight (rebalance the others to keep the sum at 1.0).
Nothing else changes — the orchestrator, the aggregation math, and the UI
adapter are all analyzer-count-agnostic.

## Each analyzer's contract

Per the milestone spec, every `DecisionFactorResult` has: `score` (0-100 or
`null`), `confidence` (0-1), `status` (short — fits the existing insight
card), `explanation` (a full sentence), `supportingData`, `missingData`,
`weight`. **`score` is `null`, never a guess, whenever there isn't enough
real data** — every analyzer in this codebase honors that; none of them
default to a "safe middle" number when data is missing.

## Why 5 of 7 substantive analyzers return "insufficient data" today

This milestone explicitly said **do not add more data providers**. Only 2
real providers exist (`nominatim_geocoding`, `booli_listing`), so most
analyzers' real backing sources (SCB, Bolagsverket, Trafikverket,
Riksbanken, ...) are still the placeholders from the previous milestone.
Rather than fabricate scoring depth the data can't support, each of those
analyzers:

1. Checks for a real signal it *could* use today (e.g. Housing
   Association checks for a BRF name from Booli — real, but identity, not
   financial health) and reflects that in `confidence`/`explanation`
   without inventing a score from it.
2. Documents a **forward contract**: the specific `attributes.*` key a
   future provider should set to unlock real scoring, e.g. Price
   Analyzer's `area_median_price_per_m2_sek`, Market's
   `market_price_index_trend_pct`, Risk's `brf_debt_per_m2_sek` /
   `environmental_risk_score`, Future Development's
   `nearby_planned_projects`, Negotiation's `days_on_market` /
   `asking_price_change_pct`, Area's `area_price_trend_pct` /
   `area_population_growth_pct`. When a provider sets that key, the
   analyzer starts scoring automatically — no engine changes needed.

**Price Analyzer is the one with real depth today**: once Booli supplies
`asking_price_sek` + `living_area_m2`, it computes real price-per-m² —
verified in this session against a synthetic comparable
(`area_median_price_per_m2_sek`) to confirm the scoring branch produces
sensible output (8.3% below → score 92, "Excellent") ahead of any real
comparables provider existing. The delta→score curve (5 points per 1%) is
a documented, tunable design constant — the *aggregation* into an overall
score is what must be principled/non-arbitrary, and that's where the real
constraint applies (see below).

## Overall Decision Score — confidence-weighted, not arbitrary

Old engine (v0.2): hardcoded `MAX_SCORE_WITHOUT_MARKET_DATA = 60` cap.
New engine: a continuous function of measured confidence.

```
for each substantive factor with a score:
    effectiveWeight = factor.weight * factor.confidence
rawScore = Σ(score × effectiveWeight) / Σ(effectiveWeight)   [50 if nothing scoreable]

overallConfidence = ConfidenceAnalyzer.score / 100

finalScore = round(50 + (rawScore − 50) × overallConfidence)
```

An analyzer that's unsure sways the total less (confidence discounts its
weight); the whole result is then shrunk toward the neutral prior (50) in
proportion to how much of the full data picture actually exists. As real
providers connect, both `rawScore`'s inputs and `overallConfidence` rise
together, so the score is naturally allowed to diverge from neutral only
as fast as real evidence accumulates — the old cap did this in one
hardcoded step; this does it continuously and it's driven by the
Confidence Analyzer's real, computed number, not a constant.

Verified live (Dalagatan 30, no providers configured): score 50,
confidence 0.07, verdict "Requires a Closer Look", every insight card
correctly shows "No listing price"/"No BRF data"/etc — same honest
degraded state as before, now produced by real architecture instead of a
cap. Verified via direct engine invocation with a synthetic Booli + SCB
comparable: score correctly rises to 63 overall (92 for Price alone),
confidence 0.30 — confirms the shrinkage/lift behavior end-to-end.

## Confidence Analyzer (the 8th box)

Meta over the other 7 — it doesn't judge the property, it judges how much
of the picture we have: `0.5 × sourceCompleteness + 0.5 ×
avgFactorConfidence`. Its `weight` is 0 (it doesn't compete for score
share); its `score/100` directly drives the shrinkage above. Its
`missingData` lists every not-yet-connected source by name, making it the
single place a future "why is this score uncertain" UI panel could read
from.

## `AnalysisReport` additions (not rendered by the UI yet)

- `decisionFactors: DecisionFactorResult[]` — all 8, full detail, for the
  future AI report.
- `overallConfidence: number` — same value that drove the score shrinkage.

Both are stored on every analysis (`analyses.result` jsonb) but not read
by `report/page.tsx` — same pattern as the property-economics fields added
in the previous milestone (store now, render later, no UI redesign).

`ENGINE_VERSION` bumped 0.2.0 → 0.3.0 (scoring behavior changed).
