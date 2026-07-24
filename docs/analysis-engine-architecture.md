# Analysis Engine Architecture

> **Status: DESIGN DOCUMENT.** This defines the complete architecture for the
> Köpanalys Analysis Engine — the system that transforms raw BRF annual reports
> into a deterministic, explainable, trustworthy purchase analysis.
>
> Governing principle: **The LLM explains verified facts. It never invents, estimates, or calculates.**

---

## 1. Architectural Overview

### 1.1 The Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ACQUISITION LAYER                           │
│                   (BRF-Scraper — already built)                     │
│                                                                     │
│   Discovery → Crawl → Download → Storage                           │
│   Output: PDF files on disk + metadata in SQLite                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PROCESSING PIPELINE                            │
│                 (Analysis Engine — this document)                   │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Stage 1  │→│   Stage 2     │→│   Stage 3    │→│  Stage 4    │  │
│  │  PDF      │  │  Structured   │  │  Verified    │  │  Calcula-  │  │
│  │  Extract  │  │  Extraction   │  │  JSON        │  │  tion      │  │
│  └──────────┘  └──────────────┘  └─────────────┘  └─────┬──────┘  │
│                                                          │          │
│  ┌──────────────────────────────────────────────────────┘          │
│  │                                                                  │
│  ▼                                                                  ▼
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Stage 5     │→│   Stage 6     │→│   Stage 7     │              │
│  │   Trend       │  │   Risk        │  │   LLM         │              │
│  │   Engine      │  │   Engine      │  │   Explanation  │              │
│  └──────────────┘  └──────────────┘  └──────┬───────┘              │
│                                              │                      │
│                                              ▼                      │
│                                    ┌──────────────────┐             │
│                                    │  Final Köpanalys  │             │
│                                    │  (AnalysisReport) │             │
│                                    └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Invariants

These are non-negotiable rules that every component must enforce:

| # | Rule | Enforcement |
|---|------|-------------|
| I-1 | No number may appear in the final analysis that was not either extracted verbatim from a PDF or computed by deterministic code | Type system + validation layer |
| I-2 | Every output field must carry a `SourceRef` pointing to the exact PDF + page + field it came from | Embedded in every data class |
| I-3 | If data is missing, the system says "missing" — never fills a default or estimate | Nullable fields + explicit null handling |
| I-4 | Every calculated value must declare its formula and inputs | `CalculatedField` wrapper type |
| I-5 | The LLM receives only a structured prompt containing verified JSON — never raw PDF text for reasoning | Architecture boundary |
| I-6 | The system must produce the same output given the same input (determinism) | No randomness, no model temperature |
| I-7 | Multi-year analysis must align fields across years before computing trends | Year-aligned schema |

---

## 2. Stage 1: PDF Text Extraction

### 2.1 Purpose

Convert a PDF file into structured text content, preserving positional information needed for field location. This stage produces **raw text**, not financial data.

### 2.2 Extraction Strategy

BRF annual reports vary in quality. A multi-strategy approach is necessary:

```
PDF Input
    │
    ├── Is text-based PDF? (pdfplumber detects extractable text)
    │   ├── YES → pdfplumber text extraction (fast, reliable)
    │   └── NO  → OCR pipeline
    │              ├── Is it a scanned document?
    │              │   └── YES → PaddleOCR (Swedish-optimized)
    │              └── Does it have embedded images of tables?
    │                  └── YES → PyMuPDF image extraction → PaddleOCR
    │
    ▼
Unified Text Output (per page, with coordinates)
```

### 2.3 Output: `ExtractedPage`

```python
@dataclass(frozen=True)
class PageCoordinate:
    """Position of text on the PDF page."""
    x0: float
    y0: float
    x1: float
    y1: float
    page_number: int

@dataclass(frozen=True)
class ExtractedText:
    """A piece of extracted text with its location."""
    text: str
    confidence: float          # 0.0-1.0, 1.0 for text-based PDFs
    coordinates: PageCoordinate
    extraction_method: str     # "pdfplumber", "paddleocr", "pymupdf_image"

@dataclass(frozen=True)
class ExtractedPage:
    """All text content from one PDF page."""
    page_number: int
    texts: list[ExtractedText]
    raw_text: str              # concatenated, reading-order text
    has_tables: bool           # table detection flag
```

### 2.4 Quality Gate

Before passing to Stage 2, the extraction quality is assessed:

| Check | Threshold | Action on Failure |
|-------|-----------|-------------------|
| Total text extracted | > 200 characters | Retry with OCR |
| OCR confidence average | > 0.7 | Flag for manual review |
| Page count | > 3 and < 200 | Reject obviously wrong files |
| Swedish text detected | > 10% of words are Swedish | Warning, proceed with caution |

### 2.5 Implementation Location

`BRF-Scraper/src/brf_scraper/extractor/` (currently a stub `__init__.py`). The existing `pdfplumber` and `pymupdf` dependencies are already declared in `BRF-Scraper/pyproject.toml`. PaddleOCR is declared under the optional `[ocr]` extra.

---

## 3. Stage 2: Structured Financial Extraction

### 3.1 Purpose

Transform raw extracted text into a structured, typed financial representation. This is the most critical stage — it is where unstructured PDF content becomes typed, validated data.

### 3.2 Two-Phase Extraction

```
ExtractedPages
    │
    ├── Phase A: Template-Based Extraction (deterministic)
    │   │
    │   ├── Table detection & parsing (pdfplumber tables)
    │   ├── Known template matching (Swedish BRF annual report templates)
    │   ├── Regex field extraction for known patterns:
    │   │   ├── "Bruttoresultat" → revenue
    │   │   ├── "Rörelseresultat" → operating_profit
    │   │   ├── "Skulder totalt" → total_liabilities
    │   │   ├── "Antal lägenheter" → number_of_apartments
    │   │   └── ... (50+ known field patterns)
    │   └── Produces: PartialStructuredData + FieldConfidence
    │
    └── Phase B: LLM-Assisted Extraction (for tables/fields the template engine misses)
        │
        ├── Input: raw page text + coordinates + Phase A results
        ├── LLM prompt: "Extract these specific fields from this text.
        │   Return ONLY the values you find. If a field is not present,
        │   return null. Never estimate or calculate."
        ├── Output: additional field values with source references
        └── Validation: all LLM-extracted values must pass through
            the same validation rules as template-extracted values
```

### 3.3 The Source Reference System

Every single data field carries a `SourceRef` — this is what makes the system trustworthy.

