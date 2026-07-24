# User Problems — Buying Property in Sweden

**Date:** 2026-07-13 · **Sprint:** 3 · Product definition only — no
technical content.

For each segment: the problem, why it exists, how people solve it today,
and why that's insufficient.

---

## First-time buyers

**Problem 1 — They cannot tell a fair price from an overpriced one.**
Why it exists: Sweden's opening-bid system (utgångspris) is a known
lowball anchor — the advertised price is frequently 10-20% below what
the object actually sells for, and a first-time buyer has no personal
transaction history to calibrate against.
Today: they eyeball Hemnet's "sold nearby" panel, ask a parent, or trust
the broker (who is paid by the seller, not them).
Why insufficient: "sold nearby" is a handful of loosely comparable
objects, not a valuation; the broker's incentive is structurally
misaligned with the buyer's.

**Problem 2 — They don't understand what they're bidding against.**
Why it exists: the Swedish open-bidding process (budgivning) is opaque —
bids are visible but bidders' seriousness, financing status, and true
ceiling are not.
Today: they call the broker and ask "how's it going," get a vague answer.
Why insufficient: brokers legally represent the seller and have every
incentive to create urgency; buyers have no independent read on the
auction.

**Problem 3 — They don't know what a BRF's finances mean.**
Why it exists: buying a bostadsrätt means buying a share of a
housing co-operative's debt and future fee trajectory, disclosed only in
a dense annual report (årsredovisning) most buyers have never read.
Today: they skim the report or ignore it entirely.
Why insufficient: the numbers that matter (debt per m², amortization
rate, planned maintenance) are not summarized anywhere in plain language;
a BRF with hidden debt problems looks identical to a healthy one at a
glance.

## Families

**Problem 4 — "Is this a good place to raise a kid here in 5 years?" has no answer.**
Why it exists: school quality, safety trends, and planned development
(new transit, new construction) are scattered across a dozen government
sources (Skolverket, BRÅ, Region Stockholm) with no consumer-facing
synthesis.
Today: word of mouth, Facebook parent groups, gut feeling from a single
viewing.
Why insufficient: anecdote-driven, not comparable across candidate areas,
and blind to what's *changing* (a new metro line or school closure a few
years out).

**Problem 5 — Space needs change faster than they can move.**
Why it exists: family size and remote-work patterns shift over a 5-10
year horizon that outpaces the practical frequency of moving.
Today: they overbuy space "just in case" or accept they'll move again.
Why insufficient: no tool helps them reason about total cost of a
future move versus buying larger now.

## Investors

**Problem 6 — No reliable way to screen for mispriced or high-yield
objects across a market.**
Why it exists: no public sold-price register exists for bostadsrätter at
all (this is a genuine structural gap, not a solved problem someone is
hiding); the closest thing is broker-provided listing data.
Today: manual browsing of Hemnet/Booli by eye, or paid access to
Mäklarstatistik/Valueguard aggregates that don't go to object level.
Why insufficient: manual screening doesn't scale past a handful of
listings a day; aggregate indices don't identify specific opportunities.

**Problem 7 — BRF financial risk is invisible until it's a problem.**
Why it exists: same disclosure gap as Problem 3, but the stakes are
higher — an investor holding a BRF apartment through a fee-doubling event
(common when a BRF's low-interest loans reset) can lose the entire yield
thesis.
Today: manual read of the annual report per object, if at all.
Why insufficient: doesn't scale, and the risk signal (debt/m²,
loan-maturity concentration) is exactly the kind of thing that's easy to
compute once and hard to read by hand every time.

## People moving within Stockholm

**Problem 8 — Comparing "sell then buy" trade timing is guesswork.**
Why it exists: local price trends by area/segment are known to
professionals (Mäklarstatistik, Valueguard/HOX) but not surfaced to
consumers deciding whether to list now or wait.
Today: ask their broker, who benefits from a transaction happening now
regardless of timing quality.
Why insufficient: same misaligned-incentive problem as Problem 1.

**Problem 9 — They already know their commute/amenity requirements
precisely, but no tool lets them filter by them.**
Why it exists: Hemnet/Booli filter by rooms/price/area, not "under 30
min to my office by transit" or "walking distance to a specific school."
Today: manually check each candidate listing's location one by one.
Why insufficient: high-friction, doesn't scale past a few listings.

## House buyers (villa/radhus)

**Problem 10 — Physical condition risk is underweighted relative to
financial risk.**
Why it exists: houses carry maintenance/structural risk (roof, drainage,
foundation) that isn't disclosed the way BRF finances are, and a
besiktning (inspection) happens late in the process, often after
significant emotional and time investment.
Today: rely on the besiktning report alone, late, after already
emotionally committing.
Why insufficient: doesn't help *screen* candidates early, only validates
(or invalidates) the one they've already chosen to pursue.

**Problem 11 — Land/plot-level risk (flooding, planned nearby
development) is not visible.**
Why it exists: this data exists (SMHI climate data, Stockholms Stad
detaljplaner) but is scattered across specialist government portals with
no consumer synthesis.
Today: mostly not checked at all by ordinary buyers.
Why insufficient: literally absent as a purchase consideration for most
buyers today.

## Apartment buyers (bostadsrätt)

**Problem 12 — The BRF is the actual asset, but appears as a footnote.**
Why it exists: covered under Problems 3/7 — same disclosure gap, same
lack of synthesis, but apartment buyers are the largest segment in
Stockholm and this affects nearly everyone in that segment.
Today: as above — usually skipped or superficially skimmed.
Why insufficient: as above.

---

## Cross-cutting theme

Every problem above reduces to one shape: **the information required to
make a good decision exists somewhere, in a government register or a
dense filing, but nobody has synthesized it into a form a buyer can act
on in the time they actually have** (a viewing is 15-20 minutes; a
bidding war moves over days). Listing portals solved *discovery*
(finding objects that match filters) in the 2000s. Nobody has solved
*understanding* (is this object, and this BRF, actually a good decision)
for the ordinary consumer.
