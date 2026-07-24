"""Verification for the "evidence-based reasoning engine" sprint.

reasoning.py must never evaluate, recommend, judge, predict, or overstate
certainty (see reasoning.py's module docstring). This module verifies that
in two ways:

  1. Branch-level unit tests that construct Signal/CalculatedMetrics objects
     directly, so every branch of generate_observations() is exercised with
     an exact, known SignalStrength combination rather than reverse-engineered
     from raw financial figures.
  2. A banned-pattern scan (mirroring frontend/src/lib/report/
     build.objectivity.verify.mjs's BANNED_PATTERNS for the TypeScript report
     layer) run over full generate_report() output for several realistic
     annual-report fixtures - the "generate several real reports and verify"
     step, automated and repeatable.
"""
from __future__ import annotations

import re

import pytest
from calculator import CalculatedField, CalculatedMetrics, calculate_metrics
from reasoning import (
    INTEREST_COVERAGE_RANGES,
    Finding,
    FindingClassification,
    Severity,
    Signal,
    SignalStrength,
    _classify,
    compute_verdict,
    generate_findings,
    generate_observations,
    generate_recommendations,
    run_reasoning,
)
from report import generate_report

# ─── Banned patterns ──────────────────────────────────────────────────────
# Same category of check as the TS report layer's BANNED_PATTERNS, adapted
# to this module's own known-bad vocabulary (the sprint brief's explicit
# ban list, plus every subjective/advisory/predictive phrase the pre-sprint
# code actually used).
BANNED_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"stark ekonomi", r"svag ekonomi", r"sund ekonomi", r"god ekonomi",
        r"\bbra\b", r"\bdålig\w*", r"köpvärd", r"olämplig",
        r"rekommenderas", r"\bbör\b", r"\bmåste\b",
        r"stöder (ett |)köp", r"talar för (ett |)köp", r"\bundvik\b",
        r"\btänk efter\b", r"är trolig", r"är sannolik",
        r"\bbe styrelsen\b", r"\bfråga styrelsen\b", r"\bkontrollera\b",
        r"\bbedöm\b", r"kan inte ges", r"\bansträngd\b", r"\bhanterbar\b",
    ]
]

ALLOWED_VERDICTS = {
    "Otillräckligt dataunderlag",
    "Begränsat dataunderlag för en tillförlitlig sammanställning",
    "Flera kritiska observationer",
    "Flera kritiska och väsentliga observationer",
    "En kritisk observation",
    "Flera väsentliga observationer",
    "Väsentlig observation identifierad",
    "Flera mindre observationer",
    "Inga väsentliga svagheter identifierade",
}


def _assert_clean(text: str, where: str) -> None:
    for pattern in BANNED_PATTERNS:
        match = pattern.search(text)
        assert match is None, f"banned pattern {pattern.pattern!r} found in {where}: {text!r}"


def _field(value: float, computed: bool = True) -> CalculatedField:
    return CalculatedField(value=value, unit="x", formula="f", inputs=[], input_values=[1.0], computed=computed)


def _signal(metric: str, value: float, strength: SignalStrength, confidence: float = 1.0) -> Signal:
    return Signal(metric=metric, value=value, strength=strength, threshold_description="d", confidence=confidence)


# ─── Branch-level coverage: every SignalStrength combination ─────────────

FINANCIAL_HEALTH_CASES = [
    ("both positive", SignalStrength.STRONG_POSITIVE, SignalStrength.POSITIVE),
    ("negative margin", SignalStrength.POSITIVE, SignalStrength.STRONG_NEGATIVE),
    ("low equity", SignalStrength.WEAK_NEGATIVE, SignalStrength.WEAK_POSITIVE),
    ("middling", SignalStrength.WEAK_POSITIVE, SignalStrength.WEAK_POSITIVE),
]