```python
@dataclass(frozen=True)
class SourceRef:
    """Points to exactly where a value came from in the original PDF."""
    pdf_hash: str              # SHA-256 of the PDF file
    pdf_path: str              # local path to the PDF
    page_number: int           # 1-indexed page number
    field_name: str            # the financial field name in the PDF
    extraction_method: str     # "template" | "llm" | "manual"
    confidence: float          # 0.0-1.0
    coordinates: PageCoordinate | None = None  # position on page (when available)
    raw_text: str | None = None                # the exact text that was parsed
```

### 3.4 Multi-Year Extraction

When extracting multiple annual reports (3-5 years), the system:

1. Extracts each PDF independently (no cross-contamination)
2. Assigns each extraction to its fiscal year
3. Validates that extracted years match the expected years
4. Detects if the same financial fields are present across all years
5. Flags years where key fields are missing

```python
@dataclass(frozen=True)
class YearlyExtraction:
    """One year's worth of extracted data from one annual report."""
    fiscal_year: int
    report: AnnualReportRef        # link to the source PDF
    financial_data: FinancialData  # the extracted financials
    board_info: BoardInfo | None
    property_info: PropertyInfo | None
    extraction_confidence: float   # overall confidence for this year
    extraction_notes: list[str]    # any warnings or issues

@dataclass(frozen=True)
class MultiYearExtraction:
    """Extraction result spanning multiple annual reports."""
    brf_id: UUID
    years: list[YearlyExtraction]  # sorted by fiscal_year ascending
    years_extracted: int
    years_expected: int
    year_alignment: YearAlignment  # which fields are present across all years
```

### 3.5 Existing Models

The BRF-Scraper already defines Pydantic models at `BRF-Scraper/src/brf_scraper/models/brf.py`:

- `FinancialData` — income statement, balance sheet, per-apartment metrics, ratios, fees
- `BoardInfo` / `BoardMember` — board composition
- `PropertyInfo` — building metadata
- `ExtractionResult` — extraction output wrapper

These models will be extended (see Section 10), not replaced.

---

## 4. Stage 3: Verified JSON Schema

### 4.1 Purpose

Produce a single, validated, versioned JSON document that is the **sole source of truth** for all downstream stages. Once data enters this schema, it is immutable. No stage may modify it — only read from it.

### 4.2 Schema Design Principles

1. **All values are nullable** — null means "not found in the PDF", never "default"
2. **All monetary values are in SEK** — the schema enforces units
3. **All ratios are explicit** — e.g., `equity_ratio` is stored alongside `total_equity` and `total_assets` so the calculation can be verified
4. **Every field has a SourceRef** — provenance is mandatory
5. **The schema is versioned** — `schema_version` field for forward compatibility
6. **No derived values in the core schema** — calculations happen in Stage 4

### 4.3 Top-Level Structure

```json
{
  "$schema_version": "1.0.0",
  "generated_at": "2026-07-20T14:30:00Z",
  "engine_version": "1.0.0",

  "brf": {
    "id": "uuid",
    "name": "string",
    "organization_number": "string | null",
    "municipality": "string | null",
    "number_of_apartments_extracted": "int | null",
    "source_ref": "SourceRef"
  },

  "annual_reports": [
    {
      "fiscal_year": 2025,
      "pdf": {
        "path": "string",
        "hash": "sha256",
        "size_bytes": 123456
      },
      "extraction_confidence": 0.92,
      "extraction_notes": ["string"],

      "income_statement": {
        "revenue": { "value": 1234567.0, "unit": "SEK", "source": "SourceRef" },
        "operating_costs": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "operating_profit": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "financial_income": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "financial_costs": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "profit_before_tax": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "profit_after_tax": { "value": ..., "unit": "SEK", "source": "SourceRef" }
      },

      "balance_sheet": {
        "total_assets": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "current_assets": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "fixed_assets": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "total_equity": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "total_liabilities": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "long_term_debt": { "value": ..., "unit": "SEK", "source": "SourceRef" },
        "short_term_debt": { "value": ..., "unit": "SEK", "source": "SourceRef" }
      },

      "apartment_metrics": {
        "number_of_apartments": { "value": ..., "unit": "count", "source": "SourceRef" },
        "number_of_commercial": { "value": ..., "unit": "count", "source": "SourceRef" },
        "number_of_rental": { "value": ..., "unit": "count", "source": "SourceRef" },
        "avg_monthly_fee": { "value": ..., "unit": "SEK/month", "source": "SourceRef" }
      },

      "loans": [
        {
          "lender": "string | null",
          "original_amount": { "value": ..., "unit": "SEK", "source": "SourceRef" },
          "remaining_amount": { "value": ..., "unit": "SEK", "source": "SourceRef" },
          "interest_rate_percent": { "value": ..., "unit": "%", "source": "SourceRef" },
          "maturity_date": "string | null",
          "amortization_required": "bool | null"
        }
      ],

      "board": {
        "chairman": "string | null",
        "auditor": "string | null",
        "auditor_firm": "string | null",
        "members_count": "int | null",
        "source": "SourceRef"
      },

      "property_info": {
        "property_designation": "string | null",
        "year_built": { "value": ..., "unit": "year", "source": "SourceRef" },
        "building_area_sqm": { "value": ..., "unit": "m²", "source": "SourceRef" },
        "land_area_sqm": { "value": ..., "unit": "m²", "source": "SourceRef" },
        "energy_class": "string | null",
        "source": "SourceRef"
      },

      "notes_and_events": {
        "planned_investments": ["string"],
        "renovation_history": ["string"],
        "special_events": ["string"],
        "source": "SourceRef"
      },

      "missing_fields": [
        {
          "field": "balance_sheet.long_term_debt",
          "reason": "not found in extracted text",
          "expected_in": "standard Swedish årsredovisning"
        }
      ]
    }
  ],

  "extraction_metadata": {
    "total_pdfs_processed": 3,
    "total_pdfs_succeeded": 3,
    "average_confidence": 0.89,
    "years_span": [2023, 2024, 2025],
    "field_coverage": {
      "income_statement.revenue": 3,
      "balance_sheet.long_term_debt": 1,
      "loans": 2
    }
  }
}
```

### 4.4 Typed Value Wrapper

Every extractable value uses the same wrapper:

```python
@dataclass(frozen=True)
class TypedValue[T]:
    """A value with its unit and provenance."""
    value: T | None         # null = not found
    unit: str               # "SEK", "%", "count", "m²", "year", "SEK/month"
    source: SourceRef       # where this came from

@dataclass(frozen=True)
class FieldWithSource:
    """Convenience alias for common use."""
    value: float | int | str | bool | None
    unit: str
    source: SourceRef
```

