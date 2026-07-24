"""Pydantic models for BRF data."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class BRFType(StrEnum):
    """Type of BRF."""

    BOSTADSRATTSFORENING = "bostadsrättsförening"
    SAMBOSTADSRATTSFORENING = "sambostadsrättsförening"
    KONTORSLOKALSFORBUND = "kontorslokalssförbund"


class ReportStatus(StrEnum):
    """Status of annual report processing."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    EXTRACTING = "extracting"
    EXTRACTED = "extracted"
    FAILED = "failed"


class BRF(BaseModel):
    """Bostadsrättsförening model."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    organization_number: str | None = None
    brf_type: BRFType = BRFType.BOSTADSRATTSFORENING
    website_url: str | None = None
    city: str | None = None
    municipality: str | None = None
    county: str | None = None
    address: str | None = None
    postal_code: str | None = None
    founding_year: int | None = None
    number_of_apartments: int | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("organization_number")
    @classmethod
    def validate_org_number(cls, v: str | None) -> str | None:
        """Validate Swedish organization number format."""
        if v is None:
            return v
        # Remove any dashes or spaces
        cleaned = v.replace("-", "").replace(" ", "")
        if len(cleaned) != 10 or not cleaned.isdigit():
            raise ValueError(f"Invalid organization number: {v}")
        return cleaned


class AnnualReport(BaseModel):
    """Annual report (årsredovisning) model."""

    id: UUID = Field(default_factory=uuid4)
    brf_id: UUID
    year: int
    title: str | None = None
    pdf_url: str | None = None
    pdf_path: str | None = None
    pdf_hash: str | None = None
    pdf_size: int | None = None
    status: ReportStatus = ReportStatus.PENDING
    downloaded_at: datetime | None = None
    extracted_at: datetime | None = None
    extraction_error: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("year")
    @classmethod
    def validate_year(cls, v: int) -> int:
        """Validate report year."""
        current_year = datetime.now().year
        if v < 1900 or v > current_year + 1:
            raise ValueError(f"Invalid year: {v}")
        return v


class FinancialData(BaseModel):
    """Financial data extracted from annual report."""

    id: UUID = Field(default_factory=uuid4)
    report_id: UUID
    year: int

    # Income statement
    revenue: float | None = None
    operating_costs: float | None = None
    operating_profit: float | None = None
    financial_income: float | None = None
    financial_costs: float | None = None
    profit_before_tax: float | None = None
    profit: float | None = None

    # Balance sheet
    total_assets: float | None = None
    current_assets: float | None = None
    fixed_assets: float | None = None
    total_equity: float | None = None
    total_liabilities: float | None = None
    long_term_debt: float | None = None
    short_term_debt: float | None = None

    # Per apartment metrics
    revenue_per_apartment: float | None = None
    cost_per_apartment: float | None = None
    equity_per_apartment: float | None = None
    debt_per_apartment: float | None = None

    # Ratios
    equity_ratio: float | None = None
    debt_ratio: float | None = None
    operating_margin: float | None = None

    # Fees
    monthly_fee_avg: float | None = None
    monthly_fee_min: float | None = None
    monthly_fee_max: float | None = None

    created_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)


class BoardMember(BaseModel):
    """Board member information."""

    id: UUID = Field(default_factory=uuid4)
    report_id: UUID
    name: str
    role: str | None = None
    email: str | None = None
    phone: str | None = None
    since_year: int | None = None


class BoardInfo(BaseModel):
    """Board information from annual report."""

    id: UUID = Field(default_factory=uuid4)
    report_id: UUID
    chairman_name: str | None = None
    vice_chairman_name: str | None = None
    treasurer_name: str | None = None
    secretary_name: str | None = None
    auditor_name: str | None = None
    auditor_firm: str | None = None
    members: list[BoardMember] = Field(default_factory=list)
    board_meetings_count: int | None = None
    annual_meeting_date: date | None = None


class PropertyInfo(BaseModel):
    """Property information."""

    id: UUID = Field(default_factory=uuid4)
    report_id: UUID
    property_name: str | None = None
    property_designation: str | None = None
    year_built: int | None = None
    year_renovated: int | None = None
    building_area_sqm: float | None = None
    land_area_sqm: float | None = None
    number_of_buildings: int | None = None
    energy_class: str | None = None
    location_description: str | None = None


class ExtractionResult(BaseModel):
    """Result of data extraction from PDF."""

    report_id: UUID
    financial_data: FinancialData | None = None
    board_info: BoardInfo | None = None
    property_info: PropertyInfo | None = None
    extraction_notes: list[str] = Field(default_factory=list)
    confidence_score: float | None = None
    raw_text: str | None = None
    extracted_at: datetime = Field(default_factory=datetime.now)
