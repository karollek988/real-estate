"""The safety boundary between raw PDF extraction and the Decision Engine.

Every value financial_extractor.py produces already carries a confidence
score — but before this module, nothing downstream ever checked it. A
0.65-confidence guess ("number two lines below the keyword") flowed into
equity ratios exactly like a 0.90-confidence table match. This module closes
that gap.

Rule: correct data > missing data > incorrect data. A field that fails a
check here is discarded — never repaired, never silently passed through.
Only HIGH-tier, cross-validated fields are ever marked `verified`, and only
`verified` fields may reach calculate_metrics() (see
extract_annual_report()'s `.verification` and `to_profile_financials()`,
and analysis_engine/calculator.py's own confidence gate for defense in
depth).
"""
from __future__ import annotations

from datetime import date

from .models import ConfidenceTier, ExtractedValue, FieldVerification

HIGH_CONFIDENCE = 0.85
MEDIUM_CONFIDENCE = 0.65

# Slack allowed before a cross-field identity check is considered violated.
# Real annual reports round to whole kronor and sometimes fold small items
# together, so exact equality is too strict; anything beyond this is treated
# as "the wrong number was picked up", not "reasonable rounding".
BALANCE_IDENTITY_TOLERANCE = 0.15
INCOME_IDENTITY_TOLERANCE = 0.20


def confidence_tier(confidence: float) -> ConfidenceTier:
    if confidence >= HIGH_CONFIDENCE:
        return ConfidenceTier.HIGH
    if confidence >= MEDIUM_CONFIDENCE:
        return ConfidenceTier.MEDIUM
    return ConfidenceTier.LOW


# Plausible [min, max] ranges per field. A value outside its range is not
# "unusual", it is evidence of OCR corruption, a merged multi-year number,
# or a keyword match that landed on the wrong line/column entirely.
INCOME_STATEMENT_BOUNDS: dict[str, tuple[float, float]] = {
    "revenue": (10_000, 200_000_000),
    "operating_costs": (10_000, 200_000_000),
    "operating_profit": (-100_000_000, 100_000_000),
    "financial_income": (0, 20_000_000),
    "financial_costs": (0, 50_000_000),
    "profit_before_tax": (-100_000_000, 100_000_000),
    "profit_after_tax": (-100_000_000, 100_000_000),
}

BALANCE_SHEET_BOUNDS: dict[str, tuple[float, float]] = {
    "total_assets": (100_000, 5_000_000_000),
    "current_assets": (0, 500_000_000),
    "fixed_assets": (0, 5_000_000_000),
    "total_equity": (-500_000_000, 5_000_000_000),
    "total_liabilities": (0, 5_000_000_000),
    "long_term_debt": (0, 5_000_000_000),
    "short_term_debt": (0, 500_000_000),
    "cash_and_bank": (0, 200_000_000),
}

APARTMENT_BOUNDS: dict[str, tuple[float, float]] = {
    "number_of_apartments": (1, 3000),
    "number_of_rental": (0, 3000),
    "number_of_commercial": (0, 500),
    "avg_monthly_fee": (500, 30_000),
    "parking_spaces": (0, 3000),
    "garage_spaces": (0, 3000),
    "storage_units": (0, 3000),
}

PROPERTY_BOUNDS: dict[str, tuple[float, float]] = {
    "building_area_sqm": (10, 200_000),
    "residential_area_sqm": (10, 200_000),
    "commercial_area_sqm": (0, 200_000),
    "year_built": (1800, date.today().year + 1),
}

LOAN_BOUNDS: dict[str, tuple[float, float]] = {
    "remaining_amount": (1_000, 2_000_000_000),
    "interest_rate_percent": (0.01, 15.0),
}

# A value that is technically inside its [min, max] range can still be
# nonsense: "operating_profit: 10 SEK" or "current_assets: 28 SEK" are
# almost certainly a page number, footnote marker, or stray digit fragment
# rather than real BRF financials — a real line item is either exactly
# zero (a legitimate value for several of these) or at least a few
# thousand kronor. Fields not listed here allow any in-bounds magnitude
# (e.g. apartment/parking counts, where small integers are normal).
MIN_MAGNITUDE_SEK = 1_000
FIELDS_REQUIRING_MAGNITUDE_OR_ZERO = frozenset({
    "operating_profit", "financial_income", "financial_costs",
    "profit_before_tax", "profit_after_tax",
    "current_assets", "fixed_assets", "cash_and_bank", "short_term_debt",
})


def _out_of_bounds(value: object, bounds: tuple[float, float]) -> bool:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    lo, hi = bounds
    return not (lo <= value <= hi)


