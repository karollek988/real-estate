# Reasoning Engine — Knowledge Model

> **Status: DESIGN DOCUMENT.** This defines the intellectual core of Köpanalys —
> the knowledge model that transforms verified financial facts into customer-facing
> insights. Every rule, threshold, and reasoning chain is designed to behave like
> an experienced Swedish property analyst.
>
> No machine learning. No black boxes. Every conclusion is deterministic,
> reproducible, explainable, and traceable.

---

# Part I: The Six Layers

## Layer 1: Raw Facts

### What this layer is
The numbers exactly as they appear in the source documents. Zero interpretation.
The analyst has opened the annual report and written down what they read.

### Input
PDF annual report (one or more years), listing data, external market data.

### Output
A structured collection of typed values, each with a source reference.

### What is stored here
- Every number from the income statement
- Every number from the balance sheet
- Every loan entry
- Every apartment count
- Every fee amount
- Every date
- Every name
- Every text field the annual report contains

### Evidence requirements
- The value must be extractable from the document
- The value must be assigned to the correct fiscal year
- The value must be assigned to the correct field

### Confidence calculation
- 1.0 if extracted by template engine with high pattern match
- 0.8-0.9 if extracted by template engine with moderate match
- 0.6-0.8 if extracted by LLM with high agreement with template
- 0.4-0.6 if extracted only by LLM
- 0.0 if not found

### Traceability
Every raw fact carries: PDF hash → page number → field name → extraction method → confidence score.

### What may never be inferred
Nothing. This layer contains only what is literally present in the document.

### What requires multiple years
Nothing. Each year is extracted independently.

### What requires external market data
Nothing. This layer is purely internal to the source documents.

### Fact vs interpretation
**100% objective facts.** No expert judgment whatsoever.

---

## Layer 2: Signals

### What this layer is
The analyst notices patterns in the raw facts. "This number is positive."
"This number is higher than that number." "This ratio falls within a range."
Signals are still objective — they are observations about the data, not about
the BRF's quality.

### Input
Raw Facts from Layer 1.

### Output
A collection of signal evaluations, each classified as POSITIVE, NEGATIVE,
NEUTRAL, or UNKNOWN.

### What is computed here

**For every financial metric:**
- Is it positive, negative, or zero?
- Is it above, at, or below the previous year's value?
- What is the year-over-year change (absolute and percentage)?

**For every ratio:**
- What is the calculated value?
- Which range does it fall into? (defined by Swedish BRF norms)
- Is it in the healthy, caution, or danger zone?

**For every comparison:**
- How does this BRF compare to the area median?
- How does this BRF compare to the national median?
- How does this BRF compare to similar-sized BRFs?

**For every trend (requires 2+ years):**
- Is the metric improving, declining, or stable?
- Is the rate of change accelerating, decelerating, or constant?
- Are there any anomalous year-over-year changes?

### Signal classification scheme

| Signal | Meaning | Example |
|--------|---------|---------|
| STRONG_POSITIVE | Exceeds healthy threshold by wide margin | equity_ratio > 0.55 |
| POSITIVE | Within healthy range | 0.35 < equity_ratio < 0.55 |
| WEAK_POSITIVE | Marginal, above caution threshold | equity_ratio between 0.30 and 0.35 |
| NEUTRAL | Cannot be assessed or is exactly at threshold | missing data |
| WEAK_NEGATIVE | Marginal, below caution threshold | equity_ratio between 0.25 and 0.30 |
| NEGATIVE | Below healthy range | equity_ratio between 0.15 and 0.25 |
| STRONG_NEGATIVE | Below danger threshold | equity_ratio < 0.15 |
| UNKNOWN | Data not available | missing equity data |

### Evidence requirements
- Raw fact must exist with confidence ≥ 0.4
- For ratios: all input raw facts must exist
- For trends: at least 2 years of raw facts for the same field
- For comparisons: external market data must be available with confidence ≥ 0.5

### Confidence calculation
Signal confidence = minimum confidence of its input raw facts.
If any input is missing, signal is UNKNOWN with confidence 0.

### Traceability
Every signal references its input raw facts by source reference.

### What may never be inferred
- A signal about a metric that has no data
- A trend signal with only 1 year of data
- A comparison signal without market data
- The "quality" of a metric — only its position relative to thresholds

### What requires multiple years of evidence
- Trend signals (direction, acceleration, anomaly)
- Rate-of-change signals
- Volatility signals

### What requires external market data
- Comparison signals (vs area median, vs national median)
- Price positioning signals
- Fee positioning signals
- Area quality signals

### Fact vs interpretation
**Objective facts.** "The equity ratio is 42%." "The equity ratio is 3 percentage points higher than last year." "The equity ratio falls in the healthy range (30-55%)." No expert judgment about what this means for the buyer.

---

## Layer 3: Observations

### What this layer is
The analyst interprets what the signals mean. "The BRF is profitable."
"Debt levels are concerning." "Fees are rising faster than inflation."
This is where domain knowledge enters. An observation is a statement about
the BRF's state, not yet a judgment about the buyer's decision.

### Input
Signals from Layer 2, combined with domain knowledge (thresholds, norms, patterns).

### Output
A collection of observations, each classified as a statement about a specific
analytical dimension.

### What is computed here

#### Financial Health Observations

