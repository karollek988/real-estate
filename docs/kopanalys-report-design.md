# Köpanalys — Complete Report Design

> **Status: Version 1.0 — DESIGN DOCUMENT, implementation-ready** (reviewed
> alongside [`43_architecture_review.md`](./43_architecture_review.md); no
> findings from that review required changes to this document's content —
> the review's applied fixes live in
> [`42_platform_data_contracts.md`](./42_platform_data_contracts.md)).
> This defines the final customer-facing report.
> Every section, metric, and conclusion was designed by thinking like a Swedish
> real estate analyst, bank credit officer, and BRF board member — not like a
> software engineer.
>
> The report answers one question: **"Should I buy this apartment?"**

---

## Pipeline ownership (read before the rest of this document)

This document was written to specify report *content* — what each section
says and why it matters to a buyer. It was written before the pipeline
architecture and data contracts were finalized, and in places reads as if
a single "the analysis" or "the risk engine" computes everything. That has
since been formalized. The binding ownership split, defined in
[`42_platform_data_contracts.md`](./42_platform_data_contracts.md) and
[`37_platform_architecture.md`](./37_platform_architecture.md), is:

- **This document** owns *what* a section must say, its minimum-data
  thresholds, and what must never be concluded without evidence — that
  content contract is unchanged and still authoritative.
- **The Listing Parser** owns turning a Hemnet URL into the `Property`
  object every "Listing" reference below actually means (doc 42 §3).
- **The BRF, Market Intelligence, and Location Intelligence Engines** own
  fetching/extracting the raw facts — every "annual report," "Booli,"
  "SCB," "Trafikverket," etc. reference below is now a named engine with a
  concrete domain/key contract (doc 42 §4–§6), not a generic external
  source.
- **The Aggregator** owns merging engine outputs and preserving (never
  silently dropping) disagreements between sources (doc 42 §7).
- **The AI Analysis Engine** — not a separate "risk engine" or the report
  itself — owns every verdict, risk severity, trend classification,
  confidence score, and piece of generated prose this document describes.
  Wherever this document says "the analysis concludes X" or "the risk
  engine evaluates," read that as the AI Analysis Engine's
  `StructuredAnalysis` output (doc 42 §8).
- **The Report Generator** performs none of the above — it renders
  `StructuredAnalysis` fields into the pages this document describes.

Section-by-section data-source references below have been updated to name
the concrete owning engine. The report content and rules themselves —
verdicts, thresholds, risk taxonomy — are unchanged.

---

# Report Philosophy

A home buyer is making the largest financial decision of their life. They are
not buying a stock. They are buying into a community — a BRF — where they will
live, pay fees, and share financial responsibility with their neighbours.

The report must feel like sitting down with three experts:

- **The real estate agent** who knows the market and can say whether the price is fair
- **The bank credit analyst** who has read the BRF's financials and can say whether the association is financially sound
- **The experienced board member** who knows what the numbers don't show — the hidden risks, the upcoming costs, the things that keep board members awake at night

Every statement must be backed by real data. If the data is missing, the report
says so. It never guesses.

---

# Report Structure

The report is divided into **10 sections**, presented in the order a buyer would
naturally think through the decision.

---

## Section 1: Besked — The Bottom Line

### Purpose
Give the buyer a clear, honest answer to their question within 30 seconds.

### Why the customer cares
They have looked at dozens of apartments. They need a quick signal: is this one
worth investing more time in, or should they move on?

### What this section contains

| Element | Description |
|---------|-------------|
| **Bedömningsgrad** | Buy / Buy with reservation / Negotiate / Think again / Avoid |
| **Confidence level** | How confident the analysis is based on available data |
| **One-sentence verdict** | "A financially healthy BRF in a growing area, but the asking price is above market." |
| **Three key reasons** | The three most important factors driving the verdict |
| **Three key risks** | The three most important risks the buyer should know about |

### Confidence level
This section is only shown when overall analysis confidence is above 0.50.
Below that, the report opens with: "Analysera saknar för mycket data för ett
pålitligt besked."

### What should never be concluded without evidence
- Never say "good investment" without having at least 1 year of BRF financials
- Never say "fair price" without at least 3 comparable sales in the area
- Never say "avoid" without at least one concrete, data-backed risk factor
- Never state a price recommendation without showing the supporting data

---

## Section 2: Objektet — The Property

### Purpose
Establish exactly what is being bought.

### Why the customer cares
Before evaluating whether the deal is good, the buyer needs a clear picture of
what they are actually purchasing — size, condition, location, and what the
monthly cost looks like.

### What this section contains

**Property facts:**

| Field | Source |
|-------|--------|
| Address | Listing |
| Municipality / City | Listing / Geocoding |
| Postal code | Listing |
| Property type | Listing (Lägenhet, Radhus, etc.) |
| Apartment number | Listing |
| Floor | Listing |
| Rooms | Listing |
| Living area (m²) | Listing |
| Asking price (SEK) | Listing |
| Price per m² (SEK/m²) | Calculated: asking_price / living_area |
| Monthly fee (SEK/month) | Listing / BRF data |
| Monthly fee per m² (SEK/m²/month) | Calculated: monthly_fee / living_area |
| Operating costs (SEK/year) | Listing if available |
| Year built | BRF annual report |
| Energy class | Energy declaration (when available) |
| Balcony | Listing |
| Elevator | Listing |
| Storage | Listing |
| Parking | Listing |

**Price positioning:**

| Metric | What it tells you |
|--------|-------------------|
| Price per m² vs area median | Is this apartment priced above, at, or below the area average? |
| Price per m² vs BRF average | How does this compare to other apartments in the same BRF? |
| Asking price vs estimated market value | Is there room to negotiate? |

**Monthly cost breakdown:**