This design means:
- A consumer can always ask "where did this number come from?"
- The LLM prompt can include the full source chain
- Debugging extraction issues traces to the exact PDF location

---

## 5. Stage 4: Deterministic Calculation Engine

### 5.1 Purpose

Compute all derived financial metrics from the verified JSON using **only code-based formulas**. The calculation engine is a pure function: same input always produces same output.

### 5.2 Design Rules

1. **No financial knowledge in the calculation code** — formulas are documented in a formula registry
2. **Every calculated field is wrapped in `CalculatedField`** — declaring its formula and inputs
3. **If any input is null, the output is null** — no partial calculations
4. **Calculations are idempotent** — running twice on the same input produces the same output
5. **Calculations are unit-aware** — the engine rejects mismatched units

### 5.3 Core Calculations

#### 5.3.1 Per-Apartment Metrics

```python
# These are the most important metrics for BRF analysis.
# They allow comparison across BRFs of different sizes.

debt_per_apartment = total_long_term_debt / number_of_apartments
equity_per_apartment = total_equity / number_of_apartments
revenue_per_apartment = revenue / number_of_apartments
cost_per_apartment = operating_costs / number_of_apartments
```

#### 5.3.2 Financial Ratios

```python
equity_ratio = total_equity / total_assets           # higher = healthier
debt_ratio = total_liabilities / total_assets         # lower = healthier
operating_margin = operating_profit / revenue         # positive = self-sustaining
interest_coverage = operating_profit / financial_costs  # > 1.0 = can service debt
loan_to_value = total_debt / estimated_property_value  # needs external valuation
cost_per_sqm = operating_costs / building_area_sqm
revenue_per_sqm = revenue / building_area_sqm
```

#### 5.3.3 Fee Analysis

```python
fee_sustainability = avg_monthly_fee / (revenue / number_of_apartments / 12)
# > 1.0 means fees cover costs; < 1.0 means the BRF is running a deficit
```

#### 5.3.4 Debt Structure

```python
total_debt = sum(loan.remaining_amount for loan in loans)
weighted_average_interest = sum(debt * rate) / total_debt
short_term_debt_ratio = short_term_debt / total_debt
avg_loan_maturity = mean(years_until_maturity for each loan)
```

#### 5.3.5 Growth Rates (Multi-Year)

```python
# Only computed when 2+ years of data are available
revenue_growth_yoy = (revenue[y] - revenue[y-1]) / revenue[y-1]
cost_growth_yoy = (costs[y] - costs[y-1]) / costs[y-1]
equity_change_yoy = equity[y] - equity[y-1]
debt_change_yoy = debt[y] - debt[y-1]
profit_trend = [profit[y] for y in sorted_years]  # the raw series
```

### 5.4 Calculated Output

```python
@dataclass(frozen=True)
class CalculatedField[T]:
    """A value computed by the calculation engine."""
    value: T | None
    unit: str
    formula: str               # human-readable formula, e.g. "total_equity / total_assets"
    inputs: list[str]          # field names that were used as inputs
    input_values: list[float | None]  # the actual input values (for traceability)
    computed: bool             # False if any input was null

@dataclass(frozen=True)
class CalculatedMetrics:
    """All deterministic calculations for one fiscal year."""
    fiscal_year: int

    # Per-apartment metrics
    debt_per_apartment: CalculatedField[float]
    equity_per_apartment: CalculatedField[float]
    revenue_per_apartment: CalculatedField[float]
    cost_per_apartment: CalculatedField[float]

    # Financial ratios
    equity_ratio: CalculatedField[float]
    debt_ratio: CalculatedField[float]
    operating_margin: CalculatedField[float]
    interest_coverage: CalculatedField[float]
    cost_per_sqm: CalculatedField[float]
    revenue_per_sqm: CalculatedField[float]

    # Fee analysis
    fee_sustainability: CalculatedField[float]

    # Debt structure
    total_debt: CalculatedField[float]
    weighted_average_interest: CalculatedField[float]
    short_term_debt_ratio: CalculatedField[float]

    # Growth (only for multi-year)
    revenue_growth_yoy: CalculatedField[float] | None = None
    cost_growth_yoy: CalculatedField[float] | None = None
    equity_change_yoy: CalculatedField[float] | None = None
    debt_change_yoy: CalculatedField[float] | None = None
```

### 5.5 Formula Registry

All formulas are registered in a central registry for documentation and auditability:

```python
FORMULA_REGISTRY = {
    "equity_ratio": Formula(
        name="equity_ratio",
        description="Andel eget kapital i procent av totala tillgångar",
        formula="total_equity / total_assets",
        inputs=["balance_sheet.total_equity", "balance_sheet.total_assets"],
        unit="%",
        benchmark_range=(0.30, 0.70),  # Swedish BRF norms
        benchmark_source="BRF-branschen typical range",
    ),
    "debt_per_apartment": Formula(
        name="debt_per_apartment",
        description="Skuld per lägenhet i kronor",
        formula="total_long_term_debt / number_of_apartments",
        inputs=["balance_sheet.long_term_debt", "apartment_metrics.number_of_apartments"],
        unit="SEK",
        benchmark_range=(200_000, 600_000),  # Stockholm typical
        benchmark_source="market observation",
    ),
    # ... etc.
}
```

---

## 6. Stage 5: Trend Engine

### 6.1 Purpose

Analyze changes across multiple years to identify trends. A single year tells you where the BRF is. Multiple years tell you where it is going.

### 6.2 Requirements

- Minimum 2 years of extracted data for any trend calculation
- 3+ years recommended for meaningful trend analysis
- All trends are computed by code, never inferred by the LLM
- Missing years are handled gracefully (gap detection)

### 6.3 Trend Calculations

#### 6.3.1 Direction Classification

```python
def classify_trend(values: list[float], threshold_pct: float = 3.0) -> TrendDirection:
    """
    Classify a series of year-over-year values into a trend direction.

    threshold_pct: minimum % change to be considered "changing"
    Values must be in chronological order.
    """
    if len(values) < 2:
        return TrendDirection.INSUFFICIENT_DATA

    changes = [(values[i] - values[i-1]) / abs(values[i-1])
               for i in range(1, len(values)) if values[i-1] != 0]

    if not changes:
        return TrendDirection.STABLE

    avg_change = sum(changes) / len(changes)

    if avg_change > threshold_pct / 100:
        return TrendDirection.IMPROVING
    elif avg_change < -threshold_pct / 100:
        return TrendDirection.DECLINING
    else:
        return TrendDirection.STABLE
```