| Observation | Triggered when | Type |
|-------------|---------------|------|
| BRF is self-sustaining from operating income | operating_profit > 0 for latest year | Objective fact |
| BRF is spending reserves | operating_profit < 0 | Objective fact |
| BRF has adequate financial cushion | equity_ratio in healthy zone | Expert interpretation |
| BRF has thin financial cushion | equity_ratio in caution zone | Expert interpretation |
| BRF has no financial cushion | equity_ratio in danger zone | Expert interpretation |
| BRF's profitability is improving | profitability_trend == IMPROVING | Objective fact |
| BRF's profitability is declining | profitability_trend == DECLINING | Objective fact |
| BRF has had consistent profits | operating_profit > 0 for 3+ consecutive years | Objective fact |
| BRF has had losses recently | operating_profit < 0 in any of last 2 years | Objective fact |
| BRF's costs are growing faster than revenue | cost_growth > revenue_growth for 2+ years | Objective fact |
| BRF is generating surplus | operating_margin > 0.10 | Expert interpretation |

#### Debt Observations

| Observation | Triggered when | Type |
|-------------|---------------|------|
| BRF carries moderate debt | debt_per_apartment in healthy zone | Expert interpretation |
| BRF carries heavy debt | debt_per_apartment in caution zone | Expert interpretation |
| BRF carries excessive debt | debt_per_apartment in danger zone | Expert interpretation |
| BRF can service its debt from income | interest_coverage > 1.0 | Objective fact |
| BRF cannot service its debt from income | interest_coverage < 1.0 | Objective fact |
| BRF has refinancing risk | short_term_debt_ratio > 0.40 | Expert interpretation |
| BRF is deleveraging | debt_trend == DECLINING | Objective fact |
| BRF is increasing leverage | debt_trend == IMPROVING | Objective fact |
| BRF's debt is concentrated in few lenders | largest_lender_share > 0.50 | Expert interpretation |
| BRF pays above-market interest | weighted_interest > market_rate + 1% | Expert interpretation |

#### Fee Observations

| Observation | Triggered when | Type |
|-------------|---------------|------|
| Fees are below area average | fee_per_m² < area_median | Objective fact |
| Fees are at area average | fee_per_m² ≈ area_median | Objective fact |
| Fees are above area average | fee_per_m² > area_median | Objective fact |
| Fees cover operating costs | fee_sustainability > 1.0 | Objective fact |
| Fees do not cover operating costs | fee_sustainability < 0.8 | Expert interpretation |
| Fees are rising faster than inflation | fee_growth > CPI for 2+ years | Objective fact |
| Fees have been stable | fee_trend == STABLE | Objective fact |

#### Price Observations

| Observation | Triggered when | Type |
|-------------|---------------|------|
| Asking price is above market | price_premium > 10% | Expert interpretation |
| Asking price is at market | -5% < price_premium < 5% | Expert interpretation |
| Asking price is below market | price_premium < -10% | Expert interpretation |
| Apartment has been on market long | days_on_market > 60 | Objective fact |
| Price has been reduced | price_reductions > 0 | Objective fact |
| There is competition | active_listings > 5 in area | Objective fact |
| There is little competition | active_listings < 3 in area | Objective fact |

#### Trend Observations

| Observation | Triggered when | Type |
|-------------|---------------|------|
| BRF is on a positive trajectory | 3+ key metrics improving | Expert interpretation |
| BRF is on a negative trajectory | 3+ key metrics declining | Expert interpretation |
| BRF's trajectory is mixed | some improving, some declining | Expert interpretation |
| BRF shows anomalies | any anomaly detected | Objective fact + investigation needed |
| BRF is deteriorating rapidly | 2+ critical metrics declining sharply | Expert interpretation |

### Evidence requirements
- All input signals must be non-UNKNOWN
- For trend observations: minimum 2 years of signals, preferably 3+
- For comparison observations: market data must be available
- Confidence of observation = minimum confidence of input signals

### Confidence calculation
Observation confidence is the minimum confidence of the signals it depends on.
If an observation depends on a trend, and the trend has only 2 years of data,
the observation confidence is reduced (2-year trends are less reliable than 3+).

| Data years | Confidence multiplier |
|-----------|----------------------|
| 1 year (no trend) | 0.7 for single-year observations |
| 2 years | 0.8 for trend observations |
| 3 years | 0.9 for trend observations |
| 4+ years | 1.0 for trend observations |

### Traceability
Every observation references the signals that triggered it, which in turn
reference the raw facts. Full chain: observation → signals → raw facts → PDF page.

### What may never be inferred
- An observation about a dimension where all signals are UNKNOWN
- A positive observation when signals are mixed (must report the mix)
- A conclusion about the BRF's management quality without auditor information
- A conclusion about future fee levels without trend data

### What requires multiple years
- Any observation about trajectory or direction
- Any observation about consistency (e.g., "consistent profits")
- Any observation about acceleration or deceleration
- Any observation involving anomaly detection

### What requires external market data
- Fee positioning observations (vs area median)
- Price positioning observations (vs comparable sales)
- Area quality observations
- Interest rate comparison observations

### Fact vs interpretation
**Mixed.** Some observations are objective facts ("BRF is spending reserves"
is simply operating_profit < 0). Others require expert interpretation
("adequate financial cushion" requires knowing what "adequate" means for
Swedish BRFs). Each observation is tagged as FACT or INTERPRETATION.

---

## Layer 4: Findings

### What this layer is
The analyst synthesizes multiple observations into conclusions about the BRF's
overall state. "This is a financially healthy BRF." "This BRF has significant
debt concerns." "The price is above market but the BRF is strong."
Findings are what the analyst would write in their report.