| Metric | What it tells you |
|--------|-------------------|
| Monthly fee | What you pay the BRF each month |
| Estimated interest cost | What you pay the bank (based on current Riksbanken rate + margin) |
| Estimated amortisation | What you pay back (based on standard 2% or 3% amortisation requirement) |
| **Total estimated monthly cost** | Fee + interest + amortisation |

### Data required
- **Listing Parser** — `Property` object: address, price, area, rooms, fee, floor, features (doc 42 §3)
- **BRF Engine** — `brf_overview` domain: year built, number of apartments (doc 42 §6)
- **Market Intelligence Engine** — `macro_economy` domain, `riksbank_interest_rate` provider (for interest estimation; real code, unreleased)
- **Market Intelligence Engine** — `comparable_sales` (for price positioning) — **named gap**: no comparable-sale-transaction provider is built yet (doc 42 §5); this row degrades to the missing-data placeholder until one exists
- **Market Intelligence Engine** — area price statistics, same gap as above

### Risk indicators
- High price per m² relative to area (may indicate overpaying)
- High fee per m² (may indicate BRF inefficiency or old building)
- Missing energy class (may indicate high energy costs)
- Old building without recent renovation records

### Multi-year influence
None — this section is a snapshot of the current listing.

---

## Section 3: BRF:n — The Housing Association

### Purpose
Explain the financial health of the BRF the buyer is joining. This is the most
important section of the entire report. When you buy into a BRF, you inherit
its financial health — its debts, its savings, its maintenance obligations.

### Why the customer cares
A weak BRF means:
- Monthly fees will increase
- Special assessments (särskilda avgifter) may be imposed
- The apartment's value may decline
- The buyer may be stuck with a property they cannot sell

A strong BRF means:
- Stable or decreasing fees
- Reserves for maintenance
- Financial cushion against surprises
- A property that holds its value

### What this section contains

#### 3.1 Overview

| Field | Description |
|-------|-------------|
| BRF name | Official name |
| Organization number | For verification at Bolagsverket |
| Municipality | Where the BRF is located |
| Number of apartments | Total apartments in the association |
| Number of commercial premises | Kassaskåp, butiker, etc. (revenue diversification) |
| Number of rental apartments | Inkomstlägenheter (revenue diversification) |
| Year built | Oldest building in the association |
| Property designation | Fastighetsbeteckning |

#### 3.2 Financial Statements (per year)

**Income Statement (Rörelseresultat):**

| Metric | Why it matters |
|--------|---------------|
| Revenue (Bruttointäkter) | Total income from fees, commercial rent, other |
| Operating costs (Rörelsekostnader) | Total costs to run the BRF |
| Operating profit (Rörelseresultat) | Revenue minus costs. Positive = self-sustaining. Negative = spending reserves. |
| Financial income (Finansintäkter) | Interest earned on savings |
| Financial costs (Finanskostnader) | Interest paid on loans |
| Profit before tax (Resultat före skatt) | Bottom line before tax |
| Profit after tax (Resultat efter skatt) | What actually went to or came from reserves |

**Balance Sheet (Balansräkning):**

| Metric | Why it matters |
|--------|---------------|
| Total assets (Summa tillgångar) | Everything the BRF owns |
| Total equity (Eget kapital) | What belongs to the members after debts are paid |
| Total liabilities (Skulder totalt) | Everything the BRF owes |
| Long-term debt (Skulder > 1 år) | Loans with maturity > 1 year |
| Short-term debt (Skulder < 1 year) | Loans due within 1 year + overdraft |

**Per-Apartment Metrics (the most important numbers):**

| Metric | Formula | What it tells you |
|--------|---------|-------------------|
| Debt per apartment | long_term_debt / apartments | How much debt each apartment carries |
| Equity per apartment | equity / apartments | How much each apartment is "worth" in the BRF |
| Revenue per apartment | revenue / apartments | Income generated per apartment |
| Cost per apartment | operating_costs / apartments | Cost to run per apartment |

#### 3.3 Financial Ratios

| Ratio | Formula | Healthy Range | What it means |
|-------|---------|---------------|---------------|
| **Equity ratio** | equity / total_assets | 30-70% | Higher = more financial cushion. Below 30% is a warning sign. |
| **Operating margin** | operating_profit / revenue | > 0% | Positive = the BRF covers its costs from income. Negative = spending reserves. |
| **Interest coverage** | operating_profit / financial_costs | > 1.0 | Can the BRF pay its interest from operating income? Below 1.0 is dangerous. |
| **Debt ratio** | total_liabilities / total_assets | < 70% | How leveraged is the BRF? High = risky. |
| **Cost per m²** | operating_costs / building_area | Varies | Efficiency metric — compare across years |
| **Fee sustainability** | avg_fee / (revenue_per_apartment / 12) | > 0.8 | Do fees actually cover costs? |

#### 3.4 Loan Portfolio

| Field | Why it matters |
|-------|---------------|
| Total debt | Sum of all remaining loan balances |
| Number of loans | How many separate obligations |
| Weighted average interest rate | Effective cost of borrowing |
| Short-term debt ratio | Portion of debt due within 1 year |
| Upcoming maturities | Which loans need to be refinanced soon |
| Amortisation requirements | Are there mandatory paydown schedules? |

For each individual loan:

| Field | Description |
|-------|-------------|
| Lender | Which bank |
| Original amount | How much was borrowed |
| Remaining amount | How much is left |
| Interest rate | What rate is being paid |
| Maturity date | When it must be repaid |
| Amortisation requirement | Mandatory paydown schedule |

#### 3.5 Board & Governance

| Field | Why it matters |
|-------|---------------|
| Chairman | Who leads the board |
| Auditor | Independent oversight |
| Auditor firm | Professional vs member auditor |
| Board meeting frequency | Active governance vs passive |
| Member count | Board size relative to BRF size |