#### 6.3.2 Trend Categories

| Category | Fields Analyzed | What It Tells You |
|----------|----------------|-------------------|
| Revenue Trend | revenue, revenue_per_apartment | Is the BRF generating more income? |
| Cost Trend | operating_costs, cost_per_apartment | Are costs growing faster than revenue? |
| Profitability Trend | operating_profit, operating_margin | Is the BRF becoming more or less self-sustaining? |
| Debt Trend | total_long_term_debt, debt_per_apartment | Is debt growing or being paid down? |
| Equity Trend | total_equity, equity_ratio | Is the BRF building reserves? |
| Fee Trend | avg_monthly_fee | Are fees increasing? At what rate? |
| Loan Structure | weighted_average_interest, loan count | Is the BRF refinancing favorably? |

#### 6.3.3 Trend Output

```python
@dataclass(frozen=True)
class TrendAnalysis:
    """Analysis of a single metric across years."""
    metric_name: str
    direction: TrendDirection          # IMPROVING, DECLINING, STABLE, INSUFFICIENT_DATA
    yearly_values: list[YearlyValue]   # [{year, value, change_pct}] 
    average_annual_change_pct: float | None
    volatility: float | None           # std deviation of year-over-year changes
    years_analyzed: int
    earliest_year: int
    latest_year: int

@dataclass(frozen=True)
class YearlyValue:
    year: int
    value: float
    change_pct: float | None  # % change from previous year; None for first year

@dataclass(frozen=True)
class MultiYearTrends:
    """Complete trend analysis across all available years."""
    brf_id: UUID
    years_analyzed: list[int]
    revenue_trend: TrendAnalysis
    cost_trend: TrendAnalysis
    profitability_trend: TrendAnalysis
    debt_trend: TrendAnalysis
    equity_trend: TrendAnalysis
    fee_trend: TrendAnalysis
    loan_structure_trend: TrendAnalysis

    # Anomaly detection
    anomalies: list[TrendAnomaly]   # e.g., "costs spiked 40% in 2024"

@dataclass(frozen=True)
class TrendAnomaly:
    """A significant deviation detected in the trend data."""
    metric: str
    year: int
    description: str               # e.g., "operating_costs increased 40% from previous year"
    magnitude: float               # how many std deviations from normal
    severity: str                  # "info", "warning", "critical"
```

### 6.4 Anomaly Detection

The trend engine flags anomalies that the risk engine should investigate:

| Anomaly | Detection | Severity |
|---------|-----------|----------|
| Cost spike | > 20% YoY increase in operating costs | warning |
| Revenue drop | > 15% YoY decrease in revenue | warning |
| Debt increase | > 25% increase in total debt without corresponding asset increase | critical |
| Equity erosion | equity_ratio falling below 30% | critical |
| Fee surge | > 10% annual fee increase | info |
| Interest rate jump | weighted average interest increased > 2 percentage points | warning |
| Margin collapse | operating_margin went negative | critical |

---

## 7. Stage 6: Risk Engine

### 7.1 Purpose

Combine all calculated metrics, trends, and extracted data into a structured risk assessment. The risk engine assigns risk scores and risk levels, never raw recommendations.

### 7.2 Design

The risk engine is a **rule-based system** — not a model, not an ML classifier. Every rule is explicit, testable, and auditable.

```python
@dataclass(frozen=True)
class RiskRule:
    """A single risk evaluation rule."""
    id: str
    category: str                # "financial_health", "debt", "fee", "trend", "structural"
    description: str
    condition: str               # human-readable condition, e.g. "equity_ratio < 0.30"
    severity: RiskSeverity       # LOW, MEDIUM, HIGH, CRITICAL
    weight: float                # 0.0-1.0, importance in overall risk score
    recommendation: str          # what a buyer should consider

@dataclass(frozen=True)
class RiskEvaluation:
    """Result of evaluating one risk rule."""
    rule: RiskRule
    triggered: bool              # did this rule fire?
    actual_value: float | None   # what the metric actually was
    threshold: str               # what the rule expects
    evidence: SourceRef          # where the value came from

@dataclass(frozen=True)
class RiskAssessment:
    """Complete risk assessment for the BRF."""
    brf_id: UUID
    fiscal_year: int
    evaluations: list[RiskEvaluation]
    overall_risk_score: float    # 0-100 (0 = no risk, 100 = extreme risk)
    risk_level: RiskLevel        # LOW, MEDIUM, HIGH, CRITICAL
    risk_factors: list[RiskFactor]  # summarized risk factors for the report
```

### 7.3 Risk Categories and Rules

#### 7.3.1 Financial Health Risks

| Rule | Condition | Severity | Weight |
|------|-----------|----------|--------|
| Low equity | equity_ratio < 0.30 | HIGH | 0.9 |
| Negative operating profit | operating_profit < 0 | CRITICAL | 1.0 |
| Deficit operations | operating_margin < -0.05 | HIGH | 0.85 |
| High cost per sqm | cost_per_sqm > regional_median * 1.5 | MEDIUM | 0.6 |
| Declining revenue trend | revenue_trend == DECLINING for 2+ consecutive years | HIGH | 0.8 |

#### 7.3.2 Debt Risks

| Rule | Condition | Severity | Weight |
|------|-----------|----------|--------|
| Excessive debt per apartment | debt_per_apartment > 600_000 | HIGH | 0.85 |
| Short-term debt concentration | short_term_debt_ratio > 0.40 | HIGH | 0.8 |
| High weighted interest | weighted_avg_interest > 5.0% | MEDIUM | 0.65 |
| No loans disclosed | loans list is empty | MEDIUM | 0.5 |
| Rising debt trend | debt_trend == IMPROVING (debt increasing) | MEDIUM | 0.6 |

#### 7.3.3 Fee Risks

| Rule | Condition | Severity | Weight |
|------|-----------|----------|--------|
| High monthly fee | avg_monthly_fee > 5000 | MEDIUM | 0.5 |
| Fee unsustainability | fee_sustainability < 0.8 | HIGH | 0.75 |
| Rapid fee increase | fee_trend shows > 10% annual increase | MEDIUM | 0.6 |

#### 7.3.4 Structural Risks

