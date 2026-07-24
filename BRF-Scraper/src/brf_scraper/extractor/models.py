"""Extraction evidence models.

Every extracted value carries provenance: where it came from,
how confident we are, and the original text snippet.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Evidence(BaseModel):
    """Provenance for a single extracted value."""

    page: int = Field(description="1-indexed page number in the PDF")
    field: str = Field(description="Canonical field name (e.g. 'revenue')")
    label: str = Field(description="Original label/heading found in the text")
    method: str = Field(default="pdf_text", description="Extraction method")
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence")
    snippet: str = Field(default="", description="Original text snippet (max 300 chars)")


class ExtractedValue(BaseModel):
    """A single extracted value with evidence."""

    value: float | int | str | bool
    unit: str = ""
    evidence: Evidence


class ConfidenceTier(StrEnum):
    """How much a single extracted value can be trusted.

    Only HIGH may ever reach the Decision Engine (see extractor/validation.py).
    MEDIUM and LOW are kept for audit/debugging but are never scored.
    """

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class FieldVerification(BaseModel):
    """The validation outcome for one extracted field.

    Produced by extractor/validation.py for every field financial_extractor.py
    returns a value for — including ones that get discarded. `verified=False`
    fields are never repaired, only ever kept for audit trail via
    `validation_reason`; the value itself is never mutated here.
    """

    field: str
    value: float | int | str | bool
    confidence: float
    tier: ConfidenceTier
    verified: bool
    evidence_snippet: str = ""
    validation_reason: str


class ExtractionResult(BaseModel):
    """Result of extracting data from a single annual report PDF."""

    pdf_path: str
    fiscal_year: int | None = None
    is_text_based: bool = False
    total_pages: int = 0
    pages_with_text: int = 0

    # Financial data
    income_statement: dict[str, ExtractedValue] = Field(default_factory=dict)
    balance_sheet: dict[str, ExtractedValue] = Field(default_factory=dict)
    apartment_metrics: dict[str, ExtractedValue] = Field(default_factory=dict)
    loans: list[dict[str, ExtractedValue]] = Field(default_factory=list)

    # Property info
    property_info: dict[str, ExtractedValue] = Field(default_factory=dict)

    # Board/personnel
    board: dict[str, ExtractedValue] = Field(default_factory=dict)

    # Missing fields
    missing_fields: list[dict[str, str]] = Field(default_factory=list)

    # Overall metrics
    total_values_extracted: int = 0
    average_confidence: float = 0.0

    # Validation (see extractor/validation.py). Keyed "section.field", e.g.
    # "balance_sheet.total_assets". Populated by extract_annual_report() for
    # every value in income_statement/balance_sheet/apartment_metrics/
    # property_info — including ones later discarded. This is the audit
    # trail: raw extraction above is never filtered or mutated, so a human
    # can always see what was found and why it was or wasn't trusted.
    verification: dict[str, FieldVerification] = Field(default_factory=dict)
    loan_verification: list[dict[str, FieldVerification]] = Field(default_factory=list)

    @property
    def has_financial_data(self) -> bool:
        return bool(self.income_statement or self.balance_sheet)

    @property
    def has_verified_financial_data(self) -> bool:
        """True only if at least one income_statement or balance_sheet
        field survived validation. This — not has_financial_data — is what
        should gate whether the Decision Engine attempts a financial score."""
        return any(
            v.verified
            for key, v in self.verification.items()
            if key.startswith("income_statement.") or key.startswith("balance_sheet.")
        )

    def _verified_section(self, section_name: str, section: dict[str, ExtractedValue]) -> dict[str, ExtractedValue]:
        return {
            field: ev
            for field, ev in section.items()
            if (v := self.verification.get(f"{section_name}.{field}")) is not None and v.verified
        }

    @property
    def verified_income_statement(self) -> dict[str, ExtractedValue]:
        return self._verified_section("income_statement", self.income_statement)

    @property
    def verified_balance_sheet(self) -> dict[str, ExtractedValue]:
        return self._verified_section("balance_sheet", self.balance_sheet)

    @property
    def verified_apartment_metrics(self) -> dict[str, ExtractedValue]:
        return self._verified_section("apartment_metrics", self.apartment_metrics)

    @property
    def verified_property_info(self) -> dict[str, ExtractedValue]:
        return self._verified_section("property_info", self.property_info)

    @property
    def verified_loans(self) -> list[dict[str, ExtractedValue]]:
        verified = []
        for loan, loan_reports in zip(self.loans, self.loan_verification):
            kept = {
                field: ev
                for field, ev in loan.items()
                if (v := loan_reports.get(field)) is not None and v.verified
            }
            if kept:
                verified.append(kept)
        return verified

    def to_profile_financials(self) -> dict:
        """Convert VERIFIED data only to the dict format BRFFinancials/the
        Decision Engine expects. Unverified values are never included here —
        call `.verification` directly for the full audit trail."""
        def _sv_to_dict(ev: ExtractedValue) -> dict:
            return {
                "value": ev.value,
                "unit": ev.unit,
                "source": {
                    "page": ev.evidence.page,
                    "field": ev.evidence.field,
                    "method": ev.evidence.method,
                    "confidence": ev.evidence.confidence,
                },
            }

        result = {
            "fiscal_year": self.fiscal_year,
            "income_statement": {k: _sv_to_dict(v) for k, v in self.verified_income_statement.items()},
            "balance_sheet": {k: _sv_to_dict(v) for k, v in self.verified_balance_sheet.items()},
            "apartment_metrics": {k: _sv_to_dict(v) for k, v in self.verified_apartment_metrics.items()},
            "loans": [{k: _sv_to_dict(v) for k, v in loan.items()} for loan in self.verified_loans],
            "property_info": {k: _sv_to_dict(v) for k, v in self.verified_property_info.items()},
            "source": self.pdf_path,
            "extraction_confidence": self.average_confidence,
            "verification_status": "ok" if self.has_verified_financial_data else "insufficient_verified_data",
        }
        return result
