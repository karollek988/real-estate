"""Unified BRF Profile models.

Every field is wrapped in ``SourcedValue`` which tracks which provider(s)
supplied the value, the confidence, and when it was last updated.

The analysis engine must consume only ``BRFProfile`` — never raw provider output.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Sourced value wrapper ────────────────────────────────────────────

class SourcedValue(BaseModel):
    """A value with full provenance tracking."""

    value: Any
    unit: str | None = None
    sources: list[str] = Field(default_factory=list)
    confidence: float = 1.0
    last_updated: str | None = None


class ApartmentListing(BaseModel):
    """One apartment in the BRF (typically from Booli)."""

    designation: str | None = None
    address: str | None = None
    area_sqm: float | None = None
    rooms: float | None = None
    floor: int | None = None
    monthly_fee: float | None = None
    source: str = ""


class LoanInfo(BaseModel):
    """A single loan from the annual report."""

    lender: str = ""
    original_amount: SourcedValue | None = None
    remaining_amount: SourcedValue | None = None
    interest_rate_percent: SourcedValue | None = None
    maturity_date: str | None = None
    amortization_required: bool = False
    source: str = ""


class DocumentInfo(BaseModel):
    """A document found on Allabrf or the official website."""

    title: str
    doc_type: str  # annual_report, bylaw, certificate, economic_plan, other
    year: int | None = None
    url: str | None = None
    downloadable: bool = False
    source: str = ""


# ── Sub-profiles ─────────────────────────────────────────────────────

class BRFIdentity(BaseModel):
    """Identity fields for the BRF."""

    name: SourcedValue | None = None
    organization_number: SourcedValue | None = None
    brf_type: SourcedValue | None = None
    municipality: SourcedValue | None = None
    county: SourcedValue | None = None
    address: SourcedValue | None = None
    postal_code: SourcedValue | None = None
    website_url: SourcedValue | None = None
    founding_year: SourcedValue | None = None


class BRFApartments(BaseModel):
    """Apartment count and details."""

    owner_occupied: SourcedValue | None = None
    rental: SourcedValue | None = None
    commercial: SourcedValue | None = None
    avg_monthly_fee: SourcedValue | None = None
    units: list[ApartmentListing] = Field(default_factory=list)


class BRFProperty(BaseModel):
    """Physical property information."""

    year_built: SourcedValue | None = None
    building_area_sqm: SourcedValue | None = None
    residential_area_sqm: SourcedValue | None = None
    commercial_area_sqm: SourcedValue | None = None
    land_ownership: SourcedValue | None = None
    energy_class: SourcedValue | None = None
    renovation_history: SourcedValue | None = None


class BRFPersonnel(BaseModel):
    """People and organisations managing the BRF."""

    property_manager: SourcedValue | None = None
    technical_manager: SourcedValue | None = None
    chairman: SourcedValue | None = None
    vice_chairman: SourcedValue | None = None
    treasurer: SourcedValue | None = None
    secretary: SourcedValue | None = None
    auditor: SourcedValue | None = None
    auditor_firm: SourcedValue | None = None


class BRFFinancials(BaseModel):
    """Financial data from the latest annual report.

    Structure matches what the analysis engine expects.
    """

    fiscal_year: int | None = None
    income_statement: dict[str, Any] = Field(default_factory=dict)
    balance_sheet: dict[str, Any] = Field(default_factory=dict)
    apartment_metrics: dict[str, Any] = Field(default_factory=dict)
    loans: list[LoanInfo] = Field(default_factory=list)
    property_info: dict[str, Any] = Field(default_factory=dict)
    source: str = ""
    extraction_confidence: float = 0.0

    # "ok": at least one income_statement/balance_sheet field passed
    # validation (see extractor/validation.py). "insufficient_verified_data":
    # a PDF was found and extracted but nothing survived validation - the
    # BRF analyzer must degrade gracefully rather than score from nothing.
    # "unknown": no extraction has run yet (distinct from "not_connected",
    # which is when there's no annual report at all - see
    # frontend/.../providers/brfFinancials.ts).
    verification_status: str = "unknown"


# ── Top-level profile ────────────────────────────────────────────────

class BRFProfile(BaseModel):
    """The single canonical profile for a BRF.

    Built by ``ProfileEngine`` from Hemnet + Booli + Allabrf + official website.
    The analysis engine consumes only this object.
    """

    brf: BRFIdentity = Field(default_factory=BRFIdentity)
    apartments: BRFApartments = Field(default_factory=BRFApartments)
    property: BRFProperty = Field(default_factory=BRFProperty)
    personnel: BRFPersonnel = Field(default_factory=BRFPersonnel)
    financials: BRFFinancials = Field(default_factory=BRFFinancials)
    documents: list[DocumentInfo] = Field(default_factory=list)

    meta: dict[str, Any] = Field(default_factory=lambda: {
        "sources_queried": [],
        "profile_confidence": 0.0,
        "built_at": datetime.now().isoformat(),
    })

    # ── Convenience accessors for the analysis engine ─────────────

    def get(self, section: str, field: str) -> Any:
        """Get a sourced value's raw value by section.field path."""
        obj = getattr(self, section, None)
        if obj is None:
            return None
        sv = getattr(obj, field, None)
        if isinstance(sv, SourcedValue):
            return sv.value
        return sv

    def to_analysis_input(self) -> dict[str, Any]:
        """Convert to the dict format the existing analysis engine expects.

        This is a bridge — new code should consume BRFProfile directly.
        """
        f = self.financials
        apt = self.apartments
        prop = self.property

        result: dict[str, Any] = {
            "fiscal_year": f.fiscal_year or 0,
            "income_statement": f.income_statement,
            "balance_sheet": f.balance_sheet,
            "apartment_metrics": dict(f.apartment_metrics),
            "loans": [],
            "property_info": dict(f.property_info),
            "pdf": {"path": f.source or "profile", "hash": "", "size_bytes": 0},
            "extraction_confidence": f.extraction_confidence,
            "verification_status": f.verification_status,
        }

        # Fill apartment count from profile if not in financials
        n = apt.owner_occupied.value if apt.owner_occupied else None
        if n and "number_of_apartments" not in result["apartment_metrics"]:
            result["apartment_metrics"]["number_of_apartments"] = {
                "value": n, "unit": "count",
                "source": {"page": 0, "field": "number_of_apartments",
                           "method": "profile", "confidence": 1.0},
            }

        avg_fee = apt.avg_monthly_fee.value if apt.avg_monthly_fee else None
        if avg_fee and "avg_monthly_fee" not in result["apartment_metrics"]:
            result["apartment_metrics"]["avg_monthly_fee"] = {
                "value": avg_fee, "unit": "SEK/month",
                "source": {"page": 0, "field": "avg_monthly_fee",
                           "method": "profile", "confidence": 1.0},
            }

        # Property info from profile
        yb = prop.year_built.value if prop.year_built else None
        if yb and "year_built" not in result["property_info"]:
            result["property_info"]["year_built"] = {
                "value": yb, "unit": "year",
                "source": {"page": 0, "field": "year_built",
                           "method": "profile", "confidence": 0.9},
            }
        ba = prop.building_area_sqm.value if prop.building_area_sqm else None
        if ba and "building_area_sqm" not in result["property_info"]:
            result["property_info"]["building_area_sqm"] = {
                "value": ba, "unit": "m²",
                "source": {"page": 0, "field": "building_area_sqm",
                           "method": "profile", "confidence": 0.9},
            }

        # Loans
        for loan in f.loans:
            result["loans"].append({
                "lender": loan.lender,
                "remaining_amount": {
                    "value": loan.remaining_amount.value,
                    "unit": "SEK",
                    "source": {"page": 0, "field": "remaining_amount",
                               "method": "profile", "confidence": 0.9},
                } if loan.remaining_amount else None,
                "interest_rate_percent": {
                    "value": loan.interest_rate_percent.value,
                    "unit": "%",
                    "source": {"page": 0, "field": "interest_rate_percent",
                               "method": "profile", "confidence": 0.9},
                } if loan.interest_rate_percent else None,
                "maturity_date": loan.maturity_date,
                "amortization_required": loan.amortization_required,
            })

        return result

    def to_brf_dict(self) -> dict[str, Any]:
        """Convert BRF identity to the dict the report generator expects."""
        return {
            "name": self.brf.name.value if self.brf.name else "",
            "organization_number": self.brf.organization_number.value if self.brf.organization_number else "",
            "municipality": self.brf.municipality.value if self.brf.municipality else "",
            "number_of_apartments": (
                self.apartments.owner_occupied.value
                if self.apartments.owner_occupied else 0
            ),
            "number_of_commercial": (
                self.apartments.commercial.value
                if self.apartments.commercial else 0
            ),
        }
