"""Bridge between BRFProfile and the analysis engine.

Converts profile data (from scraping) + user-provided manual financial data
into the format expected by the calculation engine.
"""

from __future__ import annotations

from typing import Any

from brf_scraper.profile.models import BRFProfile, SourcedValue


def _val(sv: Any) -> Any:
    """Extract raw value from SourcedValue or pass through plain values."""
    if sv is None:
        return None
    if isinstance(sv, SourcedValue):
        return sv.value
    return sv


def _wrap(val: Any, source: str = "profile") -> dict[str, Any] | None:
    """Wrap a value in the {"value": ..., "source": {...}} format the report expects."""
    if val is None:
        return None
    return {"value": val, "source": {"method": source, "confidence": 0.9}}


def profile_to_analysis_input(
    profile: BRFProfile,
    manual_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Convert BRFProfile + manual financial data to analysis engine input.

    The analysis engine expects a dict like sample_annual_report.json:
    {
        "brf": {"name": "...", "org_number": "..."},
        "annual_reports": [{
            "fiscal_year": 2024,
            "income_statement": {...},
            "balance_sheet": {...},
            "apartment_metrics": {...},
            "property_info": {...},
            "loans": [...]
        }]
    }

    Profile provides: brf identity, apartment count, monthly fee, year built, address.
    Manual data provides: financial statements, loans, etc.

    Returns:
        Dict ready for calculate_metrics().
    """
    manual = manual_data or {}

    # BRF identity from profile
    brf_info: dict[str, Any] = {}
    if profile.brf:
        brf_info["name"] = _val(profile.brf.name) or "Okand BRF"
        brf_info["organization_number"] = _val(profile.brf.organization_number) or ""
        brf_info["address"] = _val(profile.brf.address) or ""
        brf_info["municipality"] = _val(profile.brf.municipality) or ""
        brf_info["postal_code"] = _val(profile.brf.postal_code) or ""
        brf_info["number_of_apartments"] = _val(profile.apartments.owner_occupied) if profile.apartments else 0

    # Apartment metrics from profile
    apt_metrics: dict[str, Any] = {}
    if profile.apartments:
        apt_metrics["number_of_apartments"] = _val(profile.apartments.owner_occupied)
        apt_metrics["avg_monthly_fee"] = _val(profile.apartments.avg_monthly_fee)

    # Property info from profile
    prop_info: dict[str, Any] = {}
    if profile.property:
        yb = _wrap(_val(profile.property.year_built))
        if yb:
            prop_info["year_built"] = yb
        ba = _wrap(_val(profile.property.building_area_sqm))
        if ba:
            prop_info["building_area_sqm"] = ba
        ec = _wrap(_val(profile.property.energy_class))
        if ec:
            prop_info["energy_class"] = ec

    # Merge manual data on top (manual takes precedence)
    if "apartment_metrics" in manual:
        apt_metrics.update(manual["apartment_metrics"])
    if "property_info" in manual:
        prop_info.update(manual["property_info"])

    # Get fiscal year — default to current year
    fiscal_year = manual.get("fiscal_year", 2024)

    # Build annual report entry
    raw_loans = manual.get("loans", [])
    # Normalize loan format: report expects "lender", "remaining_amount", "interest_rate_percent"
    loans = []
    for loan in raw_loans:
        normalized = dict(loan)
        if "lender" not in normalized and "name" in normalized:
            normalized["lender"] = normalized.pop("name")
        if "remaining_amount" not in normalized and "amount" in normalized:
            amt = normalized.pop("amount")
            normalized["remaining_amount"] = {"value": amt, "unit": "SEK"}
        if "interest_rate_percent" not in normalized and "interest_rate" in normalized:
            rate = normalized.pop("interest_rate")
            normalized["interest_rate_percent"] = {"value": rate * 100 if rate < 1 else rate, "unit": "%"}
        loans.append(normalized)

    annual_report: dict[str, Any] = {
        "fiscal_year": fiscal_year,
        "income_statement": manual.get("income_statement", {}),
        "balance_sheet": manual.get("balance_sheet", {}),
        "apartment_metrics": apt_metrics,
        "property_info": prop_info,
        "loans": loans,
    }

    return {
        "brf": brf_info,
        "annual_reports": [annual_report],
        "metadata": {
            "profile_confidence": _val(profile.meta.get("profile_confidence")) if isinstance(profile.meta, dict) else None,
            "sources": profile.meta.get("sources_queried", []) if isinstance(profile.meta, dict) else [],
        },
    }