### Financial metrics required
All fields from the **BRF Engine**'s output: `income_statement`,
`balance_sheet`, `apartment_metrics`, and `loan` domains — the exact
domain/key contract is fixed in doc 42 §6, mapping 1:1 onto the tables
above. Multi-year data comes from multiple `Finding`s per key, one per
fiscal year (`validity.start`/`validity.end`), not a separate time-series
structure.

### Risk indicators

| Indicator | Severity | What it means |
|-----------|----------|---------------|
| Operating profit negative | CRITICAL | The BRF is spending more than it earns. Reserves are being depleted. |
| Equity ratio < 30% | HIGH | Thin financial cushion. A single large expense could cause a special assessment. |
| Interest coverage < 1.0 | HIGH | The BRF cannot cover interest payments from operating income. |
| Debt per apartment > 600,000 SEK | HIGH | Heavy debt burden. Higher risk of fee increases. |
| Short-term debt > 40% of total | HIGH | Refinancing risk. If rates rise, costs spike. |
| Weighted interest > 5% | MEDIUM | Above-market borrowing costs. May indicate weak creditworthiness. |
| No auditor | MEDIUM | Reduced governance oversight. |
| Single loan concentration | MEDIUM | If one lender calls the loan, the BRF is exposed. |

### Multi-year influence
This is where multi-year data is most powerful:

- **Operating profit trend**: Is the BRF becoming more or less self-sustaining?
- **Equity trend**: Is the BRF building reserves or depleting them?
- **Debt trend**: Is debt being paid down or growing?
- **Fee trend**: Are fees increasing? At what rate?
- **Cost trend**: Are costs growing faster than revenue?
- **Revenue trend**: Is income growing (from fee increases, new tenants, etc.)?

**A single year can be misleading.** A BRF might show a profit in one year because
of a one-time gain (selling a commercial premise) or a one-time cost (a major
repair). Only the trend reveals the true trajectory.

**Key multi-year conclusions:**
- "The BRF has been profitable for 3 consecutive years" → positive signal
- "Operating profit has declined for 2 years" → warning signal
- "Equity ratio has been stable at 45% for 5 years" → healthy signal
- "Debt has increased 30% while equity is flat" → the BRF is levering up

### What should never be concluded without evidence
- Never say "the BRF is healthy" without at least 2 years of financial data
- Never say "fees will increase" without a trend or a stated board decision
- Never say "the BRF is well-managed" without auditor confirmation
- Never compare BRFs without normalizing for size (per-apartment metrics)

---

## Section 4: Prisbedömning — Price Assessment

### Purpose
Determine whether the asking price is fair, and whether there is room to negotiate.

### Why the customer cares
Overpaying for a BRF apartment is one of the most common and costly mistakes
buyers make. The asking price is the seller's opening position, not the market price.

### What this section contains

#### 4.1 Comparable Sales

| Metric | Description |
|--------|-------------|
| Recent sales in the same BRF | Same building = most relevant comparables |
| Recent sales in the same street/area | Nearby similar apartments |
| Median price per m² for comparables | The benchmark |
| Price range of comparables | Shows the spread |
| Price trend of comparables | Are prices rising or falling in this area? |

#### 4.2 Price Positioning

| Metric | What it tells you |
|--------|-------------------|
| Asking price per m² | What the seller wants |
| Area median price per m² | What similar apartments sell for |
| Price premium/discount | (asking - median) / median × 100 |
| Number of days on market | How long the listing has been active |
| Price reductions | Has the price been lowered? How many times? |
| Competition | How many other apartments are for sale in the same area? |

#### 4.3 Negotiation Leverage

| Factor | Impact on negotiation |
|--------|----------------------|
| Long time on market (> 60 days) | Buyer has leverage |
| Price reductions already made | Seller may be flexible |
| Few competing listings | Less leverage for buyer |
| Many competing listings | More leverage for buyer |
| BRF financial health | Weak BRF = leverage for price reduction |
| Upcoming renovations | Known costs = leverage for price reduction |
| Seasonal timing | Winter = less competition = more leverage |

### Data required
- **Market Intelligence Engine** — sold-transaction data (Booli, Mäklarstatistik, Hemnet slutförda) — **named gap**: not built yet, see doc 42 §5. Every real provider built so far is macro/regional statistics, not per-transaction comparables.
- **Market Intelligence Engine** — current listings in the area (for competition assessment) — same gap
- **Listing Parser** — `Property` object: days on market, price history (doc 42 §3)
- **BRF Engine** — financial data, `financial_ratios`/`income_statement` domains (for health-based negotiation)
- **BRF Engine** — maintenance/renovation plans, if present in `narrative_sections`/extracted notes

### Risk indicators
- Asking price > 10% above area median → overpaying risk
- No recent comparable sales → price uncertainty
- Declining area prices → value may drop after purchase
- BRF has upcoming large renovation → costs will increase, may depress value

### Multi-year influence
- Area price trend: Are prices in this neighbourhood rising or falling?
- BRF fee trend: Rising fees reduce the apartment's effective value
- BRF equity trend: Declining equity may signal future price pressure

### What should never be concluded without evidence
- Never state a "fair price" without at least 3 comparable sales
- Never say "good deal" without knowing the area price trend
- Never recommend negotiation tactics without data on market conditions
- Never ignore the BRF's financial health in price assessment

---

## Section 5: Avgifter & Driftkostnader — Fees & Operating Costs

### Purpose
Explain the true monthly cost of ownership and whether the BRF's fees are
reasonable.

### Why the customer cares
The monthly fee is a recurring cost that directly affects affordability and
quality of life. A low fee today might mean a big increase tomorrow. A high
fee might mean the building is well-maintained or poorly managed.

### What this section contains

#### 5.1 Fee Comparison

