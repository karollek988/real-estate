"""Unit tests for models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from brf_scraper.models import (
    BRF,
    AnnualReport,
    BRFType,
    FinancialData,
    ReportStatus,
)


class TestBRF:
    """Tests for BRF model."""

    def test_create_brf(self, sample_brf: BRF) -> None:
        """Test BRF creation."""
        assert sample_brf.name == "Test BRF"
        assert sample_brf.organization_number == "1234567890"
        assert sample_brf.brf_type == BRFType.BOSTADSRATTSFORENING

    def test_brf_defaults(self) -> None:
        """Test BRF default values."""
        brf = BRF(name="Test")
        assert brf.id is not None
        assert brf.created_at is not None
        assert brf.metadata == {}

    def test_invalid_org_number(self) -> None:
        """Test invalid organization number."""
        with pytest.raises(ValidationError):
            BRF(name="Test", organization_number="123")

    def test_org_number_with_dashes(self) -> None:
        """Test organization number with dashes is cleaned."""
        brf = BRF(name="Test", organization_number="1234-5678-90")
        assert brf.organization_number == "1234567890"


class TestAnnualReport:
    """Tests for AnnualReport model."""

    def test_create_report(self, sample_annual_report: AnnualReport) -> None:
        """Test annual report creation."""
        assert sample_annual_report.year == 2023
        assert sample_annual_report.status == ReportStatus.DOWNLOADED

    def test_invalid_year(self) -> None:
        """Test invalid year."""
        with pytest.raises(ValidationError):
            AnnualReport(brf_id="00000000-0000-0000-0000-000000000000", year=1800)


class TestFinancialData:
    """Tests for FinancialData model."""

    def test_create_financial_data(self, sample_financial_data: FinancialData) -> None:
        """Test financial data creation."""
        assert sample_financial_data.revenue == 1_500_000.0
        assert sample_financial_data.year == 2023

    def test_financial_data_defaults(self) -> None:
        """Test financial data default values."""
        data = FinancialData(
            report_id="00000000-0000-0000-0000-000000000000",
            year=2023,
        )
        assert data.revenue is None
        assert data.metadata == {}