### Input
Observations from Layer 3, weighted by their analytical importance and confidence.

### Output
A collection of findings, each covering one analytical dimension.

### What is computed here

#### Finding Dimensions

| Dimension | What it evaluates | Primary observations used |
|-----------|-------------------|--------------------------|
| Financial health | Overall financial strength and sustainability | Profitability, equity, margins, cost trends |
| Debt sustainability | Whether the debt burden is manageable and structured well | Debt levels, interest coverage, debt structure, debt trend |
| Fee reasonableness | Whether the fees are fair and sustainable | Fee level, fee coverage, fee trend |
| Price fairness | Whether the asking price is justified | Comparable sales, price positioning, BRF health |
| Trend trajectory | Where the BRF is heading | All multi-year trends, anomalies |
| Risk profile | What could go wrong | All negative observations, anomalies, structural risks |
| Area quality | Neighbourhood suitability | Transport, safety, amenities, development |

#### Finding classification

Each finding is classified on two axes:

**Axis 1: Substance**

| Classification | Meaning |
|---------------|---------|
| STRENGTH | A positive attribute of the BRF |
| WEAKNESS | A negative attribute of the BRF |
| NEUTRAL | Neither positive nor negative |
| MIXED | Contains both strengths and weaknesses |
| UNKNOWN | Insufficient data to form a finding |

**Axis 2: Severity (for weaknesses and risks)**

| Severity | Meaning | Example |
|----------|---------|---------|
| MINOR | Slightly below ideal, but manageable | Fee slightly above area average |
| MODERATE | Notable concern, worth investigating | Equity ratio approaching caution zone |
| SIGNIFICANT | Important concern that affects the decision | Operating profit declining for 2 years |
| CRITICAL | Serious concern that may be a dealbreaker | BRF cannot service its debt |

#### Finding examples

**Financial Health Finding:**
```
Dimension: Financial health
Classification: STRENGTH
Confidence: 0.85
Summary: "BRF Stjärnan är ekonomiskt sund med positivt rörelseresultat tre år i rad."

Supporting observations:
- Operating profit positive in 2023, 2024, 2025
- Equity ratio at 42% (stable)
- Operating margin at 12% (healthy)

Supporting signals:
- equity_ratio = 0.42 → POSITIVE (range 0.30-0.55)
- operating_profit[2025] = 245,000 SEK → POSITIVE
- profitability_trend = STABLE → NEUTRAL

Supporting raw facts:
- total_equity[2025] = 4,200,000 SEK (page 12, balance sheet)
- total_assets[2025] = 10,000,000 SEK (page 12, balance sheet)
- operating_profit[2023] = 220,000 SEK (page 8, income statement)
- operating_profit[2024] = 235,000 SEK (page 8, income statement)
- operating_profit[2025] = 245,000 SEK (page 8, income statement)

Missing data: None for this finding.
```

**Debt Finding:**
```
Dimension: Debt sustainability
Classification: MIXED (STRENGTH + WEAKNESS)
Confidence: 0.75
Summary: "Skuldsättningen är hög men sjunkande. Ränteanläggningen är god."

Strengths:
- Debt is declining year over year
- Interest coverage is adequate (> 1.5)

Weaknesses:
- Debt per apartment at 520,000 SEK (above 500,000 threshold)
- Short-term debt is 35% of total (approaching caution zone)

Supporting observations:
[chain as above]
```

### Evidence requirements
- At least one non-UNKNOWN observation in the dimension
- Confidence ≥ 0.3 to produce a finding (below this: "Insufficient data")
- For MIXED findings: must clearly state both strengths and weaknesses
- Every statement in the finding must reference a specific observation

### Confidence calculation
Finding confidence = weighted average of input observation confidences,
where weights reflect the analytical importance of each observation.

| Observation importance | Weight factor |
|-----------------------|---------------|
| Primary metric (e.g., equity_ratio for financial health) | 1.0 |
| Secondary metric (e.g., operating_margin) | 0.7 |
| Supporting metric (e.g., cost_per_sqm) | 0.4 |
| Trend signal | 0.8 (boosted because trends are highly informative) |

### Traceability
Every finding references its observations, which reference signals, which
reference raw facts. Full traceability: finding → observations → signals → raw facts → PDF page.

### What may never be inferred
- A finding about a dimension where confidence < 0.3
- A finding that contradicts the observations (e.g., calling a BRF "healthy" when observations are mixed)
- A finding that introduces metrics not present in the observations
- A finding about the BRF's management quality without auditor data
- A finding about future fee levels without trend data
- A finding about price fairness without comparable sales data

### What requires multiple years
- Trend trajectory finding (requires 2+ years)
- "Consistent profitability" finding (requires 3+ years)
- Debt trajectory finding (requires 2+ years)
- Any finding that includes the word "developing" or "improving" or "declining"

### What requires external market data
- Price fairness finding (requires comparable sales)
- Fee reasonableness finding (requires area fee data)
- Area quality finding (requires area data sources)

### Fact vs interpretation
**Expert interpretations.** Findings are where the analyst's expertise is most evident. A finding synthesizes observations into a judgment. However, every finding must be fully supported by its observations — no leaps of logic.

---

## Layer 5: Recommendations

### What this layer is
The analyst tells the buyer what to do with the findings. "Negotiate the price."
"Request the full renovation plan." "Consider the long-term debt trajectory."
Recommendations are actionable, specific, and tied to findings.

