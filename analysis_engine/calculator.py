"""Deterministic calculation engine for BRF financial analysis.

Pure functions only. Same input always produces same output.
Every calculated field declares its formula and inputs.
No financial knowledge is hardcoded — all thresholds come from the knowledge base.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

# Mirrored by frontend/src/lib/analysis/engine/buildAnalysis.ts's
# PYTHON_ENGINE_VERSION — bump both together whenever this module,
# reasoning.py, BRF-Scraper's extractor/validation.py, or
# discovery/allabrf_provider.py change in a way that could change a
# previously-computed result, so cached analyses correctly invalidate
# (End-to-End Truth Audit fix #3).
ANALYSIS_ENGINE_VERSION = "1.0.0"


@dataclass(frozen=True)
class CalculatedField:
    """A value computed by the calculation engine."""
    value: float | None
    unit: str
    formula: str
    inputs: list[str]
    input_values: list[float | None]
    computed: bool


@dataclass
class CalculatedMetrics:
    """All deterministic calculations for one fiscal year."""
    fiscal_year: int
    debt_per_apartment: CalculatedField | None = None
    equity_per_apartment: CalculatedField | None = None
    revenue_per_apartment: CalculatedField | None = None
    cost_per_apartment: CalculatedField | None = None
    equity_ratio: CalculatedField | None = None
    debt_ratio: CalculatedField | None = None
    operating_margin: CalculatedField | None = None
    interest_coverage: CalculatedField | None = None
    cost_per_sqm: CalculatedField | None = None
    fee_sustainability: CalculatedField | None = None
    total_debt: CalculatedField | None = None
    weighted_average_interest: CalculatedField | None = None
    short_term_debt_ratio: CalculatedField | None = None
    interest_cost_per_apartment: CalculatedField | None = None
    debt_to_equity: CalculatedField | None = None
    liquidity_months: CalculatedField | None = None


# Defense-in-depth confidence gate. profile/engine.py and financial_extractor.py
# are supposed to only ever hand this module verified, HIGH-confidence data
# (see BRF-Scraper's extractor/validation.py) - but calculate_metrics() is the
# one place all BRF financial reasoning happens, called from every entry point
# (PDF extraction, the profile bridge, manual /api/analyze input, and raw
# /api/brf-financials requests). A value with no confidence recorded, or
# below this threshold, is refused here too, so a future caller can never
# accidentally feed an unverified guess into a customer-facing ratio just by
# skipping the upstream gate.
MIN_SCORING_CONFIDENCE = 0.85


def _get_value(data: dict, *keys: str) -> float | None:
    """Safely extract a numeric value from nested dict, refusing anything
    below MIN_SCORING_CONFIDENCE (see module docstring)."""
    obj = data
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return None
    if isinstance(obj, dict) and "value" in obj:
        confidence = obj.get("source", {}).get("confidence")
        if confidence is None or confidence < MIN_SCORING_CONFIDENCE:
            return None
        return obj["value"]
    if isinstance(obj, (int, float)):
        return float(obj)
    return None


def _confident_value(entry: dict | None) -> float | None:
    """Same confidence gate as `_get_value`, for loan line items reached
    without the section->field dict traversal `_get_value` expects."""
    if not isinstance(entry, dict) or "value" not in entry:
        return None
    confidence = entry.get("source", {}).get("confidence")
    if confidence is None or confidence < MIN_SCORING_CONFIDENCE:
        return None
    return entry["value"]


def _make_field(
    value: float | None,
    unit: str,
    formula: str,
    inputs: list[str],
    input_values: list[float | None],
) -> CalculatedField:
    """Create a CalculatedField, marking as uncomputed if any input is None."""
    computed = value is not None and all(v is not None for v in input_values)
    return CalculatedField(
        value=value,
        unit=unit,
        formula=formula,
        inputs=inputs,
        input_values=input_values,
        computed=computed,
    )


def calculate_metrics(report: dict) -> CalculatedMetrics:
    """Run all deterministic calculations on one year's verified JSON.

    This is a pure function: same input always produces same output.
    """
    year = report["fiscal_year"]
    inc = report.get("income_statement", {})
    bs = report.get("balance_sheet", {})
    apt = report.get("apartment_metrics", {})
    loans = report.get("loans", [])

    revenue = _get_value(inc, "revenue")
    op_costs = _get_value(inc, "operating_costs")
    op_profit = _get_value(inc, "operating_profit")
    fin_costs = _get_value(inc, "financial_costs")
    total_assets = _get_value(bs, "total_assets")
    total_equity = _get_value(bs, "total_equity")
    total_liabilities = _get_value(bs, "total_liabilities")
    lt_debt = _get_value(bs, "long_term_debt")
    st_debt = _get_value(bs, "short_term_debt")
    cash = _get_value(bs, "cash_and_bank")
    n_apt = _get_value(apt, "number_of_apartments")
    avg_fee = _get_value(apt, "avg_monthly_fee")
    building_area = _get_value(report.get("property_info", {}), "building_area_sqm")

    metrics = CalculatedMetrics(fiscal_year=year)

    # --- Per-apartment metrics ---
    if lt_debt is not None and n_apt and n_apt > 0:
        metrics.debt_per_apartment = _make_field(
            lt_debt / n_apt, "SEK/apartment",
            "long_term_debt / number_of_apartments",
            ["balance_sheet.long_term_debt", "apartment_metrics.number_of_apartments"],
            [lt_debt, n_apt],
        )

    if total_equity is not None and n_apt and n_apt > 0:
        metrics.equity_per_apartment = _make_field(
            total_equity / n_apt, "SEK/apartment",
            "total_equity / number_of_apartments",
            ["balance_sheet.total_equity", "apartment_metrics.number_of_apartments"],
            [total_equity, n_apt],
        )

    if revenue is not None and n_apt and n_apt > 0:
        metrics.revenue_per_apartment = _make_field(
            revenue / n_apt, "SEK/apartment",
            "revenue / number_of_apartments",
            ["income_statement.revenue", "apartment_metrics.number_of_apartments"],
            [revenue, n_apt],
        )

    if op_costs is not None and n_apt and n_apt > 0:
        metrics.cost_per_apartment = _make_field(
            op_costs / n_apt, "SEK/apartment",
            "operating_costs / number_of_apartments",
            ["income_statement.operating_costs", "apartment_metrics.number_of_apartments"],
            [op_costs, n_apt],
        )

    # --- Financial ratios ---
    if total_equity is not None and total_assets and total_assets > 0:
        metrics.equity_ratio = _make_field(
            total_equity / total_assets, "ratio",
            "total_equity / total_assets",
            ["balance_sheet.total_equity", "balance_sheet.total_assets"],
            [total_equity, total_assets],
        )

    if total_liabilities is not None and total_assets and total_assets > 0:
        metrics.debt_ratio = _make_field(
            total_liabilities / total_assets, "ratio",
            "total_liabilities / total_assets",
            ["balance_sheet.total_liabilities", "balance_sheet.total_assets"],
            [total_liabilities, total_assets],
        )

    if op_profit is not None and revenue and revenue > 0:
        metrics.operating_margin = _make_field(
            op_profit / revenue, "ratio",
            "operating_profit / revenue",
            ["income_statement.operating_profit", "income_statement.revenue"],
            [op_profit, revenue],
        )

    if op_profit is not None and fin_costs and fin_costs > 0:
        metrics.interest_coverage = _make_field(
            op_profit / fin_costs, "ratio",
            "operating_profit / financial_costs",
            ["income_statement.operating_profit", "income_statement.financial_costs"],
            [op_profit, fin_costs],
        )

    if op_costs is not None and building_area and building_area > 0:
        metrics.cost_per_sqm = _make_field(
            op_costs / building_area, "SEK/m²",
            "operating_costs / building_area_sqm",
            ["income_statement.operating_costs", "property_info.building_area_sqm"],
            [op_costs, building_area],
        )

    # --- Fee sustainability ---
    if avg_fee is not None and revenue is not None and n_apt and n_apt > 0:
        rev_per_apt = revenue / n_apt
        monthly_rev_per_apt = rev_per_apt / 12
        if monthly_rev_per_apt > 0:
            metrics.fee_sustainability = _make_field(
                avg_fee / monthly_rev_per_apt, "ratio",
                "avg_monthly_fee / (revenue / number_of_apartments / 12)",
                ["apartment_metrics.avg_monthly_fee", "income_statement.revenue",
                 "apartment_metrics.number_of_apartments"],
                [avg_fee, revenue, n_apt],
            )

    # --- Debt structure ---
    if lt_debt is not None and st_debt is not None:
        total_debt_val = lt_debt + st_debt
        metrics.total_debt = _make_field(
            total_debt_val, "SEK",
            "long_term_debt + short_term_debt",
            ["balance_sheet.long_term_debt", "balance_sheet.short_term_debt"],
            [lt_debt, st_debt],
        )

    if loans:
        # Only loans with BOTH a confidently-extracted amount AND rate
        # contribute - to either side of the average. Previously a loan
        # missing its rate still counted toward the denominator, silently
        # diluting the weighted average interest rate downward.
        weighted_terms = []
        for l in loans:
            amt = _confident_value(l.get("remaining_amount"))
            rate = _confident_value(l.get("interest_rate_percent"))
            if amt is not None and rate is not None:
                weighted_terms.append((l, amt, rate))

        total_rated_amount = sum(amt for _, amt, _ in weighted_terms)
        weighted_sum = sum(amt * rate for _, amt, rate in weighted_terms)
        if total_rated_amount > 0:
            metrics.weighted_average_interest = _make_field(
                weighted_sum / total_rated_amount, "%",
                "sum(loan_amount × rate) / total_loan_amount, restricted to "
                "loans with a verified amount and rate",
                [f"loans.{l['lender']}.remaining_amount" for l, _, _ in weighted_terms]
                + [f"loans.{l['lender']}.interest_rate_percent" for l, _, _ in weighted_terms],
                [amt for _, amt, _ in weighted_terms]
                + [rate for _, _, rate in weighted_terms],
            )

    if st_debt is not None and total_liabilities and total_liabilities > 0:
        metrics.short_term_debt_ratio = _make_field(
            st_debt / total_liabilities, "ratio",
            "short_term_debt / total_liabilities",
            ["balance_sheet.short_term_debt", "balance_sheet.total_liabilities"],
            [st_debt, total_liabilities],
        )

    if fin_costs is not None and n_apt and n_apt > 0:
        metrics.interest_cost_per_apartment = _make_field(
            fin_costs / n_apt, "SEK/apartment",
            "financial_costs / number_of_apartments",
            ["income_statement.financial_costs", "apartment_metrics.number_of_apartments"],
            [fin_costs, n_apt],
        )

    if total_liabilities is not None and total_equity and total_equity > 0:
        metrics.debt_to_equity = _make_field(
            total_liabilities / total_equity, "ratio",
            "total_liabilities / total_equity",
            ["balance_sheet.total_liabilities", "balance_sheet.total_equity"],
            [total_liabilities, total_equity],
        )

    if cash is not None and op_costs and op_costs > 0:
        monthly_costs = op_costs / 12
        if monthly_costs > 0:
            metrics.liquidity_months = _make_field(
                cash / monthly_costs, "months",
                "cash_and_bank / (operating_costs / 12)",
                ["balance_sheet.cash_and_bank", "income_statement.operating_costs"],
                [cash, op_costs],
            )

    return metrics
