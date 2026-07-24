# Boenderapport Go/No-Go Gap Analysis

**Date:** 2026-07-15 · **Type:** Pure market/data research and strategic analysis (no code, no UI, no architecture)

## Purpose and method

This sprint reverse-engineers boenderapport.se, a live Swedish commercial product, to test our own MVP definition ([[14_mvp_definition]]) and prior feasibility conclusions ([[19_feasibility_report]], `data-source-inventory.md`) against a real competitor/comparable that is already charging money for something adjacent to what we've scoped. It does not design any code, UI, or backend architecture.

**What is confirmed vs. inferred is marked explicitly throughout.** Confirmed facts come from boenderapport.se's own homepage (fetched directly) and a Trustpilot-indexed search snippet describing the product; boenderapport.se's internal pages beyond the homepage could not be fetched directly (WebFetch returned only the homepage tagline with no body content, and Trustpilot itself 403'd), so most granular detail below is search-engine-summarized secondary text about the site, not a direct read of every subpage. Where no external source exists at all, sections are reasoned from general knowledge of the Swedish property-data landscape and are labeled **INFERRED**.

### Confirmed facts about Boenderapport (highest confidence available this sprint)

- Tagline: "Bedöm bostaden innan du budar" ("Assess the home before you bid").
- Product: a data-driven analysis of a bostadsrätt (co-op apartment) purchase, delivered as a PDF within 24 hours.
- Price: 395 SEK for a full report; a free "quick report" gives a directional read for a specific listing.
- Full report contents (as described in search-indexed site copy): a concrete recommended maximum bid, an assessment of fee-increase risk ("avgiftsrisk"), and a full review of the BRF's finances (strengths and weaknesses).
- Everything in the report is stated to be verified against the primary source — the BRF's own annual report (årsredovisning) — surfacing what "rarely shows up in the broker listing": risk of fee increases, high leverage, and interest-rate sensitivity.
- No confirmed evidence was found (this sprint) that Boenderapport uses individual sold-price comparables at all — its stated value proposition is specifically about BRF financial health and a resulting bid recommendation, not a comparable-sales valuation engine. This is an important structural finding: **the one real competitor found in this space appears to be built almost entirely on the exact data source (Bolagsverket BRF filings) that our own prior research already confirmed is free and fully solved**, and may be deliberately avoiding the sold-price/comparables problem that our own Sprint 7 flagged as the load-bearing, commercially-gated wall.

This is a meaningfully different (and more favorable) picture than assuming Boenderapport is a full Booli-style valuation-plus-comps product. Everything else below reconstructs a *plausible superset* of report sections such a product category could contain, using general knowledge of Swedish property-report products, and evaluates our own buildability against that superset — not against unverified claims about Boenderapport specifically.

Sources: [boenderapport.se](https://www.boenderapport.se/), search-indexed summaries of boenderapport.se content (Trustpilot review page itself returned HTTP 403 and could not be read directly).

---

## Part 1 — Reverse-engineered report sections (plausible superset)

The following is every section a Swedish property-report product in this category plausibly contains, combining (a) what's confirmed for Boenderapport and (b) what's standard in the broader category (INFERRED, based on general knowledge of Swedish real-estate data products such as Booli, Hemnet, allabrf.se, Svensk Mäklarstatistik-based tools).

### 1. Recommended maximum bid (CONFIRMED core feature)
- **Purpose:** Give the buyer a single actionable number before an auction-style bidding process (Swedish home sales are typically open-outcry bidding wars, so a pre-committed ceiling is genuinely decision-relevant).
- **Customer value:** Very high — this is the single number a nervous first-time buyer wants most, and it's the headline feature of the confirmed competitor.
- **Estimated complexity:** Medium-to-high. Trivial to compute mechanically (asking price × some adjustment factor derived from fee risk / comparables), but the number is only as trustworthy as the valuation model underneath it, and a wrong "max bid" is a high-stakes, reputation-defining error.

### 2. BRF fee-increase risk assessment (CONFIRMED core feature)
- **Purpose:** Flag whether the monthly fee (avgift) is likely to rise, based on the association's debt load, interest-rate exposure, and reserve fund status.
- **Customer value:** High — fee increases materially change the true cost of ownership and are invisible in a normal listing.
- **Estimated complexity:** Low-medium. This is a direct read of already-structured BRF annual-report line items (debt per m², interest-rate terms, reserve fund, planned maintenance) — mechanical once the report is parsed.

### 3. Full BRF financial review — strengths/weaknesses (CONFIRMED core feature)
- **Purpose:** Plain-language narrative synthesis of the BRF's balance sheet health.
- **Customer value:** High — this is exactly the information asymmetry a buyer faces (brokers rarely volunteer BRF weaknesses).
- **Estimated complexity:** Low-medium. Same underlying data as #2, different presentation (narrative vs. flag).

### 4. Comparable sold prices / fair-price range (INFERRED as commonly expected, not confirmed present in Boenderapport)
- **Purpose:** Show what similar apartments nearby actually sold for, to sanity-check the asking price.
- **Customer value:** Very high — arguably the single most-wanted number in the entire category (this matches our own Section 3 in [[18_report_inputs]]).
- **Estimated complexity:** High — requires per-object sold-price data at volume, which prior research has already shown is the hardest, least-free part of the entire Swedish property-data landscape.

### 5. Area/neighborhood price trend (INFERRED)
- **Purpose:** Contextualize whether prices in the area are rising, flat, or falling.
- **Customer value:** Medium — useful context, less decision-critical than #1/#2/#4.
- **Estimated complexity:** Low, *if* built on aggregate index data (SCB FASTPI) rather than per-object comps — this is a materially easier version of the same underlying need as #4.

### 6. Energy performance / running-cost indicator (INFERRED)
- **Purpose:** Surface the building's energideklaration rating as a proxy for utility costs and building quality.
- **Customer value:** Medium — relevant to total cost of ownership, less urgent than financial risk.
- **Estimated complexity:** Low, if a usable public lookup/API exists at the needed granularity (per prior research, bulk/API access mechanics were unconfirmed — see `data-source-inventory.md` §17).

### 7. Planning/zoning risk (detaljplan changes, nearby development) (INFERRED)
- **Purpose:** Flag whether a planned development (new subway line, new building, rezoning) could change the neighborhood's character or the specific building's value/light/views.
- **Customer value:** Medium — occasionally decisive (e.g., a planned high-rise next door), usually just reassuring context.
- **Estimated complexity:** Medium-high. Data exists (municipal planning portals, Lantmäteriet, Trafikverket) but is fragmented across ~290 municipalities with no common API or schema (already flagged in `data-source-inventory.md`).

### 8. Neighborhood demographics / socioeconomic context (INFERRED)
- **Purpose:** General area profile — income levels, age distribution, population trend.
- **Customer value:** Low-medium — nice-to-have context, rarely decision-changing on its own.
- **Estimated complexity:** Low. SCB data down to DeSO level is free, structured, and already inventoried as solved.

### 9. Crime/safety indicator (INFERRED)
- **Purpose:** Area safety signal.
- **Customer value:** Low-medium, emotionally significant to some buyers, marginal to most.
- **Estimated complexity:** Medium. BRÅ statistics are free but only at municipality/region granularity by design (statistical disclosure control) — not per-address, which limits precision for a specific listing.

### 10. School quality / catchment info (INFERRED)
- **Purpose:** Relevant for buyers with or planning children.
- **Customer value:** Medium for a specific buyer segment (families), low for others (a large share of bostadsrätt buyers in dense urban cores are singles/couples without school-age children).
- **Estimated complexity:** Low. Skolverket data is free, structured, already inventoried as solved.

### 11. Transit/commute score (INFERRED)
- **Purpose:** Distance/time to public transport, city center, workplace.
- **Customer value:** Medium-high in a dense city market like Stockholm where commute time is a first-order buying criterion.
- **Estimated complexity:** Low-medium. Trafiklab (GTFS) data is free and already inventoried as solved; routing/isochrone computation adds engineering effort but no new data-acquisition risk.

### 12. Object condition / renovation-state assessment (INFERRED)
- **Purpose:** Structured signal on whether the specific apartment/building has been recently renovated or needs work.
- **Customer value:** High when accurate, but genuinely hard to get right from documents alone.
- **Estimated complexity:** Very high. As already flagged in [[19_feasibility_report]] Gap 4, no structured public data source captures this — only listing photos/text do, which requires either manual review or computer-vision/NLP inference, neither of which is a data-acquisition problem so much as a much harder product-capability problem.

### 13. Historical price of this specific unit (if previously sold) (INFERRED)
- **Purpose:** Show what this exact apartment sold for last time, as an anchor.
- **Customer value:** High when available, but only applicable to units that have sold before (not new-build, not first BRF conversion).
- **Estimated complexity:** High for the same reason as #4 — this is a sold-price lookup problem, just narrowed to one address instead of a comp set.

### 14. Overall verdict / composite score (INFERRED, matches our own [[17_scoring_framework]] design)
- **Purpose:** One headline number/traffic-light combining the above into a single "should I bid on this" signal.
- **Customer value:** Very high as a decision-simplifying device — this is effectively what "recommended max bid" already does for Boenderapport specifically.
- **Estimated complexity:** Low — pure composition logic once the inputs exist, no independent data dependency (this mirrors our own Sprint 7 conclusion for Sections 1–2 of our design).

---

## Part 2 — Can we build it?

Ruling Hemnet out explicitly for every row: Hemnet's ToS bans scraping and explicitly bans use of its data for ML/AI (confirmed in prior research, `data-source-inventory.md` §2). No feature below relies on Hemnet, and none should.

| Feature | Can we build it? | Data source | Confidence | Comments |
|---|---|---|---|---|
| Recommended max bid | PARTIAL | Composite of BRF-health + fair-price range | High (for BRF half); Low (for price half) | Trivial composition, but only as good as the fair-price range beneath it, which is the weakest input we have |
| BRF fee-increase risk | YES | Bolagsverket annual-report API | High | Already confirmed free, state-run, open license (`data-source-inventory.md` §4). This is the one section with essentially no data blocker, same conclusion as [[19_feasibility_report]] |
| BRF financial strengths/weaknesses | YES | Bolagsverket annual-report API | High | Same source as above; purely a presentation/synthesis layer on solved data |
| Comparable sold prices / fair-price range | PARTIAL, bordering NO at commercial scale | Booli API (free tier restricts commercial/competitive use; commercial tier unconfirmed and paid) | Medium-High (on the blocker; Low on resolving it for free) | Confirmed by two prior sprints ([[19_feasibility_report]], `20_booli_alternatives.md`): no free, legally clean, per-object sold-price source exists for bostadsrätter. Lantmäteriet structurally never records these (share transfer, not property transfer). This is the load-bearing gap of the entire category, for us and plausibly for Boenderapport too |
| Area price trend (index-level) | YES | SCB FASTPI (aggregate index) | High | Free, CC0, API-accessible — but this is an aggregate/regional index, not a per-listing comparable; weaker substitute for #4, not equivalent to it |
| Energy performance rating | PARTIAL | Boverket energideklaration register | Medium | Register lookup exists; bulk/API access mechanics unconfirmed (`data-source-inventory.md` §17) — likely buildable but not yet verified end-to-end |
| Planning/zoning risk | PARTIAL | Municipal open-data portals (e.g. Stockholms Stad), Lantmäteriet, Trafikverket | Medium | Solvable for Stockholm municipality specifically; fragmented and inconsistent nationally across ~290 municipalities with no common schema — a real scaling cost, not a legal blocker |
| Neighborhood demographics | YES | SCB (DeSO-level) | High | Free, structured, already solved per inventory |
| Crime/safety indicator | PARTIAL | BRÅ statistics, Polisen event feed | Medium | Free and legal, but granularity is municipality/region (BRÅ, by design) or coarse-location event-level (Polisen) — neither gives a trustworthy per-address safety score |
| School quality/catchment | YES | Skolverket | High | Free, structured API, already solved per inventory |
| Transit/commute score | YES | Trafiklab (GTFS Sverige 2, SL, ResRobot) | High | Free within rate-limited tiers; engineering effort for routing/isochrones, not a data-acquisition risk |
| Object condition/renovation state | NO | No structured public source exists | High (on the negative) | Only captured in listing photos/text; would require CV/NLP inference on Hemnet/Booli listing media, which reintroduces licensing questions and is a hard, unproven capability, not a data-source gap |
| Historical price of this specific unit | PARTIAL, bordering NO | Same source as #4 (Booli) | Medium | Same commercial-licensing blocker as the general comps problem, just narrowed to a single address; no easier in practice |
| Overall verdict/composite score | YES | Derived from other sections | High | Pure composition logic, no independent data dependency — same conclusion reached independently in our own [[19_feasibility_report]] for the equivalent section |

**Explicit note on Hemnet:** every row above was built assuming zero reliance on Hemnet. Nothing in this table requires revisiting that constraint — Hemnet is not a candidate data source for any feature in this analysis, full stop.

---

## Part 3 — If we cannot: closest legal alternative for every NO/PARTIAL row

### Recommended max bid (PARTIAL)
No separate fix needed — this inherits whatever we do for the fair-price range below. Once that's resolved (even partially), the max-bid composition itself is free.

### Comparable sold prices / fair-price range (PARTIAL→NO at commercial scale)
This is the same conclusion reached twice already in this project (`19_feasibility_report.md`, `20_booli_alternatives.md`) and it holds again here. Closest legal, mostly-free alternative: **replace "verified comparable sold prices" with a modeled valuation estimate** built from SCB's FASTPI regional index (time/region trend adjustment) blended with Skatteverket's taxeringsvärde (a free, per-property, but lagged and ~75%-of-market-value assessed baseline). This is honestly a *weaker* product claim — a market-value *estimate*, not verified comparable sales — and must be labeled as such to the customer, not presented as equivalent to what Boenderapport or Booli-based tools imply. The stronger fix remains what prior sprints already recommended: negotiate a Booli commercial tier or an allabrf.se/Mäklarstatistik partner agreement before claiming parity on this specific feature.

### Energy performance rating (PARTIAL)
Alternative: use the free register lookup manually/semi-automated for the MVP's limited pilot geography while bulk/API access terms are confirmed directly with Boverket, rather than blocking the whole report section on an unverified API. Preserves customer value fully once confirmed; degrades to "not always available" in the interim, which is an honest, disclosable limitation rather than a silent gap.

### Planning/zoning risk (PARTIAL)
Alternative: scope this section to Stockholm municipality only for the MVP (where Stockholms Stad's open-data/geodata portal is confirmed to exist), and explicitly label it "not available outside Stockholm" elsewhere rather than attempting a false national claim. This preserves most of the customer value for the initial launch geography at zero extra legal or acquisition risk, consistent with the MVP's existing Stockholm-first scope ([[14_mvp_definition]]).

### Crime/safety indicator (PARTIAL)
Alternative: present BRÅ's municipality/region-level statistic honestly labeled as area-level, not address-level, rather than implying address-specific precision. This is a presentation-honesty fix, not a data-acquisition fix — the data will never get more granular than this by policy design (statistical disclosure control), so this ceiling is permanent, not temporary.

### Object condition/renovation state (NO)
No structured public data alternative exists, and building one (CV/NLP over listing photos) both requires access to listing media (a licensing question, not just an engineering one) and is a materially harder, unproven capability. Closest honest alternative: **omit this section entirely from the MVP** and, if pursued later, source it from user-submitted or professional-inspection data rather than automated inference — this is the same conclusion [[19_feasibility_report]] Gap 4 already reached (not scoped into the MVP at all).

### Historical price of this specific unit (PARTIAL→NO)
Same blocker and same alternative as the general comps problem — no separate fix exists. If a Booli commercial agreement is reached for the comps feature, this falls out "for free" as a side effect (a single-address lookup is a subset of a comparable-set lookup); it is not worth solving independently.

---

## Part 4 — MVP definition (targeting ~80% of Boenderapport's confirmed value using only free/legal data today)

Boenderapport's *confirmed* value proposition, per Part 1, rests almost entirely on BRF financial analysis (fee-increase risk, financial strengths/weaknesses, and a bid recommendation derived from that analysis) — not, as far as this sprint could confirm, on a full sold-price comparables engine. This is a materially better starting position than assumed going into this sprint: **the hardest part of Boenderapport's stated feature set (recommended max bid, avgiftsrisk, full BRF review) sits entirely on data we have already confirmed is free, state-authoritative, and legally unambiguous (Bolagsverket).**

The MVP that preserves ~80% of that value using only free/legal data:

1. **BRF financial strengths/weaknesses review** (Part 1 §3) — fully buildable today, free, Bolagsverket-sourced.
2. **BRF fee-increase risk flag** (Part 1 §2) — fully buildable today, free, same source.
3. **A recommended max bid / price-range guidance** (Part 1 §1) — buildable, but must be **explicitly framed as a modeled estimate** (SCB FASTPI index + Skatteverket taxeringsvärde), not as "verified comparable sold prices." This is the one section where the MVP's honest capability is narrower than what Boenderapport appears to offer, and that gap must be disclosed to the customer, not hidden.
4. **Area price trend** (Part 1 §5) — free, SCB-sourced, adds context without overclaiming precision.
5. **Confidence/"why" citation panel** — every claim traceable to its specific public source document (Bolagsverket filing, SCB table), matching the transparency principle already established in [[14_mvp_definition]] and [[17_scoring_framework]].

Explicitly excluded from this MVP (per Part 3's findings): comparable sold-price listings framed as verified transactions, per-address renovation/condition assessment, address-level crime scores, and any zoning/planning claim outside the initial Stockholm launch geography.

This MVP is narrower than our own earlier six-section design ([[16_executive_summary]]) in one specific way (the price section is an estimate, not a comps engine) but is arguably **closer to Boenderapport's actual confirmed feature set** than our original design was, since Boenderapport itself does not appear to promise verified comparables either.

---

## Part 5 — Final decision

### YES WITH LIMITATIONS

The MVP as scoped in Part 4 could launch commercially today on 100% free, legally clean data, and it maps closely to what a real, currently-operating Swedish competitor (Boenderapport, charging 395 SEK/report) appears to already be selling successfully on the same core data source (Bolagsverket BRF filings). This is a stronger, more concrete signal than the theoretical "GO WITH LIMITATIONS" conclusion reached in [[19_feasibility_report]] — it is no longer just our own judgment that BRF-health-only has commercial value, there is a live market comparable actually charging money for close to this exact thing.

This is not a clean YES because of the following limitations, ranked by importance:

1. **The fair-price/max-bid number is a modeled estimate, not verified comparable sales, and this must be disclosed prominently.** If Boenderapport's own max-bid figure secretly relies on Booli or Mäklarstatistik data under a commercial license we don't have, our version will be measurably less precise on this one number, and presenting it without that caveat would be misleading to a paying customer making a high-stakes financial decision.
2. **Boenderapport's exact methodology for the "max bid" figure is unconfirmed** — this analysis could not verify (via direct site access) whether it uses sold-price comparables at all, only BRF financial ratios. If it turns out Boenderapport also relies only on BRF financials for its bid recommendation, our MVP's parity is stronger than stated here; if it secretly licenses comps data, our parity is weaker. This uncertainty should be resolved (e.g., by purchasing a sample Boenderapport report and reviewing its actual content and sourcing) before finalizing MVP marketing claims.
3. **Geographic scope is Stockholm-only for anything beyond BRF financials** (zoning/planning, transit) — must be disclosed, not silently implied as national.
4. **Several "free" data sources have unconfirmed bulk/API access mechanics** (Boverket energideklaration, BRÅ, Skatteverket taxeringsvärde bulk terms) that need direct verification before launch, not assumed from documentation alone — consistent with the *(verify)* flags already carried in `data-source-inventory.md`.
5. **Legal review of the combined multi-source data stack has still never been performed by counsel** (flagged repeatedly across three prior sprints and still open) — this remains a launch blocker independent of every data-acquisition finding in this document.

---

## Part 6 — First build phase (research/sourcing order only, no code or architecture)

### Week 1 — De-risk the one open unknown that changes everything else
- Purchase one actual Boenderapport report for a real Stockholm listing and read its full content and stated sourcing/methodology. This single step resolves the biggest open question in this analysis (does its bid recommendation use comps data or only BRF financials) and should happen before any further scoping decisions, since it changes how much of a genuine data-moat gap remains.
- In parallel, re-confirm current Bolagsverket API terms/rate limits/coverage haven't changed since the last inventory pass (`data-source-inventory.md` is dated 2026-07-13; re-verify it's still current).

### Week 2 — Verify the "free" sources that are only presumed free
- Directly confirm Boverket's energideklaration bulk/API access terms and actual per-building coverage (currently marked *(verify)*).
- Directly confirm Skatteverket's taxeringsvärde bulk-access terms (not just the single-lookup public service) — needed if the modeled valuation estimate is to run at more than one-listing-at-a-time scale.
- Confirm SCB FASTPI's exact geographic granularity available (does it go fine enough for a useful Stockholm-neighborhood-level trend adjustment, or only national/regional).

### Week 3 — Scope the fragmented sources honestly
- Catalogue exactly which Stockholms Stad open-data layers (zoning/detaljplan, bygglov) are actually usable today, with license terms, for the Stockholm-only launch geography — do not attempt to generalize to other municipalities yet.
- Decide, based on Week 1's findings, whether the fair-price section should be positioned explicitly as "estimate" language from day one, or whether a stronger claim is defensible.

### Week 4 — Commercial-viability gate before further investment
- Get a direct quote/terms conversation started with Booli (per `20_booli_alternatives.md`'s outstanding recommendation) regardless of MVP launch — this doesn't block the free-data MVP but should not be allowed to keep sitting unaddressed, since it's the fastest path to closing the comps gap if it turns out Boenderapport does rely on it.
- Consolidate Weeks 1–3 findings into a go/no-go decision on whether to proceed to product-design sprints for this narrower MVP, or to hold pending the outstanding legal-counsel review flagged in Part 5, limitation 5.