### Input
Findings from Layer 4, plus the buyer's context (asking price, property details).

### Output
A list of specific, actionable recommendations.

### What is computed here

#### Recommendation categories

| Category | When generated | What it says |
|----------|---------------|--------------|
| Price action | Price finding is WEAKNESS or MIXED | Specific negotiation guidance |
| Information request | Data is missing or uncertain | What documents to request from the BRF |
| Due diligence | Risk finding is MODERATE or above | What to investigate before deciding |
| Positive signal | Finding is STRENGTH with high confidence | What to feel good about |
| Condition | Critical risk identified | Conditions that must be met before buying |
| Walk away | Multiple CRITICAL findings | Why this purchase should not proceed |

#### Recommendation examples

**Price action recommendation:**
```
Triggered by: Price fairness finding = WEAKNESS (asking price 12% above market)
Recommendation: "Priset ligger 12% över medelvärdet för jämförbara lägenheter
i området. Det finns utrymme att förhandla. Föreslå en startsats på
10-15% under begärt pris."
Evidence: [price comparison data]
Confidence: 0.70
```

**Information request recommendation:**
```
Triggered by: Debt finding has missing loan data
Recommendation: "Be styrelsen om fullständig låneportfölj med detaljerad
amorteringsplan. Utan denna data kan inte skuldsättningen bedömas ordentligt."
Evidence: [missing fields list]
Confidence: 1.0 (we know what is missing)
```

**Due diligence recommendation:**
```
Triggered by: Risk finding = SIGNIFICANT (equity ratio declining toward 30%)
Recommendation: "Kontrollera styrelseprotokollen för de senaste 2 åren.
Förstå orsaken till kapitalförringen. Fråga efter underhållsplan och
eventuella kommande särskilda avgifter."
Evidence: [equity trend data]
Confidence: 0.75
```

**Walk away recommendation:**
```
Triggered by: Multiple CRITICAL findings (negative operating profit + interest coverage < 1)
Recommendation: "BRF:n har två kritiska riskfaktorer: negativt rörelseresultat
och oförmåga att betjäna skulden från rörelseinkomsten. Det innebär att
avgifterna troligtvis kommer att öka väsentligt, eller att en särskild
avgift behöver tas ut. Rekommendation: undvik detta köp."
Evidence: [operating_profit data, interest_coverage data]
Confidence: 0.85
```

### Evidence requirements
- Every recommendation must reference at least one finding
- Price recommendations require market data (comparable sales)
- "Walk away" requires at least 2 CRITICAL findings
- Every recommendation must be specific enough to act on

### Confidence calculation
Recommendation confidence = finding confidence × actionability factor.

| Actionability | Factor |
|--------------|--------|
| Clear data supports action | 1.0 |
| Data partially supports action | 0.8 |
| Action depends on missing data | 0.6 |
| Action is precautionary | 0.5 |

### Traceability
Every recommendation references findings, which reference observations,
which reference signals, which reference raw facts. Full chain.

### What may never be inferred
- A recommendation without a supporting finding
- A price recommendation without comparable sales data
- A "buy" recommendation without financial health assessment
- A "walk away" without at least 2 critical-severity findings
- Specific negotiation percentages without market data

### What requires multiple years
- Recommendations about fee trajectory
- Recommendations about debt management
- Recommendations about long-term value

### What requires external market data
- All price-related recommendations
- All area-related recommendations
- Fee comparison recommendations

### Fact vs interpretation
**Expert advice.** Recommendations are the analyst's professional judgment.
They are always presented as "based on the data, here is what I would consider"
— never as certainty.

---

## Layer 6: Final Verdict

### What this layer is
The overall assessment. One clear answer to "Should I buy this apartment?"
Every element of the verdict is traceable through the entire reasoning chain.

### Input
All findings from Layer 4, all recommendations from Layer 5, overall confidence.

### Output
A verdict with supporting summary.

### Verdict categories

| Verdict | When assigned |
|---------|--------------|
| **Köp** (Buy) | All major dimensions are STRENGTH or NEUTRAL, confidence ≥ 0.7 |
| **Köp med reservation** (Buy with reservation) | Mostly STRENGTH but with 1-2 MODERATE weaknesses, confidence ≥ 0.6 |
| **Förhandla** (Negotiate) | Price is above market OR significant weaknesses that can be offset by price reduction |
| **Tänk efter noga** (Think carefully) | Multiple SIGNIFICANT weaknesses or MIXED findings with low confidence |
| **Undvik** (Avoid) | Any CRITICAL finding OR multiple SIGNIFICANT findings, confidence ≥ 0.5 |

### Verdict computation (deterministic rules)

```
Step 1: Count findings by classification
  strengths = count(Findings where classification == STRENGTH)
  weaknesses = count(Findings where classification == WEAKNESS)
  critical = count(Findings where severity == CRITICAL)
  significant = count(Findings where severity == SIGNIFICANT)

Step 2: Apply decision rules (in priority order)

  IF critical >= 2:
    verdict = "Undvik"
  
  ELIF critical == 1 AND significant >= 2:
    verdict = "Undvik"
  
  ELIF critical == 1:
    verdict = "Tänk efter noga"
  
  ELIF significant >= 3:
    verdict = "Tänk efter noga"
  
  ELIF significant >= 1 AND price_finding == WEAKNESS:
    verdict = "Förhandla"
  
  ELIF price_finding == WEAKNESS AND weaknesses <= 1:
    verdict = "Förhandla"
  
  ELIF significant >= 1:
    verdict = "Köp med reservation"
  
  ELIF weaknesses >= 2:
    verdict = "Köp med reservation"
  
  ELSE:
    verdict = "Köp"

Step 3: Verify confidence
  IF overall_confidence < 0.50:
    verdict = "För lite data för ett tillförlitligt besked"
  
  IF overall_confidence < 0.30:
    verdict = "Analysera kan inte ges — för lite data"
```

