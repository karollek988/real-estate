"""Tests for extractor/key_figures.py — the reviewer's prefill of the mandatory key figures."""
from __future__ import annotations

from pathlib import Path

import pytest

from brf_scraper.extractor.key_figures import (
    extract_key_figures,
    extract_statements,
    key_figures_payload,
)

HSB_TABLE = """Brf Exempel 5 (20)
Flerårsöversikt
Nyckeltal 2024 2023 2022 2021 2020
Sparande, kr/kvm 165 331 237 232 241
Skuldsättning, kr/kvm 6 332 4 539 4 571 4 603 3 957
Skuldsättning bostadsrättsyta, kr/kvm 6 618 4 735 4 769 4 802 4 128
Räntekänslighet, % 6 4 5 5 5
Energikostnad, kr/kvm 256 248 245 241 186
Årsavgifter, kr/kvm 1 118 1 090 942 928 892
Årsavgifter/totala intäkter, % 91 92 93 93 93
Soliditet, % 14 17 15 13 13
"""

WRAPPED_TABLE = """Flerårsöversikt (tkr) 2023/24 2022/23 2021/22 2020/21
Nettoomsättning 10 299 10 084 9 487 9 452
Soliditet (%) 83,93 83,49 83,06 82,62
Årsavgift per kvm upplåten med
bostadsrätt (kr/kvm) 680 648 617 617
Skuldsättning per kvm (kr/kvm) 5 799 5 991 6 183 6 373
Skuldsättning per kvm upplåten
med bostadsrätt (kr/kvm) 6 135 6 339 6 542 6 743
Sparande per kvm (kr/kvm) 217 287 209 283
Räntekänslighet (%) 9,02 9,79 10,61 10,93
Energikostnad per kvm (kr/kvm) 171 162 152 132
Årsavgifternas andel i % av totala
rörelseintäkter 81,11 78,89 79,87 80,16
"""


def _values(text: str, page: int = 5) -> dict[str, float]:
    return {k: v.value for k, v in extract_key_figures([(page, text)]).items()}


def test_reads_the_newest_year_with_thousands_separators():
    v = _values(HSB_TABLE)
    assert v == {
        "savingsPerSqm": 165,
        "debtPerSqmTotal": 6332,
        "debtPerSqmBr": 6618,
        "interestSensitivityPct": 6,
        "energyCostPerSqm": 256,
        "annualFeePerSqm": 1118,
        "feeShareOfRevenuePct": 91,
        "equityRatioPct": 14,
    }


def test_reads_labels_wrapped_over_two_lines_and_decimal_commas():
    v = _values(WRAPPED_TABLE)
    assert v["annualFeePerSqm"] == 680
    assert v["debtPerSqmTotal"] == 5799
    assert v["debtPerSqmBr"] == 6135
    assert v["interestSensitivityPct"] == pytest.approx(9.02)
    assert v["feeShareOfRevenuePct"] == pytest.approx(81.11)
    assert v["equityRatioPct"] == pytest.approx(83.93)


def test_a_newer_figure_with_fewer_years_than_the_header_is_still_read():
    # New key figures often have only one or two years in a four-year table.
    text = "Nyckeltal 2024 2023 2022 2021\nSoliditet % 58 55 48 48\nSparande per kvm kr 188 159\nRäntekänslighet 3,6% 3,8%\n"
    v = _values(text)
    assert v["savingsPerSqm"] == 188
    assert v["interestSensitivityPct"] == pytest.approx(3.6)


def test_base_fee_rows_are_not_taken_for_the_total_fee():
    text = (
        "Nyckeltal 2024 2023 2022 2021\n"
        "Grundårsavgift bostadsrätter kr/kvm 795 738 685 669\n"
        "Årsavgift (grundavgift) per kvm upplåten med bostadsrätt kr 547 545 520 500\n"
        "Årsavgift (total) per kvm upplåten med bostadsrätt kr 575 573\n"
    )
    assert _values(text)["annualFeePerSqm"] == 575


