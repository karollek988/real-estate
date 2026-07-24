# Sprint 7 — Go / No-Go Feasibility Report

**Date:** 2026-07-13 · **Sprint:** 7

## Purpose

Every prior sprint (1–6) designed the product assuming it would get
built. This sprint does the opposite: it assumes nothing and asks
whether the Property Intelligence Report, as scoped in
[[16_executive_summary]], [[17_scoring_framework]], and
[[18_report_inputs]], can actually be built and legally sold. No code,
no database design, no product design happens here — only a judgment
call, backed by the evidence already gathered in
`data-source-inventory.md` and `data-sources.md`.

---

## Part 1 — Feature Feasibility

Evaluated against the six report sections defined in
[[16_executive_summary]] / [[18_report_inputs]].

### 1. Recommendation banner (Buy/Consider/Avoid)

**PARTIAL.** Fully derivable *once* Price Score and BRF Financial
Health Score exist — but both of those are themselves PARTIAL (below),
so the banner inherits their gaps. The logic to combine two scores
into a verdict is trivial; the two things it's built on are not fully
solved.

- Missing: nothing structural — this is a pure composition problem
  that resolves itself once Sections 3 and 4 (below) are resolved.
- Solvable: yes, automatically, once the upstream scores are trustworthy.

### 2. Overall Property Score (0–100)

**PARTIAL**, for the same reason as above — it's a weighted composite
with no independent data dependency. Not a real risk on its own.

### 3. Fair price estimate vs. asking price

**PARTIAL — this is the load-bearing wall of the whole product.**

- Object attributes (m², rooms, floor, year, address): **YES**, solved.
  Booli's API delivers this with a confirmed key and no legal ambiguity
  for individual object lookups.
- Comparable sold prices (slutpriser) for bostadsrätter: **PARTIAL,
  bordering on NO for a paid commercial product.** This is the single
  most important number in the entire report, and it has exactly one
  realistic source (Booli), whose free tier explicitly restricts
  "competitive/commercial use." Selling a report that is built on
  Booli data, priced for money, to consumers making a purchase
  decision, is very plausibly the exact use case that clause exists to
  block. There is no public-register fallback: a bostadsrätt sale is a
  share transfer, not a property transfer, so Lantmäteriet structurally
  never records it, in perpetuity — this isn't a coverage gap that
  improves over time, it's a permanent structural absence.
- What's missing: a *commercial* license for slutpriser at the volume
  needed to produce defensible comparable sets per listing, city-wide.
- Can it realistically be solved: yes, but only by paying for it
  (Booli commercial tier, or Mäklarstatistik/allabrf partner
  agreement) — not by finding another free source, because none
  exists. This converts a "build it" problem into a "pay for it"
  problem, which changes the entire cost structure of the MVP.

### 4. Biggest strengths / Biggest risks (BRF side)

**YES**, this section works today, free, with source citations.
Bolagsverket's annual-report API is open, state-run, and the debt/fee/
reserve line items needed to write these bullets are directly
extractable. This is the one section of the report with no material
data blocker.

- Coverage gap: older/paper-filed BRF reports are missing for an
  unquantified subset of buildings. Realistically solvable — it
  degrades to a Confidence penalty (Section 5), not a section failure.

### 5. Confidence level

**YES.** This section is entirely derived from data already collected
for Sections 3 and 4 (comparable count, filing recency) — it has no
independent data dependency and is honestly the report's safety valve:
it's designed to *absorb* the gaps in Sections 3 and 4 rather than
hide them, which is a real strength of the current design.

### 6. AI summary

**YES**, mechanically — it's a text-generation pass over already-
computed facts, no new data dependency. Its quality is bounded by the
quality of what it summarizes, which is bounded by Section 3.

### Feasibility summary table

| Section | Status | Blocking factor |
|---|---|---|
| Recommendation banner | PARTIAL | Inherits Section 3/4 |
| Overall Property Score | PARTIAL | Inherits Section 3/4 |
| Fair price vs. asking | **PARTIAL→NO at commercial scale** | Sold-price data is commercial-license-gated, no free fallback exists |
| Strengths/risks (BRF) | YES | None — solved, free, state-authoritative |
| Confidence level | YES | None — derived |
| AI summary | YES | None — derived |

Two of six sections are unconditionally solved for free. Four of six
are gated, directly or indirectly, on one dataset: bostadsrätt sold
prices.

---

## Part 2 — Data Gaps

### Gap 1: Apartment (bostadsrätt) sold prices at commercial volume