### Verdict output

```yaml
verdict: "Köp med reservation"
confidence: 0.78
summary: >
  BRF Stjärnan är ekonomiskt sund med stabilt positivt resultat och
  god ekonomisk marginal. Skuldsättningen är hög men sjunkande.
  Priset ligger 8% över medelvärdet för området, vilket ger utrymme
  att förhandla. Rekommenderas att begära fullständig låneportfölj
  innan slutgiltigt besked.

key_reasons:
  - "Trestävigt positivt rörelseresultat med stabil marginal"
  - "Skuldsättningen minskar år för år"
  - "God räntetäckning (> 1.5)"

key_risks:
  - "Skuld per lägenhet på 520 000 kr (över tröskeln på 500 000)"
  - "Kortfristig skuld utgör 35% av totala skulden"

supported_by:
  finding_financial_health: [strength, confidence 0.85]
  finding_debt: [mixed, confidence 0.75]
  finding_fees: [strength, confidence 0.80]
  finding_price: [weakness, confidence 0.70]
  finding_trends: [neutral, confidence 0.65]
  finding_risks: [moderate, confidence 0.72]
  finding_area: [strength, confidence 0.60]
```

### Evidence requirements
- At least one finding in each major dimension (financial, debt, price)
- Overall confidence ≥ 0.30 to produce any verdict
- Verdict must be traceable to specific findings

### Confidence calculation
Overall confidence = weighted average of finding confidences, with a penalty
for missing data:

```
base_confidence = weighted_average(finding.confidence for all findings)
penalty = 0.05 × (number of UNKNOWN findings)
overall_confidence = max(0, base_confidence - penalty, 0)
```

| Finding dimension | Weight in overall confidence |
|-------------------|------------------------------|
| Financial health | 0.25 |
| Debt sustainability | 0.20 |
| Price fairness | 0.20 |
| Fee reasonableness | 0.10 |
| Trend trajectory | 0.10 |
| Risk profile | 0.10 |
| Area quality | 0.05 |

### Traceability
The verdict traces to findings, which trace to observations, which trace to
signals, which trace to raw facts. Every element of the verdict can be
traced back to the original PDF page.

### What may never be inferred
- A verdict without at least 3 computed findings
- A "Köp" verdict without financial health AND debt AND price findings
- A "Undvik" verdict without at least one CRITICAL finding
- A verdict that contradicts the findings (e.g., "Köp" when there are CRITICAL weaknesses)
- A specific price recommendation without comparable sales data

### What requires multiple years
- A verdict that references the BRF's trajectory or direction
- A verdict that mentions "developing" or "improving"

### What requires external market data
- A verdict that references price fairness
- A verdict that references area quality

### Fact vs interpretation
**Expert judgment.** The verdict is the analyst's professional opinion, based
entirely on the findings. It is always presented as an assessment, not a guarantee.

---

# Part II: Domain Knowledge — The Analyst's Brain

This section defines the domain knowledge that makes the reasoning engine
behave like an experienced Swedish property analyst. These are the thresholds,
norms, and patterns that an experienced analyst carries in their head.

## 1. Swedish BRF Financial Norms

### Equity Ratio Ranges

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| > 55% | Excellent | Very strong financial position. Uncommon and highly positive. |
| 40-55% | Healthy | Good cushion. The BRF can absorb unexpected costs. |
| 30-40% | Adequate | Acceptable but not exceptional. Monitor the trend. |
| 20-30% | Caution | Thin cushion. Risk of special assessments if costs spike. |
| 10-20% | Concerning | Very thin. The BRF is vulnerable. |
| < 10% | Critical | Danger zone. Special assessments likely imminent. |

### Operating Margin Ranges

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| > 15% | Strong surplus | BRF generates significant surplus for reserves. |
| 5-15% | Healthy surplus | Normal, self-sustaining operation. |
| 0-5% | Marginal | Covers costs but no room for error. |
| -5% to 0% | Deficit | Spending reserves. Not sustainable long-term. |
| < -5% | Deep deficit | Rapidly depleting reserves. Urgent concern. |

### Interest Coverage Ranges

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| > 3.0 | Very strong | Operating profit covers interest 3x over. |
| 1.5-3.0 | Adequate | Comfortable coverage. |
| 1.0-1.5 | Tight | Covers interest but little margin. |
| 0.5-1.0 | Insufficient | Cannot fully cover interest from operations. |
| < 0.5 | Critical | Operating profit covers less than half the interest. |

### Debt per Apartment Ranges (Stockholm-area norms)

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| < 200,000 SEK | Very low debt | Uncommonly good. |
| 200,000-400,000 SEK | Moderate | Normal range for well-managed BRFs. |
| 400,000-600,000 SEK | High | Above average. Monitor the trend. |
| 600,000-800,000 SEK | Very high | Significant burden. Fee increases likely. |
| > 800,000 SEK | Excessive | Dangerously high. Special assessments probable. |