@pytest.mark.parametrize("label,eq_strength,om_strength", FINANCIAL_HEALTH_CASES)
def test_financial_health_observation_is_clean_and_traceable(label, eq_strength, om_strength):
    metrics = CalculatedMetrics(fiscal_year=2025)
    signals = [
        _signal("equity_ratio", 0.42, eq_strength),
        _signal("operating_margin", 0.08, om_strength),
    ]
    observations = generate_observations(signals, metrics)
    obs = next(o for o in observations if o.dimension == "financial_health")
    _assert_clean(obs.statement, f"financial_health ({label})")
    assert obs.is_fact is True
    assert "2025" in obs.statement
    assert any(ch.isdigit() for ch in obs.statement)


def test_classify_below_lowest_threshold_falls_into_the_worst_bucket_not_unknown():
    """Regression test for a real bug this sprint's verification step
    caught: a negative interest_coverage ratio (operating loss - the
    ratio's numerator is negative) is below INTEREST_COVERAGE_RANGES'
    lowest threshold (0.0) and must classify as STRONG_NEGATIVE, same as
    the worst labeled bucket - not UNKNOWN, which previously let
    generate_findings() drop it from the negative signal count entirely
    and misclassify the finding as a "strength"."""
    strength, description = _classify(-0.83, INTEREST_COVERAGE_RANGES)
    assert strength == SignalStrength.STRONG_NEGATIVE
    assert description == "critical (<0.5)"


def test_finding_with_a_below_floor_negative_signal_is_never_a_strength():
    """Before the _classify() fix, this exact combination (interest_coverage
    below every threshold, the other two signals positive) classified as
    FindingClassification.STRENGTH - a -0.83x interest coverage ratio
    labeled a "strength" in a customer-facing report. It must now count as
    the negative signal it is: MIXED (one negative signal alongside two
    genuinely positive ones), never STRENGTH."""
    metrics = CalculatedMetrics(fiscal_year=2025)
    signals = [
        _signal("interest_coverage", -0.83, SignalStrength.STRONG_NEGATIVE),
        _signal("debt_per_apartment", 233_333, SignalStrength.POSITIVE),
        _signal("short_term_debt_ratio", 0.146, SignalStrength.POSITIVE),
    ]
    observations = generate_observations(signals, metrics)
    findings = generate_findings(observations, signals)
    debt_finding = next(f for f in findings if f.dimension == "debt_sustainability")
    assert debt_finding.classification == FindingClassification.MIXED


DEBT_CASES = [
    ("weak coverage", SignalStrength.STRONG_NEGATIVE, SignalStrength.STRONG_POSITIVE),
    ("high debt/apt", SignalStrength.STRONG_POSITIVE, SignalStrength.WEAK_NEGATIVE),
    ("both fine", SignalStrength.POSITIVE, SignalStrength.POSITIVE),
]


@pytest.mark.parametrize("label,ic_strength,da_strength", DEBT_CASES)
def test_debt_sustainability_observation_is_clean_and_traceable(label, ic_strength, da_strength):
    metrics = CalculatedMetrics(fiscal_year=2024)
    signals = [
        _signal("interest_coverage", 1.2, ic_strength),
        _signal("debt_per_apartment", 300_000, da_strength),
    ]
    observations = generate_observations(signals, metrics)
    obs = next(o for o in observations if o.dimension == "debt_sustainability")
    _assert_clean(obs.statement, f"debt_sustainability ({label})")
    assert obs.is_fact is True
    assert "2024" in obs.statement


@pytest.mark.parametrize("strength", list(SignalStrength))
def test_fee_analysis_observation_is_clean_for_every_strength(strength):
    metrics = CalculatedMetrics(fiscal_year=2023)
    signals = [_signal("fee_sustainability", 0.75, strength)]
    observations = generate_observations(signals, metrics)
    obs = next(o for o in observations if o.dimension == "fee_analysis")
    _assert_clean(obs.statement, f"fee_analysis ({strength})")
    # Must describe fee vs. per-apartment income, never claim it's about
    # operating-cost coverage - calculator.py's formula never looks at
    # operating costs for this ratio.
    assert "driftkostnad" not in obs.statement.lower()
    assert "intäkt per lägenhet" in obs.statement


