# Report Inputs

**Date:** 2026-07-13 · **Sprint:** 6

## Purpose

For every section of the report (as defined in [[16_executive_summary]]
and [[17_scoring_framework]]), list exactly what input data is required
to generate it. This is a checklist of raw inputs, not a design for how
they combine, how they're stored, or what they're worth. Algorithms,
weights, and database design are explicitly out of scope — see
[[17_scoring_framework]] for what each score means and
[[data-source-inventory.md]] for source-level detail behind the "Data
source" and "Access" columns below.

## How to read "Do we already have access?"

- **Yes** — source confirmed free/usable per `data-source-inventory.md`
  or `data-sources.md`, no open question blocking use.
- **Partial** — source exists and is directionally usable, but has a
  confirmed structural gap, coverage limit, or unverified license term
  that affects this specific input.
- **No** — no working source identified yet, or the only known source is
  legally/commercially blocked.

---

## 1. Recommendation banner

- **Input:** Price Score
  - **Why:** Recommendation is derived from the two component scores, not computed independently.
  - **Source:** Internal (Price Score, this report)
  - **Access:** N/A (derived, not raw input)
- **Input:** BRF Financial Health Score
  - **Why:** Second component the verdict is derived from.
  - **Source:** Internal (BRF Financial Health Score, this report)
  - **Access:** N/A (derived, not raw input)
- **Input:** Confidence Level
  - **Why:** Determines whether a hard data-quality flag forces "Avoid" regardless of the two scores above.
  - **Source:** Internal (Confidence Level, this report)
  - **Access:** N/A (derived, not raw input)
- **Input:** One-sentence rationale text (e.g. "Priced 4% under comparable sales, but BRF debt-per-m² is top quartile")
  - **Why:** Customer needs the "why" in under 60 seconds, not just the verdict.
  - **Source:** Generated from Price Score and BRF Score underlying figures
  - **Access:** N/A (generated)

## 2. Overall Property Score

- **Input:** Price Score
  - **Why:** One of the score's components.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)
- **Input:** BRF Financial Health Score
  - **Why:** One of the score's components.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)
- **Input:** Confidence Level
  - **Why:** Composite must reflect how much the underlying data can be trusted.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)

## 3. Fair price estimate vs. asking price

- **Input:** Asking price for the listing
  - **Why:** The number being evaluated; the entire section exists to contextualize it.
  - **Source:** Hemnet or Booli listing page
  - **Access:** Partial — Booli API confirmed accessible for object data; Hemnet is banned as a data source entirely, so if the customer pastes a Hemnet URL, the asking price must be entered manually or matched via Booli, not scraped.
- **Input:** Living area (m²)
  - **Why:** Needed to normalize comparable sales to a per-m² basis.
  - **Source:** Booli (listing attributes)
  - **Access:** Yes
- **Input:** Number of rooms
  - **Why:** Comparable-sale filtering criterion (a 1-room and a 4-room rarely belong in the same comparison set).
  - **Source:** Booli (listing attributes)
  - **Access:** Yes
- **Input:** Floor
  - **Why:** Comparable-sale filtering criterion; floor materially affects price within the same building/area.
  - **Source:** Booli (listing attributes)
  - **Access:** Yes
- **Input:** Building year
  - **Why:** Comparable-sale filtering criterion and a factor buyers weigh independently of price.
  - **Source:** Booli (listing attributes)
  - **Access:** Yes
- **Input:** Address / geographic location
  - **Why:** Needed to find comparable sales within a relevant radius.
  - **Source:** Booli / Lantmäteriet (geocoding)
  - **Access:** Yes
- **Input:** Comparable sold prices (slutpriser) for similar nearby apartments
  - **Why:** This is the entire basis for the fair-price range — without it there is no comparison to make.
  - **Source:** Booli (sold-price data)
  - **Access:** Partial — Booli's free tier caps volume and explicitly restricts competitive/commercial use; a commercial launch likely needs a paid agreement. Note also that Fastighetsprisregistret (Lantmäteriet) does **not** cover bostadsrätt sales at all, since a co-op sale is a share transfer, not a property transfer — Booli (or an equivalent commercial source) is the only realistic source for apartment sold prices.
- **Input:** Fair price range (low/high)
  - **Why:** The core output of this section; the asking price is plotted against it.
  - **Source:** Computed from comparable sold prices (not a separate raw input)
  - **Access:** N/A (derived)
