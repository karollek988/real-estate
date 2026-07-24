# Bostadsradar Vision Review — Critical Assessment

**Type:** Strategy review (planning only, no implementation)
**Date:** 2026-07-16

## Context

The user presented a product vision for Bostadsradar (decision-support platform for Swedish property buyers) and asked for a critical startup-advisor review: strengths, weaknesses, risks, missing opportunities, better approaches. The vision was then refined (2026-07-16): Bostadsradar is *not another valuation site* but a decision-support layer combining many trusted sources with its own intelligence; reports answer "is the price reasonable / what risks / what opportunities / is the area improving"; a flagship future premium feature is an **AI Property Inspection Assistant** (personalized pre-viewing checklist); and the near-term business goal is explicitly *"build a product people are willing to pay for"* — PMF and revenue before expansion.

This review is grounded in the project's own prior research — notably `docs/19_feasibility_report.md` (Sprint 7 go/no-go), `docs/21_boenderapport_gap_analysis.md` (competitor reverse-engineering, 2026-07-15), `docs/14_mvp_definition.md`, `docs/11_product_positioning.md`, and `docs/15_success_metrics.md` — because the most important findings are places where the vision statement quietly contradicts conclusions this project has already reached twice. This vision (including the tiering in §6) should be treated as the standing direction for all future planning and implementation sessions on this project.

---

## 1. Strengths — what the vision gets right

- **"Analysis layer, not marketplace" is a real structural moat.** Hemnet/Booli earn from brokers/sellers; they structurally cannot tell a buyer "this is overpriced" or "this BRF is risky." Your incentive alignment with the buyer is genuinely defensible and already well-articulated in `11_product_positioning.md`. Complementing Booli (even linking to it) rather than cloning it is the right call.
- **"Revenue before scale" and "MVP → launch → paying customers" is the right discipline.** Deferring subscriptions/watchlists/investor tools is correct. A live competitor (boenderapport.se) charges 395 SEK per report and appears to sustain a business on it — the market's willingness to pay for exactly this category is *validated*, which is rare and valuable.
- **Verdict-shaped reports (not raw data) is the right product form.** "One verdict, one number, one price, three reasons" from `16_executive_summary.md` is stronger than the generic dashboard most data products ship. The Confidence label as a designed "safety valve" for data gaps is unusually honest and is itself a differentiator.
- **The design language and the built UI are ahead of schedule.** Landing, auth, analyzing, and report shell exist; the premium dark/glass identity is consistent. This is not where the risk is.

## 2. The core problem — the vision still leans on your one commercially-gated dataset

The refined vision softens this (it says "complement existing valuation services," which is right), but the report promise "Is the asking price reasonable?" still ultimately rests on **sold-price comparables**. Your own Sprint 7 feasibility report concluded, after two research passes, that per-object bostadsrätt sold prices are:

- **Structurally absent from public registers, permanently** (share transfers, never recorded by Lantmäteriet).
- **Legally gated behind a commercial license** (Booli commercial tier, allabrf, or Mäklarstatistik agreement). Hemnet is ToS-foreclosed entirely.
- **The load-bearing wall**: 4 of 6 report sections inherit this gap.

The vision statement reads as if this constraint doesn't exist. Meanwhile `21_boenderapport_gap_analysis.md` found the one real competitor appears to have **built its entire paid product on the data you already have for free** (Bolagsverket BRF filings) — plausibly *because* they hit the same wall. The strategic conclusion your own docs reached, and the vision should absorb rather than override: **BRF financial health is the wedge; verified comparables are a paid upgrade you negotiate for, not a launch assumption.**

Similarly, the vision re-expands scope — infrastructure projects, municipal plans, economic indicators, local news — that `14_mvp_definition.md` explicitly excluded and `21` triaged. "Our priority is not hundreds of features" and the ingredient list of 9 data domains are in tension with each other. This is classic vision drift two documents after a hard-won narrowing.

## 3. Weaknesses & risks

1. **The "can't replicate with 5 minutes of ChatGPT" bar is weaker than it sounds — today, and eroding.** ChatGPT with web search can already fetch a listing, find a BRF årsredovisning PDF, and summarize it passably. What an LLM chat *cannot* do: legally licensed comps data, guaranteed coverage, structured extraction verified against the filing, consistent scoring across thousands of BRFs, citations a bank will accept, and a tracked accuracy record. **The moat is the data pipeline + licenses + track record — the "AI interpretation" layer is table stakes, not the advantage.** Any marketing built on "AI analysis" invites the ChatGPT comparison; marketing built on "verified against the primary source, every claim cited" escapes it.
2. **"Local news that affects property values" is the riskiest item on the list.** Causally linking news to a specific property's value is exactly where LLMs hallucinate confidently. A wrong "planned development will lower values" claim in a paid report for a multi-million-SEK decision is a reputation-ending error. The tractable version already identified in `21`: *structured municipal planning data (detaljplaner, bygglov) for Stockholm municipality only* — not general news NLP.
3. **Liability and honesty exposure on "Is this property worth buying?"** A paid verdict on a several-million-SEK decision carries consumer-protection and reputational risk. The existing design (Buy/Consider/Avoid + confidence label + "we don't know" honesty rate in `15_success_metrics.md`) is the right mitigation — the vision's more confident framing ("worth buying?", "Investment Score", "Long-term Potential") should not outrun what the data supports. "Long-term Potential" in particular is a prediction; nothing in the data stack validates predictions yet.
4. **The legal review flagged in three sprints has still never happened.** Multi-license data stack (ODbL + CC0 + proprietary) plus GDPR on address-linked data is a launch blocker independent of everything else. It's absent from the vision.
5. **Platform/vendor risk:** the positioning references Booli as a friendly complement *and* the most likely paid data vendor *and* a potential competitor (Booli already has a valuation model; SBC/allabrf could add verdicts). A Booli commercial agreement is both the biggest unlock and a single-vendor dependency — worth naming in strategy, not discovering later.
6. **Distribution is unaddressed.** The moment of need is "listing open, bidding in days." How do buyers find you at that moment? SEO on BRF names ("BRF X årsredovisning analys" — thousands of long-tail pages from data you already have), the free quick-check funnel (Boenderapport does this), and mortgage-advisor/bank partnerships are the plausible channels. A great report nobody finds at the bidding moment produces no revenue.