| Rule | Condition | Severity | Weight |
|------|-----------|----------|--------|
| Old building | year_built < 1950 AND no renovation since | MEDIUM | 0.5 |
| Single-commercial dependency | commercial_sqm / total_sqm > 0.30 | MEDIUM | 0.55 |
| Small association | number_of_apartments < 20 | LOW | 0.3 |
| Missing audit | auditor is None | LOW | 0.2 |

#### 7.3.5 Trend-Based Risks

| Rule | Condition | Severity | Weight |
|------|-----------|----------|--------|
| Profitability declining | profitability_trend == DECLINING | HIGH | 0.8 |
| Cost growth exceeds revenue growth | cost_trend magnitude > revenue_trend magnitude | MEDIUM | 0.65 |
| Equity eroding | equity_trend == DECLINING for 2+ years | HIGH | 0.85 |

### 7.4 Overall Risk Score

```python
def compute_risk_score(evaluations: list[RiskEvaluation]) -> float:
    """
    Weighted risk score. Each triggered rule contributes its weight * severity_factor.
    Severity factors: LOW=0.25, MEDIUM=0.5, HIGH=0.75, CRITICAL=1.0
    """
    if not evaluations:
        return 0.0

    total_weight = sum(e.rule.weight for e in evaluations if e.triggered)
    max_possible = sum(e.rule.weight for e in evaluations)  # if all triggered

    if max_possible == 0:
        return 0.0

    return (total_weight / max_possible) * 100
```

---

## 8. Stage 7: LLM Explanation Layer

### 8.1 Purpose

Generate human-readable explanations for the analysis. The LLM is a **narrator**, not an analyst. It reads verified data and explains it in natural language.

### 8.2 The Iron Rule

> The LLM receives a structured prompt containing:
> 1. The verified JSON (Stage 3)
> 2. The calculated metrics (Stage 4)
> 3. The trend analysis (Stage 5)
> 4. The risk assessment (Stage 6)
>
> It must NEVER:
> - Add financial values not present in the input
> - Perform any calculations
> - Infer missing data
> - Make investment recommendations
> - Use phrases like "approximately", "estimated", "likely"
>
> It MUST:
> - Explain what the numbers mean
> - Highlight what data is missing
> - Use hedging language when data is incomplete
> - Cite the source of every fact it states
> - Respond in Swedish (with English technical terms where standard)

### 8.3 Prompt Architecture

The LLM receives a structured prompt with explicit sections:

```
SYSTEM PROMPT (fixed, never changes):
"You are a financial analyst explaining a BRF's annual report to a potential buyer.
You may ONLY explain facts that are present in the provided data.
If data is missing, say so explicitly.
Never estimate, infer, or calculate values.
Every statement must cite its source.
Respond in Swedish."

USER PROMPT:
Section 1: BRF IDENTIFICATION
- Name, org number, municipality, number of apartments

Section 2: FINANCIAL DATA (from verified JSON)
- Income statement per year
- Balance sheet per year
- Loans

Section 3: CALCULATED METRICS (from calculation engine)
- All ratios, per-apartment metrics, fee sustainability

Section 4: TRENDS (from trend engine)
- Direction of each metric, anomalies detected

Section 5: RISK ASSESSMENT (from risk engine)
- Triggered rules, overall risk score

Section 6: EXPLICIT INSTRUCTIONS
- "Explain the financial health of this BRF based on the above data."
- "For each section, state which fields are missing if any."
- "Do not add any values or calculations not present above."
```

### 8.4 Explanation Sections

The LLM produces structured explanations, one per analysis section:

```python
@dataclass(frozen=True)
class LLMExplanation:
    """A structured explanation generated by the LLM."""
    section: str                    # "financial_health", "debt_analysis", etc.
    heading: str                    # "Ekonomisk hälsa"
    body: str                       # the LLM-generated text
    facts_used: list[str]           # which facts from the verified JSON were referenced
    missing_data_notes: list[str]   # what the LLM noted was missing
    confidence: float               # based on data completeness, not LLM certainty

@dataclass(frozen=True)
class ExplanationBundle:
    """All LLM explanations for one analysis."""
    brf_id: UUID
    fiscal_year: int
    sections: list[LLMExplanation]
    overall_summary: str            # high-level summary
    data_completeness_note: str     # what percentage of expected fields were found
    methodology_note: str           # how the analysis was performed
```

### 8.5 Explanation Sections

| Section ID | Heading | Content |
|------------|---------|---------|
| `financial_health` | Ekonomisk hälsa | Explain operating profit, margins, revenue vs costs |
| `debt_analysis` | Skuldsättning | Explain debt levels, interest rates, loan structure |
| `fee_analysis` | Avgifter | Explain monthly fees, sustainability, trend |
| `equity_analysis` | Eget kapital | Explain equity levels, equity ratio, trend |
| `trend_analysis` | Utveckling över tid | Explain improving/declining trends |
| `risk_summary` | Riskbedömming | Explain triggered risk factors |
| `missing_data` | Saknade uppgifter | List all fields that were expected but not found |
| `recommendations` | Vad att tänka på | Non-financial guidance (ask for specific documents, visit the property) |

### 8.6 Hallucination Prevention

The system prevents LLM hallucination through multiple layers:

1. **Input restriction**: The LLM only receives verified, structured data — never raw PDF text
2. **Output parsing**: The LLM's response is parsed and validated against the input data
3. **Fact checking**: Every claim in the LLM's text is checked against the verified JSON
4. **Confidence scoring**: If the LLM references data not in the input, it is flagged
5. **System prompt constraints**: Explicit instructions with negative examples

---

## 9. Confidence Scoring

### 9.1 Purpose

Provide a transparent measure of how much data was available for the analysis. A high confidence score means most expected fields were found. A low score means the analysis is based on partial data.

### 9.2 Confidence Components

```python
@dataclass(frozen=True)
class ConfidenceReport:
    """How confident we are in the analysis, broken down by component."""
    overall: float                 # 0.0-1.0

    # Per-stage confidence
    extraction_confidence: float   # how well did PDF extraction work?
    field_coverage: float          # % of expected fields that were found
    year_coverage: float           # % of requested years that were extracted
    calculation_coverage: float    # % of calculations that could be computed
    trend_coverage: float          # % of trends that had enough data points
    risk_coverage: float           # % of risk rules that could be evaluated

    # Per-year breakdown
    yearly_confidence: dict[int, float]

    # Field-level detail
    missing_critical_fields: list[str]  # fields that significantly reduce confidence
    missing_optional_fields: list[str]  # fields that are nice-to-have
```

### 9.3 Confidence Thresholds