@pytest.mark.parametrize("strength", list(SignalStrength))
def test_liquidity_observation_is_clean_for_every_strength_including_the_gap_bucket(strength):
    """WEAK_POSITIVE ("tight, 1-3 months") previously matched no branch at
    all and silently produced no observation - it must now produce one,
    same as every other bucket."""
    metrics = CalculatedMetrics(fiscal_year=2022)
    signals = [_signal("liquidity_months", 2.0, strength)]
    observations = generate_observations(signals, metrics)
    assert len(observations) == 1, f"liquidity_months={strength} produced no observation"
    obs = observations[0]
    _assert_clean(obs.statement, f"liquidity ({strength})")


def test_confidence_note_appears_only_when_confidence_is_below_one():
    metrics = CalculatedMetrics(fiscal_year=2025)
    full_confidence = [_signal("liquidity_months", 4.0, SignalStrength.POSITIVE, confidence=1.0)]
    reduced_confidence = [_signal("liquidity_months", 4.0, SignalStrength.POSITIVE, confidence=0.5)]

    obs_full = generate_observations(full_confidence, metrics)[0]
    obs_reduced = generate_observations(reduced_confidence, metrics)[0]

    assert "Baserat på tillgängliga uppgifter" not in obs_full.statement
    assert "Baserat på tillgängliga uppgifter" in obs_reduced.statement


# ─── Recommendations: must always be empty ────────────────────────────────

def test_generate_recommendations_is_always_empty():
    findings = [
        Finding(dimension="financial_health", classification=FindingClassification.STRENGTH, summary="x"),
        Finding(dimension="debt_sustainability", classification=FindingClassification.WEAKNESS,
                severity=Severity.SIGNIFICANT, summary="y"),
        Finding(dimension="fee_analysis", classification=FindingClassification.WEAKNESS, summary="z"),
        Finding(dimension="liquidity", classification=FindingClassification.WEAKNESS, summary="w"),
    ]
    assert generate_recommendations(findings) == []
    assert generate_recommendations([]) == []


# ─── Verdict: labels are score-pattern descriptors, never buy/avoid ──────

@pytest.mark.parametrize("confidence", [0.1, 0.29, 0.3, 0.4, 0.49, 0.5, 0.6, 0.9, 1.0])
@pytest.mark.parametrize(
    "findings",
    [
        [],
        [Finding(dimension="financial_health", classification=FindingClassification.STRENGTH, summary="s")],
        [Finding(dimension="debt_sustainability", classification=FindingClassification.WEAKNESS,
                  severity=Severity.SIGNIFICANT, summary="s")],
        [Finding(dimension="liquidity", classification=FindingClassification.WEAKNESS,
                  severity=Severity.CRITICAL, summary="s"),
         Finding(dimension="fee_analysis", classification=FindingClassification.WEAKNESS,
                  severity=Severity.CRITICAL, summary="s")],
    ],
)
def test_verdict_label_is_always_in_the_allowed_evidence_based_set(findings, confidence):
    result = compute_verdict(findings, confidence)
    assert result["verdict"] in ALLOWED_VERDICTS, f"unexpected verdict label: {result['verdict']!r}"
    _assert_clean(result["verdict"], "verdict label")
    _assert_clean(result["summary"], "verdict summary")


# ─── Integration: generate several real reports end-to-end ───────────────

def _sek_field(value: float, confidence: float = 0.95) -> dict:
    return {"value": value, "unit": "SEK", "source": {"confidence": confidence}}


def _annual_report(*, revenue, op_costs, fin_costs, total_assets, total_equity,
                    total_liabilities, lt_debt, st_debt, cash, n_apt, avg_fee,
                    fiscal_year=2025) -> dict:
    op_profit = revenue - op_costs
    return {
        "fiscal_year": fiscal_year,
        "pdf": {"path": "test.pdf", "hash": "", "size_bytes": 0},
        "extraction_confidence": 0.9,
        "income_statement": {
            "revenue": _sek_field(revenue), "operating_costs": _sek_field(op_costs),
            "operating_profit": _sek_field(op_profit), "financial_costs": _sek_field(fin_costs),
        },
        "balance_sheet": {
            "total_assets": _sek_field(total_assets), "total_equity": _sek_field(total_equity),
            "total_liabilities": _sek_field(total_liabilities), "long_term_debt": _sek_field(lt_debt),
            "short_term_debt": _sek_field(st_debt), "cash_and_bank": _sek_field(cash),
        },
        "apartment_metrics": {
            "number_of_apartments": _sek_field(n_apt), "avg_monthly_fee": _sek_field(avg_fee, confidence=0.9),
        },
        "loans": [],
        "missing_fields": [],
    }