def test_the_table_page_beats_a_stray_number_in_prose():
    prose = "Sparande\nLågt < 100 kr\nEtt sparande behövs för att Högt > 300\n"
    found = extract_key_figures([(2, prose), (10, HSB_TABLE)])
    assert found["savingsPerSqm"].value == 165
    assert found["savingsPerSqm"].page == 10


def test_implausible_or_unreadable_rows_are_skipped():
    # A fee per kvm of 935 833 kr is not a fee: the row must split into plausible years or not be read at all.
    text = "Årsavgifter, kr/kvm 935833\nRäntekänslighet, % 450\n"
    assert _values(text) == {}


def test_fiscal_year_comes_from_the_table_header_and_a_broken_year_counts_as_its_end_year():
    payload = key_figures_payload([(6, WRAPPED_TABLE)], fiscal_year=None)
    assert payload["values"]["fiscalYear"] == 2024
    assert "s. 6:" in payload["evidence"]["annualFeePerSqm"]


def test_statements_about_the_association_itself():
    text = (
        "Föreningen är ett privatbostadsföretag enligt inkomstskattelagen. "
        "Föreningen innehar fastigheten med tomträtt. "
        "Föreningen har en aktuell underhållsplan. "
        "Styrelsen har beslutat att höja årsavgiften med 3,0 % från 2025-01-01."
    )
    s = extract_statements(text, fiscal_year=2024)
    assert s == {
        "isGenuine": True,
        "landTenure": "leasehold",
        "hasMaintenancePlan": True,
        "feeChangePct": 3.0,
        "feeChangeEffective": "2025-01-01",
    }


def test_glossary_text_is_not_read_as_a_statement_and_past_fee_changes_are_ignored():
    text = (
        "Ordlista. Oäkta förening: en förening som inte är ett privatbostadsföretag. "
        "Årsavgiften höjs med 10 % från 2024-01-01."
    )
    assert extract_statements(text, fiscal_year=2024) == {}


def test_negated_genuine_statement():
    assert extract_statements("Föreningen är inte ett privatbostadsföretag.", 2024) == {"isGenuine": False}


# ── The real 2024 annual reports in validation_reports/ (skipped when absent) ──

REPORTS = Path(__file__).resolve().parents[3] / "validation_reports"

EXPECTED = {
    "Brf_Essinge_Malarstrand_2024.pdf": {"annualFeePerSqm": 680, "debtPerSqmBr": 6135, "savingsPerSqm": 217, "interestSensitivityPct": 9.02, "fiscalYear": 2024},
    "HSB_Hagaborg_2024.pdf": {"annualFeePerSqm": 779, "debtPerSqmBr": 2008, "savingsPerSqm": 249, "interestSensitivityPct": 2.6, "feeChangePct": 3.0},
    "HSB_Kvillebacken_2024.pdf": {"annualFeePerSqm": 1118, "debtPerSqmBr": 6618, "savingsPerSqm": 165, "energyCostPerSqm": 256},
    "HSB_Peralbinshem_2024.pdf": {"annualFeePerSqm": 803, "debtPerSqmBr": 1888, "savingsPerSqm": 260, "interestSensitivityPct": 2},
    "MBF_Viksang_2024.pdf": {"annualFeePerSqm": 575, "debtPerSqmBr": 797, "savingsPerSqm": 180, "interestSensitivityPct": 1.4},
}


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_real_annual_reports(name):
    path = REPORTS / name
    if not path.exists():
        pytest.skip(f"{name} not available")
    from brf_scraper.extractor.financial_extractor import _detect_fiscal_year
    from brf_scraper.extractor.pdf_reader import read_pdf

    doc = read_pdf(str(path), max_pages=50)
    values = key_figures_payload([(p.page_number, p.text) for p in doc.pages], _detect_fiscal_year(doc))["values"]
    for key, expected in EXPECTED[name].items():
        assert values.get(key) == pytest.approx(expected), key
