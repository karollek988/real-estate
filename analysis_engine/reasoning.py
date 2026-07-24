"""Reasoning engine for BRF financial analysis.

Converts calculated metrics into signals, observations, findings, and recommendations.
Every conclusion is deterministic and traceable back to source data.

No ML. No black boxes. Pure rule-based reasoning.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from calculator import CalculatedField, CalculatedMetrics


class SignalStrength(StrEnum):
    STRONG_POSITIVE = "strong_positive"
    POSITIVE = "positive"
    WEAK_POSITIVE = "weak_positive"
    NEUTRAL = "neutral"
    WEAK_NEGATIVE = "weak_negative"
    NEGATIVE = "negative"
    STRONG_NEGATIVE = "strong_negative"
    UNKNOWN = "unknown"


class FindingClassification(StrEnum):
    STRENGTH = "strength"
    WEAKNESS = "weakness"
    MIXED = "mixed"
    NEUTRAL = "neutral"
    UNKNOWN = "unknown"


class Severity(StrEnum):
    MINOR = "minor"
    MODERATE = "moderate"
    SIGNIFICANT = "significant"
    CRITICAL = "critical"


@dataclass
class Signal:
    metric: str
    value: float | None
    strength: SignalStrength
    threshold_description: str
    source_page: int | None = None
    confidence: float = 0.0


@dataclass
class Observation:
    dimension: str
    statement: str
    is_fact: bool
    signals: list[Signal] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class Finding:
    dimension: str
    classification: FindingClassification
    severity: Severity | None = None
    summary: str = ""
    observations: list[Observation] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class Recommendation:
    category: str
    text: str
    findings: list[Finding] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class ReasoningResult:
    signals: list[Signal]
    observations: list[Observation]
    findings: list[Finding]
    recommendations: list[Recommendation]
    overall_confidence: float


# ─── THRESHOLDS (from knowledge base) ────────────────────────────────────────

EQUITY_RATIO_RANGES = [
    (0.55, SignalStrength.STRONG_POSITIVE, "excellent (>55%)"),
    (0.40, SignalStrength.POSITIVE, "healthy (40-55%)"),
    (0.30, SignalStrength.WEAK_POSITIVE, "adequate (30-40%)"),
    (0.20, SignalStrength.WEAK_NEGATIVE, "caution (20-30%)"),
    (0.10, SignalStrength.NEGATIVE, "concerning (10-20%)"),
    (0.0, SignalStrength.STRONG_NEGATIVE, "critical (<10%)"),
]

OPERATING_MARGIN_RANGES = [
    (0.15, SignalStrength.STRONG_POSITIVE, "strong surplus (>15%)"),
    (0.05, SignalStrength.POSITIVE, "healthy surplus (5-15%)"),
    (0.0, SignalStrength.WEAK_POSITIVE, "marginal (0-5%)"),
    (-0.05, SignalStrength.WEAK_NEGATIVE, "deficit (-5% to 0%)"),
    (-1.0, SignalStrength.STRONG_NEGATIVE, "deep deficit (<-5%)"),
]

INTEREST_COVERAGE_RANGES = [
    (3.0, SignalStrength.STRONG_POSITIVE, "very strong (>3.0)"),
    (1.5, SignalStrength.POSITIVE, "adequate (1.5-3.0)"),
    (1.0, SignalStrength.WEAK_POSITIVE, "tight (1.0-1.5)"),
    (0.5, SignalStrength.WEAK_NEGATIVE, "insufficient (0.5-1.0)"),
    (0.0, SignalStrength.STRONG_NEGATIVE, "critical (<0.5)"),
]

DEBT_PER_APT_RANGES = [
    (800_000, SignalStrength.STRONG_NEGATIVE, "excessive (>800k SEK)"),
    (600_000, SignalStrength.WEAK_NEGATIVE, "very high (600k-800k SEK)"),
    (400_000, SignalStrength.WEAK_POSITIVE, "high (400k-600k SEK)"),
    (200_000, SignalStrength.POSITIVE, "moderate (200k-400k SEK)"),
    (0.0, SignalStrength.STRONG_POSITIVE, "very low (<200k SEK)"),
]

FEE_SUSTAINABILITY_RANGES = [
    (1.2, SignalStrength.STRONG_POSITIVE, "over-funded (>1.2)"),
    (1.0, SignalStrength.POSITIVE, "self-sustaining (1.0-1.2)"),
    (0.8, SignalStrength.WEAK_POSITIVE, "under-funded (0.8-1.0)"),
    (0.6, SignalStrength.WEAK_NEGATIVE, "significantly under-funded (0.6-0.8)"),
    (0.0, SignalStrength.STRONG_NEGATIVE, "severely under-funded (<0.6)"),
]

SHORT_TERM_DEBT_RANGES = [
    (0.45, SignalStrength.STRONG_NEGATIVE, "high (>45%)"),
    (0.30, SignalStrength.WEAK_NEGATIVE, "elevated (30-45%)"),
    (0.15, SignalStrength.WEAK_POSITIVE, "moderate (15-30%)"),
    (0.0, SignalStrength.POSITIVE, "low (<15%)"),
]

LIQUIDITY_RANGES = [
    (6.0, SignalStrength.STRONG_POSITIVE, "very strong (>6 months)"),
    (3.0, SignalStrength.POSITIVE, "adequate (3-6 months)"),
    (1.0, SignalStrength.WEAK_POSITIVE, "tight (1-3 months)"),
    (0.0, SignalStrength.STRONG_NEGATIVE, "critical (<1 month)"),
]


def _classify(value: float | None, ranges: list) -> tuple[SignalStrength, str]:
    """Classify a value against a set of threshold ranges.

    A value below every listed threshold still classifies into the lowest
    (worst) bucket rather than "unclassified" - the ranges describe a
    continuum, so a value below the lowest labeled boundary is further in
    that same direction, not meaningless. This matters in practice: e.g. a
    BRF running an operating loss has a negative interest_coverage ratio,
    which is below INTEREST_COVERAGE_RANGES' lowest threshold (0.0) - it
    must classify as (at least as) negative as "critical (<0.5)", not
    UNKNOWN, or generate_findings()'s positive/negative signal count
    silently drops it from the negative side entirely.
    """
    if value is None:
        return SignalStrength.UNKNOWN, "data not available"
    for threshold, strength, description in ranges:
        if value >= threshold:
            return strength, description
    return ranges[-1][1], ranges[-1][2]


def _min_confidence(fields: list[CalculatedField | None]) -> float:
    """Return the minimum confidence from a list of calculated fields."""
    confidences = []
    for f in fields:
        if f is not None:
            confidences.append(1.0 if f.computed else 0.5)
    return min(confidences) if confidences else 0.0


# ─── STATEMENT FORMATTING ────────────────────────────────────────────────────
# Local to reasoning.py (not shared with report.py's own _fmt) because
# reasoning.py must stay import-free of report.py, which imports reasoning.py.
# Same display conventions as report.py's _fmt for the same units, so a
# number reads identically whether it appears in an observation sentence or
# in the § 4/§ 6 tables.

def _pct(value: float) -> str:
    return f"{value:.1%}"


def _ratio_x(value: float) -> str:
    return f"{value:.2f}x"


def _sek_per_apt(value: float) -> str:
    return f"{value:,.0f} kr/lägenhet".replace(",", " ")


def _months(value: float) -> str:
    return f"{value:.1f} månader"


def _confidence_note(confidence: float) -> str:
    """Flag a statement built from less-than-fully-verified inputs.

    Never let a sentence imply more certainty than the underlying data
    supports (see reasoning.py's module docstring / the objectivity rules
    this module follows).
    """
    return " Baserat på tillgängliga uppgifter." if confidence < 1.0 else ""


# ─── SIGNAL GENERATION ───────────────────────────────────────────────────────

def generate_signals(metrics: CalculatedMetrics) -> list[Signal]:
    """Generate signals from calculated metrics. Pure function."""
    signals = []

    # Equity ratio
    if metrics.equity_ratio:
        strength, desc = _classify(metrics.equity_ratio.value, EQUITY_RATIO_RANGES)
        signals.append(Signal(
            metric="equity_ratio",
            value=metrics.equity_ratio.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.equity_ratio.computed else 0.5,
        ))

    # Operating margin
    if metrics.operating_margin:
        strength, desc = _classify(metrics.operating_margin.value, OPERATING_MARGIN_RANGES)
        signals.append(Signal(
            metric="operating_margin",
            value=metrics.operating_margin.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.operating_margin.computed else 0.5,
        ))

    # Interest coverage
    if metrics.interest_coverage:
        strength, desc = _classify(metrics.interest_coverage.value, INTEREST_COVERAGE_RANGES)
        signals.append(Signal(
            metric="interest_coverage",
            value=metrics.interest_coverage.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.interest_coverage.computed else 0.5,
        ))

    # Debt per apartment
    if metrics.debt_per_apartment:
        strength, desc = _classify(metrics.debt_per_apartment.value, DEBT_PER_APT_RANGES)
        signals.append(Signal(
            metric="debt_per_apartment",
            value=metrics.debt_per_apartment.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.debt_per_apartment.computed else 0.5,
        ))

    # Fee sustainability
    if metrics.fee_sustainability:
        strength, desc = _classify(metrics.fee_sustainability.value, FEE_SUSTAINABILITY_RANGES)
        signals.append(Signal(
            metric="fee_sustainability",
            value=metrics.fee_sustainability.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.fee_sustainability.computed else 0.5,
        ))

    # Short-term debt ratio
    if metrics.short_term_debt_ratio:
        strength, desc = _classify(metrics.short_term_debt_ratio.value, SHORT_TERM_DEBT_RANGES)
        signals.append(Signal(
            metric="short_term_debt_ratio",
            value=metrics.short_term_debt_ratio.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.short_term_debt_ratio.computed else 0.5,
        ))

    # Liquidity
    if metrics.liquidity_months:
        strength, desc = _classify(metrics.liquidity_months.value, LIQUIDITY_RANGES)
        signals.append(Signal(
            metric="liquidity_months",
            value=metrics.liquidity_months.value,
            strength=strength,
            threshold_description=desc,
            confidence=1.0 if metrics.liquidity_months.computed else 0.5,
        ))

    return signals


# ─── OBSERVATION GENERATION ──────────────────────────────────────────────────

def generate_observations(signals: list[Signal], metrics: CalculatedMetrics) -> list[Observation]:
    """Generate observations from signals. Pure function.

    Every statement states the figures a signal is built from rather than
    characterizing them — no adjective in this function is allowed to say
    more than the numbers themselves do. Where a general, non-BRF-specific
    explanation helps interpret a figure (e.g. what higher debt generally
    implies), it's stated as general knowledge, never as a judgment about
    this specific association. is_fact is True throughout because nothing
    here does more than restate a computed number and, where applicable,
    generic financial context.
    """
    observations = []
    signal_map = {s.metric: s for s in signals}
    year = metrics.fiscal_year

    # Financial health
    eq = signal_map.get("equity_ratio")
    om = signal_map.get("operating_margin")
    if eq and om:
        confidence = min(eq.confidence, om.confidence)
        if eq.strength in (SignalStrength.STRONG_POSITIVE, SignalStrength.POSITIVE) and \
           om.strength in (SignalStrength.STRONG_POSITIVE, SignalStrength.POSITIVE):
            statement = (
                f"Föreningen redovisar en soliditet på {_pct(eq.value)} och ett rörelseresultat på "
                f"{_pct(om.value)} av intäkterna, enligt årsredovisningen för räkenskapsåret {year}."
            )
        elif om.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.STRONG_NEGATIVE):
            statement = (
                f"Föreningen redovisar ett rörelseresultat på {_pct(om.value)} av intäkterna för "
                f"räkenskapsåret {year}, det vill säga ett underskott enligt den senaste tillgängliga "
                f"årsredovisningen."
            )
        elif eq.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.NEGATIVE, SignalStrength.STRONG_NEGATIVE):
            statement = (
                f"Föreningen redovisar en soliditet på {_pct(eq.value)} enligt årsredovisningen för "
                f"räkenskapsåret {year}. Lägre soliditet innebär generellt mindre ekonomisk marginal vid "
                f"oväntade kostnader."
            )
        else:
            statement = (
                f"Föreningen redovisar en soliditet på {_pct(eq.value)} och ett rörelseresultat på "
                f"{_pct(om.value)} av intäkterna, enligt årsredovisningen för räkenskapsåret {year}."
            )
        observations.append(Observation(
            dimension="financial_health",
            statement=statement + _confidence_note(confidence),
            is_fact=True,
            signals=[eq, om],
            confidence=confidence,
        ))

    # Debt sustainability
    ic = signal_map.get("interest_coverage")
    da = signal_map.get("debt_per_apartment")
    sd = signal_map.get("short_term_debt_ratio")
    if ic and da:
        confidence = min(ic.confidence, da.confidence)
        related = [ic, da] + ([sd] if sd else [])
        if ic.strength in (SignalStrength.STRONG_NEGATIVE, SignalStrength.WEAK_NEGATIVE):
            statement = (
                f"Räntetäckningsgraden är {_ratio_x(ic.value)} (rörelseresultat i relation till "
                f"finanskostnader) för räkenskapsåret {year}, det vill säga rörelseresultatet täcker inte "
                f"räntekostnaderna fullt ut. Skulden per lägenhet uppgår till {_sek_per_apt(da.value)}."
            )
        elif da.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.STRONG_NEGATIVE):
            statement = (
                f"Skulden per lägenhet uppgår till {_sek_per_apt(da.value)} enligt årsredovisningen för "
                f"räkenskapsåret {year}. Räntetäckningsgraden är {_ratio_x(ic.value)}. Högre skuldsättning "
                f"innebär generellt större känslighet för framtida ränteförändringar."
            )
        else:
            statement = (
                f"Skulden per lägenhet uppgår till {_sek_per_apt(da.value)} och räntetäckningsgraden är "
                f"{_ratio_x(ic.value)}, enligt årsredovisningen för räkenskapsåret {year}."
            )
        observations.append(Observation(
            dimension="debt_sustainability",
            statement=statement + _confidence_note(confidence),
            is_fact=True,
            signals=related,
            confidence=confidence,
        ))

    # Fee analysis. fee_sustainability is avg_monthly_fee / (revenue per
    # apartment per month) — the fee measured against the association's own
    # per-apartment income, not against operating costs (calculator.py has
    # no cost_per_apartment-based fee ratio) — so the statement below
    # describes exactly that comparison and nothing more. All three former
    # signal-strength branches collapsed to one: once the subjective framing
    # ("täcker inte driftkostnaderna", "ger marginal", "inte akut") is
    # removed, they rendered the same sentence with different numbers.
    fs = signal_map.get("fee_sustainability")
    if fs:
        statement = (
            f"Föreningens genomsnittliga avgift motsvarar {_pct(fs.value)} av föreningens genomsnittliga "
            f"intäkt per lägenhet och månad, enligt årsredovisningen för räkenskapsåret {year}."
        )
        observations.append(Observation(
            dimension="fee_analysis",
            statement=statement + _confidence_note(fs.confidence),
            is_fact=True,
            signals=[fs],
            confidence=fs.confidence,
        ))

    # Liquidity. Only the critical (<1 month) bucket gets a distinct
    # sentence — the direct, computable consequence of that figure. Every
    # other bucket (including the previously-unhandled "tight (1-3 months)"
    # WEAK_POSITIVE case, which fell through all branches and silently
    # produced no observation at all) states the same figure plainly.
    liq = signal_map.get("liquidity_months")
    if liq:
        if liq.strength == SignalStrength.STRONG_NEGATIVE:
            statement = (
                f"Likviditeten uppgår till {_months(liq.value)} enligt årsredovisningen för "
                f"räkenskapsåret {year}, det vill säga mindre än en månads rörelsekostnader i kassa och "
                f"bank."
            )
        else:
            statement = (
                f"Likviditeten uppgår till {_months(liq.value)} enligt årsredovisningen för "
                f"räkenskapsåret {year}."
            )
        observations.append(Observation(
            dimension="liquidity",
            statement=statement + _confidence_note(liq.confidence),
            is_fact=True,
            signals=[liq],
            confidence=liq.confidence,
        ))

    return observations


# ─── FINDING GENERATION ──────────────────────────────────────────────────────

def generate_findings(observations: list[Observation], signals: list[Signal]) -> list[Finding]:
    """Generate findings from observations. Pure function."""
    findings = []
    signal_map = {s.metric: s for s in signals}

    # Financial health finding
    fh_obs = [o for o in observations if o.dimension == "financial_health"]
    if fh_obs:
        obs = fh_obs[0]
        positive_count = sum(
            1 for s in obs.signals
            if s.strength in (SignalStrength.STRONG_POSITIVE, SignalStrength.POSITIVE)
        )
        negative_count = sum(
            1 for s in obs.signals
            if s.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.NEGATIVE, SignalStrength.STRONG_NEGATIVE)
        )
        if positive_count > 0 and negative_count == 0:
            classification = FindingClassification.STRENGTH
        elif negative_count > 0 and positive_count == 0:
            classification = FindingClassification.WEAKNESS
        elif positive_count > 0 and negative_count > 0:
            classification = FindingClassification.MIXED
        else:
            classification = FindingClassification.NEUTRAL

        findings.append(Finding(
            dimension="financial_health",
            classification=classification,
            summary=obs.statement,
            observations=[obs],
            confidence=obs.confidence,
        ))

    # Debt sustainability finding
    ds_obs = [o for o in observations if o.dimension == "debt_sustainability"]
    if ds_obs:
        obs = ds_obs[0]
        negative_count = sum(
            1 for s in obs.signals
            if s.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.NEGATIVE, SignalStrength.STRONG_NEGATIVE)
        )
        positive_count = sum(
            1 for s in obs.signals
            if s.strength in (SignalStrength.STRONG_POSITIVE, SignalStrength.POSITIVE)
        )
        if negative_count > 0 and positive_count == 0:
            classification = FindingClassification.WEAKNESS
            severity = Severity.SIGNIFICANT if negative_count >= 2 else Severity.MODERATE
        elif positive_count > 0 and negative_count == 0:
            classification = FindingClassification.STRENGTH
            severity = None
        elif positive_count > 0 and negative_count > 0:
            classification = FindingClassification.MIXED
            severity = Severity.MODERATE
        else:
            classification = FindingClassification.NEUTRAL
            severity = None

        findings.append(Finding(
            dimension="debt_sustainability",
            classification=classification,
            severity=severity,
            summary=obs.statement,
            observations=[obs],
            confidence=obs.confidence,
        ))

    # Fee analysis finding
    fa_obs = [o for o in observations if o.dimension == "fee_analysis"]
    if fa_obs:
        obs = fa_obs[0]
        fs = signal_map.get("fee_sustainability")
        if fs and fs.strength in (SignalStrength.WEAK_NEGATIVE, SignalStrength.STRONG_NEGATIVE):
            classification = FindingClassification.WEAKNESS
            severity = Severity.SIGNIFICANT if fs.strength == SignalStrength.STRONG_NEGATIVE else Severity.MODERATE
        elif fs and fs.strength in (SignalStrength.POSITIVE, SignalStrength.STRONG_POSITIVE):
            classification = FindingClassification.STRENGTH
            severity = None
        else:
            classification = FindingClassification.MIXED
            severity = Severity.MINOR

        findings.append(Finding(
            dimension="fee_analysis",
            classification=classification,
            severity=severity,
            summary=obs.statement,
            observations=[obs],
            confidence=obs.confidence,
        ))

    # Liquidity finding
    lq_obs = [o for o in observations if o.dimension == "liquidity"]
    if lq_obs:
        obs = lq_obs[0]
        liq = signal_map.get("liquidity_months")
        if liq and liq.strength in (SignalStrength.STRONG_NEGATIVE,):
            classification = FindingClassification.WEAKNESS
            severity = Severity.SIGNIFICANT
        elif liq and liq.strength in (SignalStrength.WEAK_NEGATIVE,):
            classification = FindingClassification.WEAKNESS
            severity = Severity.MODERATE
        elif liq and liq.strength in (SignalStrength.POSITIVE, SignalStrength.STRONG_POSITIVE):
            classification = FindingClassification.STRENGTH
            severity = None
        else:
            classification = FindingClassification.NEUTRAL
            severity = None

        findings.append(Finding(
            dimension="liquidity",
            classification=classification,
            severity=severity,
            summary=obs.statement,
            observations=[obs],
            confidence=obs.confidence,
        ))

    return findings


# ─── RECOMMENDATION GENERATION ───────────────────────────────────────────────

def generate_recommendations(findings: list[Finding]) -> list[Recommendation]:
    """Always returns no recommendations. Pure function.

    Every previous template here was an instruction ("Be styrelsen om...",
    "Kontrollera...", "Bedöm om...") or a purchase endorsement/prediction
    ("Detta stöder ett köp", "En avgiftshöjning är trolig") — Köpanalys is
    not an advisor and must not tell a customer what to do or predict what
    will happen (see reasoning.py's module docstring). There's no
    evidence-based replacement content to put here instead: this function
    only ever received `findings`, whose `summary` (already reported in
    full, per-dimension, in Observations/Findings) is the only fact it has
    - a rewritten "recommendation" would either invent a claim about data
    this module never receives (e.g. an amortization schedule) or just
    restate the finding a second time. The parameter, dataclass, and
    ReasoningResult.recommendations field are kept (rather than removed)
    so callers (serialize.py, the AI narrator, the TS DTOs) don't need to
    change shape for an always-empty list.
    """
    del findings  # kept for signature stability; see docstring
    return []


# ─── VERDICT ──────────────────────────────────────────────────────────────────

def compute_verdict(findings: list[Finding], overall_confidence: float) -> dict:
    """Compute the final verdict label. Deterministic rules.

    Labels name the pattern of findings behind them (how many significant/
    critical observations were found, or how much data backs the analysis)
    - never a buy/avoid/wait instruction. Mirrors the TypeScript Decision
    Engine's VERDICTS (frontend/src/lib/analysis/engine/decisionEngine.ts),
    which draws the same line for the same reason: Köpanalys reports data,
    not advice. report.py's compute_verdict_from_reasoning() is a thin
    wrapper around this function - there is exactly one verdict-labeling
    implementation.
    """
    strengths = [f for f in findings if f.classification == FindingClassification.STRENGTH]
    weaknesses = [f for f in findings if f.classification == FindingClassification.WEAKNESS]
    critical = [f for f in findings if f.severity == Severity.CRITICAL]
    significant = [f for f in findings if f.severity == Severity.SIGNIFICANT]

    if overall_confidence < 0.30:
        verdict = "Otillräckligt dataunderlag"
    elif len(critical) >= 2:
        verdict = "Flera kritiska observationer"
    elif len(critical) == 1 and len(significant) >= 2:
        verdict = "Flera kritiska och väsentliga observationer"
    elif len(critical) == 1:
        verdict = "En kritisk observation"
    elif len(significant) >= 3:
        verdict = "Flera väsentliga observationer"
    elif len(significant) >= 1:
        verdict = "Väsentlig observation identifierad"
    elif len(weaknesses) >= 2:
        verdict = "Flera mindre observationer"
    else:
        verdict = "Inga väsentliga svagheter identifierade"

    if overall_confidence < 0.50:
        verdict = "Begränsat dataunderlag för en tillförlitlig sammanställning"

    summary_parts = []
    for f in strengths:
        summary_parts.append(f"+ {f.summary}")
    for f in weaknesses:
        summary_parts.append(f"- {f.summary}")

    return {
        "verdict": verdict,
        "summary": "\n".join(summary_parts) if summary_parts else "Inga slutsatser kunde dras.",
        "strengths": len(strengths),
        "weaknesses": len(weaknesses),
        "critical_count": len(critical),
        "significant_count": len(significant),
        "confidence": overall_confidence,
    }


# ─── MAIN REASONING PIPELINE ─────────────────────────────────────────────────

def run_reasoning(metrics: CalculatedMetrics) -> ReasoningResult:
    """Run the complete reasoning pipeline. Pure function."""
    signals = generate_signals(metrics)
    observations = generate_observations(signals, metrics)
    findings = generate_findings(observations, signals)
    recommendations = generate_recommendations(findings)

    # Overall confidence: weighted by finding importance
    if findings:
        confidences = [f.confidence for f in findings]
        overall_confidence = sum(confidences) / len(confidences)
    else:
        overall_confidence = 0.0

    return ReasoningResult(
        signals=signals,
        observations=observations,
        findings=findings,
        recommendations=recommendations,
        overall_confidence=overall_confidence,
    )