REAL_REPORT_FIXTURES = {
    "strong": _annual_report(
        revenue=3_000_000, op_costs=2_500_000, fin_costs=100_000,
        total_assets=10_000_000, total_equity=6_000_000, total_liabilities=4_000_000,
        lt_debt=3_600_000, st_debt=400_000, cash=1_200_000, n_apt=40, avg_fee=6_500,
    ),
    "weak_equity_and_margin": _annual_report(
        revenue=2_000_000, op_costs=2_150_000, fin_costs=180_000,
        total_assets=9_000_000, total_equity=800_000, total_liabilities=8_200_000,
        lt_debt=7_000_000, st_debt=1_200_000, cash=80_000, n_apt=30, avg_fee=3_000,
    ),
    "weak_interest_coverage": _annual_report(
        revenue=2_500_000, op_costs=2_150_000, fin_costs=1_000_000,
        total_assets=10_000_000, total_equity=5_500_000, total_liabilities=4_500_000,
        lt_debt=4_000_000, st_debt=500_000, cash=600_000, n_apt=35, avg_fee=6_000,
    ),
    "high_debt_per_apartment": _annual_report(
        revenue=2_600_000, op_costs=2_000_000, fin_costs=150_000,
        total_assets=20_000_000, total_equity=6_800_000, total_liabilities=13_200_000,
        lt_debt=13_000_000, st_debt=200_000, cash=700_000, n_apt=20, avg_fee=7_000,
    ),
    "tight_liquidity_gap_bucket": _annual_report(
        revenue=2_600_000, op_costs=2_200_000, fin_costs=140_000,
        total_assets=10_500_000, total_equity=5_800_000, total_liabilities=4_700_000,
        lt_debt=4_000_000, st_debt=700_000, cash=280_000, n_apt=32, avg_fee=5_200,
    ),
}


@pytest.mark.parametrize("name", REAL_REPORT_FIXTURES)
def test_generated_report_has_no_banned_language(name):
    report_data = REAL_REPORT_FIXTURES[name]
    extracted = {
        "brf": {
            "name": f"BRF Testexempel ({name})", "organization_number": "769600-0000",
            "municipality": "Stockholm", "number_of_apartments": report_data["apartment_metrics"]["number_of_apartments"]["value"],
        },
        "annual_reports": [report_data],
    }
    metrics = calculate_metrics(report_data)
    reasoning = run_reasoning(metrics)

    assert reasoning.recommendations == []

    report_text = generate_report(extracted, metrics, reasoning)
    _assert_clean(report_text, f"full report ({name})")

    # No "§ 9. REKOMMENDATIONER" section when there are no recommendations.
    assert "REKOMMENDATIONER" not in report_text

    # Every observation statement must be traceable: it must appear
    # verbatim in the report (proves generate_report() didn't rewrite or
    # drop it) and must be tagged FAKTUM now that nothing is a value
    # judgment (see generate_observations()'s docstring).
    for obs in reasoning.observations:
        assert obs.statement in report_text
        assert obs.is_fact is True


def test_no_two_observations_produce_the_same_statement_text():
    """No duplicated explanations: each dimension's statement must be
    distinguishable from the others within one report."""
    for name, report_data in REAL_REPORT_FIXTURES.items():
        metrics = calculate_metrics(report_data)
        reasoning = run_reasoning(metrics)
        statements = [o.statement for o in reasoning.observations]
        assert len(statements) == len(set(statements)), f"duplicate observation text in fixture {name!r}"