| Metric | What it tells you |
|--------|-------------------|
| This apartment's monthly fee | Absolute cost |
| Fee per m² | Normalized cost — allows comparison across apartment sizes |
| Area median fee per m² | What other apartments in the area cost |
| BRF median fee per m² | What other apartments in the same BRF cost |
| Fee percentile | Where this fee ranks among comparable apartments |

#### 5.2 What the Fee Covers

A good report should explain what the buyer gets for their fee:

| Typical inclusions | Notes |
|-------------------|-------|
| Heating | Often included |
| Water | Often included |
| Building insurance | Usually included |
| Property tax | Usually included |
| Cable TV / Internet | Sometimes included |
| Cleaning of common areas | Usually included |
| Gardening / Snow removal | Usually included |
| Städning | Usually included |
| Maintenance reserve | Portion goes to future repairs |

#### 5.3 Fee Sustainability Analysis

| Metric | Formula | What it tells you |
|--------|---------|-------------------|
| Fee coverage ratio | avg_fee / (revenue_per_apartment / 12) | Does the fee actually cover the BRF's costs? |
| Operating cost per apartment | operating_costs / apartments | What it costs to run the BRF per unit |
| Fee trend (annual change) | (fee[y] - fee[y-1]) / fee[y-1] | How fast are fees rising? |
| Fee growth vs inflation | fee_growth - CPI | Is fee growth outpacing general price increases? |

#### 5.4 Fee Forecast

Based on historical trends and known future costs:

| Forecast element | Basis |
|-----------------|-------|
| Expected fee increase next year | Historical trend + known cost pressures |
| Risk of special assessment | BRF financial health + upcoming maintenance |
| Impact of known renovations | If the annual report mentions planned work |

### Data required
- **Listing Parser** — monthly fee (`Property.monthly_fee_sek`), fallback to **BRF Engine** `brf_overview` if absent
- **BRF Engine** — operating costs, revenue, number of apartments (`income_statement`, `brf_overview` domains)
- **BRF Engine** — fee history across multiple fiscal years (multiple `Finding`s via `validity` windows)
- **Market Intelligence Engine** — area fee statistics — **named gap**, no listing-level comparable data yet (doc 42 §5)
- **Market Intelligence Engine** — inflation/CPI data, `macro_economy` domain

### Risk indicators
- Fee per m² above 80th percentile of area → expensive
- Fee increasing > 5% annually → accelerating costs
- Fee coverage ratio < 0.8 → fees don't cover costs, BRF is subsidising from reserves
- Sudden fee jump → may indicate a problem

### Multi-year influence
Fee trends are critical:

- **Stable fees over 3+ years** → well-managed BRF
- **Steady 2-3% annual increase** → normal, tracks inflation
- **Accelerating increases** → warning sign, costs are growing faster than income
- **Fee decrease** → unusual, may indicate the BRF overcharged previously or lost revenue

### What should never be concluded without evidence
- Never say "fees are reasonable" without comparing to the area median
- Never predict future fees without at least 2 years of historical data
- Never say "fees will stay the same" — fees always change
- Never ignore the relationship between fees and BRF financial health

---

## Section 6: Skuldsättning — Debt Analysis

### Purpose
Deep analysis of the BRF's debt burden and its implications for the buyer.

### Why the customer cares
When you buy into a BRF, you implicitly take on a share of its debt. High debt
means higher financial risk, higher interest costs (passed through to fees),
and less flexibility for the BRF to handle unexpected expenses.

### What this section contains

#### 6.1 Debt Overview

| Metric | Description |
|--------|-------------|
| Total debt | Sum of all loans |
| Debt per apartment | Each apartment's share of the debt |
| Debt per m² | Debt normalized by building size |
| Debt-to-equity ratio | Total debt / total equity — how leveraged is the BRF? |
| Debt-to-asset ratio | Total debt / total assets |

#### 6.2 Debt Service Capacity

| Metric | Formula | What it tells you |
|--------|---------|-------------------|
| Annual interest cost | sum of (loan × rate) | What the BRF pays in interest each year |
| Interest cost per apartment | annual_interest / apartments | Per-unit burden |
| Interest coverage ratio | operating_profit / financial_costs | Can the BRF pay interest from income? |
| Debt service ratio | (interest + mandatory amortisation) / revenue | Can the BRF service all debt obligations? |

#### 6.3 Debt Structure

| Metric | What it tells you |
|--------|-------------------|
| Weighted average interest rate | Effective borrowing cost |
| Fixed vs floating rate exposure | Risk if rates rise |
| Short-term debt ratio | Refinancing risk |
| Loan maturity distribution | When loans need to be refinanced |
| Largest single lender concentration | Counterparty risk |

#### 6.4 Debt Trajectory

| Metric | What it tells you |
|--------|-------------------|
| Debt change over past years | Is debt growing or shrinking? |
| Amortisation progress | How much has been paid down? |
| New borrowing | Has the BRF taken on new loans? |
| Debt-to-equity trend | Is the BRF becoming more or less leveraged? |

### Data required
- **BRF Engine** — `loan` domain, one `Finding` per loan, per year (doc 42 §6)
- **BRF Engine** — `income_statement.operating_profit_sek` (for interest coverage)
- **BRF Engine** — `income_statement.revenue_sek` (for debt service ratio)
- **BRF Engine** — `brf_overview.apartment_count` (for per-unit metrics)

### Risk indicators

| Indicator | Severity | What it means |
|-----------|----------|---------------|
| Debt per apartment > 600,000 SEK | HIGH | Heavy burden |
| Interest coverage < 1.0 | CRITICAL | Cannot service debt from income |
| Short-term debt > 40% | HIGH | Refinancing cliff |
| Debt growing faster than equity | HIGH | Levering up |
| Single lender > 50% of debt | MEDIUM | Concentration risk |
| Weighted interest > market rate | MEDIUM | May indicate weak credit |