### Fee Sustainability Ranges

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| > 1.2 | Over-funded | Fees more than cover costs. Reserves growing from fee income. |
| 1.0-1.2 | Self-sustaining | Fees cover costs. Healthy. |
| 0.8-1.0 | Under-funded | Fees don't fully cover costs. Reserves subsidizing operations. |
| 0.6-0.8 | Significantly under-funded | Large gap. Fee increase or special assessment needed. |
| < 0.6 | Severely under-funded | Crisis territory. Immediate action needed. |

### Short-term Debt Ratio Ranges

| Range | Classification | Analyst interpretation |
|-------|---------------|----------------------|
| < 15% | Low | Minimal near-term refinancing risk. |
| 15-30% | Moderate | Some near-term obligations. Manageable. |
| 30-45% | Elevated | Significant refinancing needed soon. Risk if rates rise. |
| > 45% | High | Major refinancing cliff. High risk. |

## 2. Trend Interpretation Rules

### Direction classification

Given a series of year-over-year values [y1, y2, y3, ...]:

```
IF fewer than 2 data points:
  direction = INSUFFICIENT_DATA

ELSE compute year-over-year changes:
  changes = [(y[i] - y[i-1]) / |y[i-1]| for i in 1..n]

  IF all changes are within ±3% of zero:
    direction = STABLE

  IF average change > +3%:
    direction = IMPROVING (for revenue, equity, profit)
    direction = DECLINING (for debt, costs, fees)

  IF average change < -3%:
    direction = DECLINING (for revenue, equity, profit)
    direction = IMPROVING (for debt, costs, fees)

  IF the sign of changes flips between years:
    direction = VOLATILE

  IF magnitude of any single change > 25%:
    flag as ANOMALY
```

Note: The direction classification is metric-dependent. "Improving" means
different things for different metrics:
- For revenue: going up is improving
- For debt: going down is improving
- For costs: going down is improving
- For equity: going up is improving
- For fees: going down is improving (for the buyer)

### Anomaly detection

An anomaly is a year-over-year change that significantly deviates from the
pattern of other changes in the series:

```
IF 3+ years of data:
  compute mean and std of year-over-year changes
  IF any change is > 2 standard deviations from mean:
    flag as ANOMALY with magnitude and context

IF 2 years of data:
  IF single change > 20% in absolute value:
    flag as POTENTIAL_ANOMALY (not enough data to confirm)
```

## 3. Cross-Dimensional Reasoning Rules

These rules combine observations from multiple dimensions to produce
higher-level insights. This is where the analyst connects dots.

### Rule: Financial-Derbt Correlation

```
IF profitability_declining AND debt_increasing:
  finding = "BRF:n tar upp mer skuld samtidigt som resultatet försämras.
             Detta är en eskalerande risk som kräver närmare granskning."
  severity = SIGNIFICANT

IF profitability_improving AND debt_decreasing:
  finding = "BRF:n förbättrar samtidigt som den minskar skulden — stark kombination."
  severity = STRENGTH (with high confidence)
```

### Rule: Fee-Debt Correlation

```
IF fees_rising AND debt_decreasing:
  finding = "Avgifterna ökar men skulden minskar — avgifterna kan stabilisera sig
             när skulden nått en lägre nivå."
  severity = NEUTRAL (trending positive)

IF fees_rising AND debt_increasing:
  finding = "Avgifterna ökar och skulden växer — en negativ spiral som troligtvis
             kommer att fortsätta."
  severity = SIGNIFICANT
```

### Rule: Equity-Operating Profit Correlation

```
IF equity_declining AND operating_profit_positive:
  finding = "Trots positivt resultat minskar kapitalet. Kontrollera om det finns
             stora engångskostnader eller investeringar som förklarar detta."
  severity = MODERATE

IF equity_declining AND operating_profit_negative:
  finding = "BRF:n minskar sitt kapital och har förlust. Detta är en allvarlig
             situation som kan leda till särskilda avgifter."
  severity = CRITICAL
```

### Rule: Price-BRF Health Correlation

```
IF asking_price_above_market AND brf_financially_weak:
  finding = "Priset ligger över marknadspriset och BRF:n har ekonomiska svagheter.
             Det finns starka skäl att förhandla aggressivt."
  severity = WEAKNESS (for the buyer's position)

IF asking_price_below_market AND brf_financially_strong:
  finding = "Priset ligger under marknadspriset och BRF:n är stark. Detta är
             ett mycket intressant köptillfälle."
  severity = STRENGTH (high priority)
```

### Rule: Trend-Risk Interaction

```
IF all_key_metrics_declining AND risk_level > MODERATE:
  finding = "Negativ trend kombinerad med befintliga risker — situationen
             förväntas försämras ytterligare."
  severity = CRITICAL (even if individual risks are only SIGNIFICANT)

IF improving_trends AND current_weaknesses:
  finding = "BRF:n har svagheter idag men utvecklingen är positiv. Om trenden
             fortsätter kan svagheterna minskas."
  severity = MIXED (with positive trajectory)
```

---

# Part III: Evidence Standards

## Objective Facts vs Expert Interpretations

This classification is critical. Every output of the reasoning engine must be tagged.

### Objective Facts (never wrong if data is correct)

