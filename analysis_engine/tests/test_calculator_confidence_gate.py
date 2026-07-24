"""calculate_metrics() must never turn an unverified value into a customer-
facing ratio, regardless of caller. These tests exercise the defense-in-depth
gate directly (independent of BRF-Scraper's upstream validation), since
calculate_metrics() is called from every entry point: PDF extraction via the
profile bridge, manual /api/analyze input, and raw /api/brf-financials
requests that could in principle skip the upstream gate entirely.
"""
from __future__ import annotations

from calculator import calculate_metrics


def _field(value, confidence):
    return {"value": value, "unit": "SEK", "source": {"confidence": confidence}}


def test_low_confidence_value_does_not_enter_a_ratio():
    report = {
        "fiscal_year": 2024,
        "income_statement": {},
        "balance_sheet": {
            "total_assets": _field(10_000_000, 0.60),  # below threshold
            "total_equity": _field(4_000_000, 0.95),
        },
    }
    metrics = calculate_metrics(report)
    assert metrics.equity_ratio is None


def test_high_confidence_value_computes_normally():
    report = {
        "fiscal_year": 2024,
        "income_statement": {},
        "balance_sheet": {
            "total_assets": _field(10_000_000, 0.95),
            "total_equity": _field(4_000_000, 0.95),
        },
    }
    metrics = calculate_metrics(report)
    assert metrics.equity_ratio is not None
    assert metrics.equity_ratio.value == 0.4
    assert metrics.equity_ratio.computed is True


def test_missing_confidence_is_treated_as_unverified():
    report = {
        "fiscal_year": 2024,
        "income_statement": {},
        "balance_sheet": {
            "total_assets": {"value": 10_000_000, "unit": "SEK"},  # no source at all
            "total_equity": _field(4_000_000, 0.95),
        },
    }
    metrics = calculate_metrics(report)
    assert metrics.equity_ratio is None


def test_weighted_average_interest_excludes_loans_missing_a_confident_rate():
    report = {
        "fiscal_year": 2024,
        "income_statement": {},
        "balance_sheet": {},
        "loans": [
            {"lender": "A", "remaining_amount": _field(1_000_000, 0.95), "interest_rate_percent": _field(4.0, 0.95)},
            # No rate at all - must not dilute the average toward a rate of 0.
            {"lender": "B", "remaining_amount": _field(9_000_000, 0.95)},
        ],
    }
    metrics = calculate_metrics(report)
    assert metrics.weighted_average_interest is not None
    # Only loan A contributes to both sides - average must equal its own rate,
    # not (1M*4.0)/(1M+9M) = 0.4, which is what including loan B's amount
    # without its rate would silently produce.
    assert metrics.weighted_average_interest.value == 4.0


def test_weighted_average_interest_ignores_low_confidence_rate():
    report = {
        "fiscal_year": 2024,
        "income_statement": {},
        "balance_sheet": {},
        "loans": [
            {"lender": "A", "remaining_amount": _field(1_000_000, 0.95), "interest_rate_percent": _field(4.0, 0.95)},
            {"lender": "B", "remaining_amount": _field(1_000_000, 0.95), "interest_rate_percent": _field(9.0, 0.50)},
        ],
    }
    metrics = calculate_metrics(report)
    assert metrics.weighted_average_interest.value == 4.0