| Score | Label | Action |
|-------|-------|--------|
| 0.90 - 1.00 | High confidence | Full analysis, all sections |
| 0.70 - 0.89 | Good confidence | Full analysis with notes about missing data |
| 0.50 - 0.69 | Moderate confidence | Analysis with prominent "insufficient data" warnings |
| 0.30 - 0.49 | Low confidence | Minimal analysis, strong recommendation to get more data |
| 0.00 - 0.29 | Very low confidence | Analysis refused — not enough data to be useful |

### 9.4 Critical Fields

Some fields have outsized impact on confidence:

| Field | Impact if Missing |
|-------|-------------------|
| `income_statement.revenue` | -0.20 |
| `income_statement.operating_profit` | -0.15 |
| `balance_sheet.total_equity` | -0.15 |
| `balance_sheet.total_liabilities` | -0.15 |
| `balance_sheet.long_term_debt` | -0.15 |
| `apartment_metrics.number_of_apartments` | -0.10 |
| `loans` (any loan data) | -0.10 |
| `property_info.year_built` | -0.05 |
| `board.auditor` | -0.05 |

---

## 10. Error Handling

### 10.1 Error Taxonomy

Every error in the pipeline is classified:

```python
class ErrorCategory(StrEnum):
    EXTRACTION_FAILED = "extraction_failed"       # PDF could not be processed
    EXTRACTION_PARTIAL = "extraction_partial"     # Some pages/fields extracted
    VALIDATION_FAILED = "validation_failed"       # Extracted data failed validation
    CALCULATION_FAILED = "calculation_failed"     # A calculation could not be completed
    LLM_FAILED = "llm_failed"                     # LLM explanation generation failed
    LLM_HALLUCINATION = "llm_hallucination"       # LLM tried to add unverified data
    MISSING_DATA = "missing_data"                 # Expected data not found
    INCONSISTENT_DATA = "inconsistent_data"       # Data conflicts between years/fields
    PDF_CORRUPT = "pdf_corrupt"                   # PDF file is damaged
    PDF_ENCRYPTED = "pdf_encrypted"               # PDF is password-protected
    PDF_UNSUPPORTED = "pdf_unsupported"           # PDF format not supported
    TIMEOUT = "timeout"                           # Processing took too long
    INTERNAL_ERROR = "internal_error"             # Bug in the system

@dataclass(frozen=True)
class PipelineError:
    """A structured error that occurred during processing."""
    category: ErrorCategory
    stage: str                     # which pipeline stage
    message: str                   # human-readable description
    details: dict[str, Any]        # additional context
    recoverable: bool              # can the pipeline continue?
    fallback_value: Any | None     # what to use instead (null, partial data, etc.)
```

### 10.2 Error Recovery Strategy

| Stage | Failure Mode | Recovery |
|-------|-------------|----------|
| PDF Extraction | PDF is scanned | Fall back to OCR |
| PDF Extraction | OCR confidence too low | Flag for manual review, continue with what we have |
| PDF Extraction | PDF is encrypted | Report error, skip this year |
| Structured Extraction | Table parsing fails | Fall back to regex extraction |
| Structured Extraction | LLM extraction disagrees with template | Use template value, flag discrepancy |
| Structured Extraction | No financial data found | Report extraction failure for this year |
| Validation | Value outside reasonable range | Flag as suspicious, keep with warning |
| Calculation | Division by zero | Return null, note "insufficient data" |
| Calculation | Missing input | Return null, note which input was missing |
| Trend | Fewer than 2 years | Return INSUFFICIENT_DATA |
| Risk | Missing metrics | Skip un-evaluable rules, note in report |
| LLM | Generation fails | Use template-based summary (deterministic) |
| LLM | Hallucination detected | Re-generate with stricter prompt, or fall back to template |

### 10.3 Graceful Degradation

The pipeline is designed to produce the best possible analysis with whatever data is available:

```
Best case:  5 years extracted → full trend analysis, high confidence
Good case:  3 years extracted → trend analysis, good confidence
OK case:    1 year extracted  → snapshot analysis, moderate confidence
Minimal:    Partial extraction → very limited analysis, low confidence
Worst case: Extraction fails  → error reported, no analysis generated
```

At no point does the system pretend to have data it doesn't.

---

## 11. Extensibility: Future Document Types

### 11.1 Architecture

The pipeline is designed to accept additional document types beyond annual reports. Each new document type plugs into the same pipeline:

```
New Document Type
    │
    ├── Does it have a known template? 
    │   ├── YES → Register a new TemplateRule set
    │   └── NO  → Use LLM extraction with a new prompt template
    │
    ├── Does it affect the analysis?
    │   ├── YES → Register new RiskRules that reference its fields
    │   └── NO  → Store as metadata only
    │
    └── Does it provide year-specific data?
        ├── YES → Add to the year-aligned MultiYearExtraction
        └── NO  → Store as point-in-time metadata
```

### 11.2 Planned Document Types

| Document Type | Swedish Name | What It Contains | Integration |
|--------------|-------------|------------------|-------------|
| Annual Report | Årsredovisning | Financial statements | **Current (Stage 2)** |
| Statutes | Stadgar | BRF rules, restrictions, right of first refusal | New extractor → rules metadata |
| Energy Declaration | Energideklaration | Energy class, heating costs, renovation needs | New extractor → property_info enrichment |
| Inspection Report | Underhållsplan / Inspektionsrapport | Building condition, planned maintenance | New extractor → risk engine expansion |
| Board Minutes | Protokoll | Decisions, upcoming votes, special assessments | New extractor → trend/risk enrichment |
| Loan Amortisation Plan | Amorteringsplan | Detailed loan schedules | New extractor → debt structure enrichment |

### 11.3 Document Type Registry

```python
class DocumentType(StrEnum):
    ANNUAL_REPORT = "annual_report"         # årsredovisning
    STATUTES = "statutes"                   # stadgar
    ENERGY_DECLARATION = "energy_declaration"  # energideklaration
    INSPECTION_REPORT = "inspection_report" # underhållsplan
    BOARD_MINUTES = "board_minutes"         # protokoll
    LOAN_PLAN = "loan_plan"                 # amorteringsplan

@dataclass(frozen=True)
class DocumentTypeConfig:
    """Configuration for a supported document type."""
    type: DocumentType
    extraction_templates: list[str]         # regex patterns for field extraction
    expected_fields: list[str]              # fields this document type should contain
    year_specific: bool                     # does this data vary by year?
    affects_risk_score: bool                # should risk rules reference this?
    llm_prompt_template: str | None         # custom LLM prompt for extraction
    validation_rules: list[str]             # validation rule IDs
```