### Multi-year influence
Debt trajectory is one of the most important multi-year signals:

- **Debt declining, equity stable or growing** → the BRF is deleveraging. Positive.
- **Debt stable, equity growing** → the BRF is building cushion. Positive.
- **Debt growing, equity stable** → the BRF is borrowing to fund operations. Warning.
- **Debt growing, equity declining** → the BRF is in financial distress. Critical.
- **Debt stable, equity declining** → the BRF is consuming reserves while not reducing debt. Warning.

### What should never be concluded without evidence
- Never say "debt is manageable" without knowing the interest coverage ratio
- Never compare debt levels without normalizing per apartment
- Never assess refinancing risk without knowing loan maturity dates
- Never ignore the relationship between debt trend and equity trend

---

## Section 7: Riskbedömning — Risk Assessment

### Purpose
Consolidate all identified risks into a structured, transparent risk profile.

### Why the customer cares
Risk is not a single number. It is a collection of specific, identifiable
factors. The buyer needs to know not just "how risky" but "what risks" and
"how severe."

### What this section contains

#### 7.1 Risk Summary

| Element | Description |
|---------|-------------|
| Overall risk level | Low / Moderate / Elevated / High / Critical |
| Number of risk factors identified | Count of triggered risks |
| Most severe risk | The single highest-severity risk found |

#### 7.2 Risk Factors (ordered by severity)

For each risk factor:

| Field | Description |
|-------|-------------|
| Category | Financial health / Debt / Fee / Structural / Trend / Market |
| Description | Plain-language explanation of the risk |
| Evidence | The specific metric or data point that triggered this risk |
| Severity | Low / Medium / High / Critical |
| What it means for the buyer | How this risk affects them specifically |
| Mitigating factors | What reduces this risk (if anything) |

#### 7.3 Risk Categories

**Financial health risks:**
- Negative operating profit
- Declining equity ratio
- Operating margin deterioration
- Revenue decline

**Debt risks:**
- High debt per apartment
- Poor interest coverage
- Short-term debt concentration
- Rising debt trend
- High weighted interest

**Fee risks:**
- High fee per m²
- Fee unsustainability (fees don't cover costs)
- Rapid fee increases
- Fee above area median

**Structural risks:**
- Old building without renovation
- Small association (fewer apartments to share costs)
- Missing audit
- Single commercial tenant dependency
- Ground lease (tomträtt)

**Trend risks:**
- Multi-year profitability decline
- Multi-year equity erosion
- Multi-year debt increase
- Cost growth outpacing revenue growth

**Market risks:**
- Declining area prices
- High supply / low demand in the area
- Rising interest rate environment

### Data required
All data from Sections 3-6, as merged into the Aggregator's MIP. The **AI
Analysis Engine** — not a separate "risk engine" — evaluates this data and
emits `risk_assessment.factors[]` (doc 42 §8), each with `category`,
`severity`, `description_sv`, `evidence_refs`, `buyer_impact_sv`, and
`mitigating_factors_sv`, matching the fields below 1:1.

### Multi-year influence
The risk assessment must incorporate trend-based risks. A BRF that looks
acceptable in a single year may be on a dangerous trajectory.

- **2+ years of declining profitability** → elevated risk even if the latest year is still positive
- **Equity ratio approaching 30% from above** → the BRF is heading toward a danger zone
- **Debt growing while costs grow faster than revenue** → a compounding problem

### What should never be concluded without evidence
- Never assign "Low risk" without at least 1 year of financial data
- Never assign "Critical risk" without at least one specific, quantified factor
- Never ignore a critical-severity factor in the overall assessment
- Never present risk without also presenting what mitigates it

---

## Section 8: Utveckling — Trends & Future Outlook

### Purpose
Show the buyer the trajectory — where the BRF has been and where it appears
to be heading.

### Why the customer cares
A snapshot tells you where things are. A trend tells you where things are going.
Buying into a BRF on a downward trajectory is very different from buying into
one that is improving.

### What this section contains

#### 8.1 Financial Trajectory

For each key metric, show the multi-year trend:

| Metric | Trend Display |
|--------|--------------|
| Revenue | Year-by-year values + direction arrow |
| Operating profit | Year-by-year values + direction arrow |
| Equity | Year-by-year values + direction arrow |
| Total debt | Year-by-year values + direction arrow |
| Monthly fee | Year-by-year values + direction arrow |
| Debt per apartment | Year-by-year values + direction arrow |
| Equity ratio | Year-by-year values + direction arrow |

#### 8.2 Trend Classifications

| Direction | Meaning | Buyer implication |
|-----------|---------|-------------------|
| Improving | Metric getting better over time | Positive signal |
| Stable | Metric roughly constant | Neutral signal |
| Declining | Metric getting worse over time | Warning signal |
| Insufficient data | Not enough years to determine | Neutral — cannot assess |
| Volatile | Large year-to-year swings | Uncertainty — investigate why |

#### 8.3 Anomalies

| Field | Description |
|-------|-------------|
| What | Which metric deviated |
| When | Which year |
| Magnitude | How large the deviation was |
| Context | What may have caused it (if determinable from the annual report) |

#### 8.4 Future Outlook

Based on trends and known factors:

| Outlook element | Basis |
|----------------|-------|
| Fee trajectory | Historical fee trend |
| Debt trajectory | Historical debt trend + loan maturities |
| Maintenance outlook | Known renovation plans from annual reports |
| Financial health trajectory | Equity and profitability trends |

### Data required
- **BRF Engine** — minimum 2 years of `income_statement`/`balance_sheet` `Finding`s (3-5 years ideal), one set per fiscal year via `validity` (doc 42 §6)
- **Market Intelligence Engine** — historical area price data (for market context) — subject to the comparable-sales gap noted in Section 4
- **BRF Engine** — known renovation plans, if extracted
- **BRF Engine** — `loan` domain maturity dates (for refinancing outlook)

All of the above is exposed to templates as `StructuredAnalysis.trends[key]`
(doc 42 §8) — direction, series, and commentary, never raw multi-year
`Finding` lists rendered directly.

### Multi-year influence
This section IS the multi-year analysis. Its entire purpose is to show trajectory.

**Key principle:** A single good year does not make a healthy BRF. A single bad year
does not make an unhealthy BRF. Only the trend tells the truth.

**Minimum data requirements:**
- 2 years: can determine direction (improving/declining/stable)
- 3 years: can determine acceleration (getting better faster, or slowing)
- 4-5 years: can identify cyclical patterns and long-term trajectory

### What should never be concluded without evidence
- Never show a trend with fewer than 2 data points
- Never extrapolate trends into the future
- Never call a trend "stable" with only 2 data points
- Never hide volatile data behind a smoothed average
- Never ignore anomalies without noting them

---

## Section 9: Området — The Area

### Purpose
Evaluate the neighbourhood and its impact on quality of life and property value.

### Why the customer cares
They are not just buying an apartment — they are buying a neighbourhood.
Schools, transport, safety, and local development all affect both their daily
life and their investment.

### What this section contains

#### 9.1 Location Quality

| Factor | Data source |
|--------|------------|
| Distance to city centre | `address_resolver`/`nominatim_geocoder` |
| Public transport access | `trafikverket_infrastructure` — **not yet connected**, needs API credentials (doc 42 §4) |
| Commute time to nearest urban centre | `trafikverket_infrastructure`, same connectivity caveat |
| Walkability | `osm_poi` |
| Proximity to green spaces | `osm_poi` |
| Noise level | **named gap** — no provider exists (no SMHI or municipal noise-data provider built) |

#### 9.2 Amenities

| Factor | What to measure |
|--------|----------------|
| Grocery stores | Distance and number within walking distance |
| Schools | Distance, quality ratings (if available) |
| Healthcare | Distance to nearest Vårdcentral |
| Childcare | Distance and availability |
| Restaurants / Cafés | Proximity (lifestyle indicator) |
| Parks / Recreation | Proximity and quality |

#### 9.3 Safety

| Factor | Data source |
|--------|------------|
| Crime statistics | `polisen_crime` (Polisen event data — not Brå; correcting an earlier draft assumption) |
| Crime trend | Only stated if `polisen_crime` returns multi-period data — otherwise omitted per the "never conclude without evidence" rule |
| Type of crime | `polisen_crime` event-type breakdown |
| Perception of safety | **named gap** — no survey-data provider exists |

#### 9.4 Demographics

| Factor | Data source |
|--------|------------|
| Population trend | `scb_municipality` |
| Age distribution | `scb_municipality` |
| Income levels | `scb_municipality` / `kolada` |
| Education levels | `scb_municipality` |
| Foreign-born percentage | `scb_municipality` |

All figures in this subsection are **municipality-level**, per
`AddressContext.municipality_code` — the page must say so explicitly and
never imply neighbourhood-level precision the engine doesn't have (doc 42
§4).

