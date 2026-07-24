# BRF Knowledge Base

> **Status: DESIGN DOCUMENT.** This is the single source of truth for every
> financial concept used in the reasoning engine. Every metric, threshold,
> formula, and interpretation rule lives here. The reasoning engine does not
> have hardcoded knowledge — it reads this knowledge base.
>
> Every entry is structured so that a deterministic system can load it,
> evaluate it, and trace every conclusion back to this document.

---

# How to Read This Document

Each metric entry contains the same fields in the same order. This is
deliberate — the reasoning engine processes them uniformly.

**Field definitions:**

| Field | What it means |
|-------|---------------|
| **Category** | Which group this metric belongs to |
| **Type** | OBJECTIVE_FACT, CALCULATED, INTERPRETATION, or RECOMMENDATION |
| **Name** | Swedish name and common abbreviations |
| **Formula** | Exact calculation. "EXTRACTED" if it comes directly from the annual report |
| **Unit** | SEK, SEK/m², %, count, ratio, or dimensionless |
| **Source** | Where in the annual report this appears (page section, table name) |
| **Typical range** | What you normally see in Swedish BRFs |
| **Risk thresholds** | Exact numbers that trigger caution, warning, or critical signals |
| **Trend interpretation** | How to read the multi-year direction of this metric |
| **Dependencies** | Which other metrics this one feeds into |
| **Exceptions** | Cases where the normal rules don't apply |
| **Do not interpret when** | Conditions under which this metric should not be used for conclusions |
| **Buyer impact** | What this metric means for the person buying the apartment |
| **Confidence requirement** | Minimum extraction confidence needed to use this metric |

---

# Category A: Income Statement (Rörelseresultat)

The income statement tells you whether the BRF earns enough to cover its costs.
It is the single most important financial statement for assessing operational health.

---

## A1. Revenue (Bruttointäkter / Intäkter)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Bruttointäkter" or "Intäkter"
- **Typical range:** 40,000-120,000 SEK per apartment per year (varies by BRF size, location, and fee level)
- **Risk thresholds:**
  - Below 30,000 SEK/apartment: investigate why (small BRF, low fees, or missing revenue streams)
  - Above 150,000 SEK/apartment: unusual — may indicate significant commercial rental income
- **Trend interpretation:**
  - Increasing: normal if driven by fee increases or new tenants. Investigate cause.
  - Decreasing: serious concern. May indicate lost commercial tenants, declining occupancy, or fee cuts.
  - Stable: expected for mature BRFs with predictable fee structures.
- **Dependencies:** Feeds into operating_margin, fee_sustainability, revenue_per_apartment, revenue_per_sqm
- **Exceptions:**
  - BRFs with large commercial premises may have much higher revenue per apartment than residential-only BRFs
  - Newly formed BRFs may show incomplete-year revenue
- **Do not interpret when:**
  - Revenue is reported for a partial fiscal year (e.g., BRF founded mid-year)
  - Revenue includes one-time items (e.g., sale of a commercial premise) — check notes for "engångsposter"
- **Buyer impact:** Revenue directly funds the BRF's operations. Declining revenue means either fee increases or service cuts. Stable or growing revenue (from organic sources) is positive.
- **Confidence requirement:** ≥ 0.80 to use in analysis

---

## A2. Operating Costs (Rörelsekostnader)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Rörelsekostnader"
- **Typical range:** 35,000-100,000 SEK per apartment per year
- **Risk thresholds:**
  - Above 120,000 SEK/apartment: investigate — may indicate deferred maintenance, expensive contracts, or inefficiency
  - Below 25,000 SEK/apartment: unusually low — may indicate deferred maintenance or incomplete reporting
- **Trend interpretation:**
  - Increasing faster than revenue: the BRF is becoming less efficient. Warning.
  - Increasing in line with revenue: normal inflationary growth.
  - Decreasing: investigate — may be genuine efficiency gains or may indicate deferred maintenance.
  - Stable: expected for mature BRFs.
- **Dependencies:** Feeds into operating_profit, operating_margin, cost_per_apartment, cost_per_sqm, fee_sustainability
- **Exceptions:**
  - BRFs with major one-time repairs will show cost spikes. Check notes for "underhållsinsatser" or "renovering".
  - BRFs in cold climates may have higher heating costs (check SMHI data for context).
- **Do not interpret when:**
  - Costs include one-time items that inflate the figure (e.g., emergency roof repair)
  - The BRF has recently merged with another association (costs may be transitional)
- **Buyer impact:** High or rising costs directly lead to fee increases. Costs that outpace revenue are the most common path to financial distress in BRFs.
- **Confidence requirement:** ≥ 0.80

---

## A3. Operating Profit (Rörelseresultat)

- **Type:** OBJECTIVE_FACT (the number) / INTERPRETATION (what it means)
- **Formula:** EXTRACTED or CALCULATED: revenue − operating_costs
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Rörelseresultat"
- **Typical range:** -50,000 to +200,000 SEK per apartment per year
- **Risk thresholds:**
  - Positive: the BRF covers its operating costs from income. Healthy.
  - Negative: the BRF is spending reserves to cover costs. Unsustainable if persistent.
  - Below -100,000 SEK/apartment: critical. Reserves depleting rapidly.
- **Trend interpretation:**
  - Positive and stable: ideal. The BRF is self-sustaining.
  - Positive and increasing: very strong. The BRF is building reserves.
  - Positive but declining: investigate. Profitability is eroding.
  - Negative for 1 year: may be a one-time event. Check notes.
  - Negative for 2+ years: critical. The BRF is consuming reserves systematically.
- **Dependencies:** Feeds into operating_margin, interest_coverage, profitability_trend, all financial health assessments
- **Exceptions:**
  - A single negative year after many positive years may be caused by a large one-time repair. Check the notes and the year's events.
  - A single positive year after many negative years does not mean the problem is solved. Check the trend.
- **Do not interpret when:**
  - The figure includes one-time items that significantly distort it (check notes for "särskilda poster")
  - The BRF is newly formed and has a partial first year
- **Buyer impact:** The single most important operational metric. Positive operating profit means the BRF can sustain itself without raising fees or imposing special assessments. Negative operating profit means fees will likely increase.
- **Confidence requirement:** ≥ 0.85

---

## A4. Financial Income (Finansintäkter)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Finansintäkter"
- **Typical range:** 0-200,000 SEK/year (depends on savings and investment portfolio)
- **Risk thresholds:**
  - Unusually high relative to cash holdings: investigate source (may be non-recurring)
  - Zero when the BRF has significant cash deposits: unusual — may indicate funds are invested in non-liquid instruments
- **Trend interpretation:** Generally not a focus metric unless the BRF has significant financial assets.
- **Dependencies:** Feeds into profit_before_tax, interest_income_per_apartment
- **Exceptions:**
  - One-time financial gains (e.g., sale of an investment) should be identified and excluded from trend analysis
- **Do not interpret when:**
  - Financial income includes realized capital gains (one-time events)
- **Buyer impact:** Minor for most buyers. Significant if the BRF relies on financial income to offset operating losses — that is not sustainable.
- **Confidence requirement:** ≥ 0.70

---

## A5. Financial Costs (Finanskostnader)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Finanskostnader"
- **Typical range:** 50,000-500,000 SEK/year (depends entirely on debt level and interest rates)
- **Risk thresholds:**
  - Above 50% of revenue: the BRF spends more on interest than it earns. Serious concern.
  - Growing faster than operating profit: the BRF's ability to service debt is deteriorating.
- **Trend interpretation:**
  - Increasing: the BRF's debt burden is growing (either from new borrowing or rising interest rates)
  - Decreasing: the BRF is paying down debt or refinancing at lower rates
  - Stable: expected if loan portfolio is fixed-rate
- **Dependencies:** Feeds into interest_coverage, interest_cost_per_apartment, debt_service_ratio, profit_before_tax
- **Exceptions:**
  - Interest rate changes affect this metric even if the BRF does nothing. A rising Riksbanken rate will increase financial costs for floating-rate loans.
- **Do not interpret when:**
  - Financial costs include arrangement fees or one-time bank charges
- **Buyer impact:** Financial costs are a direct cost to the buyer. Higher financial costs = higher fees. The buyer inherits the BRF's interest rate exposure.
- **Confidence requirement:** ≥ 0.80

---

## A6. Profit Before Tax (Resultat före skatt)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED or CALCULATED: operating_profit + financial_income − financial_costs
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Resultat före skatt"
- **Typical range:** -100,000 to +200,000 SEK/year
- **Risk thresholds:**
  - Negative: the BRF is operating at a loss after financing costs
  - Declining trend: the BRF's financial position is deteriorating
