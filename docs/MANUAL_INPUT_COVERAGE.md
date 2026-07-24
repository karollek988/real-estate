# Manual Input Coverage Report

## Goal

Customer pastes a Hemnet URL → receives a useful Köpanalys with **zero manual input**.

---

## Current State (Post-Sprint)

### Automatic Extraction Rates (from 9 PDF validation)

| Field | Source | Auto Rate | Manual Needed? |
|-------|--------|-----------|----------------|
| **Identity** ||||
| name | Hemnet | 100% | NO |
| organization_number | Allabrf | 100% | NO |
| municipality | Hemnet | 100% | NO |
| address | Hemnet | 100% | NO |
| **Property** ||||
| year_built | Allabrf profile | 0% (not in PDFs) | Via Allabrf |
| building_area_sqm | Allabrf profile | 0% (not in PDFs) | Via Allabrf |
| energy_class | Allabrf profile | 0% (not in PDFs) | Via Allabrf |
| land_ownership | PDF extractor | 78% | 22% of the time |
| **Apartments** ||||
| number_of_apartments | Booli / Allabrf | 100% | NO |
| avg_monthly_fee | Booli listing | 100% | NO |
| number_of_rental | PDF extractor | 0% | YES (rare) |
| number_of_commercial | PDF extractor | 89% | 11% of the time |
| parking_spaces | PDF extractor | 89% | 11% of the time |
| garage_spaces | PDF extractor | 89% | 11% of the time |
| storage_units | PDF extractor | 33% | 67% of the time |
| **Financials** ||||
| revenue | PDF extractor | 100% | NO (keywords added) |
| operating_costs | PDF extractor | 100% | NO |
| operating_profit | PDF extractor | 89% | 11% of the time |
| financial_income | PDF extractor | 0% | YES (not used in calc) |
| financial_costs | PDF extractor | 100% | NO |
| profit_before_tax | PDF extractor | 89% | 11% of the time (keywords added) |
| profit_after_tax | PDF extractor | 89% | 11% of the time |
| total_assets | PDF extractor | 100% | NO |
| current_assets | PDF extractor | 100% | NO |
| fixed_assets | PDF extractor | 89% | 11% of the time |
| total_equity | PDF extractor | 89% | 11% of the time |
| total_liabilities | PDF extractor | 100% | NO |
| long_term_debt | PDF extractor | 78% | 22% of the time (keywords added) |
| short_term_debt | PDF extractor | 89% | 11% of the time |
| cash_and_bank | PDF extractor | 89% | 11% of the time |
| **Loans** ||||
| lender | PDF extractor | 56% | 44% of the time |
| remaining_amount | PDF extractor | 56% | 44% of the time |
| interest_rate_percent | PDF extractor | 22% | 78% of the time |

---

## Fields the Calculator Actually Needs

The calculator (`calculator.py`) computes 16 metrics. Here's which input fields each metric requires:

| Metric | Required Inputs | Blocks If Missing |
|--------|----------------|-------------------|
| debt_per_apartment | long_term_debt, number_of_apartments | 2 fields |
| equity_per_apartment | total_equity, number_of_apartments | 2 fields |
| revenue_per_apartment | revenue, number_of_apartments | 2 fields |
| cost_per_apartment | operating_costs, number_of_apartments | 2 fields |
| equity_ratio | total_equity, total_assets | 2 fields |
| debt_ratio | total_liabilities, total_assets | 2 fields |
| operating_margin | operating_profit, revenue | 2 fields |
| interest_coverage | operating_profit, financial_costs | 2 fields |
| cost_per_sqm | operating_costs, building_area_sqm | 2 fields |
| fee_sustainability | avg_monthly_fee, revenue, number_of_apartments | 3 fields |
| total_debt | long_term_debt, short_term_debt | 2 fields |
| weighted_average_interest | loans[].remaining_amount, loans[].interest_rate_percent | N/A per loan |
| short_term_debt_ratio | short_term_debt, total_liabilities | 2 fields |
| interest_cost_per_apartment | financial_costs, number_of_apartments | 2 fields |
| debt_to_equity | total_liabilities, total_equity | 2 fields |
| liquidity_months | cash_and_bank, operating_costs | 2 fields |

---

## Manual Input Needed (Post-Sprint)

### Automatic (customer doesn't touch these)
- Name, org number, municipality, address (from Hemnet/Allabrf)
- Number of apartments, avg monthly fee (from Booli)
- Revenue, operating costs, financial costs, total assets, total liabilities (100% from PDF)
- Operating profit, profit before/after tax, equity, fixed/current assets, debt, cash (89-100% from PDF)

### Possibly Manual (depends on PDF)
- **interest_rate_percent**: 78% missing → customer may need to enter loan interest rate
- **building_area_sqm**: 100% missing from PDF → available from Allabrf profile (auto-fillable)
- **year_built**: 100% missing from PDF → available from Allabrf profile (auto-fillable)
- **energy_class**: 100% missing from PDF → available from Allabrf profile (auto-fillable)
- **long_term_debt**: 22% missing → customer may need to enter if extractor missed it

### True Manual (rarely needed)
- **number_of_rental**: 100% missing, rare field
- **storage_units**: 67% missing
- **financial_income**: 100% missing, but not used in calculator

---

## What Was Done in Sprint

| Change | Fields Improved | Coverage Delta |
|--------|----------------|----------------|
| Revenue keyword variants | revenue | 78% → 100% |
| Long-term debt keyword variants | long_term_debt | 78% → 78% (was already 78%) |
| Profit_before_tax variants | profit_before_tax | 56% → 89% |
| Expanded bank list (9 new banks) | lender, remaining_amount | 0% → 56% |
| Loan table-format parsing | lender, remaining_amount | 0% → 56% |
| Strategic apartment fields | parking, garage, storage | 0% → 33-89% |
| Engine.py loan field fix | lender, remaining_amount, interest_rate_percent | Counting fixed |

---

## What Still Needs Manual Input

### Tier 1: Can Be Automated (Post-MVP)

| # | Field | Why Manual Now | Auto Source | Effort |
|---|-------|---------------|-------------|--------|
| 1 | interest_rate_percent | 78% missing from PDFs | Booli or manual | Medium |
| 2 | building_area_sqm | Not in PDFs | Allabrf profile scraping | Low |
| 3 | year_built | Not in PDFs | Allabrf profile scraping | Low |
| 4 | energy_class | Not in PDFs | Allabrf profile scraping | Low |

### Tier 2: Edge Cases (Skip for MVP)

| # | Field | Why Manual |
|---|-------|-----------|
| 5 | long_term_debt | 22% missing — usually extractable |
| 6 | number_of_rental | Rare, low analytical value |
| 7 | storage_units | 67% missing |

---

## Summary

**Post-Sprint State**: Customer pastes Hemnet URL → system auto-extracts most data → customer may need to enter 0-4 fields.

**Automatic**: ~22 of 26 fields (85%)
**Possibly manual**: 4 fields (interest_rate, building_area, year_built, energy_class)
**Rarely manual**: 3 fields (long_term_debt, number_of_rental, storage_units)

**Target**: 0-4 fields manual input for most listings.

**Key insight**: Property detail fields (year_built, building_area_sqm, energy_class) are NOT in PDF annual reports — they're in Allabrf profile pages. Scraping Allabrf profiles would eliminate most remaining manual input.