---

## 12. Complete Data Flow

### 12.1 Single-Year Analysis

```
Input: PDF file + fiscal_year

Stage 1: PDF Extraction
  → ExtractedPage[] (with coordinates, confidence)
  → Quality gate check

Stage 2: Structured Extraction
  Phase A: Template extraction → PartialStructuredData
  Phase B: LLM extraction → AdditionalFields
  Merge → VerifiedJSON (single year)

Stage 3: Validation
  Range checks, consistency checks, unit verification
  → ValidatedJSON

Stage 4: Calculations
  Pure function: ValidatedJSON → CalculatedMetrics
  → All ratios, per-apartment metrics, fee analysis

Stage 5: Risk Assessment
  Rule evaluation against CalculatedMetrics
  → RiskAssessment (triggered rules, risk score)

Stage 6: LLM Explanation
  Prompt: ValidatedJSON + CalculatedMetrics + RiskAssessment
  → ExplanationBundle (structured text)

Stage 7: Assembly
  Combine everything into AnalysisReport
  → Final Köpanalys
```

### 12.2 Multi-Year Analysis

```
Input: PDF files for years [Y1, Y2, Y3, Y4, Y5]

Parallel extraction:
  For each year: Stage 1 → Stage 2 → Stage 3
  → list[ValidatedJSON]

Year alignment:
  Compare field availability across years
  → YearAlignmentReport

Parallel calculation:
  For each year: Stage 4 → CalculatedMetrics
  → list[CalculatedMetrics]

Trend analysis:
  Cross-year comparison → MultiYearTrends
  Anomaly detection → list[TrendAnomaly]

Risk assessment:
  Rules against latest year + trend-informed rules
  → RiskAssessment

LLM explanation:
  Multi-year context in prompt
  → ExplanationBundle with trend narrative

Assembly:
  → Final Köpanalys with multi-year context
```

---

## 13. Module Layout

```
BRF-Scraper/src/brf_scraper/
├── extractor/                          # Stage 1-2: PDF extraction
│   ├── __init__.py
│   ├── pdf_processor.py               # PDF text extraction (pdfplumber, OCR)
│   ├── table_detector.py              # Table detection in PDFs
│   ├── template_engine.py             # Template-based field extraction
│   ├── llm_extractor.py               # LLM-assisted extraction
│   ├── field_patterns.py              # Swedish financial field regex patterns
│   ├── source_ref.py                  # SourceRef data class
│   └── quality_gate.py               # Extraction quality checks

analysis/                               # Stage 3-7: Analysis engine
├── __init__.py
├── schema/                             # Verified JSON schema
│   ├── __init__.py
│   ├── types.py                       # TypedValue, FieldWithSource, SourceRef
│   ├── annual_report.py               # AnnualReportSchema
│   ├── multi_year.py                  # MultiYearSchema
│   └── validation.py                  # Schema validation rules
│
├── calculator/                         # Stage 4: Deterministic calculations
│   ├── __init__.py
│   ├── engine.py                      # CalculationEngine
│   ├── formulas.py                    # Formula registry
│   ├── per_apartment.py               # Per-apartment metrics
│   ├── ratios.py                      # Financial ratios
│   ├── fees.py                        # Fee analysis
│   ├── debt.py                        # Debt structure analysis
│   └── growth.py                      # Growth rate calculations
│
├── trends/                             # Stage 5: Multi-year trends
│   ├── __init__.py
│   ├── engine.py                      # TrendEngine
│   ├── direction.py                   # Trend classification
│   ├── anomalies.py                   # Anomaly detection
│   └── alignment.py                   # Year alignment
│
├── risk/                               # Stage 6: Risk assessment
│   ├── __init__.py
│   ├── engine.py                      # RiskEngine
│   ├── rules/                          # Individual risk rule modules
│   │   ├── __init__.py
│   │   ├── financial_health.py
│   │   ├── debt.py
│   │   ├── fees.py
│   │   ├── structural.py
│   │   └── trends.py
│   └── scoring.py                     # Risk score computation
│
├── llm/                                # Stage 7: LLM explanation
│   ├── __init__.py
│   ├── prompt_builder.py              # Structured prompt construction
│   ├── explainer.py                   # LLM explanation generation
│   ├── fact_checker.py               # Verify LLM output against source data
│   ├── templates/                      # Prompt templates per section
│   │   ├── financial_health.md
│   │   ├── debt_analysis.md
│   │   ├── fee_analysis.md
│   │   ├── trend_analysis.md
│   │   ├── risk_summary.md
│   │   └── system_prompt.md
│   └── fallback.py                    # Template-based fallback explanations
│
├── confidence/                         # Confidence scoring
│   ├── __init__.py
│   ├── scorer.py                      # ConfidenceReport generation
│   ├── field_impact.py               # Field impact weights
│   └── thresholds.py                  # Confidence thresholds
│
├── pipeline/                           # Orchestration
│   ├── __init__.py
│   ├── analysis_pipeline.py           # Main pipeline orchestrator
│   ├── single_year.py                 # Single-year pipeline
│   ├── multi_year.py                  # Multi-year pipeline
│   ├── error_handler.py               # Pipeline error handling
│   └── result.py                      # Pipeline result types
│
└── documents/                          # Extensibility: document type registry
    ├── __init__.py
    ├── registry.py                    # DocumentTypeRegistry
    ├── annual_report.py               # Annual report config
    └── future/                         # Placeholder for future types
        ├── statutes.py
        ├── energy_declaration.py
        ├── inspection_report.py
        └── board_minutes.py
```

---

## 14. Integration with Existing Code

### 14.1 BRF-Scraper Integration

The Analysis Engine extends the BRF-Scraper, not replaces it:

| Existing Component | How It Connects |
|-------------------|-----------------|
| `models/brf.py` | Extended with new fields (see 14.2) |
| `extractor/` (stub) | Becomes the Stage 1-2 implementation |
| `downloader/` | Provides PDF files as input |
| `pipeline/crawl_pipeline.py` | Extended to chain into analysis after download |
| `storage/local.py` | Provides PDF file paths |
| `config.py` | Extended with analysis configuration |

### 14.2 Model Extensions

The existing `FinancialData` model in `models/brf.py` will be extended:

