"""Coverage report for BRF profiles.

Tracks which data fields are populated for each analyzed property,
enabling data-driven prioritization of improvements.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from brf_scraper.profile.models import BRFProfile, SourcedValue


def _has(sv: SourcedValue | None) -> bool:
    """Check if a SourcedValue has a non-empty value."""
    if sv is None:
        return False
    if sv.value is None:
        return False
    if isinstance(sv.value, str) and sv.value.strip() == "":
        return False
    return True


class FieldCoverage(BaseModel):
    """Coverage status for a single field."""

    field: str
    category: str
    populated: bool
    value: Any = None
    source: str | None = None
    confidence: float | None = None


class PropertyCoverage(BaseModel):
    """Coverage report for a single property."""

    # Property identity
    hemnet_url: str | None = None
    brf_name: str | None = None
    address: str | None = None
    municipality: str | None = None

    # Source availability
    hemnet_found: bool = False
    booli_matched: bool = False
    allabrf_matched: bool = False
    official_website_found: bool = False

    # Document coverage
    annual_reports_found: int = 0
    statutes_found: int = 0
    maintenance_info_found: bool = False

    # Field coverage
    fields: list[FieldCoverage] = Field(default_factory=list)

    # Scores
    overall_coverage: float = 0.0
    overall_confidence: float = 0.0

    # Errors
    errors: list[str] = Field(default_factory=list)

    # Missing fields grouped by category
    missing_fields: dict[str, list[str]] = Field(default_factory=dict)


def generate_coverage_report(
    profile: BRFProfile,
    hemnet_url: str | None = None,
) -> PropertyCoverage:
    """Generate a coverage report from a BRFProfile.

    Args:
        profile: The merged BRF profile.
        hemnet_url: Original Hemnet URL if available.

    Returns:
        PropertyCoverage with field-level coverage tracking.
    """
    report = PropertyCoverage(
        hemnet_url=hemnet_url,
        brf_name=profile.brf.name.value if _has(profile.brf.name) else None,
        address=profile.brf.address.value if _has(profile.brf.address) else None,
        municipality=profile.brf.municipality.value if _has(profile.brf.municipality) else None,
    )

    # Source availability
    sources = profile.meta.get("sources_queried", []) if isinstance(profile.meta, dict) else []
    report.hemnet_found = "hemnet" in sources
    report.booli_matched = "booli" in sources
    report.allabrf_matched = "allabrf" in sources
    report.official_website_found = "official_website" in sources

    # Document coverage
    for doc in profile.documents:
        if doc.doc_type == "annual_report":
            report.annual_reports_found += 1
        elif doc.doc_type == "bylaw":
            report.statutes_found += 1
        elif doc.doc_type == "maintenance_plan":
            report.maintenance_info_found = True

    # Errors
    if isinstance(profile.meta, dict):
        report.errors = profile.meta.get("errors", [])

    # Field coverage tracking
    all_fields: list[FieldCoverage] = []
    confidence_values: list[float] = []

    # ── IDENTITY ─────────────────────────────────────────────────────
    identity_fields = [
        ("name", profile.brf.name),
        ("organization_number", profile.brf.organization_number),
        ("municipality", profile.brf.municipality),
        ("county", profile.brf.county),
        ("address", profile.brf.address),
        ("postal_code", profile.brf.postal_code),
        ("website_url", profile.brf.website_url),
        ("founding_year", profile.brf.founding_year),
    ]
    for field_name, sv in identity_fields:
        populated = _has(sv)
        fc = FieldCoverage(
            field=field_name,
            category="identity",
            populated=populated,
            value=sv.value if populated else None,
            source=sv.sources[0] if populated and sv.sources else None,
            confidence=sv.confidence if populated else None,
        )
        all_fields.append(fc)
        if populated and sv.confidence:
            confidence_values.append(sv.confidence)

    # ── APARTMENTS ───────────────────────────────────────────────────
    apt_fields = [
        ("owner_occupied", profile.apartments.owner_occupied),
        ("rental", profile.apartments.rental),
        ("commercial", profile.apartments.commercial),
        ("avg_monthly_fee", profile.apartments.avg_monthly_fee),
    ]
    for field_name, sv in apt_fields:
        populated = _has(sv)
        fc = FieldCoverage(
            field=field_name,
            category="apartments",
            populated=populated,
            value=sv.value if populated else None,
            source=sv.sources[0] if populated and sv.sources else None,
            confidence=sv.confidence if populated else None,
        )
        all_fields.append(fc)
        if populated and sv.confidence:
            confidence_values.append(sv.confidence)

    # ── PROPERTY ─────────────────────────────────────────────────────
    prop_fields = [
        ("year_built", profile.property.year_built),
        ("building_area_sqm", profile.property.building_area_sqm),
        ("residential_area_sqm", profile.property.residential_area_sqm),
        ("commercial_area_sqm", profile.property.commercial_area_sqm),
        ("energy_class", profile.property.energy_class),
        ("land_ownership", profile.property.land_ownership),
        ("renovation_history", profile.property.renovation_history),
    ]
    for field_name, sv in prop_fields:
        populated = _has(sv)
        fc = FieldCoverage(
            field=field_name,
            category="property",
            populated=populated,
            value=sv.value if populated else None,
            source=sv.sources[0] if populated and sv.sources else None,
            confidence=sv.confidence if populated else None,
        )
        all_fields.append(fc)
        if populated and sv.confidence:
            confidence_values.append(sv.confidence)

    # ── PERSONNEL ────────────────────────────────────────────────────
    personnel_fields = [
        ("property_manager", profile.personnel.property_manager),
        ("technical_manager", profile.personnel.technical_manager),
        ("chairman", profile.personnel.chairman),
        ("vice_chairman", profile.personnel.vice_chairman),
        ("treasurer", profile.personnel.treasurer),
        ("secretary", profile.personnel.secretary),
        ("auditor", profile.personnel.auditor),
        ("auditor_firm", profile.personnel.auditor_firm),
    ]
    for field_name, sv in personnel_fields:
        populated = _has(sv)
        fc = FieldCoverage(
            field=field_name,
            category="personnel",
            populated=populated,
            value=sv.value if populated else None,
            source=sv.sources[0] if populated and sv.sources else None,
            confidence=sv.confidence if populated else None,
        )
        all_fields.append(fc)
        if populated and sv.confidence:
            confidence_values.append(sv.confidence)

    # ── FINANCIALS ───────────────────────────────────────────────────
    fin = profile.financials
    financial_fields = [
        ("fiscal_year", fin.fiscal_year is not None, fin.fiscal_year, None, None),
        ("income_statement", bool(fin.income_statement), None, "financials", None),
        ("balance_sheet", bool(fin.balance_sheet), None, "financials", None),
        ("loans", bool(fin.loans), len(fin.loans) if fin.loans else 0, "financials", None),
    ]
    for field_name, populated, value, source, conf in financial_fields:
        fc = FieldCoverage(
            field=field_name,
            category="financials",
            populated=populated,
            value=value,
            source=source,
            confidence=conf,
        )
        all_fields.append(fc)

    # ── DOCUMENTS ────────────────────────────────────────────────────
    doc_fields = [
        ("annual_reports", report.annual_reports_found > 0, report.annual_reports_found, "allabrf", None),
        ("statutes", report.statutes_found > 0, report.statutes_found, "allabrf", None),
        ("maintenance_info", report.maintenance_info_found, None, "allabrf", None),
    ]
    for field_name, populated, value, source, conf in doc_fields:
        fc = FieldCoverage(
            field=field_name,
            category="documents",
            populated=populated,
            value=value,
            source=source,
            confidence=conf,
        )
        all_fields.append(fc)

    report.fields = all_fields

    # Calculate scores
    total = len(all_fields)
    populated_count = sum(1 for f in all_fields if f.populated)
    report.overall_coverage = populated_count / total if total > 0 else 0.0
    report.overall_confidence = (
        sum(confidence_values) / len(confidence_values) if confidence_values else 0.0
    )

    # Group missing fields by category
    missing: dict[str, list[str]] = {}
    for fc in all_fields:
        if not fc.populated:
            missing.setdefault(fc.category, []).append(fc.field)
    report.missing_fields = missing

    return report