- **Trend interpretation:** Similar to operating_profit but also reflects the impact of debt servicing costs.
- **Dependencies:** Feeds into profit_after_tax, overall financial health assessment
- **Exceptions:** Same as operating_profit — check for one-time items.
- **Do not interpret when:** Same as operating_profit.
- **Buyer impact:** This is the "real" bottom line before tax. It shows whether the BRF is truly self-sustaining after paying all costs including interest.
- **Confidence requirement:** ≥ 0.80

---

## A7. Profit After Tax (Resultat efter skatt)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED or CALCULATED: profit_before_tax − tax
- **Unit:** SEK/year
- **Source:** Årsredovisning → Rörelseresultat → "Resultat efter skatt"
- **Typical range:** -100,000 to +200,000 SEK/year
- **Risk thresholds:**
  - Negative for 2+ years: the BRF is depleting reserves
  - Positive: the BRF is adding to reserves (from operations)
- **Trend interpretation:** This is the final word on whether the BRF added to or subtracted from its reserves during the year.
- **Dependencies:** Feeds into equity trend (the change in equity from operations)
- **Exceptions:** Tax can vary year to year based on deductions. Don't over-interpret small year-to-year changes in the tax component.
- **Do not interpret when:** The BRF has received tax rebates or one-time tax adjustments.
- **Buyer impact:** This is what actually went into (or came out of) the BRF's reserves. The buyer's apartment value is directly tied to the BRF's equity.
- **Confidence requirement:** ≥ 0.80

---

# Category B: Balance Sheet (Balansräkning)

The balance sheet tells you what the BRF owns, what it owes, and what belongs
to the members. It is a snapshot at a single point in time.

---

## B1. Total Assets (Summa tillgångar)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Summa tillgångar"
- **Typical range:** 5,000,000-50,000,000 SEK (depends on BRF size and property values)
- **Risk thresholds:**
  - Declining trend without corresponding debt reduction: investigate
- **Trend interpretation:** Total assets generally grow slowly over time as property values appreciate. Sudden drops indicate asset sales or write-downs.
- **Dependencies:** Feeds into equity_ratio, debt_ratio, asset_per_apartment
- **Exceptions:**
  - Property revaluations can cause large one-time jumps in assets. These are paper gains and should be noted.
- **Do not interpret when:** The BRF has recently undergone a major revaluation or structural change.
- **Buyer impact:** Higher assets per apartment generally means a wealthier, more resilient BRF.
- **Confidence requirement:** ≥ 0.80

---

## B2. Current Assets (Omsättningstillgångar)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Omsättningstillgångar"
- **Typical range:** 200,000-5,000,000 SEK
- **Risk thresholds:**
  - Below 100,000 SEK total: very low liquidity. The BRF may struggle with short-term obligations.
  - Above 20% of total assets: may indicate the BRF is holding too much cash (opportunity cost)
- **Trend interpretation:** Fluctuation is normal as cash moves in and out. Sustained decline may indicate liquidity pressure.
- **Dependencies:** Feeds into liquidity assessment, cash_per_apartment
- **Exceptions:** Some BRFs hold large cash reserves for planned renovations. This is not necessarily idle cash.
- **Do not interpret when:** The figure includes restricted funds (fonderade medel) that cannot be used for general operations.
- **Buyer impact:** Low current assets mean the BRF has little buffer for unexpected expenses. The buyer may face special assessments sooner.
- **Confidence requirement:** ≥ 0.70

---

## B3. Fixed Assets (Anläggningstillgångar)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Anläggningstillgångar"
- **Typical range:** 4,000,000-45,000,000 SEK
- **Risk thresholds:**
  - Significant write-downs: may indicate building deterioration or impairment
- **Trend interpretation:** Should grow slowly with property value appreciation. Sharp declines indicate write-downs.
- **Dependencies:** Feeds into total_assets, asset_per_apartment
- **Exceptions:** Property revaluations cause jumps. Depreciation policies vary.
- **Do not interpret when:** The BRF has undergone a revaluation during the year.
- **Buyer impact:** Fixed assets are primarily the building itself. This is the physical asset backing the buyer's investment.
- **Confidence requirement:** ≥ 0.80

---

## B4. Total Equity (Eget kapital)

- **Type:** OBJECTIVE_FACT (the number) / INTERPRETATION (what it means)
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Eget kapital"
- **Typical range:** 2,000,000-30,000,000 SEK
- **Risk thresholds:**
  - Below 20% of total assets: critically low equity
  - Declining for 2+ consecutive years: serious concern
  - Negative: the BRF's liabilities exceed its assets. Insolvency risk.
- **Trend interpretation:**
  - Growing: the BRF is building reserves. Very positive.
  - Stable: the BRF is maintaining its position.
  - Declining slowly: investigate — may be planned spending from reserves.
  - Declining rapidly: critical. The BRF is consuming its cushion.
- **Dependencies:** Feeds into equity_ratio, equity_per_apartment, equity_trend, all financial health assessments
- **Exceptions:**
  - Equity can decline due to planned renovations funded from reserves. This is not necessarily negative if the renovation adds value.
  - Equity can increase due to property revaluation. This is a paper gain, not operational improvement.
- **Do not interpret when:**
  - Equity changes are dominated by property revaluations rather than operational results
  - The BRF has recently distributed surplus to members (uncommon but possible)
- **Buyer impact:** Equity is the members' share of the BRF's value. Higher equity per apartment means the buyer is joining a wealthier association. Declining equity means the buyer is inheriting a weaker position.
- **Confidence requirement:** ≥ 0.85

---

## B5. Total Liabilities (Skulder totalt)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Skulder" or "Skulder totalt"
- **Typical range:** 2,000,000-40,000,000 SEK
- **Risk thresholds:**
  - Above 80% of total assets: very high leverage
  - Growing faster than equity: the BRF is levering up
- **Trend interpretation:**
  - Declining: the BRF is paying down debt. Positive.
  - Stable: neutral.
  - Growing: investigate — is the BRF borrowing for improvements or to cover operating losses?
- **Dependencies:** Feeds into debt_ratio, debt_per_apartment, total_debt_analysis
- **Exceptions:**
  - Some liabilities are operational (accounts payable, accrued expenses) and not long-term debt. Distinguish between financial debt and operational liabilities.
- **Do not interpret when:** The figure includes deferred tax liabilities or other non-cash items.
- **Buyer impact:** The buyer implicitly inherits a share of the BRF's liabilities through higher fees and reduced equity.
- **Confidence requirement:** ≥ 0.80

---

## B6. Long-Term Debt (Skulder med löptid > 1 år)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Skulder > 1 år" or from loan schedule
- **Typical range:** 1,500,000-35,000,000 SEK
- **Risk thresholds:**
  - Above 60% of total assets: heavily leveraged
  - Growing while equity is flat or declining: increasing financial risk
- **Trend interpretation:**
  - Declining: debt is being paid down. Positive.
  - Stable: neutral.
  - Growing: investigate cause. May be planned investment or distress borrowing.
- **Dependencies:** Feeds into debt_per_apartment, loan_to_value, long_term_debt_trend, debt structure analysis
- **Exceptions:** Refinancing short-term debt into long-term debt will show as a decrease in short-term and increase in long-term. This is generally positive.
- **Do not interpret when:** The classification between short-term and long-term is based on the next 12 months, which changes every year.
- **Buyer impact:** Long-term debt represents the major financial commitments the buyer is inheriting. It directly affects fees and financial flexibility.
- **Confidence requirement:** ≥ 0.80

---

## B7. Short-Term Debt (Skulder med löptid < 1 år)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Skulder < 1 år"
- **Typical range:** 0-5,000,000 SEK
- **Risk thresholds:**
  - Above 40% of total liabilities: high refinancing risk
  - Growing: the BRF may be unable to refinance into long-term debt
  - Includes bank overdraft: the BRF is using short-term credit facilities
- **Trend interpretation:**
  - Declining: positive, refinancing risk decreasing
  - Spiking: critical — a large loan may be coming due
- **Dependencies:** Feeds into short_term_debt_ratio, refinancing_risk
- **Exceptions:**
  - Accounts payable (leverantörsskulder) are short-term but not debt. Distinguish between financial short-term debt and operational payables.
- **Do not interpret when:** The short-term debt includes operational payables that will be settled from normal cash flow.
- **Buyer impact:** High short-term debt means the BRF faces a refinancing cliff. If interest rates have risen since the original loan, costs will spike.
- **Confidence requirement:** ≥ 0.80

---

## B8. Cash and Bank Balances (Kassa och bank)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Årsredovisning → Balansräkning → "Kassa och bank"
- **Typical range:** 100,000-3,000,000 SEK
- **Risk thresholds:**
  - Below 50,000 SEK: very low liquidity
  - Above 3,000,000 SEK for a small BRF: may indicate hoarding or planned expenditure