#### 9.5 Future Development

| Factor | What to look for |
|--------|-----------------|
| Planned infrastructure | New metro lines, roads, bridges |
| Municipal development plans | Stadsplaner, detaljplaner |
| Major construction projects | New buildings, commercial developments |
| Zoning changes | May affect density, traffic, character |
| Impact on property values | Positive or negative implications |

### Data required
All from the **Location Intelligence Engine** — released, real, field-level
schema fixed in doc 42 §4. Concrete provider mapping:
- Geocoding/precision: `address_resolver`, `nominatim_geocoder`
- Public transport / planned infrastructure: `trafikverket_infrastructure` (currently `not_connected` — needs credentials), `lantmateriet_detaljplan` (same)
- Crime data: `polisen_crime`
- Demographics: `scb_municipality`, `kolada`
- Amenities: `osm_poi`
- Construction activity: `osm_construction`
- Local news: `svt_local_news`
- Local business activity: `bolagsverket_companies`
- Environmental risk (flood, contamination) — **named gap**: in this engine's architectural scope, no provider built yet

### Risk indicators
- High crime rate or increasing crime trend
- Poor public transport connectivity
- Declining population
- Major construction that may disrupt the area
- Flood risk or environmental contamination

### Multi-year influence
- Population trend (growing or declining?)
- Crime trend (improving or worsening?)
- Infrastructure development (new transport links coming?)
- Area price trend (are properties in this area appreciating?)

### What should never be concluded without evidence
- Never say "good area" without specific supporting data points
- Never ignore crime data
- Never speculate about future development without citing municipal plans
- Never compare areas without using the same metrics

---

## Section 10: Saknade Uppgifter — Missing Data

### Purpose
Transparently list everything the analysis could NOT find or verify.

### Why the customer cares
This is perhaps the most important section for trust. If the analysis hides
what it doesn't know, the buyer cannot make an informed decision. If the
analysis explicitly states what is missing, the buyer knows exactly what
additional information to request.

### What this section contains

#### 10.1 Missing BRF Data

| Missing field | Why it matters | How to obtain it |
|---------------|---------------|-----------------|
| Annual report for year X | Cannot assess that year's financials | Request from BRF board or Bolagsverket |
| Loan details | Cannot assess debt structure | Request from BRF board |
| Renovation plans | Cannot assess future costs | Request from BRF board |
| Board minutes | Cannot assess governance quality | Request from BRF board |

#### 10.2 Missing Market Data