- **Why it matters:** It is the entire basis for Price Score, the fair-
  price range, and therefore the Recommendation banner and Overall
  Score. Nothing downstream works without it.
- **Severity: Critical.** Not a quality issue — a licensing and legal
  issue. The data technically exists (Booli has it); the product is
  legally blocked from using it commercially without a paid agreement.
- **Value without it:** None for the pricing half of the report. The
  BRF-health half (Section 4) still stands on its own and could
  justify a narrower, cheaper product (see Part 5).

### Gap 2: Listing/BRF entity matching

- **Why it matters:** Two unconfirmed lookups sit in the input chain:
  matching a pasted Hemnet URL to the corresponding Booli object, and
  matching a listing's BRF name to its Bolagsverket registration
  number. If either fails silently or ambiguously, the report is
  either wrong or blocked at intake.
- **Severity: Medium-High.** Unlike Gap 1, this is solvable with
  engineering effort, not money — but it's currently unverified, not
  merely unbuilt, so its true difficulty is unknown.
- **Value without it:** Low — if intake can't reliably resolve a
  pasted listing to both a Booli object and a Bolagsverket filing, the
  MVP's entire user flow ("paste a URL, get a report") breaks at step
  one.

### Gap 3: Older / paper-filed BRF annual reports

- **Why it matters:** Feeds Section 4 (strengths/risks) and Section 5
  (confidence) directly.
- **Severity: Low-Medium**, unquantified. Digitized coverage is rising
  over time by nature of the filing regime, so this gap self-heals; it
  degrades gracefully into a Low-confidence report rather than a
  broken one.
- **Value without it:** The report still works, just with an honest
  "Low confidence" label for affected buildings — the design already
  accounts for this (see [[17_scoring_framework]] Section 5).

### Gap 4: Interior condition / renovation state

- **Why it matters:** Real buyers weigh renovation state heavily;
  neither Booli's structured attributes nor Bolagsverket filings
  capture it in structured form (only listing photos/text do).
- **Severity: Low for MVP** — not scoped into the current report
  design at all (see [[18_report_inputs]], which never lists it as an
  input). Worth naming here only because it's a known ceiling on
  eventual "why is this priced the way it is" precision, not because
  the MVP claims to need it.
- **Value without it:** Full — the MVP report never promised this.

### Gap 5: Bidding-history / final-vs-asking dynamics

- **Why it matters:** Named in `data-sources.md` §2.3 as needed for
  any future negotiation-estimate feature; not required by the current
  MVP scope, which explicitly excludes negotiation coaching (see
  [[14_mvp_definition]]).
- **Severity: N/A for this Go/No-Go** — out of scope by design, listed
  for completeness only.

---

## Part 3 — Alternative Data Acquisition (for Gap 1: sold prices)

This is the only gap worth a full alternatives sweep, because it's the
only one blocking the product outright.

| Alternative | Technically possible | Legally usable commercially | Effort | Long-term reliability |
|---|---|---|---|---|
| **Booli commercial/paid API tier** | Yes — same integration already scoped | Yes, this is the intended paid path | Low (same API, new contract) | ★★ — dependent on one vendor's continued terms and pricing |
| **allabrf.se BRF-Data (commercial)** | Yes | Yes, under paid agreement; covers ~25,000 BRFs incl. some sales | Medium (new integration, different data shape) | ★★ — smaller commercial vendor, dependent on their parsing pipeline |
| **Svensk Mäklarstatistik partner API** | Yes, but aggregated (area-level), not per-object | Yes, under partner agreement | Medium-High (partner negotiation, not just a signup) | ★★★ — industry-standard body, but data granularity doesn't match the report's per-listing comparable-sale requirement |
| **Valueguard (HOX) micro-data** | Yes | Yes, paid license | High (index methodology, not raw comparables) | ★★★ — used by Riksbank/media, but it's an index, not comparable-sale detail |
| **Scrape Hemnet directly** | Technically possible | **No — ToS explicitly bans scraping and explicitly bans ML/AI use of Hemnet data.** Treat as legally foreclosed, not merely risky. | N/A | N/A — do not pursue |
| **Community/open-source scrapers (GitHub)** | Yes, several exist for Booli/Hemnet | **No** — using them against Hemnet inherits the same ToS violation; against Booli, still subject to Booli's own non-commercial clause regardless of tooling | Low to build, zero legal cover | N/A — the blocker is legal, not technical, so better tooling doesn't fix it |
| **Government register (Lantmäteriet)** | No — structurally impossible | N/A | N/A | N/A — bostadsrätt sales are share transfers, never recorded here, permanently |
| **Manual/crowdsourced data entry** | Technically possible at small scale | Legally clean (no ToS violated) but commercially non-viable — can't cover a city at report-generation speed | High effort for low, unreliable coverage | ★ — doesn't scale to a real product |
| **Buy anonymized data from a broker network / franchise** | Possible in principle | Depends entirely on the specific agreement negotiated | High (business-development effort, not engineering) | Unknown — no research done yet, flagged for later if Booli/allabrf terms prove insufficient |

