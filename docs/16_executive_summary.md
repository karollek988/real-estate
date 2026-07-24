# Report Page 1: Executive Summary

**Date:** 2026-07-13 · **Sprint:** 4

## Purpose

A customer has just paid for a report on a specific listing. They have
several million SEK on the line and, realistically, a bid deadline in
days. This page must let them answer "should I even keep looking at
this apartment?" in under 10 seconds, and "why?" in under 60. Everything
below the fold in the rest of the report exists to back up what's
stated here — this page makes no claim it doesn't cite.

## Design principle

One verdict, one number, one price, three reasons. No panel on this
page should require the reader to interpret raw data — every value
here is already a conclusion. Raw comparables, BRF filing line items,
and methodology belong on later pages, linked from here, never shown
here.

## Layout (top to bottom)

### 1. Recommendation banner (largest element on the page)

**Buy / Consider / Avoid**, rendered as a single colored banner —
not a score gauge, not a badge buried in a corner. This is the first
thing the eye hits.

- **Buy** — fair price and BRF health both clear, no material risk
  flag.
- **Consider** — one dimension is mixed (e.g., fair price but BRF debt
  is elevated, or vice versa); worth pursuing with eyes open.
- **Avoid** — a hard flag on price, BRF financial health, or a
  data-quality problem serious enough that we can't stand behind a
  number.

Directly under the banner, one sentence stating *why* this verdict,
e.g. "Priced 4% under comparable sales, but the BRF's debt-per-m²
is in the top quartile for this area."

### 2. Overall Property Score

A single 0–100 score, shown as a compact dial or bar next to the
banner — not the headline element, since Buy/Consider/Avoid already
carries the verdict. The score exists for comparing across multiple
reports a customer has purchased, not for justifying this one. Label
it plainly as a composite, and link to the page that breaks down its
components (price, BRF health, data confidence) rather than
explaining the composite here.

### 3. Fair price estimate vs. asking price

Shown together as one visual block, not two separate numbers:

- **Fair price range** (e.g., "3.85M–4.05M SEK"), derived from
  comparable sales.
- **Asking price** for this listing, positioned on the same scale —
  a simple horizontal range bar with the asking price marked as a
  point works better here than two stacked numbers, since the
  *relationship* between them is the actual answer the customer wants
  ("am I being asked to overpay?").
- One line stating the delta as a plain-language percentage: "Asking
  price is 3% below the low end of the fair range" — sign and framing
  matter more than precision here.

### 4. Biggest strengths / Biggest risks

Two short lists side by side, capped at **3 bullets each**. Every
bullet is one line, specific, and points to a source ("BRF has no
external loans — see filing p.4," not "financially healthy BRF").
This is the part a customer will screenshot and send to a partner or
a bank — it has to survive being read with zero other context.

If there are fewer than 3 genuine strengths or risks, show fewer —
never pad to reach three.

### 5. Confidence level

A plain-language label (**High / Medium / Low**), not a percentage —
percentages imply false precision for what is fundamentally "how much
public data did we actually have." One line explains the driver:
"High — full 3-year BRF filing history and 12 comparable sales within
500m." A Low confidence should visually de-emphasize the
recommendation banner's certainty (e.g., a muted variant of the same
banner) so the customer doesn't read more conviction into the verdict
than the underlying data supports.

### 6. AI summary (5–8 sentences)

Placed last, functioning as the connective narrative that ties the
above elements together in prose — for a reader who wants the "tell
me like a person would" version after skimming the visual elements
above. Structure implicitly: what this property is, the verdict and
why, the one or two things that would change the reader's mind, and
what to do next (bid, walk away, or ask the seller a specific
question). No new facts appear here that aren't already shown above —
this section explains and connects, it doesn't introduce.

## What is deliberately NOT on this page

- Raw comparable-sale listings (page 2+)
- BRF filing line items / balance sheet detail (page 2+)
- Methodology or data-source citations beyond inline references (own
  page)
- Area context: schools, transit, safety (excluded from V1 entirely,
  see [[14_mvp_definition]])
- Historical price trend charts
- Any interactive element — this is a static report page

## Open question for later sprints

Whether "Consider" needs a sub-label (e.g., "Consider — price risk" vs
"Consider — BRF risk") once we see real listings hit that middle
bucket, or whether the one-sentence rationale under the banner already
carries that distinction well enough. Not resolving this now — decide
after the first batch of real reports.
