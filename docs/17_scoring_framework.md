# Scoring Framework

**Date:** 2026-07-13 · **Sprint:** 5

## Purpose

This document defines every score and rating that appears anywhere in
the customer report. It does not explain how any of them are
calculated — only what each one means, why it exists as a distinct
thing, and how a customer should read it. Calculation and weighting
are a separate, later sprint.

## Design principles applied

Five scores were considered and two were rejected before writing this
document, in keeping with "challenge every score before including it":

- **Rejected: a separate Risk Score.** Everything that would drive it
  (BRF debt, data gaps, price uncertainty) is already fully captured by
  the BRF Financial Health Score and the Confidence Level. A standalone
  risk number would just restate those two in different units.
- **Rejected: a numeric Confidence Score (0–100).** Confidence is about
  how much public data we actually had, not a measured quantity — a
  percentage implies false precision. It stays a plain-language label.

What remains are four scores, each answering a question none of the
others answer.

---

## 1. Recommendation

**Purpose:**
The single verdict on whether this property is worth the customer's
continued time and attention.

**Question it answers:**
"Should I keep pursuing this apartment, or move on?"

**Why the customer should care:**
It's the one output they need before they even open the rest of the
report. Everything else exists to justify this.

**Range:**
Three categories — **Buy / Consider / Avoid**. Not numeric.

**Interpretation:**

- **Buy** — no material concerns on either price or BRF health.
- **Consider** — one dimension is mixed; worth pursuing with eyes
  open.
- **Avoid** — a hard flag on price, BRF health, or a data problem
  serious enough that we can't stand behind a number.

---

## 2. Overall Property Score

**Purpose:**
A single composite number summarizing the property's overall standing,
for comparing across multiple reports a customer has purchased.

**Question it answers:**
"How does this property stack up against others I've looked at?"

**Why the customer should care:**
A customer evaluating several listings needs a way to rank them at a
glance without re-reading each full report. This is that number.

**Range:**
0–100.

**Interpretation:**

| Range | Meaning |
|---|---|
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Mixed |
| 40–59 | High Risk |
| 0–39 | Avoid |

**Why this is distinct from Recommendation:**
Recommendation is the single-property verdict, phrased as a decision
("keep pursuing or not"). Overall Property Score is a ranking number,
useful only once a customer has more than one report to compare — it's
not the thing that justifies this report's verdict, and the report
should never lean on it to explain the Recommendation.

---

## 3. Price Score

**Purpose:**
An assessment of how fairly the asking price is set relative to
comparable sales.

**Question it answers:**
"Am I being asked to overpay for this specific apartment?"

**Why the customer should care:**
Price is the single largest number in the transaction and the easiest
one for a customer to misjudge without comparables in hand — this
converts "asking price vs. fair range" into one interpretable number.

**Range:**
0–100.

**Interpretation:**

| Range | Meaning |
|---|---|
| 90–100 | Priced well below fair value |
| 70–89 | Priced fairly, at or slightly under market |
| 40–69 | Priced at or slightly above market |
| 0–39 | Priced materially above fair value |

---

## 4. BRF Financial Health Score

**Purpose:**
An assessment of the financial soundness of the housing association
(BRF) that owns the building.

**Question it answers:**
"Is this BRF a financial risk I'd be buying into, separate from the
apartment itself?"

**Why the customer should care:**
In a bostadsrätt purchase, the customer isn't just buying an apartment
— they're buying a share of the BRF's debt and financial obligations.
A structurally fine apartment can still be a bad purchase if the BRF
is in poor financial shape. This is the one existing free tool doesn't
give customers today.

**Range:**
0–100.

**Interpretation:**

| Range | Meaning |
|---|---|
| 90–100 | Very strong — low or no debt, healthy reserves |
| 70–89 | Solid — manageable debt, no red flags |
| 40–69 | Elevated risk — above-average debt or thin reserves |
| 0–39 | Weak — high debt load or signs of financial distress |

**Why this is distinct from Price Score:**
Price Score is about the apartment; BRF Financial Health Score is
about the entity that owns the building. A property can score high on
one and low on the other, and a customer needs to know which is
driving a mixed verdict — collapsing them into one number would hide
that distinction.

---

## 5. Confidence Level

**Purpose:**
A statement of how much reliable public data was available to produce
this report.

**Question it answers:**
"How much should I trust the numbers above?"

**Why the customer should care:**
Every score above is only as good as the data behind it. A customer
should read a High-confidence "Buy" very differently from a
Low-confidence "Buy" — this makes that distinction explicit instead of
letting a thin data set masquerade as certainty.

**Range:**
Three categories — **High / Medium / Low**. Deliberately not a
percentage or number.

**Interpretation:**

- **High** — full BRF filing history and a strong set of nearby
  comparable sales.
- **Medium** — one of the two data sources is thin (e.g., few
  comparables, or an older filing).
- **Low** — meaningful gaps in either data source; the report's other
  scores should be treated as directional, not precise.

---

## Score relationships at a glance

| Score | Answers | Scope |
|---|---|---|
| Recommendation | Should I act? | Whole property, this report |
| Overall Property Score | How does it rank? | Whole property, cross-report |
| Price Score | Is the price fair? | The apartment |
| BRF Financial Health Score | Is the BRF sound? | The building/association |
| Confidence Level | How much should I trust this? | The underlying data |

No two rows answer the same question, and every row maps to a
different section of [[16_executive_summary]].
