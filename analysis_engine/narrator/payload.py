"""Builds the NarrationPayload from the Aggregator's own output.

Every field here is copied, never derived or computed — this module's only
job is serialization, so a provider can be given nothing the rule-based
pipeline (calculator.py + reasoning.py) didn't already decide.
"""

from __future__ import annotations

from calculator import CalculatedMetrics
from reasoning import ReasoningResult

from .base import NarrationPayload


def build_payload(
    extracted: dict,
    metrics: CalculatedMetrics,
    reasoning: ReasoningResult,
    verdict: dict,
) -> NarrationPayload:
    brf = extracted["brf"]
    report = extracted["annual_reports"][0]

    return NarrationPayload(
        brf_name=brf["name"],
        fiscal_year=report["fiscal_year"],
        verdict=verdict["verdict"],
        confidence=reasoning.overall_confidence,
        signals=[
            {
                "metric": s.metric,
                "value": s.value,
                "strength": s.strength.value,
                "description": s.threshold_description,
            }
            for s in reasoning.signals
        ],
        observations=[
            {
                "dimension": o.dimension,
                "statement": o.statement,
                "is_fact": o.is_fact,
                "confidence": o.confidence,
            }
            for o in reasoning.observations
        ],
        findings=[
            {
                "dimension": f.dimension,
                "classification": f.classification.value,
                "severity": f.severity.value if f.severity else None,
                "summary": f.summary,
                "confidence": f.confidence,
            }
            for f in reasoning.findings
        ],
        recommendations=[
            {
                "category": r.category,
                "text": r.text,
                "confidence": r.confidence,
            }
            for r in reasoning.recommendations
        ],
    )


def payload_to_dict(payload: NarrationPayload) -> dict:
    """JSON-serializable form of a NarrationPayload, for sending to a provider."""
    return {
        "brf_name": payload.brf_name,
        "fiscal_year": payload.fiscal_year,
        "verdict": payload.verdict,
        "confidence": payload.confidence,
        "signals": payload.signals,
        "observations": payload.observations,
        "findings": payload.findings,
        "recommendations": payload.recommendations,
    }
