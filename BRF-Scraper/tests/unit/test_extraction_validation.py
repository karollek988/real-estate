"""Tests for the extraction safety gate (extractor/validation.py).

financial_extractor.py had zero test coverage before this file. These tests
exist to prevent the specific failure mode this module was built for: a
low-confidence or implausible value quietly reaching the Decision Engine.
"""
from __future__ import annotations

from brf_scraper.extractor.models import ConfidenceTier, Evidence, ExtractedValue, ExtractionResult
from brf_scraper.extractor.validation import (
    confidence_tier,
    verify_apartment_metrics,
    verify_balance_sheet,
    verify_income_statement,
)


def _ev(value, confidence, field="x", page=1) -> ExtractedValue:
    return ExtractedValue(
        value=value,
        unit="SEK",
        evidence=Evidence(page=page, field=field, label="", confidence=confidence, snippet=""),
    )


class TestConfidenceTier:
    def test_high(self):
        assert confidence_tier(0.85) == ConfidenceTier.HIGH
        assert confidence_tier(0.95) == ConfidenceTier.HIGH

    def test_medium(self):
        assert confidence_tier(0.65) == ConfidenceTier.MEDIUM
        assert confidence_tier(0.84) == ConfidenceTier.MEDIUM

    def test_low(self):
        assert confidence_tier(0.64) == ConfidenceTier.LOW
        assert confidence_tier(0.0) == ConfidenceTier.LOW


class TestConfidenceGate:
    def test_low_confidence_value_is_never_verified_even_if_plausible(self):
        section = {"revenue": _ev(2_000_000, confidence=0.65, field="revenue")}
        reports = verify_income_statement(section)
        assert reports["revenue"].verified is False
        assert "0.65" in reports["revenue"].validation_reason

    def test_high_confidence_plausible_value_is_verified(self):
        section = {"revenue": _ev(2_000_000, confidence=0.90, field="revenue")}
        reports = verify_income_statement(section)
        assert reports["revenue"].verified is True


class TestPlausibilityBounds:
    def test_implausibly_large_value_is_rejected(self):
        # e.g. a concatenated/OCR-corrupted number
        section = {"total_assets": _ev(4.85e17, confidence=0.90, field="total_assets")}
        reports = verify_balance_sheet(section)
        assert reports["total_assets"].verified is False
        assert "outside the plausible range" in reports["total_assets"].validation_reason

    def test_implausibly_tiny_nonzero_value_is_rejected(self):
        # e.g. a page number or footnote marker mistaken for the real figure
        section = {"current_assets": _ev(28.0, confidence=0.90, field="current_assets")}
        reports = verify_balance_sheet(section)
        assert reports["current_assets"].verified is False

    def test_legitimate_zero_is_not_penalized_for_magnitude(self):
        section = {
            "total_assets": _ev(5_000_000, confidence=0.90),
            "total_equity": _ev(1_000_000, confidence=0.90),
            "total_liabilities": _ev(4_000_000, confidence=0.90),
            "short_term_debt": _ev(0, confidence=0.90),
        }
        reports = verify_balance_sheet(section)
        assert reports["short_term_debt"].verified is True