| Statement type | Example |
|---------------|---------|
| Raw number | "Rörelseresultatet 2025 var 245 000 kr" |
| Ratio calculation | "Egenkapitalandelen är 42%" |
| Direction | "Rörelseresultatet har ökat tre år i rad" |
| Comparison | "Avgiften per kvadratmeter ligger 15% över områdets median" |
| Threshold crossing | "Egenkapitalandelen understeg 30% under 2024" |
| Anomaly detection | "Kostnaderna ökade med 40% från 2023 till 2024" |

### Expert Interpretations (depend on domain knowledge)

| Statement type | Example | Why it's interpretation |
|---------------|---------|----------------------|
| Health assessment | "BRF:n är ekonomiskt sund" | Requires knowing what "sund" means |
| Risk level | "Skuldsättningen är hög" | Requires a reference point |
| Adequacy | "Kapitalet är tillräckligt" | Requires a norm for "tillräckligt" |
| Sustainability | "Avgifterna är hållbara" | Requires a model of fee sustainability |
| Value assessment | "Priset är rimligt" | Requires market comparison |
| Recommendation | "Förhandla priset ner" | Requires combining multiple judgments |
| Verdict | "Köp med reservation" | Requires all findings synthesized |

### The rule

**Every expert interpretation must be accompanied by:**
1. The objective facts it is based on
2. The threshold or norm it is using
3. A confidence level reflecting the strength of the evidence
4. An explicit statement that this is an interpretation, not a fact

---

## Evidence Requirements by Conclusion Type

| Conclusion type | Minimum evidence | Additional requirements |
|----------------|-----------------|----------------------|
| Stating a number | 1 year of data | Source reference |
| Stating a direction | 2 years of data | Both years extracted |
| Stating a trend | 3 years of data | Consistent direction |
| Stating a finding | 1+ observations in the dimension | Confidence ≥ 0.3 |
| Stating a recommendation | 1+ findings | Confidence ≥ 0.5 |
| Stating a verdict | 3+ findings across dimensions | Overall confidence ≥ 0.5 |
| Price assessment | 3+ comparable sales | All from last 12 months |
| Fee comparison | Area fee median available | Same apartment type |
| Risk assessment | At minimum: equity, debt, operating_profit | 1+ years of data |
| Area assessment | 3+ data sources connected | All with confidence ≥ 0.5 |

## Multi-Year Evidence Requirements

| Conclusion type | Minimum years | What changes with more years |
|----------------|--------------|------------------------------|
| Direction (improving/declining) | 2 years | More years = more confidence |
| Consistency ("stable") | 3 years | 2 years is tentative |
| Anomaly confirmation | 3 years | 2 years can only flag potential |
| Trajectory assessment | 3 years | Can identify acceleration/deceleration |
| Pattern recognition | 4-5 years | Can identify cyclical patterns |

## External Market Data Requirements

| Conclusion type | Required data | Source |
|----------------|--------------|--------|
| Price vs market | 3+ sold comparables in same area | Booli, Mäklarstatistik |
| Fee vs market | Area fee median for same apartment type | Booli, Hemnet |
| Area quality | 3+ of: transport, crime, demographics, amenities | Trafikverket, Brå, SCB, OSM |
| Future development | Municipal development plans | Municipality website |
| Interest rate context | Riksbanken policy rate | Riksbanken |

---

# Part IV: The Complete Reasoning Chain

## Example: Full Chain for a Single BRF

### Raw Facts (from annual report 2025)
```
revenue = 1,450,000 SEK
operating_costs = 1,270,000 SEK
operating_profit = 180,000 SEK
total_equity = 3,800,000 SEK
total_assets = 9,200,000 SEK
total_liabilities = 5,400,000 SEK
long_term_debt = 4,200,000 SEK
short_term_debt = 1,200,000 SEK
number_of_apartments = 24
avg_monthly_fee = 3,800 SEK
loans = [
  { lender: "Handelsbanken", remaining: 2,800,000, rate: 3.8%, maturity: "2028-06" },
  { lender: "SEB", remaining: 1,400,000, rate: 4.2%, maturity: "2027-12" },
  { lender: "Swedbank", remaining: 1,200,000, rate: 3.5%, maturity: "2026-06" }
]
```

### Signals
```
equity_ratio = 3,800,000 / 9,200,000 = 41.3% → POSITIVE (range 0.30-0.55)
operating_margin = 180,000 / 1,450,000 = 12.4% → POSITIVE (range 0.05-0.15)
interest_coverage = 180,000 / ((2,800,000×0.038)+(1,400,000×0.042)+(1,200,000×0.035)) = 180,000 / 178,600 = 1.01 → WEAK_POSITIVE (barely above 1.0)
debt_per_apartment = 4,200,000 / 24 = 175,000 SEK → POSITIVE (range 200k-400k)
short_term_debt_ratio = 1,200,000 / 5,400,000 = 22.2% → POSITIVE (range 15-30%)
weighted_average_interest = 178,600 / 5,400,000 = 3.31% → POSITIVE
fee_sustainability = 3,800 / (1,450,000 / 24 / 12) = 3,800 / 5,042 = 0.75 → NEGATIVE (below 0.8)
```

### Observations
```
observation: "BRF är självförsörjande med positivt rörelseresultat"
  type: FACT
  based_on: operating_profit > 0

observation: "Egenkapitalandelen är sunt på 41%"
  type: INTERPRETATION
  based_on: equity_ratio = 41.3% → falls in "healthy" range (0.30-0.55)
  threshold_used: Swedish BRF norm 30-55%

observation: "Räntetäckningen är ansträngd"
  type: INTERPRETATION
  based_on: interest_coverage = 1.01 → falls in "tight" range (1.0-1.5)
  threshold_used: Swedish BRF norm 1.0-1.5

observation: "Avgifterna täcker inte kostnaderna"
  type: INTERPRETATION
  based_on: fee_sustainability = 0.75 → falls in "significantly under-funded" range
  threshold_used: Swedish BRF norm > 1.0
```