- **Trend interpretation:** Fluctuates naturally. Look at the trend relative to the BRF's operating costs to assess how many months of operations the cash can cover.
- **Dependencies:** Feeds into liquidity assessment, cash_per_apartment, months_of_coverage
- **Exceptions:** Cash may be restricted (fonderade medel) and not available for general use.
- **Do not interpret when:** Cash includes restricted funds.
- **Buyer impact:** Cash is the BRF's immediate buffer. Low cash means the BRF may need to borrow or impose special assessments for unexpected costs.
- **Confidence requirement:** ≥ 0.80

---

# Category C: Per-Apartment Metrics

Per-apartment metrics normalize the BRF's financials by its size, enabling
comparison across BRFs of different sizes. These are the most important
metrics for the buyer.

---

## C1. Number of Apartments (Antal lägenheter)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** count
- **Source:** Årsredovisning → Uppgifter om föreningen → "Antal lägenheter" or "Antal bostadsrätter"
- **Typical range:** 10-200
- **Risk thresholds:**
  - Below 15: very small BRF. Each apartment bears a large share of fixed costs. Less financial resilience.
  - Above 100: large BRF. More cost-sharing, but potentially more complex governance.
- **Trend interpretation:** Should be stable. Changes indicate BRF expansion (new construction) or merger.
- **Dependencies:** Denominator for all per-apartment metrics
- **Exceptions:** Some BRFs include commercial premises and rental apartments in their count. Be clear about what is counted.
- **Do not interpret when:** The number has changed during the fiscal year (mid-year additions).
- **Buyer impact:** Determines how costs are shared. Fewer apartments = each owner bears more risk. More apartments = more diversification but potentially less individual influence.
- **Confidence requirement:** ≥ 0.90

---

## C2. Revenue per Apartment (Intäkter per lägenhet)

- **Type:** CALCULATED
- **Formula:** revenue / number_of_apartments
- **Unit:** SEK/apartment/year
- **Source:** CALCULATED from A1 and C1
- **Typical range:** 40,000-120,000 SEK/apartment/year
- **Risk thresholds:**
  - Declining: investigate cause (lost tenants, fee cuts, reduced commercial income)
  - Below 30,000: very low revenue — the BRF may struggle to cover costs
- **Trend interpretation:** Should track with fee changes. If revenue per apartment declines while the number of apartments is stable, the BRF is earning less per unit.
- **Dependencies:** Feeds into fee_sustainability, revenue_trend
- **Exceptions:** BRFs with significant commercial income will have higher revenue per apartment.
- **Do not interpret when:** Revenue includes one-time items.
- **Buyer impact:** Revenue per apartment is the BRF's earning power. Higher is better, but must be compared to cost per apartment.
- **Confidence requirement:** Minimum confidence of revenue and apartment count inputs.

---

## C3. Cost per Apartment (Rörelsekostnader per lägenhet)

- **Type:** CALCULATED
- **Formula:** operating_costs / number_of_apartments
- **Unit:** SEK/apartment/year
- **Source:** CALCULATED from A2 and C1
- **Typical range:** 35,000-100,000 SEK/apartment/year
- **Risk thresholds:**
  - Growing faster than revenue per apartment: the BRF is becoming less efficient
  - Above 100,000 SEK: investigate — may indicate deferred maintenance, expensive contracts, or inefficiency
- **Trend interpretation:**
  - Stable: expected for mature BRFs
  - Increasing: investigate cause (energy costs, maintenance, insurance, staff)
  - Decreasing: may indicate genuine efficiency gains or deferred maintenance
- **Dependencies:** Feeds into fee_sustainability, cost_trend, operating_margin
- **Exceptions:** BRFs with large shared facilities (laundry, guest rooms, party rooms) will have higher costs per apartment.
- **Do not interpret when:** Costs include one-time major repairs.
- **Buyer impact:** This is the buyer's share of the BRF's operating costs. Rising costs directly translate to rising fees.
- **Confidence requirement:** Minimum confidence of costs and apartment count inputs.

---

## C4. Equity per Apartment (Eget kapital per lägenhet)

- **Type:** CALCULATED
- **Formula:** total_equity / number_of_apartments
- **Unit:** SEK/apartment
- **Source:** CALCULATED from B4 and C1
- **Typical range:** 100,000-500,000 SEK/apartment
- **Risk thresholds:**
  - Below 50,000 SEK: very low equity per apartment. The BRF has little cushion.
  - Declining for 2+ years: the BRF is losing its financial buffer
- **Trend interpretation:**
  - Growing: the BRF is building wealth per unit
  - Stable: neutral
  - Declining: the BRF is consuming reserves
- **Dependencies:** Feeds into equity_trend, financial health finding
- **Exceptions:** Equity can change due to property revaluations without operational improvement.
- **Do not interpret when:** Equity changes are dominated by revaluations.
- **Buyer impact:** This is the buyer's implicit share of the BRF's wealth. Higher equity per apartment = stronger position.
- **Confidence requirement:** Minimum confidence of equity and apartment count inputs.

---

## C5. Debt per Apartment (Skuld per lägenhet)

- **Type:** CALCULATED
- **Formula:** long_term_debt / number_of_apartments
- **Unit:** SEK/apartment
- **Source:** CALCULATED from B6 and C1
- **Typical range:** 100,000-600,000 SEK/apartment
- **Risk thresholds:**
  - Below 200,000 SEK: low debt. Positive.
  - 200,000-400,000 SEK: moderate. Normal range.
  - 400,000-600,000 SEK: high. Above average. Monitor trend.
  - 600,000-800,000 SEK: very high. Significant burden.
  - Above 800,000 SEK: excessive. Special assessments probable.
- **Trend interpretation:**
  - Declining: the BRF is deleveraging. Very positive.
  - Stable: neutral
  - Growing: the BRF is increasing its debt burden. Investigate why.
- **Dependencies:** Feeds into debt_trend, risk assessment, fee forecast
- **Exceptions:**
  - Newly formed BRFs or BRFs that recently built new buildings may have very high debt per apartment that will decline over time.
- **Do not interpret when:**
  - The BRF is in a growth phase with planned debt reduction
- **Buyer impact:** The single most important debt metric. This is the buyer's implicit share of the BRF's debt. High debt per apartment means higher fees and higher risk of special assessments.
- **Confidence requirement:** Minimum confidence of debt and apartment count inputs.

---

## C6. Debt-to-Equity Ratio (Skuld-egenkapitalförhållandet)

- **Type:** CALCULATED
- **Formula:** total_liabilities / total_equity
- **Unit:** ratio (dimensionless)
- **Source:** CALCULATED from B5 and B4
- **Typical range:** 0.5-3.0
- **Risk thresholds:**
  - Below 1.0: the BRF has more equity than debt. Very strong.
  - 1.0-2.0: normal range. Debt exceeds equity but is manageable.
  - 2.0-3.0: elevated. The BRF is leveraged.
  - Above 3.0: highly leveraged. Significant financial risk.
- **Trend interpretation:**
  - Declining: the BRF is deleveraging relative to its equity
  - Growing: the BRF is levering up
- **Dependencies:** Feeds into debt sustainability assessment, risk engine
- **Exceptions:** This metric can be distorted by large one-time items in either equity or liabilities.
- **Do not interpret when:** Equity or liabilities include significant revaluation effects.
- **Buyer impact:** Higher ratio = the BRF is more reliant on debt financing = more risk for the buyer.
- **Confidence requirement:** Minimum confidence of equity and liabilities inputs.

---

## C7. Debt-to-Asset Ratio (Skuldandel)

- **Type:** CALCULATED
- **Formula:** total_liabilities / total_assets
- **Unit:** ratio (dimensionless)
- **Source:** CALCULATED from B5 and B1
- **Typical range:** 0.2-0.7
- **Risk thresholds:**
  - Below 0.3: low leverage
  - 0.3-0.5: moderate leverage
  - 0.5-0.7: high leverage
  - Above 0.7: very high leverage
- **Trend interpretation:** Similar to debt-to-equity ratio.
- **Dependencies:** Feeds into risk assessment, overall leverage analysis
- **Exceptions:** Can be distorted by property revaluations (which increase assets without changing liabilities).
- **Do not interpret when:** Assets include significant revaluation gains.
- **Buyer impact:** Shows what fraction of the BRF's assets are financed by debt rather than equity.
- **Confidence requirement:** Minimum confidence of equity, liabilities, and assets inputs.

---

# Category D: Financial Ratios

Ratios combine multiple raw metrics into single numbers that reveal the
BRF's financial character. Each ratio has specific Swedish BRF norms.

---

## D1. Equity Ratio (Egenkapitalandel)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** total_equity / total_assets
- **Unit:** % (expressed as decimal, e.g., 0.42 = 42%)
- **Source:** CALCULATED from B4 and B1
- **Typical range:** 25%-55% for Swedish BRFs
- **Risk thresholds:**
  - Above 55%: excellent. Very strong financial position.
  - 40-55%: healthy. Good cushion.
  - 30-40%: adequate. Acceptable but monitor trend.
  - 20-30%: caution. Thin cushion. Risk of special assessments.
  - 10-20%: concerning. Very thin. Vulnerable to shocks.
  - Below 10%: critical. Danger zone. Special assessments likely imminent.