## 4. The AI Property Inspection Assistant — strategically strong, with one condition

This is the best new idea in the refined vision, for reasons the rest of the feature list can't claim:

- **Zero gated data.** Checklists need property type, age, BRF filing facts, and energideklaration — all free or already-solved sources. No Booli license, no comps problem.
- **High perceived value at the exact right moment** (before a viewing), and a natural premium upsell attached to the report purchase.
- **It generates questions, not verdicts** — far lower liability exposure than a price call. "Ask the BRF about X" can't be wrong the way "max bid: 4.2M" can.

The condition: **built generically, it is the single most ChatGPT-replicable feature in the entire vision** — a generic "what to check when viewing an apartment" checklist is a prompt away for anyone. It only clears the vision's own moat bar if every checklist item is *grounded in this specific property's data*: "the 2024 årsredovisning mentions a planned facade renovation — ask when and how it's financed," "energy class F — ask about the heating system's age," "the BRF's loans reprice in 2027 — ask about fee planning." That grounding falls out of the same data pipeline the report needs, which is exactly why this feature belongs to Bostadsradar and not to a chat prompt. Design it as a *data-driven* checklist from day one or don't ship it as premium.

## 5. Missing opportunities

- **The free BRF quick-check as the growth engine.** Free directional read on any BRF (data is free; marginal cost ~0) → paid full report on the specific listing. This is both the funnel and the SEO asset, and the competitor has validated the pattern.
- **B2B second market for the identical artifact:** mortgage advisors, buyer-side agents, and banks assessing BRF risk. Same report, different buyer, better retention than episodic consumers. Not MVP, but should shape report design (shareable PDF, citations that survive being forwarded — already a design principle in `16`).
- **Accuracy track record as a compounding asset.** Log every verdict vs. eventual sale outcome from day one (cheap to store, impossible to backfill). In 12 months, "our fair-price calls were within X% on N tracked sales" is marketing no entrant can copy quickly.
- **Buying a Boenderapport report (395 SEK) is the single cheapest de-risking action available** — already Week 1 of the plan in `21` — it resolves whether the competitor secretly licenses comps data, which determines how much parity the free-data MVP really has.

## 6. Recommended reshaping (better approach)

Keep the mission and design language. Restate the product strategy as **staged tiers keyed to data feasibility**, so vision and feasibility stop contradicting each other:

- **Tier 1 — launchable now, 100% free/legal data:** BRF financial review + fee-increase risk + modeled price *estimate* (SCB FASTPI + taxeringsvärde, honestly labeled as an estimate, not comps) + area trend + citations/confidence panel. Stockholm bostadsrätter only. This ≈ the Part 4 MVP in `21` and ≈ what the competitor sells for 395 SEK.
- **Tier 2 — after direct verification:** energideklaration, Stockholm detaljplan/bygglov flags, transit/school context, and the **data-grounded Inspection Assistant** (§4) as the first premium add-on — it reuses Tier 1's pipeline and needs no new gated data.
- **Tier 3 — after a signed data agreement:** verified comparable sales, unit sale history, true fair-price range. This is a business-development milestone, not an engineering one.
- **Never (restate explicitly):** Hemnet-derived data, per-address crime scores, automated renovation-state inference, general news→value causal claims.

Report conclusions for Tier 1 should be: Fair-price *estimate* (labeled), BRF Risk Level, Strengths, Weaknesses, Confidence, AI Summary. Hold "Investment Score" and "Long-term Potential" for Tier 3 — don't print numbers the data can't defend.

**Pricing:** per-report one-off (anchor near/under 395 SEK) fits the episodic buyer moment; the Silver/Gold/Platinum subscription idea fits the later B2B/investor audience, not the MVP consumer. The vision already defers this — correctly.

## 7. Concrete next steps (all non-code, ordered)

1. Buy one Boenderapport report for a real Stockholm listing; compare its sourcing/claims against the Tier 1 scope (resolves the biggest open competitive unknown).
2. Verify the three *(verify)* data sources: Boverket energideklaration access, Skatteverket taxeringsvärde bulk terms, SCB FASTPI granularity (Week 2 of `21`'s plan).
3. Open the Booli commercial-tier conversation now (long lead time; gates Tier 3; also clarifies the complement-vs-vendor relationship).
4. Commission the legal/GDPR review of the combined data stack — still the unresolved launch blocker.
5. Only then: product-design sprint for the Tier 1 report (revise `16_executive_summary.md` to the estimate-based price section) and the accuracy-logging schema.

## Verification

This is a strategy document, not code; "verification" = the user agrees or amends. Success criteria: the vision document and `14`/`16`/`21` stop contradicting each other on (a) whether comps data is assumed at launch, (b) which report conclusions ship in Tier 1, and (c) the ordered de-risk list above being adopted or explicitly rejected.
