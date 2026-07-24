# Real-Estate Platform — Architecture & Roadmap

**Date:** 2026-07-13 · **Status:** skeleton; no implementation yet

## What we are building (eventually)

An intelligence product for property buyers/investors in Sweden
(Stockholm first): valuation, BRF financial-health scoring, mispricing
signals, negotiation context, and infrastructure-driven future-value
analysis. Product form follows the betting project's Sprint 47–55 arc:
**decision intelligence with explanations, not oracle point estimates.**

## Architecture

```
external sources          real_estate package                     delivery
─────────────────         ─────────────────────────────────       ────────
Booli API      ─┐         data/       raw acquisition + storage   api/ (FastAPI,
SCB PxWeb       ├──────▶  features/   listing-time features   ─▶  mirrors betting)
Lantmäteriet    │         valuation/  targets + models            frontend/
Bolagsverket    │                     (probability_engine!)
Trafiklab etc. ─┘         services/   reports, explanations, DTOs
```

Principles carried over from the betting project (they were earned, not
guessed — see the betting docs):

1. **Data-leakage discipline**: a feature available "at listing time" may
   contain nothing from at/after the sale. Same rule, new domain.
2. **Provider-swappable data clients**: every external source sits behind
   an interface in `data/`, because the riskiest sources (Booli) are
   revocable free tiers (see `data-sources.md`, risk #1).
3. **Models come from `probability_engine`** — the shared engine's
   `Model` ABC, registry, scoring and significance tests. This project
   contributes *features and targets*, never modeling machinery.
4. **Pre-registered decision gates**: before each validation experiment,
   fix the thresholds that mean continue/stop (the betting project's
   Sprint 5 discipline).
5. **Determinism and versioned artifacts** via the engine's persistence.

### How the engine maps onto valuation

The engine models *discrete-outcome probabilities*, so targets are framed
accordingly, e.g.:

- price band vs area median: `("well_below", "below", "at", "above", "well_above")`
- mispricing: `("underpriced", "fair", "overpriced")` with probability-
  weighted expected value, exactly like the betting EV layer
- sale premium vs asking: banded final/asking ratio

Continuous price regression, if ever needed, is a *new engine capability*
to discuss for engine v0.2+ — not something to bolt on inside this project.

## Development roadmap

Phased, each with an explicit gate; numbers continue the repo's sprint
convention.

**Phase 0 — Data verification (before any product code)**
- 0.1 Obtain Booli API key; measure real coverage/limits vs `data-sources.md`.
- 0.2 Prototype Bolagsverket annual-report fetch for 10 Stockholm BRFs;
      confirm the financials we need are parseable.
- 0.3 Pull SCB/Kolada/Trafiklab samples for one district.
- **Gate:** enough sold-price volume for a first backtest? (Power analysis
  first, like the betting scale-plan did.)

**Phase 1 — First honest backtest (fastest path, skip architecture gold-plating)**
- 1.1 Ingest one district's sold history; build 3–5 listing-time features.
- 1.2 Train engine softmax on a banded target; walk-forward by sale date.
- 1.3 Compare against the naive baseline (area price/m² median).
- **Gate (pre-register):** model beats naive baseline at p < 0.05 → continue;
  else re-scope to BRF-health product only.

**Phase 2 — BRF financial-health scorer** (independent of Phase 1's outcome —
it needs no price model and is the clearest free-data differentiator)

**Phase 3 — Product layer**: valuation report + explanation engine
(mirror betting's `CustomerReportBuilder`/`ExplanationEngine` shape), then
`api/`, then frontend.

**Phase 4 — Commercial-data decision**: with Phase 1–3 evidence, decide
whether paid transaction data (Booli Pro / allabrf / Mäklarstatistik)
clears its pre-registered value bar.