- **Trend interpretation:**
  - Stable above 40%: strong and healthy
  - Stable between 30-40%: adequate, monitor for decline
  - Declining from above 40% toward 30%: investigate cause
  - Declining below 30%: serious concern
  - Any equity ratio approaching 20%: critical — the BRF is heading toward insolvency territory
- **Dependencies:** Feeds into financial_health_finding, risk_assessment, confidence_scoring, verdict
- **Exceptions:**
  - Property revaluations can cause large jumps in equity (and thus equity ratio) without operational improvement. Always check whether the equity change came from operations or revaluations.
  - Newly formed BRFs may have unusual equity ratios in their first year.
- **Do not interpret when:**
  - The equity ratio is based on partially revalued assets and partially historical cost assets (check the notes)
  - Only 1 year of data is available and the ratio is in the 25-35% range (borderline — need trend to assess)
- **Buyer impact:** This is the single most important financial health indicator. A low equity ratio means the BRF has little margin for error. The buyer may face special assessments, fee increases, or both.
- **Confidence requirement:** ≥ 0.85 for both equity and assets. If either input is low-confidence, the ratio should be flagged as uncertain.

---

## D2. Operating Margin (Rörelsemarginal)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** operating_profit / revenue
- **Unit:** % (expressed as decimal)
- **Source:** CALCULATED from A3 and A1
- **Typical range:** -5% to +15%
- **Risk thresholds:**
  - Above 15%: strong surplus. The BRF generates significant reserves.
  - 5-15%: healthy surplus. Normal, self-sustaining operation.
  - 0-5%: marginal. Covers costs but little room for error.
  - -5% to 0%: deficit. Spending reserves. Not sustainable long-term.
  - Below -5%: deep deficit. Rapidly depleting reserves. Urgent concern.
- **Trend interpretation:**
  - Stable above 5%: healthy and self-sustaining
  - Declining toward 0%: profitability is eroding. Investigate whether costs are rising or revenue is falling.
  - Crossing from positive to negative: critical. The BRF is no longer self-sustaining.
- **Dependencies:** Feeds into financial_health_finding, profitability_trend, risk_assessment
- **Exceptions:**
  - A single negative year caused by a major one-time repair does not necessarily indicate a structural problem. Check the context.
  - Seasonal BRFs (those with summer cottages or seasonal income) may show unusual margins.
- **Do not interpret when:**
  - Revenue or costs include significant one-time items
  - The BRF is in its first year of operation
- **Buyer impact:** The margin shows whether the BRF can sustain itself from its own income. A declining margin is an early warning that fees will need to rise.
- **Confidence requirement:** ≥ 0.80 for both profit and revenue inputs.

---

## D3. Interest Coverage Ratio (Räntetäckning)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** operating_profit / financial_costs
- **Unit:** ratio (dimensionless)
- **Source:** CALCULATED from A3 and A5
- **Typical range:** 0.5-5.0
- **Risk thresholds:**
  - Above 3.0: very strong. Operating profit covers interest 3x over.
  - 1.5-3.0: adequate. Comfortable coverage.
  - 1.0-1.5: tight. Covers interest but little margin.
  - 0.5-1.0: insufficient. Cannot fully cover interest from operations.
  - Below 0.5: critical. Operating profit covers less than half the interest.
- **Trend interpretation:**
  - Stable above 1.5: the BRF can comfortably service its debt
  - Declining toward 1.0: the BRF's ability to service debt is weakening
  - Below 1.0: the BRF must use reserves or borrow to pay interest. Critical.
- **Dependencies:** Feeds into debt_sustainability_finding, risk_assessment, verdict
- **Exceptions:**
  - If operating_profit is negative, the ratio is negative and meaningless as a coverage ratio. Report the raw figures instead.
  - If financial_costs are very small (low debt), the ratio may be very high but not meaningful for comparison.
- **Do not interpret when:**
  - Operating_profit is negative (ratio is undefined/negative)
  - Financial_costs include non-interest items (bank fees, arrangement costs)
- **Buyer impact:** This ratio answers: "Can the BRF pay its interest from its own income?" If not, the BRF is dependent on reserves or borrowing to service its debt. The buyer inherits this risk.
- **Confidence requirement:** ≥ 0.80 for both inputs. Negative operating_profit makes this metric uninterpretable — use raw figures instead.

---

## D4. Cost per Square Meter (Kostnad per kvadratmeter)

- **Type:** CALCULATED
- **Formula:** operating_costs / building_area_sqm
- **Unit:** SEK/m²/year
- **Source:** CALCULATED from A2 and property_info.building_area_sqm
- **Typical range:** 200-800 SEK/m²/year (varies significantly by building age, type, and location)
- **Risk thresholds:**
  - Above 800 SEK/m²: investigate — may indicate inefficiency, old building, or expensive maintenance
  - Below 200 SEK/m²: may indicate deferred maintenance or incomplete cost reporting
  - Increasing faster than inflation: investigate cause
- **Trend interpretation:**
  - Stable: expected for well-maintained buildings
  - Increasing: costs are rising per unit of building. Investigate cause.
  - Decreasing: may indicate genuine efficiency gains
- **Dependencies:** Feeds into cost_efficiency_assessment, area_comparisons
- **Exceptions:**
  - Buildings with unusual characteristics (e.g., heritage buildings, complex heating systems) will have higher costs per m²
  - BRFs in northern Sweden have higher heating costs than southern BRFs
- **Do not interpret when:**
  - Building area is not accurately reported
  - Costs include major one-time repairs
- **Buyer impact:** Higher cost per m² means the BRF is more expensive to run. This directly affects fees.
- **Confidence requirement:** ≥ 0.70 for both inputs. Building area data is often less reliable than financial data.

---

## D5. Revenue per Square Meter (Intäkt per kvadratmeter)

- **Type:** CALCULATED
- **Formula:** revenue / building_area_sqm
- **Unit:** SEK/m²/year
- **Source:** CALCULATED from A1 and property_info.building_area_sqm
- **Typical range:** 200-900 SEK/m²/year
- **Risk thresholds:**
  - Below cost_per_sqm: the BRF is not generating enough revenue per m² to cover costs
  - Declining: investigate cause
- **Trend interpretation:** Compare with cost_per_sqm trend. If revenue per m² grows slower than cost per m², the margin is compressing.
- **Dependencies:** Feeds into efficiency assessment, fee sustainability
- **Exceptions:** Same as cost_per_sqm — building age, type, and location affect this.
- **Do not interpret when:** Building area data is unreliable.
- **Buyer impact:** Shows the BRF's earning power per unit of building. Higher is better.
- **Confidence requirement:** ≥ 0.70

---

## D6. Fee Sustainability Ratio (Avgiftstäckning)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** avg_monthly_fee / (revenue_per_apartment / 12)
- **Unit:** ratio (dimensionless)
- **Source:** CALCULATED from C2 and apartment_metrics.avg_monthly_fee
- **Typical range:** 0.7-1.3
- **Risk thresholds:**
  - Above 1.2: over-funded. Fees more than cover costs. Reserves growing from fee income.
  - 1.0-1.2: self-sustaining. Fees cover costs. Healthy.
  - 0.8-1.0: under-funded. Fees don't fully cover costs. Reserves subsidizing operations.
  - 0.6-0.8: significantly under-funded. Large gap. Fee increase needed.
  - Below 0.6: severely under-funded. Crisis territory. Immediate action needed.
- **Trend interpretation:**
  - Stable above 1.0: healthy fee structure
  - Declining toward 1.0: fees may need to increase soon
  - Below 1.0 and declining: fee increase is imminent
- **Dependencies:** Feeds into fee_finding, fee_forecast, risk_assessment
- **Exceptions:**
  - Some BRFs cross-subsidize operations from commercial income. In these cases, fees may be below cost coverage but the BRF is still financially healthy.
  - A ratio above 1.0 may indicate the BRF is overcharging members (building unnecessary reserves).
- **Do not interpret when:**
  - Revenue includes significant one-time items
  - The BRF has a complex income structure (commercial + residential + rental)
- **Buyer impact:** A ratio below 1.0 means fees are too low to cover costs. The buyer should expect a fee increase. A ratio above 1.0 means fees are comfortable.
- **Confidence requirement:** ≥ 0.80 for both fee and revenue inputs.

---

# Category E: Debt Structure

Detailed analysis of the BRF's loan portfolio.

---

## E1. Total Debt (Total skuld)