class TestCrossFieldIdentity:
    def test_balance_sheet_that_does_not_balance_discards_all_three(self):
        section = {
            "total_assets": _ev(10_000_000, confidence=0.90),
            "total_equity": _ev(1_000_000, confidence=0.90),
            "total_liabilities": _ev(1_200_000, confidence=0.90),  # should be ~9M
        }
        reports = verify_balance_sheet(section)
        assert reports["total_assets"].verified is False
        assert reports["total_equity"].verified is False
        assert reports["total_liabilities"].verified is False

    def test_balance_sheet_within_tolerance_is_verified(self):
        section = {
            "total_assets": _ev(10_000_000, confidence=0.90),
            "total_equity": _ev(4_000_000, confidence=0.90),
            "total_liabilities": _ev(6_000_000, confidence=0.90),
        }
        reports = verify_balance_sheet(section)
        assert reports["total_assets"].verified is True
        assert reports["total_equity"].verified is True
        assert reports["total_liabilities"].verified is True

    def test_long_term_debt_exceeding_total_liabilities_is_rejected(self):
        section = {
            "total_liabilities": _ev(1_000_000, confidence=0.90),
            "long_term_debt": _ev(5_000_000, confidence=0.90),
        }
        reports = verify_balance_sheet(section)
        assert reports["long_term_debt"].verified is False

    def test_income_statement_identity_violation_discards_all_three(self):
        section = {
            "revenue": _ev(5_000_000, confidence=0.90),
            "operating_costs": _ev(4_000_000, confidence=0.90),
            "operating_profit": _ev(9_000_000, confidence=0.90),  # should be ~1M
        }
        reports = verify_income_statement(section)
        assert reports["revenue"].verified is False
        assert reports["operating_costs"].verified is False
        assert reports["operating_profit"].verified is False


class TestDuplicateValueDetection:
    def test_two_distinct_fields_sharing_a_value_are_both_discarded(self):
        # e.g. parking_spaces and garage_spaces both extracted as "2011" -
        # almost certainly the same stray year leaking into two keywords.
        section = {
            "parking_spaces": _ev(2011, confidence=0.90, field="parking_spaces"),
            "garage_spaces": _ev(2011, confidence=0.90, field="garage_spaces"),
        }
        reports = verify_apartment_metrics(section)
        assert reports["parking_spaces"].verified is False
        assert reports["garage_spaces"].verified is False

    def test_distinct_values_are_unaffected(self):
        section = {
            "parking_spaces": _ev(12, confidence=0.90, field="parking_spaces"),
            "garage_spaces": _ev(8, confidence=0.90, field="garage_spaces"),
        }
        reports = verify_apartment_metrics(section)
        assert reports["parking_spaces"].verified is True
        assert reports["garage_spaces"].verified is True


class TestExtractionResultVerifiedAccessors:
    def _result_with(self, income_statement, verification) -> ExtractionResult:
        result = ExtractionResult(pdf_path="test.pdf", is_text_based=True)
        result.income_statement = income_statement
        result.verification = verification
        return result

    def test_verified_income_statement_excludes_unverified_fields(self):
        from brf_scraper.extractor.models import FieldVerification

        income_statement = {
            "revenue": _ev(5_000_000, confidence=0.90, field="revenue"),
            "operating_costs": _ev(3, confidence=0.55, field="operating_costs"),
        }
        verification = {
            "income_statement.revenue": FieldVerification(
                field="revenue", value=5_000_000, confidence=0.90,
                tier=ConfidenceTier.HIGH, verified=True, validation_reason="ok",
            ),
            "income_statement.operating_costs": FieldVerification(
                field="operating_costs", value=3, confidence=0.55,
                tier=ConfidenceTier.LOW, verified=False, validation_reason="low confidence",
            ),
        }
        result = self._result_with(income_statement, verification)

        assert set(result.verified_income_statement.keys()) == {"revenue"}
        assert result.has_verified_financial_data is True

    def test_no_verified_fields_means_insufficient_verified_data(self):
        from brf_scraper.extractor.models import FieldVerification

        income_statement = {"revenue": _ev(3, confidence=0.55, field="revenue")}
        verification = {
            "income_statement.revenue": FieldVerification(
                field="revenue", value=3, confidence=0.55,
                tier=ConfidenceTier.LOW, verified=False, validation_reason="low confidence",
            ),
        }
        result = self._result_with(income_statement, verification)

        assert result.has_verified_financial_data is False
        profile_financials = result.to_profile_financials()
        assert profile_financials["verification_status"] == "insufficient_verified_data"
        assert profile_financials["income_statement"] == {}
