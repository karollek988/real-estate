# Sprint: Is Booli Truly Our Only Source of Swedish Sold-Property Data?

Date: 2026-07-13
Type: Pure research (no code, no product design)
Trigger: Prior research treated Booli as the only viable source after Hemnet's ToS ban and BRF reports being the wrong data shape (financial statements, not transactions). This sprint stress-tests that assumption.

---

## Executive Summary

Booli is **not** the only place sold-property transaction data exists in Sweden — it is the only place it exists *already scraped, cleaned, and free to re-scrape at low effort*. The actual primary-source system of record for Swedish property transactions is **Lantmäteriet's Fastighetsprisregistret** (the Property Price Register), which is the direct analogue of the UK's HM Land Registry Price Paid Data. Unlike the UK dataset, however, it is **not free bulk open data** — it is a paid, order-based product (Fastighetsprisuttag / Fastighetsprisavisering), priced per record or per subscription, not published as a downloadable CC0 file.

A second, genuinely free and CC0-licensed data source exists: **SCB (Statistics Sweden)** publishes real estate price statistics and a quarterly Real Estate Price Index (FASTPI), and **Skatteverket** publishes individual-property assessed tax values (taxeringsvärde) via a free public lookup and open-data API. Neither gives individual sold-property transaction records at address-level granularity for free, but both are legally bulletproof and could support a modeled/approximated valuation product without ever touching Booli or Hemnet.

A third source, **Svensk Mäklarstatistik**, aggregates data from nearly all Swedish real estate brokers and sells API access to aggregated statistics — it is commercially licensable but is a paid B2B data vendor, not free, and (per a 2020 dispute investigated by the Swedish Competition Authority) has previously restricted downstream redistribution rights even to established partners like Valueguard.

None of the GitHub scraper projects found for Booli or Hemnet solve the *legal* problem — they solve only the *technical* problem, and technical ease was never the blocker.

**Bottom line for the 4 final questions:** Booli is not the only realistic option, but it may still be the cheapest *starting* option for an MVP if scraped narrowly and the legal exposure is consciously accepted as a v0/prototype risk, not a permanent architecture. The financially and legally clean long-term path is Lantmäteriet's paid register (primary data) blended with SCB/Skatteverket free data (context, index, valuation baseline) — this is the "found a company the right way" answer.

---

## 1. Open-source GitHub scrapers/projects