### Findings
```
finding: Financial Health
  classification: STRENGTH
  confidence: 0.80
  summary: "BRF har stabil ekonomi med positivt resultat och god egenkapital."

finding: Debt Sustainability
  classification: WEAKNESS
  confidence: 0.75
  severity: MODERATE
  summary: "Räntetäckningen är ansträngd. BRF behöver sin helkapacitet för att betja skulden."

finding: Fee Reasonableness
  classification: WEAKNESS
  confidence: 0.80
  severity: SIGNIFICANT
  summary: "Avgifterna täcker inte driftkostnaderna. En avgiftshöjning behövs."
```

### Recommendations
```
recommendation: "Be styrelsen om detaljerad amorteringsplan för alla lån."
  triggered_by: debt_finding (MODERATE severity)
  confidence: 0.90

recommendation: "Räkna med en avgiftshöjning på 10-15% inom 1-2 år."
  triggered_by: fee_finding (SIGNIFICANT severity)
  confidence: 0.80

recommendation: "Priset bör förhandlas med hänsyn till den ansträngda räntetäckningen."
  triggered_by: debt_finding + fee_finding
  confidence: 0.70
```

### Verdict
```
verdict: "Köp med reservation"
confidence: 0.76
summary: >
  Ekonomiskt stabil BRF med bra egenkapital och positivt resultat.
  Två svagheter: ansträngd räntetäckning och underfinansierade avgifter.
  Båda tyder på att en avgiftshöjning är sannolik. Priset bör förhandlas
  med dessa faktorer som utgångspunkt.
```

---

# Part V: The Never-Infer Rules

These are absolute constraints on the reasoning engine. Violating any of
them breaks the system's trustworthiness.

### Rule 1: Never estimate missing values
If a field is not in the annual report, it is null. The system never fills
in a value based on "what it should be" or "what similar BRFs have."

### Rule 2: Never extrapolate trends
The system can show the direction of a trend. It never predicts where the
trend will be next year. "The trend is declining" is allowed.
"Based on the trend, next year will be X" is forbidden.

### Rule 3: Never infer BRF management quality from numbers alone
The numbers tell you the financial outcome. They don't tell you whether
the board is competent, whether they meet regularly, or whether they
communicate with members. Only the auditor's opinion and board minutes
can speak to management quality.

### Rule 4: Never make price predictions
The system can say "the asking price is above market" based on comparables.
It never says "the value will increase by X% next year."

### Rule 5: Never combine data from different BRFs
Each BRF analysis is standalone. The system never says "BRF X is healthier
than BRF Y" unless the buyer explicitly asks for a comparison and both
BRFs have been fully analysed.

### Rule 6: Never present a calculation as a fact
"The equity ratio is 41%" is a fact (given the input data).
"This is healthy" is an interpretation. Both can be stated, but they
must be distinguished.

### Rule 7: Never hide uncertainty
If confidence is low, the system says so prominently. It never presents
a low-confidence finding with the same prominence as a high-confidence one.

### Rule 8: Never use financial jargon without explanation
Every technical term is accompanied by a plain-language explanation.
"Räntetäckning" is followed by "(kan BRF betala räntan från sin
rörelseinkomst?)"

### Rule 9: Never recommend a purchase without financial data
The system cannot produce a "Köp" or "Köp med reservation" verdict
without at least 1 year of BRF financial statements. The BRF's financial
health is a non-negotiable input.

### Rule 10: Never state the verdict is certain
Every verdict includes a confidence level and a note about what data
is missing. The buyer always knows the limitations of the analysis.

---

# Part VI: Confidence as a First-Class Citizen

Confidence is not a footnote. It is a core part of every output.

## Confidence Propagation

```
Raw Fact confidence → Signal confidence → Observation confidence
  → Finding confidence → Recommendation confidence → Verdict confidence
```

At each layer, confidence can only decrease (never increase).
A chain is only as strong as its weakest link.

## Confidence Display Rules

| Confidence | Display treatment |
|-----------|------------------|
| ≥ 0.90 | Full confidence. Statement presented as-is. |
| 0.70-0.89 | Good confidence. Statement presented normally. |
| 0.50-0.69 | Moderate confidence. Statement prefixed with "Baserat på tillgänglig data..." |
| 0.30-0.49 | Low confidence. Statement prefixed with "Med begränsat data..." |
| < 0.30 | Very low confidence. Statement replaced with "Otillräcklig data för bedömning." |

## What Drives Confidence Down

| Factor | Confidence impact |
|--------|------------------|
| Missing field in annual report | -0.05 to -0.15 per critical field |
| Only 1 year of data | -0.20 for trend-dependent findings |
| Only 2 years of data | -0.10 for trend-dependent findings |
| No comparable sales data | -0.30 for price assessment |
| No area data | -0.25 for area assessment |
| OCR extraction (lower confidence) | -0.10 for affected fields |
| Conflicting data between years | -0.15 for affected dimensions |

---

*This document defines HOW the system thinks. The extraction engine (to be
designed next) is responsible for providing the raw facts. This reasoning
engine is responsible for turning those facts into trustworthy insights.*
