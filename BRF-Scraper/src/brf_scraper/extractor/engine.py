"""Annual Report Extraction Engine.

Orchestrates PDF reading, financial extraction, property extraction,
and combines results into an ExtractionResult.
"""
from __future__ import annotations

from pathlib import Path

from brf_scraper.utils.logging import get_logger

from .models import ExtractionResult, ExtractedValue
from .pdf_reader import read_pdf, PDFDocument
from .financial_extractor import (
    extract_financial_data,
    extract_apartment_data,
    extract_loan_data,
    _detect_fiscal_year,
)
from .property_extractor import (
    extract_board_members,
    extract_property_details,
)
from .validation import (
    verify_income_statement,
    verify_balance_sheet,
    verify_apartment_metrics,
    verify_property_info,
    verify_loan,
)

logger = get_logger(__name__)


def extract_annual_report(
    pdf_path: str | Path,
    max_pages: int = 50,
) -> ExtractionResult:
    """Extract structured data from a single annual report PDF.

    This is the main entry point for the extraction module.
    """
    pdf_path = str(pdf_path)
    result = ExtractionResult(pdf_path=pdf_path)

    # Step 1: Read PDF text
    doc = read_pdf(pdf_path, max_pages=max_pages)
    result.total_pages = doc.total_pages
    result.is_text_based = doc.is_text_based
    result.pages_with_text = doc.pages_with_text

    if not doc.is_text_based:
        logger.warning("pdf_is_scanned_image", path=pdf_path)
        result.missing_fields.append({
            "field": "all",
            "reason": "PDF is a scanned image; OCR not available",
        })
        return result

    # Step 2: Detect fiscal year
    result.fiscal_year = _detect_fiscal_year(doc)

    # Step 3: Extract financial data
    financial = extract_financial_data(doc)
    apartment = extract_apartment_data(doc)
    loans = extract_loan_data(doc)

    # Map apartment data to income_statement / balance_sheet / apartment_metrics
    income_fields = {
        "revenue", "operating_costs", "operating_profit",
        "financial_income", "financial_costs",
        "profit_before_tax", "profit_after_tax",
    }
    balance_fields = {
        "total_assets", "current_assets", "fixed_assets",
        "total_equity", "total_liabilities",
        "long_term_debt", "short_term_debt", "cash_and_bank",
    }
    apartment_fields = {
        "number_of_apartments", "number_of_rental", "number_of_commercial",
        "avg_monthly_fee", "parking_spaces", "garage_spaces", "storage_units",
    }
    property_fields = {
        "building_area_sqm", "residential_area_sqm", "commercial_area_sqm",
        "year_built", "energy_class", "land_ownership",
    }

    for k, v in financial.items():
        if k in income_fields:
            result.income_statement[k] = v
        elif k in balance_fields:
            result.balance_sheet[k] = v

    for k, v in apartment.items():
        if k in apartment_fields:
            result.apartment_metrics[k] = v
        elif k in property_fields:
            result.property_info[k] = v

    result.loans = loans

    # Step 4: Extract property details (regex-based)
    prop_details = extract_property_details(doc)
    for k, v in prop_details.items():
        if k not in result.property_info:
            result.property_info[k] = v
        # Also fill apartment_metrics from property_details
        if k == "number_of_apartments" and k not in result.apartment_metrics:
            result.apartment_metrics[k] = v

    # Step 5: Extract board members
    board = extract_board_members(doc)
    result.board = board

    # Step 6: Compute missing fields
    all_expected = (
        list(income_fields) + list(balance_fields)
        + list(apartment_fields) + list(property_fields)
    )
    extracted = (
        set(result.income_statement.keys())
        | set(result.balance_sheet.keys())
        | set(result.apartment_metrics.keys())
        | set(result.property_info.keys())
    )

    # Check loan-level fields separately: lender/remaining_amount/interest_rate_percent
    # are only missing if NO loan contains them
    loan_fields = {"lender", "remaining_amount", "interest_rate_percent"}
    loan_fields_found = set()
    for loan in result.loans:
        if isinstance(loan, dict):
            loan_fields_found.update(loan.keys())
    # Remove loan-level fields from all_expected; handle them separately
    all_expected = [f for f in all_expected if f not in loan_fields]

    for field in all_expected:
        if field not in extracted:
            result.missing_fields.append({
                "field": field,
                "reason": "not found in extracted text",
            })

    for field in loan_fields:
        if field not in loan_fields_found:
            result.missing_fields.append({
                "field": field,
                "reason": "not found in extracted loans",
            })

    # Step 7: Compute summary stats
    all_values = (
        list(result.income_statement.values())
        + list(result.balance_sheet.values())
        + list(result.apartment_metrics.values())
        + list(result.property_info.values())
    )
    result.total_values_extracted = len(all_values)
    if all_values:
        result.average_confidence = sum(
            v.evidence.confidence for v in all_values
        ) / len(all_values)

    # Step 8: Validate every extracted value before it can reach the
    # Decision Engine. This never repairs a value or changes what was
    # extracted above — it only decides which of those values are trusted
    # enough to score (see extractor/validation.py and
    # ExtractionResult.verified_* / .to_profile_financials()).
    income_reports = verify_income_statement(result.income_statement)
    balance_reports = verify_balance_sheet(result.balance_sheet)
    apartment_reports = verify_apartment_metrics(result.apartment_metrics)
    property_reports = verify_property_info(result.property_info)

    result.verification = {
        **{f"income_statement.{k}": v for k, v in income_reports.items()},
        **{f"balance_sheet.{k}": v for k, v in balance_reports.items()},
        **{f"apartment_metrics.{k}": v for k, v in apartment_reports.items()},
        **{f"property_info.{k}": v for k, v in property_reports.items()},
    }
    result.loan_verification = [verify_loan(loan) for loan in result.loans]

    all_reports = list(result.verification.values())
    for loan_reports in result.loan_verification:
        all_reports.extend(loan_reports.values())
    discarded = [v for v in all_reports if not v.verified]

    logger.info(
        "annual_report_extracted",
        path=pdf_path,
        fiscal_year=result.fiscal_year,
        values_extracted=result.total_values_extracted,
        confidence=round(result.average_confidence, 2),
        income_fields=len(result.income_statement),
        balance_fields=len(result.balance_sheet),
        apartment_fields=len(result.apartment_metrics),
        loans=len(result.loans),
        board=len(result.board),
        verified_fields=len(all_reports) - len(discarded),
        discarded_fields=len(discarded),
        has_verified_financial_data=result.has_verified_financial_data,
    )
    if discarded:
        logger.warning(
            "extraction_fields_discarded",
            path=pdf_path,
            fields=[{"field": d.field, "reason": d.validation_reason} for d in discarded],
        )

    return result


def extract_multiple_reports(
    pdf_paths: list[str | Path],
    max_pages: int = 50,
) -> list[ExtractionResult]:
    """Extract data from multiple annual report PDFs.

    Returns results sorted by fiscal year (newest first).
    """
    results = []
    for path in pdf_paths:
        try:
            result = extract_annual_report(path, max_pages=max_pages)
            results.append(result)
        except Exception as e:
            logger.error("extraction_failed", path=str(path), error=str(e))

    # Sort by fiscal year (newest first), None last
    results.sort(key=lambda r: r.fiscal_year or 0, reverse=True)
    return results