**Conclusion for Part 3:** every technically-possible, cost-free route
to this dataset is legally blocked (Hemnet) or structurally absent
(Lantmäteriet). Every legally clean route requires a paid commercial
agreement. There is no clever free workaround — this has already been
searched for across two prior research sprints (`data-sources.md`,
`data-source-inventory.md`) and the conclusion holds.

---

## Part 4 — Business Feasibility

**PARTIAL.**

Can we honestly deliver enough value to justify a price, *today, on
the free tier*? No — a report that includes a fair-price range built
on data whose license doesn't clearly cover this commercial use case
is not something we can sell in good conscience, independent of
whether it's factually accurate. That's not a data-quality problem,
it's an integrity problem: MVP definition documents (see
[[14_mvp_definition]]) already assume commercial usability of "public
comparables," but the inventory work in this same sprint cycle shows
that assumption was optimistic for the one number Booli explicitly
restricts.

Can we deliver enough value *with a paid Booli/data agreement in
place*? Yes, plausibly — the two-sided verdict (fair price + BRF
health, each independently sourced and cited) is a genuinely
differentiated product. No free consumer tool currently exposes BRF
financial health this directly (per [[14_mvp_definition]]'s own
reasoning), and that half of the value proposition survives even if
Gap 1 takes time to resolve.

Can we deliver *a smaller, honestly-scoped* product on free data
alone, today? Yes — see Part 5.

---

## Part 5 — Go / No-Go

### Recommendation: **GO WITH LIMITATIONS**

Not a full No-Go, because two of the six report sections (BRF
strengths/risks, and by extension confidence/summary) are fully
solved, free, and state-authoritative — that's a real, defensible
product on its own. Not a clean Go, because the report as currently
scoped in [[16_executive_summary]] cannot be sold as designed without
either a paid Booli/comparable-data agreement or a scope cut that
removes the fair-price section.

Two concrete paths forward, not mutually exclusive:

1. **Narrow the MVP to BRF Financial Health only** (drop Section 3's
   fair-price range, keep Sections 4–6 built around it) and launch on
   100% free, legally clean data immediately. This directly
   contradicts [[14_mvp_definition]]'s framing of price + BRF as
   equally load-bearing "Must Have" — that framing needs revisiting in
   light of this sprint's finding, not carried forward unchanged.
2. **Negotiate a Booli commercial tier (or equivalent) before writing
   another line of report-generation code**, and keep the full
   two-sided report as designed. This is a business-development task,
   not an engineering one, and it should happen *before* further
   product-design sprints, not after — building more on an unlicensed
   assumption only compounds the eventual rework.

If GO (either path), the three biggest risks to solve first:

1. **Data licensing for sold prices** (Gap 1) — resolve before writing
   any pricing logic. This is the one blocker that no amount of good
   engineering fixes; it's a contract, not a bug.
2. **Intake matching** (Gap 2: Hemnet URL → Booli object, BRF name →
   Bolagsverket registration number) — unverified as a solved
   mechanism; if it fails at meaningful frequency, the "paste a URL"
   flow that the entire MVP is built around doesn't work regardless of
   what data licensing gets solved.
3. **Legal review of the multi-license data stack before any
   commercial launch** (ODbL/OSM + CC0/Lantmäteriet + proprietary/Booli
   in one product, plus GDPR exposure on address-linked sold prices) —
   flagged repeatedly in `data-source-inventory.md` and
   `data-sources.md` as *(verify)*, never actually verified by counsel.
   This is a launch blocker independent of Gap 1 being resolved.

---

## Summary

The product is not infeasible — the BRF-health half is real, free, and
differentiated today. But the report as currently designed quietly
assumes commercial-grade access to a dataset (bostadsrätt sold prices)
that has been researched twice already and confirmed, both times, to
have no free or legally-clean path at commercial scale. This sprint's
job was to say that plainly before more product design gets built on
top of that assumption: **do not proceed to database/API design for
the full report until either a Booli commercial agreement exists, or
the scope is formally cut to BRF-health-only.**