```python
# New fields to add to FinancialData:
class FinancialData(BaseModel):
    # ... existing fields ...

    # NEW: Loan details
    loans: list[LoanInfo] = Field(default_factory=list)
    total_debt: float | None = None
    weighted_average_interest: float | None = None

    # NEW: Source tracking
    extraction_method: str = "template"  # "template" | "llm" | "hybrid"
    field_sources: dict[str, SourceInfo] = Field(default_factory=dict)

    # NEW: Missing fields for transparency
    missing_fields: list[MissingField] = Field(default_factory=list)

class LoanInfo(BaseModel):
    lender: str | None = None
    original_amount: float | None = None
    remaining_amount: float | None = None
    interest_rate_percent: float | None = None
    maturity_date: str | None = None
    amortization_required: bool | None = None

class SourceInfo(BaseModel):
    page_number: int
    field_name: str
    extraction_method: str
    confidence: float
    raw_text: str | None = None

class MissingField(BaseModel):
    field: str
    reason: str
    expected_in: str = "standard Swedish årsredovisning"
```

### 14.3 Frontend Integration

The analysis pipeline in `frontend/src/lib/analysis/` will be extended:

| Existing Component | Extension |
|-------------------|-----------|
| `types.ts` | Add `AnnualReportAnalysis`, `TrendAnalysis`, `RiskAssessment` types |
| `pipeline.ts` | Add BRF analysis step after provider collection |
| `engine/analyzers/housingAssociation.ts` | Consume BRF health score from the analysis engine |
| `engine/analyzers/risk.ts` | Consume risk assessment from the analysis engine |
| `providers/` | Add BRF data provider that fetches from the analysis engine |

---

## 15. Testing Strategy

### 15.1 Test Levels

| Level | What | How |
|-------|------|-----|
| Unit | Individual extraction templates | Test against known PDF page snippets |
| Unit | Calculation formulas | Test with hand-calculated examples |
| Unit | Risk rules | Test with crafted metric sets |
| Unit | Trend classification | Test with known time series |
| Integration | Full single-year pipeline | Test with real PDFs from `data/production_validation/` |
| Integration | Multi-year pipeline | Test with 3+ PDFs from the same BRF |
| Regression | LLM hallucination prevention | Verify LLM output against source data |
| E2E | Full pipeline from PDF to report | Test with known BRFs where we have ground truth |

### 15.2 Test Data

The `BRF-Scraper/data/` directory already contains validation PDFs:
- `production_validation/` — 5 PDFs
- `allabrf_validation/` — 12 PDFs
- `allabrf_smoke/` — smoke test PDFs
- `hemnet_validation/` — Hemnet validation results

These serve as the foundation for integration tests.

### 15.3 Determinism Tests

Every calculation and risk rule must pass a determinism test:

```python
def test_calculation_determinism():
    """Same input always produces same output."""
    input_data = load_test_data("test_brf_2025.json")
    result1 = calculate_metrics(input_data)
    result2 = calculate_metrics(input_data)
    assert result1 == result2  # exact equality, not approximate

def test_no_randomness():
    """Verify no random values in the pipeline."""
    # Run pipeline 10 times with same input
    results = [run_pipeline(test_input) for _ in range(10)]
    assert all(r == results[0] for r in results)
```

---

## 16. Performance Considerations

### 16.1 Processing Time Budget

| Stage | Target | Notes |
|-------|--------|-------|
| PDF Extraction | < 30s per PDF | OCR is the slow path |
| Structured Extraction | < 10s per year | Template engine fast, LLM adds latency |
| Validation | < 1s | Pure in-memory |
| Calculations | < 1s | Pure arithmetic |
| Trend Analysis | < 1s | Simple series operations |
| Risk Assessment | < 1s | Rule evaluation |
| LLM Explanation | < 30s | Network call, parallel sections |
| **Total (single year)** | **< 75s** | |
| **Total (5 years)** | **< 3 min** | Extraction parallelized |

### 16.2 Caching

- PDF extraction results are cached by PDF hash (same PDF, re-extract = skip)
- LLM explanations are cached by input hash (same data, same explanation)
- Calculations are not cached (too fast to benefit)

---

## 17. Implementation Priority

### Phase 1: Core Pipeline (MVP)

1. `extractor/pdf_processor.py` — PDF text extraction
2. `extractor/template_engine.py` — Template-based extraction
3. `extractor/field_patterns.py` — Swedish financial field patterns
4. `schema/types.py` — SourceRef, TypedValue
5. `schema/annual_report.py` — Verified JSON schema
6. `schema/validation.py` — Validation rules
7. `calculator/engine.py` + `formulas.py` — Core calculations
8. `risk/engine.py` + `rules/financial_health.py` + `rules/debt.py` — Basic risk
9. `confidence/scorer.py` — Confidence scoring
10. `pipeline/analysis_pipeline.py` — Orchestrator
11. `pipeline/error_handler.py` — Error handling

### Phase 2: Multi-Year + Trends

1. `extractor/llm_extractor.py` — LLM-assisted extraction
2. `schema/multi_year.py` — Multi-year schema
3. `trends/engine.py` + `direction.py` + `anomalies.py` — Trend analysis
4. `risk/rules/trends.py` + `rules/structural.py` + `rules/fees.py` — Extended risk
5. `pipeline/multi_year.py` — Multi-year orchestrator

### Phase 3: LLM Explanation

1. `llm/prompt_builder.py` — Prompt construction
2. `llm/explainer.py` — Explanation generation
3. `llm/fact_checker.py` — Hallucination prevention
4. `llm/templates/` — All prompt templates
5. `llm/fallback.py` — Template-based fallback

### Phase 4: Extensibility

1. `documents/registry.py` — Document type registry
2. `documents/future/statutes.py` — Statutes extractor
3. `documents/future/energy_declaration.py` — Energy declaration extractor
4. `documents/future/inspection_report.py` — Inspection report extractor

---

## 18. Summary

This architecture ensures that:

1. **Every number is traceable** — from the final report back to the exact PDF page
2. **No data is fabricated** — the LLM explains, never creates
3. **Missing data is transparent** — explicitly reported, never filled with defaults
4. **Calculations are deterministic** — code-based, auditable, reproducible
5. **Trends are evidence-based** — computed from actual multi-year data
6. **Risk is rule-based** — every risk factor has an explicit, testable rule
7. **The system degrades gracefully** — partial data produces partial analysis, never false analysis
8. **New document types are easy to add** — registry-based extensibility
9. **The LLM is constrained** — structured prompts, fact-checking, fallback templates
10. **Confidence is measured** — the user always knows how much data backs the analysis

The result is a system that a Swedish real estate professional would trust, because every statement can be verified against the source document.