def _verify_section(
    section: dict[str, ExtractedValue],
    bounds: dict[str, tuple[float, float]],
) -> dict[str, FieldVerification]:
    reports: dict[str, FieldVerification] = {}
    for field, ev in section.items():
        tier = confidence_tier(ev.evidence.confidence)
        verified = True
        reason = "ok"

        if tier != ConfidenceTier.HIGH:
            verified = False
            reason = (
                f"confidence {ev.evidence.confidence:.2f} is {tier.value}, below the "
                f"{HIGH_CONFIDENCE:.2f} threshold required to influence scoring"
            )
        elif field in bounds and _out_of_bounds(ev.value, bounds[field]):
            verified = False
            lo, hi = bounds[field]
            reason = f"value {ev.value} is outside the plausible range [{lo}, {hi}] for {field}"
        elif (
            field in FIELDS_REQUIRING_MAGNITUDE_OR_ZERO
            and isinstance(ev.value, (int, float))
            and not isinstance(ev.value, bool)
            and ev.value != 0
            and abs(ev.value) < MIN_MAGNITUDE_SEK
        ):
            verified = False
            reason = (
                f"value {ev.value} is implausibly small for {field} — a real BRF figure "
                f"is either exactly 0 or at least {MIN_MAGNITUDE_SEK} SEK; this looks like "
                f"a page number, footnote marker, or stray digit fragment"
            )

        reports[field] = FieldVerification(
            field=field,
            value=ev.value,
            confidence=ev.evidence.confidence,
            tier=tier,
            verified=verified,
            evidence_snippet=ev.evidence.snippet,
            validation_reason=reason,
        )
    return reports


def _flag_duplicate_values(reports: dict[str, FieldVerification]) -> None:
    """Two distinct line items sharing the exact same value almost never
    happens in a real statement — it is far more likely the same number was
    picked up twice by different keywords (a column shift, or a keyword
    matching the wrong line). Downgrades every field involved in place."""
    by_value: dict[float, list[str]] = {}
    for field, r in reports.items():
        if not r.verified or not isinstance(r.value, (int, float)):
            continue
        by_value.setdefault(r.value, []).append(field)

    for value, fields in by_value.items():
        if len(fields) < 2:
            continue
        for field in fields:
            r = reports[field]
            others = [f for f in fields if f != field]
            r.verified = False
            r.validation_reason = (
                f"value {value} is identical to {others} in the same statement — "
                f"likely a column shift or the same number matched twice"
            )


def verify_income_statement(section: dict[str, ExtractedValue]) -> dict[str, FieldVerification]:
    """Field-level bounds + income statement identity: revenue - operating_costs ~= operating_profit."""
    reports = _verify_section(section, INCOME_STATEMENT_BOUNDS)
    _flag_duplicate_values(reports)

    revenue = reports.get("revenue")
    costs = reports.get("operating_costs")
    profit = reports.get("operating_profit")
    if revenue and costs and profit and revenue.verified and costs.verified and profit.verified:
        expected = revenue.value - costs.value
        actual = profit.value
        tolerance = max(abs(expected), abs(actual), 1) * INCOME_IDENTITY_TOLERANCE
        if abs(expected - actual) > tolerance:
            reason = (
                f"income statement does not add up: revenue({revenue.value:,.0f}) - "
                f"operating_costs({costs.value:,.0f}) = {expected:,.0f}, but "
                f"operating_profit is {actual:,.0f} — one of these three was "
                f"misattributed"
            )
            for r in (revenue, costs, profit):
                r.verified = False
                r.validation_reason = reason
    return reports


def verify_balance_sheet(section: dict[str, ExtractedValue]) -> dict[str, FieldVerification]:
    """Field-level bounds + balance sheet identity: assets == equity + liabilities,
    and long_term_debt + short_term_debt <= total_liabilities."""
    reports = _verify_section(section, BALANCE_SHEET_BOUNDS)
    _flag_duplicate_values(reports)

    assets = reports.get("total_assets")
    equity = reports.get("total_equity")
    liabilities = reports.get("total_liabilities")
    if assets and equity and liabilities and assets.verified and equity.verified and liabilities.verified:
        expected = equity.value + liabilities.value
        actual = assets.value
        tolerance = max(abs(expected), abs(actual), 1) * BALANCE_IDENTITY_TOLERANCE
        if abs(expected - actual) > tolerance:
            reason = (
                f"balance sheet does not balance: total_equity({equity.value:,.0f}) + "
                f"total_liabilities({liabilities.value:,.0f}) = {expected:,.0f}, but "
                f"total_assets is {actual:,.0f} — assets, equity, or liabilities was "
                f"extracted from the wrong line or column"
            )
            for r in (assets, equity, liabilities):
                r.verified = False
                r.validation_reason = reason

    lt_debt = reports.get("long_term_debt")
    st_debt = reports.get("short_term_debt")
    if lt_debt and liabilities and lt_debt.verified and liabilities.verified:
        st_value = st_debt.value if (st_debt and st_debt.verified) else 0
        combined = lt_debt.value + st_value
        if combined > liabilities.value * (1 + BALANCE_IDENTITY_TOLERANCE):
            lt_debt.verified = False
            lt_debt.validation_reason = (
                f"long_term_debt({lt_debt.value:,.0f}) plus short_term_debt({st_value:,.0f}) "
                f"exceeds total_liabilities({liabilities.value:,.0f}) — long_term_debt was "
                f"likely extracted from the wrong line"
            )
    return reports


def verify_apartment_metrics(section: dict[str, ExtractedValue]) -> dict[str, FieldVerification]:
    reports = _verify_section(section, APARTMENT_BOUNDS)
    _flag_duplicate_values(reports)
    return reports


def verify_property_info(section: dict[str, ExtractedValue]) -> dict[str, FieldVerification]:
    return _verify_section(section, PROPERTY_BOUNDS)


def verify_loan(loan: dict[str, ExtractedValue]) -> dict[str, FieldVerification]:
    return _verify_section(loan, LOAN_BOUNDS)