| Missing field | Why it matters | How to obtain it |
|---------------|---------------|-----------------|
| Comparable sales | Cannot validate price | **Named platform gap** — no `comparable_sales` provider exists in Market Intelligence yet (doc 42 §5); until built, check Booli/Mäklarstatistik manually |
| Area price trend | Cannot assess market direction | Same gap — `scb_housing_market`/`eurostat_housing_price` give national/regional indices only, not this area's trend specifically |
| Energy declaration | Cannot assess energy costs | Not sourced by any current provider — request from BRF or check Boverket manually |

#### 10.3 Missing External Data

| Missing field | Why it matters | How to obtain it |
|---------------|---------------|-----------------|
| Crime statistics | Cannot assess safety | Normally sourced from `polisen_crime` — if `no_data`, the underlying Location Intelligence run failed for this address; retry rather than treat as a permanent gap |
| Infrastructure plans | Cannot assess future development | `trafikverket_infrastructure`/`lantmateriet_detaljplan` — both `not_connected` by default until API credentials are configured (doc 42 §4); this is the realistic default today |
| Ground lease terms (tomträtt) | May affect long-term value | Not sourced by any current provider — request from BRF |

#### 10.4 Confidence Summary

| Metric | Value | Source field (doc 42 §8) |
|--------|-------|---------------------------|
| Overall data completeness | X% of expected fields found | Derived from `missing_data[]` length vs. total expected domain/keys |
| Most impactful missing data | What would most improve the analysis | `missing_data[].impact_sv`, highest-impact entry surfaced first |
| Recommendation | "Request the following documents before making a decision" | `missing_data[].how_to_obtain_sv` |
| Overall verdict confidence | Same number gating the Executive Summary | `verdict.confidence` / `verdict.confidence_gate_passed` |

**Placeholder microcopy is fixed, not free text** — every missing field
anywhere in the report uses the exact strings defined in doc 42 §9:
`Uppgift saknas` (single field), `Otillräckligt dataunderlag` (whole
section), or the fixed low-confidence banner sentence for the Executive
Summary. This section is the only place that *explains* what's missing;
every other section just shows the fixed placeholder and points here.

### What should never be concluded without evidence
- This section must never be empty if any expected field is missing
- Never say "data not available" without suggesting how to obtain it
- Never hide missing data in footnotes — it must be prominently displayed
- The confidence score must be directly tied to what is listed here

---

# Data Dependency Map

This map shows exactly which raw data points are required to produce every
conclusion in the report. Each row is a data dependency — without it, the
dependent conclusions cannot be made.

## Legend

Each letter now maps to a specific pipeline component and schema location
(doc 42) rather than a generic source type:

- **[E]** = Extracted by the **BRF Engine** (doc 42 §6) — must be present in an annual report or equivalent filing
- **[L]** = From the **Listing Parser**'s `Property` object (doc 42 §3)
- **[M]** = From the **Market Intelligence** or **Location Intelligence Engine** (doc 42 §4–§5)
- **[C]** = Calculated — either by the emitting engine itself (e.g. BRF Engine's `apartment_metrics`/`financial_ratios` domains, `trust_tier: derived`) or by the **Aggregator** (doc 42 §7). Never by the Report Generator.
- **[T]** = From `StructuredAnalysis.trends[key]`, computed by the **AI Analysis Engine** (doc 42 §8), requires 2+ years of underlying data
- **[R]** = From `StructuredAnalysis.risk_assessment`, computed by the **AI Analysis Engine** (doc 42 §8) — there is no separate "risk engine" component

## Dependency Table

### Section 1: Besked (Bottom Line)

| Conclusion | Requires these data points |
|------------|--------------------------|
| "Buy" verdict | All of Sections 3-7 must be computed |
| Confidence level | Field coverage ratio [C] → requires all [E] fields |
| Three key reasons | Highest-impact factors from Sections 3-6 |
| Three key risks | Top 3 severity risks from Section 7 |

### Section 2: Objektet (Property)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Property facts | [L] address, area, rooms, floor, price, fee, type |
| Price per m² | [C] asking_price / living_area |
| Fee per m² | [C] monthly_fee / living_area |
| Price vs area median | [M] area median price per m² |
| Monthly cost estimate | [L] fee + [M] riksbanken rate + [C] interest + [C] amortisation |

### Section 3: BRF:n (Housing Association)

| Conclusion | Requires these data points |
|------------|--------------------------|
| BRF overview | [E] name, org_number, apartments, commercial, rental, year_built |
| Operating profit | [E] revenue, operating_costs → [C] operating_profit |
| Equity ratio | [E] total_equity, total_assets → [C] equity / assets |
| Interest coverage | [E] operating_profit, financial_costs → [C] profit / costs |
| Debt per apartment | [E] long_term_debt, apartments → [C] debt / apartments |
| Equity per apartment | [E] total_equity, apartments → [C] equity / apartments |
| Fee sustainability | [E] avg_fee, revenue, apartments → [C] fee / (revenue_per_apt / 12) |
| Loan portfolio | [E] loans[] with lender, amount, rate, maturity |
| Weighted average interest | [E] loans[] → [C] sum(debt × rate) / total_debt |
| Short-term debt ratio | [E] short_term_debt, total_debt → [C] short / total |
| Board information | [E] chairman, auditor, auditor_firm |
| Equity trend | [E × years] equity[y] → [T] direction |
| Profitability trend | [E × years] operating_profit[y] → [T] direction |
| Debt trend | [E × years] total_debt[y] → [T] direction |
| Fee trend | [E × years] avg_fee[y] → [T] direction |

### Section 4: Prisbedömning (Price Assessment)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Comparable sales | [M] recent sold prices for similar apartments |
| Area median price | [M] median of comparable sales |
| Price premium/discount | [C] (asking - median) / median × 100 |
| Days on market | [L] listing date |
| Price history | [L] price reductions |
| Competition level | [M] current active listings in area |
| Negotiation leverage | [C] combination of market conditions + BRF health |
| Area price trend | [M × years] area prices over time → [T] direction |

### Section 5: Avgifter (Fees)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Fee comparison | [L] fee + [M] area median fee per m² |
| Fee coverage ratio | [E] avg_fee, revenue, apartments → [C] fee / (revenue_per_apt / 12) |
| Fee trend | [E × years] avg_fee[y] → [T] direction, annual_change |
| Fee vs inflation | [T] fee_growth - [M] CPI |
| Fee forecast | [T × years] historical trend → direction (NOT extrapolation) |

### Section 6: Skuldsättning (Debt Analysis)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Debt per apartment | [E] long_term_debt, apartments → [C] |
| Debt-to-equity ratio | [E] total_debt, total_equity → [C] |
| Interest cost | [E] loans[] → [C] sum(loan × rate) |
| Interest cost per apartment | [C] annual_interest / apartments |
| Interest coverage ratio | [E] operating_profit, financial_costs → [C] |
| Debt service ratio | [C] (interest + amortisation) / revenue |
| Short-term debt ratio | [E] short_term_debt, total_debt → [C] |
| Loan maturity distribution | [E] loans[].maturity_date |
| Debt trajectory | [E × years] total_debt[y] → [T] direction |
| Debt-to-equity trend | [E × years] debt[y], equity[y] → [T] direction |

### Section 7: Riskbedömning (Risk Assessment)

| Conclusion | Requires these data points |
|------------|--------------------------|
| All risk factors | [R] evaluation of each rule against its required metrics |
| Overall risk level | [C] weighted sum of triggered risks |

### Section 8: Utveckling (Trends)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Revenue trend | [E × years] revenue[y] → [T] |
| Profit trend | [E × years] operating_profit[y] → [T] |
| Equity trend | [E × years] total_equity[y] → [T] |
| Debt trend | [E × years] total_debt[y] → [T] |
| Fee trend | [E × years] avg_fee[y] → [T] |
| Cost trend | [E × years] operating_costs[y] → [T] |
| Anomaly detection | [T] comparison of year-over-year changes |
| Future outlook | Combination of [T] trends + [E] known plans |

### Section 9: Området (Area)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Transport access | [M] `trafikverket_infrastructure` (Location Intelligence) — `not_connected` by default |
| Crime statistics | [M] `polisen_crime` (Location Intelligence) |
| Demographics | [M] `scb_municipality`/`kolada` (Location Intelligence) |
| Amenities | [M] `osm_poi` (Location Intelligence) |
| Future development | [M] `osm_construction`/`lantmateriet_detaljplan` (Location Intelligence) — the latter `not_connected` by default |
| Area price trend | [M × years] Market Intelligence — **named gap**, no area-specific comparable-price provider exists yet, only national/regional indices → [T] |

### Section 10: Saknade Uppgifter (Missing Data)

| Conclusion | Requires these data points |
|------------|--------------------------|
| Missing BRF fields | [C] comparison of expected vs actual [E] fields |
| Missing market fields | [C] comparison of expected vs actual [M] fields |
| Overall confidence | [C] field coverage ratio across all sources |

---

## Minimum Data Requirements

These are the absolute minimum data points needed for each section to produce
a meaningful conclusion. Below these thresholds, the section must state that
it cannot provide a reliable assessment.

| Section | Minimum data | Below minimum → |
|---------|-------------|-----------------|
| Besked | All other sections computed | "Analysera saknar data för ett tillförlitligt besked" |
| Objektet | Listing data (price, area, rooms, fee) | Cannot evaluate the property |
| BRF:n | 1 year of financial statements | "Ingen tillgänglig årsredovisning" |
| Prisbedömning | 3 comparable sales in the area | "För få jämförelseobjekt" |
| Avgifter | BRF financials + area fee data | Cannot assess fee reasonableness |
| Skuldsättning | BRF financials with loan data | "Ingen tillgänglig lånedata" |
| Riskbedömning | At minimum: equity, debt, operating_profit | "För lite data för riskbedömning" |
| Utveckling | 2+ years of BRF annual reports | "Enstaka årsredovisning — trender kan inte bedömas" |
| Området | Area data sources connected | "Områdesdata saknas" |
| Saknade uppgifter | Always computable | Lists what is missing |

---

## Critical Path

The single most important data flow in the entire system, now named against
the concrete pipeline (doc 42 §1):

```
BRF Engine (income_statement, balance_sheet, loan, brf_overview domains)
        ↓
    apartment_metrics, financial_ratios domains
    (computed by the BRF Engine itself, trust_tier: derived)
        ↓
    Aggregator → MIP (merges with Location/Market Intelligence findings,
                       preserves any conflicts, computes confidence)
        ↓
    AI Analysis Engine → StructuredAnalysis:
       risk_assessment.factors[]  (rule evaluation over the MIP)
       trends[key]                (multi-year comparison)
        ↓
    verdict + verdict.confidence
        ↓
    Report Generator renders the above — computes nothing itself
```

Without the BRF Engine producing data, Sections 3, 6, 7 (partially), and 8
cannot be computed — those pages render the missing-data empty-state (doc
42 §9) rather than blocking the rest of the report. This makes the BRF
Engine the single most critical input to the entire system, and the reason
"missing information must never stop report generation" (doc 42 §6) is a
hard requirement, not a nicety: this is the input most likely to be absent.

---

*This document defines WHAT the report contains and WHY. HOW the data is
extracted, calculated, merged, and generated is now defined in
[`42_platform_data_contracts.md`](./42_platform_data_contracts.md), and HOW
it's laid out on a printed page is defined in
[`report-pdf-layout-blueprint.md`](./report-pdf-layout-blueprint.md). All
three documents together are implementation-ready — no remaining
architectural question blocks building the pipeline this document
describes.*