- **Input:** Delta between asking price and fair range, as plain-language percentage
  - **Why:** This is the actual answer the customer wants ("am I overpaying?").
  - **Source:** Computed from asking price and fair price range
  - **Access:** N/A (derived)

## 4. Biggest strengths / Biggest risks

- **Input:** BRF annual report (årsredovisning) line items — debt, fees, maintenance plan, reserves
  - **Why:** Primary source of BRF-side strength/risk bullets (e.g. "no external loans," "high debt-per-m²").
  - **Source:** Bolagsverket (BRF filings)
  - **Access:** Yes — free, open, state-agency source; coverage rises over time and older/paper-filed reports are missing for some BRFs.
- **Input:** Price-comparison outcome (over/under fair range, and by how much)
  - **Why:** Primary source of price-side strength/risk bullets.
  - **Source:** Computed from Section 3 inputs
  - **Access:** N/A (derived)
- **Input:** Specific citation for each bullet (e.g. "BRF filing p.4," specific comparable address)
  - **Why:** Every bullet must point to a source per the design principle in [[16_executive_summary]] — no unsourced claims.
  - **Source:** Bolagsverket filing page reference / Booli comparable listing ID
  - **Access:** Yes / Partial (same as underlying source above)

## 5. Confidence level

- **Input:** Number of comparable sales found within the search radius
  - **Why:** Directly determines whether confidence is High/Medium/Low per the thresholds in [[17_scoring_framework]] (e.g. "12 comparable sales within 500m").
  - **Source:** Computed from Section 3 comparable-sale data
  - **Access:** N/A (derived, but underlying source is Partial — see Section 3)
- **Input:** BRF filing history depth (number of years available, recency of most recent filing)
  - **Why:** Directly determines confidence (e.g. "full 3-year BRF filing history").
  - **Source:** Bolagsverket (BRF filings)
  - **Access:** Yes, with the same coverage caveat as Section 4 (older/paper-filed reports may be missing).

## 6. AI summary (5–8 sentences)

- **Input:** Recommendation + rationale (Section 1)
  - **Why:** Summary must not introduce new facts, only connect what's already shown.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)
- **Input:** Fair price vs. asking price outcome (Section 3)
  - **Why:** Referenced in the narrative.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)
- **Input:** Top strengths/risks (Section 4)
  - **Why:** Referenced in the narrative as "the one or two things that would change the reader's mind."
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)
- **Input:** Confidence level and driver (Section 5)
  - **Why:** Narrative must reflect how much conviction the data supports.
  - **Source:** Internal (this report)
  - **Access:** N/A (derived)

---

## Cross-cutting inputs (used by more than one section)

- **Input:** Listing URL or address (user-provided)
  - **Why:** Entry point for the entire report — every other input is looked up from this.
  - **Source:** User (pasted at request time)
  - **Access:** Yes (user-supplied, not a data-source dependency)
- **Input:** Object identifier / match between the pasted listing and the Booli record
  - **Why:** Needed to pull listing attributes and comparables against the correct object, especially when a Hemnet URL is pasted (Hemnet itself cannot be queried).
  - **Source:** Booli lookup (by address or Hemnet ID cross-reference, if available)
  - **Access:** Partial — matching mechanism against a pasted Hemnet URL specifically is unconfirmed; needs verification.
  - **Note:** [[10_user_problems]] and [[14_mvp_definition]] establish that the user pastes a Hemnet/Booli URL or address — the report's entire input chain depends on resolving that URL to a Booli-backed object first.
- **Input:** BRF identity/registration number for the building
  - **Why:** Needed to look up the correct BRF filing at Bolagsverket.
  - **Source:** Booli listing attributes (BRF name) matched to Bolagsverket registry
  - **Access:** Partial — matching a listing's BRF name to the correct Bolagsverket registration number is not yet confirmed as a solved lookup step.

## Known gaps surfaced by this checklist

- **Apartment sold prices** have exactly one realistic source (Booli),
  and that source's commercial-use terms are conditional, not confirmed
  free-and-clear — this is the single highest-risk data dependency in
  the entire report, since Section 3 (and everything downstream that
  depends on it: Sections 1, 2, 4, 5, 6) has no fallback source if Booli
  terms don't permit this product's use case.
- **BRF-name-to-registration-number matching** and **Hemnet-URL-to-Booli-object
  matching** are both assumed steps with no confirmed mechanism yet —
  every BRF-side and price-side input in this report depends on one of
  these two lookups succeeding.
- **Older/paper-filed BRF reports** create a partial coverage gap that
  directly feeds the Confidence Level for an unknown subset of
  buildings — not quantified yet.