- **Type:** CALCULATED
- **Formula:** sum of all loan remaining amounts OR from balance sheet: long_term_debt + short_term_debt (financial only)
- **Unit:** SEK
- **Source:** EXTRACTED from loan schedule or balance sheet
- **Typical range:** 1,500,000-35,000,000 SEK
- **Risk thresholds:** Same as long_term_debt + short_term_debt analysis
- **Trend interpretation:** Same as B6 + B7
- **Dependencies:** Feeds into all per-apartment debt metrics, risk assessment
- **Exceptions:** Ensure you are counting only financial debt, not operational liabilities.
- **Do not interpret when:** Debt classification is unclear.
- **Buyer impact:** The total burden the buyer is inheriting a share of.
- **Confidence requirement:** ≥ 0.80

---

## E2. Weighted Average Interest Rate (Vägt genomsnittlig ränta)

- **Type:** CALCULATED
- **Formula:** sum(loan_amount × interest_rate) / sum(loan_amount)
- **Unit:** %
- **Source:** CALCULATED from individual loans
- **Typical range:** 1.5%-5.0% (depends on Riksbanken rate and BRF's credit rating)
- **Risk thresholds:**
  - Below Riksbanken policy rate + 0.5%: excellent borrowing terms
  - Within Riksbanken rate + 0.5-1.5%: normal
  - Above Riksbanken rate + 2.0%: above-market terms. May indicate weak creditworthiness.
  - Significantly above market: investigate — the BRF may have difficulty refinancing
- **Trend interpretation:**
  - Declining: the BRF is refinancing at better rates
  - Stable: expected for fixed-rate loans
  - Rising: either floating-rate exposure or refinancing at worse terms
- **Dependencies:** Feeds into financial_costs, interest_cost_per_apartment, debt_service_analysis
- **Exceptions:**
  - Fixed-rate loans will maintain their rate regardless of market changes until maturity
  - Some BRFs have negotiated unusually favorable rates due to long-standing bank relationships
- **Do not interpret when:**
  - The rate includes arrangement fees or other one-time costs
  - Loan terms are not fully disclosed
- **Buyer impact:** The buyer's fees include the BRF's interest costs. A higher weighted rate means higher fees. When loans mature and are refinanced, the rate may change.
- **Confidence requirement:** ≥ 0.70 for each loan's rate and amount

---

## E3. Short-Term Debt Ratio (Andel kortfristig skuld)

- **Type:** CALCULATED
- **Formula:** short_term_debt / total_liabilities
- **Unit:** %
- **Source:** CALCULATED from B7 and B5
- **Typical range:** 0%-40%
- **Risk thresholds:**
  - Below 15%: low refinancing risk
  - 15-30%: moderate. Some near-term obligations.
  - 30-45%: elevated. Significant refinancing needed soon. Risk if rates rise.
  - Above 45%: high. Major refinancing cliff.
- **Trend interpretation:**
  - Declining: positive, less near-term pressure
  - Spiking: critical — a large loan may be coming due
- **Dependencies:** Feeds into refinancing_risk, risk_assessment
- **Exceptions:** Operational payables (not financial debt) should be excluded.
- **Do not interpret when:** Short-term debt includes operational payables.
- **Buyer impact:** High short-term debt means the BRF faces a refinancing event soon. If rates have risen, costs will spike. The buyer inherits this timing risk.
- **Confidence requirement:** ≥ 0.80

---

## E4. Loan Maturity Concentration (Låneförfallodistribution)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED from loan schedule
- **Unit:** SEK per maturity date
- **Source:** EXTRACTED from individual loan entries
- **Typical range:** Varies
- **Risk thresholds:**
  - More than 40% of total debt maturing within 12 months: high refinancing risk
  - More than 60% of total debt maturing within 24 months: elevated concern
  - All loans maturing at the same time: extreme concentration risk
- **Trend interpretation:** Not a trend metric — this is a structural snapshot.
- **Dependencies:** Feeds into refinancing_risk, risk_assessment, recommendations
- **Exceptions:** Some loans have extension options that are not visible in the maturity date alone.
- **Do not interpret when:** Maturity dates are not disclosed or are uncertain.
- **Buyer impact:** Concentrated maturities mean the BRF will face a large refinancing event. If the BRF's financial position has deteriorated, refinancing may be difficult or expensive.
- **Confidence requirement:** ≥ 0.70 for maturity dates

---

## E5. Interest Cost per Apartment (Räntekostnad per lägenhet)

- **Type:** CALCULATED
- **Formula:** annual_financial_costs / number_of_apartments
- **Unit:** SEK/apartment/year
- **Source:** CALCULATED from A5 and C1
- **Typical range:** 5,000-25,000 SEK/apartment/year
- **Risk thresholds:**
  - Above 20,000 SEK/apartment: high interest burden
  - Growing: either debt is increasing or rates are rising
  - Above 30% of revenue per apartment: the BRF is spending a large share on interest
- **Trend interpretation:**
  - Declining: positive, debt burden is decreasing
  - Stable: expected for fixed-rate loans
  - Rising: investigate cause (new debt, rising rates, or both)
- **Dependencies:** Feeds into fee analysis, debt sustainability
- **Exceptions:** Same as financial_costs
- **Do not interpret when:** Financial costs include non-interest items
- **Buyer impact:** This is the buyer's share of the BRF's interest costs. It flows directly into the monthly fee.
- **Confidence requirement:** ≥ 0.70

---

# Category F: Fee Analysis (Avgifter)

---

## F1. Average Monthly Fee (Genomsnittlig månadsavgift)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK/month
- **Source:** Årsredovisning → Uppgifter om avgifter → "Genomsnittlig månadsavgift" or from individual apartment data
- **Typical range:** 2,500-6,000 SEK/month (varies enormously by apartment size, location, and BRF characteristics)
- **Risk thresholds:**
  - Below 2,000 SEK: unusually low. May indicate under-funding.
  - Above 6,000 SEK: high. Investigate cause (old building, high debt, large apartment).
  - Increasing > 10% in a single year: significant jump. Investigate.
- **Trend interpretation:**
  - Stable: expected for mature BRFs
  - Increasing 2-4% annually: normal inflationary increase
  - Increasing > 5% annually: above-normal. Investigate whether costs or debt are driving this.
  - Decreasing: unusual. May indicate the BRF overcharged previously or lost revenue.
- **Dependencies:** Feeds into fee_comparison, fee_sustainability, fee_trend, total_monthly_cost
- **Exceptions:**
  - Fees vary by apartment size within the same BRF. Use the average or median.
  - Some BRFs include utilities (värme, vatten) in the fee; others charge separately.
- **Do not interpret when:** The fee figure is for a different apartment type than the one being analyzed.
- **Buyer impact:** This is a direct monthly cost to the buyer. It is added to mortgage payments to determine total monthly housing cost.
- **Confidence requirement:** ≥ 0.85

---

## F2. Fee per Square Meter (Avgift per kvadratmeter)

- **Type:** CALCULATED
- **Formula:** avg_monthly_fee / living_area_m2
- **Unit:** SEK/m²/month
- **Source:** CALCULATED from F1 and listing data
- **Typical range:** 30-90 SEK/m²/month
- **Risk thresholds:**
  - Below 30 SEK/m²: unusually low
  - 30-50 SEK/m²: low to moderate
  - 50-70 SEK/m²: moderate to high
  - Above 70 SEK/m²: high. Investigate cause.
- **Trend interpretation:** Compare with area median to assess whether the fee is reasonable.
- **Dependencies:** Feeds into fee_comparison, area positioning
- **Exceptions:** Large apartments have lower fee per m² due to fixed costs being spread over more area.
- **Do not interpret when:** Living area is not accurately known.
- **Buyer impact:** Normalizes fees across different apartment sizes. Allows comparison.
- **Confidence requirement:** ≥ 0.80 for both inputs.

---

## F3. Fee Comparison to Area Median (Jämförelse med områdesmedian)

- **Type:** INTERPRETATION
- **Formula:** CALCULATED: (fee_per_m² - area_median_fee_per_m²) / area_median_fee_per_m²
- **Unit:** % deviation from median
- **Source:** CALCULATED from F2 and external market data
- **Typical range:** -20% to +20% of area median
- **Risk thresholds:**
  - Below -20%: significantly below area average. May indicate under-funding.
  - -20% to -5%: slightly below area average
  - -5% to +5%: at area average
  - +5% to +20%: slightly above area average
  - Above +20%: significantly above area average. Investigate cause.
- **Trend interpretation:** Not a trend metric — this is a comparison at a point in time.
- **Dependencies:** Requires external market data (Booli, Hemnet)
- **Exceptions:**
  - BRFs with extensive shared facilities (pool, gym, guest rooms) will have higher fees
  - BRFs with significant commercial income may have lower fees
  - Older buildings typically have higher maintenance costs
- **Do not interpret when:** Area fee data is not available or not comparable (different apartment sizes, different fee structures).
- **Buyer impact:** Shows whether the buyer is paying a premium or getting a deal on fees relative to the area.
- **Confidence requirement:** ≥ 0.60 (external data is often less reliable)

---

## F4. Annual Fee Change (Årlig avgiftsförändring)

- **Type:** CALCULATED
- **Formula:** (fee[year] - fee[year-1]) / fee[year-1]
- **Unit:** %
- **Source:** CALCULATED from multi-year fee data
- **Typical range:** -5% to +10%
- **Risk thresholds:**
  - Below -5%: significant decrease. Investigate cause.
  - -5% to +2%: stable to slight increase. Normal.
  - +2% to +5%: moderate increase. Track with inflation.
  - +5% to +10%: significant increase. Investigate cause.
  - Above +10%: large jump. May indicate a crisis, major repair, or structural change.
- **Trend interpretation:**
  - Stable low increase: expected for well-managed BRFs
  - Accelerating increase: warning — costs or debt are growing faster
  - Volatile: investigate — may indicate irregular expenses
- **Dependencies:** Feeds into fee_trend, fee_forecast, risk_assessment
- **Exceptions:** A single large increase may be caused by a specific event (major repair, new loan) rather than a structural trend.
- **Do not interpret when:** Only 1 year of data is available (no trend to assess).
- **Buyer impact:** Fee increases directly reduce the buyer's disposable income. Accelerating fee increases are a sign of financial stress.
- **Confidence requirement:** ≥ 0.80 for both years' fee data.

---

# Category G: Price Assessment (Prisbedömning)

---

## G1. Asking Price (Begärt pris)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED
- **Unit:** SEK
- **Source:** Listing data (Hemnet, manual entry)
- **Typical range:** Varies enormously by location, size, and condition
- **Risk thresholds:** Not applicable — the asking price is a starting point, not a financial metric.
- **Trend interpretation:** Not a trend metric.
- **Dependencies:** Feeds into price_per_sqm, price_positioning, negotiation_analysis
- **Exceptions:** The asking price may have been reduced from the initial listing price.
- **Do not interpret when:** The asking price is for a different apartment type than analyzed.
- **Buyer impact:** This is what the seller wants. The buyer's goal is to determine whether it is fair.
- **Confidence requirement:** ≥ 0.95

---

## G2. Price per Square Meter (Pris per kvadratmeter)

- **Type:** CALCULATED
- **Formula:** asking_price / living_area_m2
- **Unit:** SEK/m²
- **Source:** CALCULATED from G1 and listing data
- **Typical range:** Varies enormously by location (Stockholm: 50,000-120,000 SEK/m²; smaller cities: 20,000-50,000 SEK/m²)
- **Risk thresholds:**
  - Above area median + 15%: premium pricing. Justify with superior condition, view, floor, etc.
  - Below area median - 15%: may indicate issues (poor condition, bad floor plan, etc.)
- **Trend interpretation:** Compare with area price trend over time.
- **Dependencies:** Feeds into price_positioning, negotiation_leverage
- **Exceptions:**
  - Newly renovated apartments command premiums
  - Top floors, corner units, and apartments with views command premiums
  - Ground floor, dark, or poorly laid out apartments trade at discounts
- **Do not interpret when:** The apartment has unusual characteristics that affect its price per m² (e.g., newly renovated, unique layout).
- **Buyer impact:** The most important price metric. Allows comparison across apartments.
- **Confidence requirement:** ≥ 0.90 for both inputs.

---

## G3. Price Premium/Discount (Prisavvikelse)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** (asking_price_per_sqm - area_median_price_per_sqm) / area_median_price_per_sqm
- **Unit:** %
- **Source:** CALCULATED from G2 and external market data
- **Typical range:** -15% to +15%
- **Risk thresholds:**
  - Above +15%: significant premium. Must be justified.
  - +5% to +15%: moderate premium. May have negotiation room.
  - -5% to +5%: at market. Fair pricing.
  - -5% to -15%: below market. May indicate issues or a good deal.
  - Below -15%: significant discount. Investigate why.
- **Trend interpretation:** Not a trend metric — point-in-time comparison.
- **Dependencies:** Requires external market data
- **Exceptions:** Same as G2 — apartment characteristics affect pricing.
- **Do not interpret when:** Area price data is not available or not comparable.
- **Buyer impact:** Shows whether the asking price is above or below market. A premium means the buyer is paying extra. A discount may be a good deal or may indicate hidden problems.
- **Confidence requirement:** ≥ 0.60 (external data reliability)

---

## G4. Days on Market (Dagar på marknaden)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED or CALCULATED from listing date
- **Unit:** days
- **Source:** Listing data
- **Typical range:** 15-90 days (varies by market conditions)
- **Risk thresholds:**
  - Below 15 days: very fast sale. High demand, little negotiation room.
  - 15-45 days: normal market pace.
  - 45-90 days: slower than average. May indicate overpricing or market softness.
  - Above 90 days: long time. Strong negotiation leverage for buyer.
- **Trend interpretation:** Compare with area average days on market.
- **Dependencies:** Feeds into negotiation_leverage
- **Exceptions:**
  - Seasonal effects: winter sales are typically slower
  - Holiday periods: summer and Christmas affect timing
- **Do not interpret when:** The listing was temporarily withdrawn and re-listed.
- **Buyer impact:** Longer time on market = more negotiation leverage for the buyer.
- **Confidence requirement:** ≥ 0.90

---

## G5. Price Reductions (Prisnedslag)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED (count and magnitude)
- **Unit:** SEK (amount) and count
- **Source:** Listing history
- **Typical range:** 0-3 reductions
- **Risk thresholds:**
  - 0 reductions: seller is firm on price
  - 1 reduction: seller is adjusting to market feedback
  - 2+ reductions: seller may be motivated. Strong negotiation position.
  - Reduction > 10% total: significant adjustment
- **Trend interpretation:** Not a trend metric.
- **Dependencies:** Feeds into negotiation_leverage
- **Exceptions:** Some reductions are cosmetic (minor adjustments to attract attention).
- **Do not interpret when:** The reduction history is not available.
- **Buyer impact:** Price reductions signal seller motivation and potential negotiation room.
- **Confidence requirement:** ≥ 0.80

---

## G6. Comparable Sales (Jämförelseförsäljningar)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED from market data
- **Unit:** SEK and SEK/m² per comparable sale
- **Source:** External market data (Booli, Mäklarstatistik, Hemnet slutförda)
- **Typical range:** Requires 3+ comparables for reliable assessment
- **Risk thresholds:**
  - Fewer than 3 comparables in 12 months: insufficient data for reliable price assessment
  - Comparables show declining prices: the market may be softening
  - Comparables show wide spread: price uncertainty is high
- **Trend interpretation:**
  - Comparables trending up: market is appreciating
  - Comparables trending down: market is declining
  - Comparables stable: market is flat
- **Dependencies:** Feeds into price_positioning, area_price_trend, negotiation_leverage
- **Exceptions:**
  - Comparables must be genuinely comparable (same size, same condition, same area)
  - Very different apartments (e.g., renovated vs original) are not comparable
- **Do not interpret when:** Fewer than 3 genuinely comparable sales exist.
- **Buyer impact:** Comparables are the strongest evidence for whether the asking price is fair.
- **Confidence requirement:** ≥ 0.70 per comparable, with at least 3 comparables

---

# Category H: Area & External Data

---

## H1. Area Crime Index (Brottslighetsindex)

- **Type:** OBJECTIVE_FACT (the data) / INTERPRETATION (what it means)
- **Formula:** EXTRACTED from Brå data
- **Unit:** Index (national average = 100) or incidents per 1,000 residents
- **Source:** Brå (Brottsförebyggande rådet)
- **Typical range:** 50-200 (varies by area)
- **Risk thresholds:**
  - Below 80: low crime area
  - 80-120: average crime area
  - 120-160: above-average crime
  - Above 160: high crime area
- **Trend interpretation:**
  - Declining: area is becoming safer
  - Stable: normal
  - Increasing: investigate — is this a temporary spike or a trend?
- **Dependencies:** Feeds into area_finding, risk_assessment
- **Exceptions:**
  - Crime data may be 1-2 years behind current conditions
  - Small areas may have volatile statistics due to small sample size
- **Do not interpret when:** The data is for a different geographic area than the property.
- **Buyer impact:** Safety is a quality-of-life factor and affects property values.
- **Confidence requirement:** ≥ 0.70

---

## H2. Public Transport Accessibility (Kollektivtrafiktillgänglighet)

- **Type:** OBJECTIVE_FACT (distance/time) / INTERPRETATION (quality)
- **Formula:** EXTRACTED from Trafikverket / SL data
- **Unit:** minutes to nearest station, distance in meters
- **Source:** Trafikverket, SL, Google Maps
- **Typical range:** 1-30 minutes to nearest public transport
- **Risk thresholds:**
  - Below 5 minutes walk: excellent
  - 5-15 minutes: good
  - 15-25 minutes: moderate
  - Above 25 minutes: poor — car-dependent area
- **Trend interpretation:**
  - New transport links planned: positive for future value
  - Existing links being removed/reduced: negative
- **Dependencies:** Feeds into area_finding, commute_time_assessment
- **Exceptions:** Planned future transport links may not yet be reflected in current data.
- **Do not interpret when:** Transport data is for a different location than the property.
- **Buyer impact:** Transport access directly affects daily life and property values.
- **Confidence requirement:** ≥ 0.80

---

## H3. Demographic Indicators (Demografiska indikatorer)

- **Type:** OBJECTIVE_FACT
- **Formula:** EXTRACTED from SCB / Kolada
- **Unit:** Various (population count, %, SEK income)
- **Source:** SCB (Statistiska centralbyrån), Kolada
- **Typical range:** Varies by area
- **Risk thresholds:**
  - Population declining > 5% over 5 years: area may be losing attractiveness
  - Median income significantly below regional average: economic weakness
  - Rapid demographic change: may indicate transition
- **Trend interpretation:**
  - Growing population: area is attractive
  - Stable population: mature area
  - Declining population: investigate cause
- **Dependencies:** Feeds into area_finding, future_value_assessment
- **Exceptions:** Demographic data is typically 1-2 years old.
- **Do not interpret when:** Data is for a different geographic area than the property.
- **Buyer impact:** Demographics affect long-term property values and neighbourhood quality.
- **Confidence requirement:** ≥ 0.70

---

## H4. Area Price Trend (Områdestrend)

- **Type:** OBJECTIVE_FACT (the data) / INTERPRETATION (what it means)
- **Formula:** EXTRACTED from SCB / Booli price index
- **Unit:** SEK/m² per year, or index
- **Source:** SCB price index, Booli market reports
- **Typical range:** Varies by area
- **Risk thresholds:**
  - Declining > 5% over 2 years: area is losing value
  - Declining 0-5% over 2 years: softening market
  - Stable: flat market
  - Growing 0-5%: normal appreciation
  - Growing > 5%: strong market
- **Trend interpretation:**
  - Accelerating growth: hot market, but may be overheating
  - Decelerating growth: market cooling
  - Declining: market weakening
- **Dependencies:** Feeds into price_finding, future_value_assessment, negotiation_leverage
- **Exceptions:**
  - National price trends may differ from local trends
  - New development in the area may affect local prices differently
- **Do not interpret when:** Price data is for a different geographic area.
- **Buyer impact:** The buyer wants to buy in an area where prices are stable or rising, not declining.
- **Confidence requirement:** ≥ 0.70

---

# Category I: Trend Metrics

---

## I1. Revenue Trend (Intäktstrend)

- **Type:** OBJECTIVE_FACT (direction) / INTERPRETATION (implication)
- **Formula:** CALCULATED from multi-year revenue data
- **Unit:** direction (IMPROVING / STABLE / DECLINING / VOLATILE / INSUFFICIENT_DATA)
- **Source:** CALCULATED from A1 across years
- **Typical range:** Stable for mature BRFs
- **Risk thresholds:**
  - DECLINING for 2+ years: investigate cause. Revenue erosion is a leading indicator of financial stress.
  - VOLATILE: investigate cause. May indicate unstable commercial income.
- **Trend interpretation:**
  - IMPROVING: BRF is growing revenue (from fee increases, new tenants, or commercial growth)
  - STABLE: expected for mature BRFs
  - DECLINING: investigate — may indicate lost tenants, fee cuts, or structural issues
  - VOLATILE: investigate — may indicate one-time items or unstable income sources
- **Dependencies:** Feeds into financial_health_finding, fee_forecast, trend_finding
- **Exceptions:** Revenue growth from one-time items is not a true improvement.
- **Do not interpret when:** Only 1 year of data available.
- **Buyer impact:** Growing revenue = healthy BRF. Declining revenue = fees will likely need to increase.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

## I2. Cost Trend (Kostnadstrend)

- **Type:** OBJECTIVE_FACT / INTERPRETATION
- **Formula:** CALCULATED from multi-year cost data
- **Unit:** direction
- **Source:** CALCULATED from A2 across years
- **Typical range:** Stable with inflation
- **Risk thresholds:**
  - IMPROVING (costs increasing) faster than revenue trend: margin compression
  - DECLINING (costs decreasing): investigate — genuine efficiency or deferred maintenance?
- **Trend interpretation:**
  - Cost growth outpacing revenue growth: the BRF is becoming less efficient
  - Cost growth matching revenue growth: normal
  - Costs declining: unusual — verify maintenance is not being deferred
- **Dependencies:** Feeds into fee_sustainability, financial_health_finding, cross-dimensional rules
- **Exceptions:** Energy cost spikes (from Riksbanken rate changes or energy prices) can cause temporary cost increases.
- **Do not interpret when:** Only 1 year of data.
- **Buyer impact:** Rising costs without rising revenue = fees will increase.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

## I3. Profitability Trend (Resultattrend)

- **Type:** OBJECTIVE_FACT / INTERPRETATION
- **Formula:** CALCULATED from multi-year operating_profit data
- **Unit:** direction
- **Source:** CALCULATED from A3 across years
- **Typical range:** Stable positive for healthy BRFs
- **Risk thresholds:**
  - DECLINING for 2+ years: profitability is eroding. Warning.
  - Crossing from positive to negative: critical.
  - VOLATILE: investigate cause.
- **Trend interpretation:**
  - IMPROVING: BRF is becoming more profitable
  - STABLE positive: healthy and consistent
  - DECLINING: early warning signal. Even if still positive, the trajectory matters.
  - Negative trend: critical — the BRF is heading toward insolvency
- **Dependencies:** Feeds into financial_health_finding, trend_finding, verdict
- **Exceptions:** A single bad year may be a one-time event, not a trend.
- **Do not interpret when:** Only 1 year of data.
- **Buyer impact:** The profitability trend is the most important predictor of future fee levels. Declining profitability = increasing fees.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

## I4. Equity Trend (Eget kapital-trend)

- **Type:** OBJECTIVE_FACT / INTERPRETATION
- **Formula:** CALCULATED from multi-year equity data
- **Unit:** direction
- **Source:** CALCULATED from B4 across years
- **Typical range:** Stable or slowly increasing for healthy BRFs
- **Risk thresholds:**
  - DECLINING for 2+ years: the BRF is consuming its reserves. Warning.
  - DECLINING rapidly (> 10% per year): critical.
  - IMPROVING: the BRF is building reserves. Very positive.
- **Trend interpretation:**
  - IMPROVING: BRF is building wealth
  - STABLE: maintaining position
  - DECLINING: investigating the cause is essential
- **Dependencies:** Feeds into financial_health_finding, risk_assessment, verdict
- **Exceptions:** Equity can change due to property revaluations (paper gains/losses) without operational changes. Always check whether the change came from operations (profit/loss) or revaluations.
- **Do not interpret when:** Equity changes are dominated by revaluations.
- **Buyer impact:** Declining equity means the buyer is joining a weaker BRF. The buyer's implicit share of the BRF's wealth is shrinking.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

## I5. Debt Trend (Skuldtrend)

- **Type:** OBJECTIVE_FACT / INTERPRETATION
- **Formula:** CALCULATED from multi-year debt data
- **Unit:** direction
- **Source:** CALCULATED from B6 across years
- **Typical range:** Declining or stable for well-managed BRFs
- **Risk thresholds:**
  - IMPROVING (debt increasing) for 2+ years: the BRF is levering up. Investigate.
  - IMPROVING while equity is declining: critical combination.
  - DECLINING: the BRF is deleveraging. Positive.
- **Trend interpretation:**
  - DECLINING: BRF is paying down debt. Very positive.
  - STABLE: neutral
  - IMPROVING: investigate. Is the BRF borrowing for planned improvements or to cover operating losses?
- **Dependencies:** Feeds into debt_sustainability_finding, risk_assessment, cross-dimensional rules
- **Exceptions:** New BRFs or BRFs that recently constructed new buildings may legitimately increase debt for planned, value-adding investments.
- **Do not interpret when:** The debt increase is for a documented, planned investment.
- **Buyer impact:** Increasing debt = increasing financial risk and likely fee increases. Decreasing debt = decreasing risk.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

## I6. Fee Trend (Avgiftstrend)

- **Type:** OBJECTIVE_FACT / INTERPRETATION
- **Formula:** CALCULATED from multi-year fee data
- **Unit:** direction
- **Source:** CALCULATED from F1 across years
- **Typical range:** Slight annual increase (2-4%) for most BRFs
- **Risk thresholds:**
  - IMPROVING (fees increasing) > 5% annually for 2+ years: accelerating fee increases. Warning.
  - DECLINING (fees decreasing): unusual. Verify the BRF is not under-funding operations.
  - VOLATILE: investigate cause.
- **Trend interpretation:**
  - STABLE low increase: expected and healthy
  - ACCELERATING increase: the BRF is under increasing financial pressure
  - DECLINING: investigate — may be positive (efficiency gains) or negative (cutting services)
- **Dependencies:** Feeds into fee_finding, fee_forecast, risk_assessment
- **Exceptions:** A single large fee increase may be caused by a specific event (major repair, new loan) rather than a structural trend.
- **Do not interpret when:** Only 1 year of data.
- **Buyer impact:** Fee trend directly affects the buyer's future monthly costs.
- **Confidence requirement:** 2+ years of data, each ≥ 0.80

---

# Category J: Risk Metrics

---

## J1. Overall Risk Score (Total riskpoäng)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** CALCULATED from all triggered risk rules (see Reasoning Engine)
- **Unit:** 0-100 (0 = no risk, 100 = extreme risk)
- **Source:** CALCULATED from all risk rule evaluations
- **Typical range:** 10-70 for most BRFs
- **Risk thresholds:**
  - 0-20: LOW risk. Financially sound BRF with no significant concerns.
  - 20-40: MODERATE risk. Some concerns that warrant attention.
  - 40-60: ELEVATED risk. Multiple concerns. Thorough investigation recommended.
  - 60-80: HIGH risk. Significant concerns. Strong caution advised.
  - 80-100: CRITICAL risk. Multiple critical findings. Consider walking away.
- **Trend interpretation:** Not a trend metric — this is a point-in-time assessment.
- **Dependencies:** This is the output of the risk engine, which consumes all other metrics
- **Exceptions:** The score must be accompanied by the individual risk factors that contributed to it. A score alone is meaningless.
- **Do not interpret when:** Overall confidence is below 0.50. The risk score is unreliable with insufficient data.
- **Buyer impact:** The risk score summarizes the overall risk level. But the individual risk factors matter more than the score itself.
- **Confidence requirement:** ≥ 0.50 overall confidence

---

## J2. Risk Factor Severity Distribution (Fördelning av riskfaktorer)

- **Type:** CALCULATED
- **Formula:** CALCULATED from individual risk rule evaluations
- **Unit:** count per severity level
- **Source:** Risk engine output
- **Typical range:**
  - Healthy BRF: 0 critical, 0-1 significant, 0-2 moderate, 0-3 minor
  - Average BRF: 0 critical, 1-2 significant, 2-3 moderate, 1-3 minor
  - Weak BRF: 1+ critical, 2+ significant, 3+ moderate, 2+ minor
- **Risk thresholds:**
  - Any CRITICAL factor: immediate attention required
  - 3+ SIGNIFICANT factors: serious concerns
  - All factors MINOR: generally healthy with minor areas for attention
- **Trend interpretation:** Not a trend metric.
- **Dependencies:** This is a summary of the risk engine output
- **Exceptions:** The distribution must be accompanied by the specific factors.
- **Do not interpret when:** Overall confidence is below 0.50.
- **Buyer impact:** Shows the buyer exactly what the risks are and how severe each one is.
- **Confidence requirement:** ≥ 0.50

---

## J3. Confidence Score (Konfidentlighetspoäng)

- **Type:** CALCULATED (the number) / INTERPRETATION (what it means)
- **Formula:** CALCULATED from field coverage, extraction quality, data availability
- **Unit:** 0-1.0
- **Source:** Confidence engine
- **Typical range:** 0.50-0.95 for BRFs with complete annual reports
- **Risk thresholds:**
  - Below 0.30: analysis should not be presented. Too little data.
  - 0.30-0.50: analysis is presented with prominent warnings about data limitations
  - 0.50-0.70: analysis is presented with notes about missing data
  - 0.70-0.85: analysis is presented normally with a confidence note
  - Above 0.85: high confidence. Analysis is robust.
- **Trend interpretation:** Not a trend metric.
- **Dependencies:** This is the output of the confidence engine
- **Exceptions:** Confidence can be high even for a small BRF with a single annual report, if all fields were extracted successfully.
- **Do not interpret when:** N/A — confidence is always interpretable.
- **Buyer impact:** Tells the buyer how much of the full picture the analysis actually has. Low confidence = "we're missing important information."
- **Confidence requirement:** N/A — this IS the confidence metric.

---

# Appendix: Metric Dependency Map

This appendix shows which metrics feed into which findings and conclusions.
It is the knowledge base's internal reference for the reasoning engine.

## Financial Health Finding

```
INPUTS:
  equity_ratio (D1)
  operating_margin (D2)
  profitability_trend (I3)
  equity_trend (I4)
  revenue_trend (I1)
  cost_trend (I2)

OUTPUTS:
  finding_financial_health (STRENGTH / WEAKNESS / MIXED / UNKNOWN)
```

## Debt Sustainability Finding

```
INPUTS:
  debt_per_apartment (C5)
  interest_coverage (D3)
  short_term_debt_ratio (E3)
  debt_trend (I5)
  weighted_average_interest (E2)
  loan_maturity_distribution (E4)

OUTPUTS:
  finding_debt_sustainability (STRENGTH / WEAKNESS / MIXED / UNKNOWN)
```

## Fee Reasonableness Finding

```
INPUTS:
  fee_per_sqm (F2)
  fee_comparison_to_area (F3)
  fee_sustainability (D6)
  fee_trend (I6)
  cost_per_sqm (D4)

OUTPUTS:
  finding_fee_reasonableness (STRENGTH / WEAKNESS / MIXED / UNKNOWN)
```

## Price Fairness Finding

```
INPUTS:
  price_per_sqm (G2)
  price_premium_discount (G3)
  comparable_sales (G6)
  days_on_market (G4)
  price_reductions (G5)
  area_price_trend (H4)

OUTPUTS:
  finding_price_fairness (STRENGTH / WEAKNESS / MIXED / UNKNOWN)
```

## Trend Trajectory Finding

```
INPUTS:
  revenue_trend (I1)
  cost_trend (I2)
  profitability_trend (I3)
  equity_trend (I4)
  debt_trend (I5)
  fee_trend (I6)

OUTPUTS:
  finding_trend_trajectory (IMPROVING / DECLINING / MIXED / STABLE / UNKNOWN)
```

## Risk Profile Finding

```
INPUTS:
  All risk rules triggered against any metric
  Overall risk score (J1)
  Risk factor distribution (J2)

OUTPUTS:
  finding_risk_profile (LOW / MODERATE / ELEVATED / HIGH / CRITICAL)
```

## Area Quality Finding

```
INPUTS:
  area_crime_index (H1)
  public_transport (H2)
  demographics (H3)
  area_price_trend (H4)

OUTPUTS:
  finding_area_quality (STRENGTH / WEAKNESS / MIXED / UNKNOWN)
```

---

# Appendix: Interpretation vs Fact Classification

Every metric in this knowledge base is classified. The reasoning engine
must respect these classifications.

## Objective Facts (numbers from the documents)

All EXTRACTED metrics are objective facts:
- A1-A7 (income statement)
- B1-B8 (balance sheet)
- C1 (apartment count)
- F1 (monthly fee)
- G1 (asking price)
- G4 (days on market)
- G5 (price reductions)
- H1-H3 (external data)
- E4 (loan maturity dates)

## Calculated Metrics (deterministic formulas)

All CALCULATED metrics are objective facts (given their inputs):
- C2-C7 (per-apartment metrics)
- D1-D6 (financial ratios)
- E1-E3, E5 (debt structure)
- F2, F4 (fee calculations)
- G2, G3 (price calculations)
- I1-I6 (trend directions)
- J1-J3 (risk and confidence scores)

## Expert Interpretations (require domain knowledge)

These entries require thresholds, norms, or cross-dimensional reasoning:
- D1 equity ratio interpretation (what range is "healthy")
- D2 operating margin interpretation
- D3 interest coverage interpretation
- D6 fee sustainability interpretation
- G3 price premium interpretation
- I1-I6 trend interpretation (what "improving" means depends on context)
- J1-J2 risk score interpretation
- All cross-dimensional reasoning rules
- All FINDINGS (Layer 4 of reasoning engine)

## Recommendations (require synthesis of findings)

These are never derived from a single metric:
- Price negotiation guidance
- Information request recommendations
- Due diligence recommendations
- Walk-away decisions
- Final verdict

---

*This knowledge base is the reasoning engine's dictionary. When the reasoning
engine encounters a metric, it looks it up here to understand what it means,
what thresholds apply, and what conclusions can be drawn. The knowledge base
does not change — it is the stable foundation that the reasoning engine builds upon.*
