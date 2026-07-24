# Feature Prioritization

**Date:** 2026-07-13 · **Sprint:** 3. Ranked by customer value, per the
problems in [[10_user_problems]] and the positioning in
[[11_product_positioning]].

## Must Have (the verdict, per Problems 1/3/6/7/12)

1. Single-object lookup by URL/address → fair-price range vs. comparables
2. BRF financial health signal (traffic light + one-line reason), from
   Bolagsverket filings
3. "Why" / evidence drill-down for every verdict, linking to the
   underlying public source
4. Explicit "we don't know" / confidence flag where data is genuinely
   missing (never fabricate a verdict from insufficient evidence)

## Should Have (area context, per Problems 4/8/9/11)

5. Area price-trend summary (up/down/flat, over 1-2 years)
6. Nearby school-quality summary (Skolverket)
7. Nearby safety-trend summary (BRÅ, municipality level — respecting the
   statistical-disclosure-control granularity the data actually supports)
8. Planned transit/infrastructure changes near the object (Trafikverket,
   Region Stockholm)
9. Commute-time filter/estimate to a saved location (Trafiklab)
10. Save/compare a handful of objects side by side

## Nice to Have (deeper investor/house-buyer needs, per Problems 6/10/11)

11. Yield/investment screening across many objects (not just one at a
    time) — the natural extension of #1 to a portfolio view
12. Flood/climate-risk flag for houses (SMHI)
13. Nearby planned construction/zoning changes (detaljplaner) that could
    affect views, noise, or value
14. Energy-performance summary (Boverket EPC) for houses
15. Historical price chart for the specific object/BRF over time, where
    data exists

## Future Vision (beyond current data-source scope)

16. Personalized "good fit for you" scoring based on stated priorities
    (school vs. commute vs. price sensitivity)
17. Negotiation coaching — suggested opening bid and walk-away price
    given comparables and bidding dynamics
18. Post-purchase tracking — how did this BRF's finances evolve, was the
    price verdict right in hindsight (this also doubles as an ongoing
    accuracy/trust signal for the product itself)
19. Expansion beyond Stockholm / beyond Sweden

Ranking logic: Must Have items are the ones that directly answer the
three questions in the value proposition and are required for the
product to be more than a listing viewer. Should Have items round out
the "is this area right for me" question for families/movers without
which the product undersells its area-context ambition. Nice to Have
serves investors and house buyers specifically — valuable but smaller
audiences than the apartment-buyer majority. Future Vision items require
either data we don't yet have reliable access to, or meaningful usage
history we won't have at launch.
