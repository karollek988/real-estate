# Guiding Principles (Vision Refinement)

**Date:** 2026-07-16 · **Type:** Standing decision framework — agreed after review of [[23_vision_review]]

These six principles govern all architectural, UX, and implementation decisions going forward. When principles conflict in a specific decision, the tie-breaker is stated at the end.

## 1. Identity: decision-support, complementary

Bostadsradar is a decision-support platform. Booli provides excellent property data and valuations — we do not replace or compete with it. Our job is helping buyers understand what that information *means* and make better decisions. Referencing trusted external sources (including Booli) is encouraged; transparency builds trust.

## 2. The feature filter

Every feature must answer **"does this help a buyer make a better decision?"** If no, it is not a priority. We build explanations, insights, recommendations, and confidence — not dashboards full of numbers.

*Practical test for any report section or UI element: does it end in a conclusion a buyer can act on, or does it just display data? The latter gets cut or demoted.*

## 3. Modular data architecture

Some datasets are hard or impossible to access today (notably bostadsrätt sold-price comparables — see [[19_feasibility_report]]). **Do not design the system around unavailable data.** Design the report engine so new data sources plug in later.

Practical implications for the eventual build:
- Each data source is an independent module/adapter behind a common interface; the report engine consumes normalized "findings," not raw source formats.
- Report sections declare their data dependencies and degrade honestly (confidence label, "not available") when a source is missing — the Confidence mechanism from [[17_scoring_framework]] is the designed-in absorber for this.
- Adding Tier 3 data (licensed comps) later must be a new adapter + an upgraded price section, not a rewrite.

## 4. AI explains, never just scores

Users pay because we explain: why something matters, what the risks are, what opportunities exist, what actions to consider. Every report should read like advice from an experienced analyst — grounded in cited data, never a black-box number. (Consistent with the "show our reasoning" commitment in [[11_product_positioning]].)

## 5. Property Inspection Assistant: personalized or not at all

One of our strongest future premium features — but it must never be a generic checklist. Every checklist is personalized from available property data: questions derived from the BRF's financial report, planned renovations, energy performance, maintenance risks, hidden costs, and documents to request. Each checklist should feel unique to its property. (This adopts the grounding condition from [[23_vision_review]] §4.)

## 6. Revenue before scale — the top priority

The objective is an MVP people are willing to pay for. Every implementation moves us toward **launch → traffic → paying customers**. Subscriptions, investor tools, and advanced monitoring stay in the long-term vision and must not distract from the first profitable version.

## Tie-breaker

**When in doubt, choose the solution that helps us launch sooner while still leaving room to expand later.** Speed to launch wins over completeness; extensibility (per §3) is how "room to expand" is preserved without building the expansion now.