| Project | URL | Activity | What it collects | Commercial legal reuse |
|---|---|---|---|---|
| hempriser | github.com/pierrelefevre/hempriser | Personal/hobby project | Scrapes Hemnet *for-sale* listings, trains a price-prediction ML model | Scrapes Hemnet directly — Hemnet's ToS explicitly bans scraping (already confirmed in prior research). Reusing this in a commercial product inherits that ToS violation risk directly. |
| hemnet_scrapy (skaty5678) | github.com/skaty5678/hemnet_scrapy | Scrapy-based crawler, villas only | Address, price, rooms, living area, plot size | Same Hemnet ToS problem; also for-sale listings, not sold prices |
| hemnet-scraper (shymaseliza) | github.com/shymaseliza/hemnet-scraper | Small hobby repo | Listings, pricing, broker details | Same as above |
| rbooli | github.com/reinholdsson/rbooli | R wrapper around **Booli's own public API** | Whatever Booli's API exposes (sold price history is part of Booli's public API surface) | This is different in kind: it wraps Booli's *sanctioned* API, not a scrape. Legal status = subject to Booli's API Terms of Use, not scraping law. Could not fetch Booli's terms page directly (404 on `/api/`); Booli's current developer terms need to be confirmed directly with Booli, but historically Booli has run an "öppet API" (open API) that requires registration/acceptance of Terms of Use — meaning commercial use is plausible but requires explicit permission, not assumed. |
| booli-api (rinti, npm) | npmjs.com/package/@booli/booli-api, github.com/rinti/booli-api | Node wrapper, same as rbooli | Same as above | Same as above — official API wrapper, not a ToS-violating scrape |
| Various Apify "Booli.se Scraper" / "Hemnet Scraper" listings | apify.com/lexis-solutions/*, apify.com/stable.scraper/*, etc. | Actively maintained commercial scraping-as-a-service products | Full listing/sold-price fields, 30+ fields per property | These are third parties selling scraped data as a service. Using their output in a downstream commercial product does not launder the legal risk — the underlying ToS violation (against Hemnet's explicit ban, and against whatever Booli's ToS says about automated bulk extraction beyond the API) still exists, and EU sui generis database rights (Directive 96/9/EC) can attach independently of ToS if "substantial investment" in the database can be shown, which is very plausible for both Booli and Hemnet given they are established commercial data operations. |

**Conclusion for this section:** No GitHub or scraper-marketplace project changes the underlying legal picture already established in prior research. The two "API wrapper" projects (rbooli, booli-api) are the only ones operating inside a vendor's sanctioned channel rather than against its ToS, and even those require verifying Booli's current commercial terms directly with Booli before building a paid product on top.

Sources: [hempriser](https://github.com/pierrelefevre/hempriser), [hemnet_scrapy](https://github.com/skaty5678/hemnet_scrapy), [hemnet-scraper](https://github.com/shymaseliza/hemnet-scraper), [rbooli](https://github.com/reinholdsson/rbooli), [booli-api npm](https://www.npmjs.com/package/@booli/booli-api), [Apify Booli.se Scraper](https://apify.com/lexis-solutions/booli-se-scraper/api/python)

---

## 2. Existing commercial/SaaS APIs for Swedish/Nordic property data

### Lantmäteriet — Fastighetsprisregistret (Property Price Register)
This is the actual system-of-record: the Swedish state cadastral and land registration authority records every property transfer, including **purchase price (köpeskilling), purchase date, buyer and seller, and property identifiers**. It is the direct Swedish analogue of the UK's HM Land Registry Price Paid Data.

Two ordering products exist:
- **Fastighetsprisuttag** ("Property Price Extract") — a one-time export of transactions for a chosen geographic area, described by Lantmäteriet as "a snapshot of information at the time of transfer."
- **Fastighetsprisavisering** ("Property Price Alert") — an ongoing subscription/monitoring feed for transactions in a geographic area.

Critically, unlike the UK dataset, this is **not free open data** — it is not listed among Lantmäteriet's CC0 open-data products, and the product pages route to an ordering/quote process rather than a direct download link or public API key. Pricing was not disclosed on the pages fetched; must be obtained by direct inquiry with Lantmäteriet (typically these registers are priced per record or per subscription band in Sweden's geodata product catalogue). Format and delivery mechanism (API vs. file) is also not published and needs direct confirmation.

This is the single most important finding of this sprint: **a legally clean, authoritative, government-run transaction register exists and is commercially licensable — it has simply never been free.**

Sources: [Fastighetsprisregistret](https://www.lantmateriet.se/sv/fastighet-och-mark/information-om-fastigheter/Fastighetsprisregistret/), [Lantmäteriet produktlista](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/), [Lantmäteriet öppna data license](https://opendata.lantmateriet.se/)

### SCB (Statistics Sweden) — Fastighetspriser och lagfarter / FASTPI
SCB publishes **aggregated** real estate price statistics ("comprehensive for the entire real estate market," based on granted title registrations) and the **Fastighetsprisindex (FASTPI)**, a quarterly/annual quality-adjusted price index for one/two-dwelling houses, holiday homes, and agricultural properties. This is **free, CC0-licensed, and accessible via API** (PxWeb), with generous rate limits (10 calls/10s, up to 100,000 values per table).

Limitation: this is statistical/aggregate data (index values, regional averages), not individual per-property sold-price transaction records. It's a valuable free ingredient for a valuation model or for market-level context in a report, but cannot substitute for transaction-level Booli/Lantmäteriet data.

Sources: [SCB open data/API](https://www.scb.se/en/services/open-data-api/), [SCB Fastighetspriser och lagfarter](https://www.scb.se/hitta-statistik/statistik-efter-amne/boende-bebyggelse-och-mark/fastigheter/fastighetspriser-och-lagfarter/), [SCB Real estate price index EN](https://www.scb.se/en/finding-statistics/statistics-by-subject-area/housing-construction-and-building/real-estate/real-estate-prices-and-registrations-of-title/)

### Svensk Mäklarstatistik
Aggregates monthly reported data from nearly all Swedish real estate brokers. Offers a paid API for **aggregated** statistics by region (not raw individual sold-price records as far as public documentation shows). Notably, in 2020 it terminated its long-standing data-supply agreement with Valueguard over redistribution/publishing rights, and the dispute reached the Swedish Competition Authority (which ultimately required Svensk Mäklarstatistik to continue supplying data, given its de facto market-data monopoly position) — illustrating that even licensed commercial partners have faced restrictive terms from this vendor. Any commercial dependency on Mäklarstatistik data should assume contract terms will be restrictive on redistribution/publishing, not assume open reuse.

Sources: [Mäklarstatistik API](https://www.maklarstatistik.se/svensk-maklarstatistiks-api-aggregerad-statistik/), [Competition Authority — must continue to deliver data](https://www.konkurrensverket.se/en/news/svensk-maklarstatistik-must-continue-to-deliver-data-on-the-housing-market/), [Competition Authority — investigation closed](https://www.konkurrensverket.se/en/news/the-swedish-competition-authority-closes-the-investigation-concerning-svensk-maklarstatistik/)

### Valueguard (HOX Index)
Valueguard's HOX index (developed with KTH and Nasdaq OMX) is built from ~95% of brokered transactions, sourced originally from Svensk Mäklarstatistik. It is a **subscription index product** (API or file delivery) aimed at institutional/professional users (banks, funds), priced per subscription tier — not a source of raw transaction records, and not cheap for an early-stage startup. Relevant mainly as a benchmark/validation index for a model, not as raw data supply.

Sources: [Valueguard HOX Price Index](https://valueguard.se/en/the-offer/valueguard-hox-price-index/), [Bloomberg on 2023 ruling limiting HOX publication](https://www.bloomberg.com/news/articles/2023-02-10/swedish-ruling-bars-publication-of-key-housing-data-amid-rout)

### Booli's own API
Booli has historically operated a public/"öppet" API requiring developer registration and acceptance of Terms of Use (confirmed via community references and existing R/Node wrappers), rather than a scrape-only posture. This matters: if Booli's *sanctioned* API can be used under a commercial license (paid tier or otherwise), that is a categorically different and safer path than scraping booli.se pages directly. This sprint could not retrieve Booli's current terms page directly (404 encountered on the guessed URL) — **direct outreach to Booli or a fetch of their live `/api` docs page is a required follow-up** before concluding anything about commercial API licensing terms.

Sources: [Booli Legal Terms page reference (via search)](https://booli.ai/legal/), [rbooli wrapper](https://github.com/reinholdsson/rbooli)

---

## 3. Public government / EU open datasets

- **Lantmäteriet öppna data (opendata.lantmateriet.se)**: general open geodata portal, CC0-licensed, free for commercial use — but the Fastighetsprisregistret (transaction prices) is **not** among the free open-data products; it sits in the paid ordering catalogue instead. This is the key structural difference from the UK.
- **UK HM Land Registry Price Paid Data**: the closest international analogue — free, bulk-downloadable (CSV/TXT/linked data), monthly-updated, under the Open Government Licence v3.0, explicitly permitting commercial and non-commercial use, with 24M+ records back to 1995. **Sweden has no equivalent free bulk dataset.** This is a real and significant policy gap between the two countries; Sweden's version of the same underlying data exists but is commercialized by Lantmäteriet rather than published freely.
- **SCB open data / EU Open Data Portal**: aggregate statistics only, as above — useful for benchmarking/context, not transaction-level data.
- **Skatteverket taxeringsvärde (assessed tax value) service**: Skatteverket runs a free public lookup ("Söka taxeringsvärde") where anyone can retrieve the assessed tax value for virtually any Swedish property by municipality + property designation, and also publishes related data via an open API/developer portal ("riktvärde" guide values as open data). This is genuinely free, per-property, and legally unambiguous — but it is an assessed *tax* value (historically ~75% of market value per statute, per secondary sources), not the actual transaction/sold price, and updates infrequently (multi-year assessment cycles), so it's a noisy proxy rather than ground truth.
- **Lantmäteriet "Taxering Direkt"**: a paid product bundling property-register taxation/valuation-unit data — same commercial-catalogue pattern as Fastighetsprisregistret.

Sources: [UK Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads), [UK Land Registry Open Data](https://landregistry.data.gov.uk/), [Skatteverket Söka taxeringsvärde](https://www.skatteverket.se/privat/fastigheterochbostad/fastighetstaxering/sokataxeringsvarde.4.109dcbe71721adafd251470.html), [Skatteverket API/öppna data developer portal](https://www7.skatteverket.se/portal/apier-och-oppna-data/utvecklarportalen/api/fastighetstaxering-taxeringsuppgifter/2.0.1/%C3%96versikt), [Lantmäteriet Taxering Direkt](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/taxering-direkt/), [Lantmäteriet värde på mark och fastighet](https://www.lantmateriet.se/sv/fastighet-och-mark/kopa-aga-salja-eller-ge-bort/varde-pa-mark-och-fastighet/)

---

## 4. Kaggle / university / archived / community datasets

No dedicated Kaggle or archived academic dataset of *Swedish sold-property transactions* was found during this sprint's searches (the UK Land Registry data does appear on Kaggle as a mirror of the free government dataset — again highlighting that the UK's open-data policy is what makes that mirror possible, not any scraping effort). No Swedish equivalent mirror exists on Kaggle, consistent with there being no free bulk source to mirror. This is not conclusive proof of absence (a deeper Kaggle-specific and university-repository-specific search would be needed to fully close this out), but nothing surfaced in general web/GitHub searches, which is itself informative given how much attention the Booli/Hemnet scraping niche gets in blogs and dev tutorials.

---

## 5. Data brokers, broker software vendors, partnerships

Targeted search results did not surface a Vitec (Sweden's dominant real-estate brokerage back-office software vendor) or "Fastighetsbyrån systems" data-feed/partnership API in this sprint's searches — this line of inquiry returned no direct hits and needs a dedicated follow-up sprint (e.g., searching Vitec's own developer/partner portal, and Swedish real-estate-tech partnership announcements) before it can be ruled in or out. Given Vitec's dominant position running the transaction/back-office software for the majority of Swedish brokers, a data or API partnership with them (or with a smaller broker-software competitor) is plausible in principle but unverified — treat as an open lead, not a confirmed option.

---

## 6. International comparables

- **UK**: HM Land Registry Price Paid Data — free, open, government-run, monthly, OGL v3.0. The gold-standard model; Sweden has the equivalent underlying register (Fastighetsprisregistret) but has chosen a commercialized-access model instead of open publication.
- The existence of a UK company/ecosystem built entirely on this free government feed (dozens of UK proptech analytics startups: Zoopla, Rightmove sold-price tools, HouseCanary-style AVMs, etc.) is a strong argument that **the fundamental data type this project needs does get open-sourced by governments elsewhere** — Sweden's choice not to is a policy/pricing fact to work around, not a technical inevitability.
- Countries with similarly open registries (indicative, not exhaustively verified this sprint): several EU land registries publish transaction data with varying openness; a follow-up sprint could map Denmark, Netherlands, and Finland equivalents to see which Nordic peer is most analogous and whether any pan-Nordic vendor already aggregates this (worth checking specifically, since Nordic proptech markets are closely linked).

Sources: [UK Price Paid Data](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads), [ODI impact case study on HMLR Price Paid Data](https://odimpact.org/case-united-kingdoms-hm-land-registry-price-paid-data.html)

---

## 7. Alternative/reconstruction approaches (modeling around the gap)

This is the most promising non-scraping direction:

- **SCB FASTPI index + Skatteverket taxeringsvärde + Lantmäteriet BRF/cadastre attributes**, combined, could support a **valuation *estimate*** (an AVM — automated valuation model) without ever touching an individual sold-price record from Booli or Hemnet:
  - Taxeringsvärde gives a free, per-property baseline (noisy, lagged, ~75%-of-market-value by statute).
  - FASTPI/SCB regional index gives the time/region adjustment factor to bring a multi-year-old assessed value to a current-market estimate.
  - BRF annual reports (already confirmed free in prior research) give building/association-level financial health context for apartments.
  - Public cadastral attributes (Lantmäteriet open geodata: area, property type, location) provide the feature set.
  - This reconstructs a **valuation estimate**, not verified historical sold prices — it would be positioned as a market-value estimate product (AVM), which is a materially different and weaker product than a "verified comparable sales" tool, but it is 100% legally clean and free to build.
- **Hemnet asking prices vs. eventual sold price**: even if Hemnet's listing (asking-price) data could legally be used (it currently cannot per ToS), asking price is a biased, systematically-different quantity from sold price (typically listings show "accepted price"/final price in Sweden once sold, actually — Hemnet does show final sold price for closed listings in many cases, which is exactly why it's valuable and exactly why it's protected). This reinforces why Hemnet locked this down — it is not a peripheral feature to them, it's the core asset.
- **Combining a *paid* Lantmäteriet Fastighetsprisuttag extract for a limited pilot geography** (e.g., one municipality) with the free SCB/Skatteverket layers is the most defensible MVP-scale path: it buys genuine, ground-truth transaction records legally, at a bounded and quotable cost, without needing full national coverage on day one.

---

## 8. Technically possible / Legally allowed / Commercially viable — summary table

| Source | Technically possible | Legally allowed (commercial product) | Commercially viable (cost/coverage) |
|---|---|---|---|
| Scraping Hemnet (any method) | Yes, trivially (many OSS scrapers exist) | **No** — explicit ToS ban already confirmed; sui generis database right risk also plausible given Hemnet's clear commercial investment in the dataset | N/A — legal risk dominates |
| Scraping Booli pages directly (bypassing API) | Yes | Uncertain/likely No — same database-right logic applies; Booli's ToS need direct re-confirmation | N/A until legal status confirmed |
| Booli's official API (registered, ToS-accepted) | Yes | Plausible, but commercial-tier terms unconfirmed this sprint (page 404'd) — **requires direct follow-up with Booli** | Unknown pricing; likely the cheapest *legal* path if commercial terms are workable |
| Lantmäteriet Fastighetsprisregistret (Fastighetsprisuttag/-avisering) | Yes (ordering process) | **Yes** — official government register, ordered directly, no scraping/ToS issue | Cost undisclosed publicly; needs direct quote; likely priced per record/subscription — real but bounded startup cost |
| SCB FASTPI / real estate price statistics | Yes (open API) | Yes — CC0, explicitly free for commercial use | Yes, free — but aggregate-only, not transaction-level |
| Skatteverket taxeringsvärde lookup/API | Yes | Yes — free public service | Yes, free — but assessed value, not sold price, and lagged |
| Svensk Mäklarstatistik API | Yes (paid API key) | Yes, under contract — but redistribution/publishing rights have historically been restricted even for established partners | Paid B2B vendor; viable only for aggregated stats, not raw records |
| Valueguard HOX index | Yes (subscription) | Yes, under license | Paid, aimed at institutional users — likely too costly/aggregate-only for an early-stage MVP |
| BRF annual reports (Bolagsverket) | Yes (already confirmed) | Yes — free public data | Yes, free — but wrong data shape (association financials, not sale prices) |
| GitHub OSS scrapers (Hemnet/Booli) | Yes | Inherits underlying site's legal status (mostly No for Hemnet; conditional for Booli) | N/A |

---

## Conclusion

**1. Is Booli truly our only realistic option?**
No. It is the only source that is *already scraped and structured for free*, which is why it kept surfacing as "the" option. But the actual system of record — Lantmäteriet's Fastighetsprisregistret — is a real, legally clean, commercially licensable alternative that was simply overlooked because it isn't free open data and doesn't show up in "open dataset" searches the way UK Land Registry does. Booli's own sanctioned API is also a distinct, safer option from scraping booli.se, pending confirmation of its commercial terms.

**2. If not, what alternatives exist?**
Ranked by legal cleanliness and data fidelity:
1. Lantmäteriet Fastighetsprisregistret (paid, official, ground-truth transaction records) — the real Swedish "Land Registry Price Paid Data" equivalent, just commercialized instead of open.
2. Booli's official API under its commercial terms (pending direct confirmation) — likely the cheapest legal path if terms permit a paid startup product.
3. SCB (FASTPI) + Skatteverket (taxeringsvärde) blended into a modeled valuation estimate — free, legally bulletproof, but an *estimate* product, not verified comparables.
4. Svensk Mäklarstatistik / Valueguard — paid, aggregate-level, institutional-grade, likely too expensive/restrictive for an MVP.
5. Scraping Hemnet or booli.se directly — technically trivial but the legally weakest option; not recommended as a permanent foundation.

**3. Which alternative would I recommend?**
Pursue a two-track approach: (a) get a direct quote and terms confirmation from Lantmäteriet for a bounded pilot-geography Fastighetsprisuttag extract (this converts an unknown legal/cost risk into a known, quotable one, and gives genuine ground-truth data), while in parallel (b) directly contact Booli to clarify current commercial API terms — if Booli's own API supports a paid commercial tier, that may be both cheaper and faster than the Lantmäteriet ordering process for an MVP. Do not build the long-term architecture on scraped Hemnet/Booli pages; if a prototype must ship before either of these is resolved, treat any scraping as an explicitly time-boxed, throwaway v0 risk, not the production data pipeline.

**4. If founding this company myself, how would I solve data acquisition?**
I would not start by scraping. I would start with two phone calls: one to Lantmäteriet's geodata sales team to get an actual price quote for a single-municipality Fastighetsprisuttag extract (turning today's biggest unknown — "what does the real register even cost" — into a number within a week), and one to Booli's API/partnerships team to ask directly whether their API supports a commercial analytics product and at what tier. Whichever answer comes back cheaper and faster becomes the v1 transaction-data backbone, blended immediately with the free SCB index and Skatteverket taxeringsvärde data for context and gap-filling between paid data refreshes. I would treat "Booli is our only option" as disproven the moment Lantmäteriet's actual quote comes in — even if it's more expensive than free, a government register is a foundation that can't be revoked by a ToS change or a cease-and-desist, which is worth more to a company's survival than the marginal cost saved by scraping.

---

## Open follow-ups for next sprint
- Get an actual price quote from Lantmäteriet for Fastighetsprisuttag (single municipality, e.g. Stockholm or a mid-size test municipality) and confirm delivery format.
- Directly fetch/contact Booli for current API Terms of Use and commercial-tier pricing (this sprint's WebFetch to booli.se/api/ 404'd; needs a live check or direct outreach).
- Confirm whether Vitec or another brokerage-software vendor has a data/API partnership program (this sprint's searches returned no hits — inconclusive, not a "no").
- Map Nordic-peer registries (Denmark, Netherlands, Finland) for a possible pan-Nordic vendor shortcut.
