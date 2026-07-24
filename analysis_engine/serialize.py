"""JSON serialization for the calculator/reasoning library's dataclass output.

calculator.py and reasoning.py are pure-function modules with no JSON
awareness of their own (by design — see their module docstrings). This module
is the only place that knows how to turn their dataclasses into the flat,
JSON-serializable shape the TypeScript pipeline consumes. It never computes
anything; it only reshapes values calculate_metrics()/run_reasoning() already
produced.

Findings normally nest their own Observations, which nest their own Signals,
and Recommendations nest Findings — serializing that verbatim would duplicate
the same Signal three times over. Nested objects are instead flattened to the
metric names / dimensions they reference, so each fact appears exactly once
(under top-level "signals") and everything else points at it by name.
"""

from __future__ import annotations

from dataclasses import fields
from typing import Any

from calculator import CalculatedField, CalculatedMetrics
from reasoning import Finding, Observation, Recommendation, ReasoningResult, Signal


def _field_to_dict(cf: CalculatedField | None) -> dict[str, Any] | None:
    if cf is None:
        return None
    return {
        "value": cf.value,
        "unit": cf.unit,
        "formula": cf.formula,
        "inputs": cf.inputs,
        "inputValues": cf.input_values,
        "computed": cf.computed,
    }


def metrics_to_dict(metrics: CalculatedMetrics) -> dict[str, Any]:
    """Every named CalculatedField on CalculatedMetrics, camelCased, null when not computed."""
    result: dict[str, Any] = {"fiscalYear": metrics.fiscal_year}
    for f in fields(metrics):
        if f.name == "fiscal_year":
            continue
        camel = _snake_to_camel(f.name)
        result[camel] = _field_to_dict(getattr(metrics, f.name))
    return result


def _signal_to_dict(signal: Signal) -> dict[str, Any]:
    return {
        "metric": signal.metric,
        "value": signal.value,
        "strength": signal.strength.value,
        "thresholdDescription": signal.threshold_description,
        "confidence": signal.confidence,
    }


def _observation_signal_metrics(observation: Observation) -> list[str]:
    return [s.metric for s in observation.signals]


def _finding_signal_metrics(finding: Finding) -> list[str]:
    seen: list[str] = []
    for obs in finding.observations:
        for metric in _observation_signal_metrics(obs):
            if metric not in seen:
                seen.append(metric)
    return seen


def reasoning_to_dict(result: ReasoningResult) -> dict[str, Any]:
    """Flat, non-duplicating JSON shape: findings/recommendations reference
    signals and findings by name instead of re-embedding the full objects."""
    findings_by_identity = {id(f): f for f in result.findings}

    def finding_index(finding: Finding) -> int:
        return result.findings.index(finding)

    return {
        "signals": [_signal_to_dict(s) for s in result.signals],
        "observations": [
            {
                "dimension": obs.dimension,
                "statement": obs.statement,
                "isFact": obs.is_fact,
                "confidence": obs.confidence,
                "signalMetrics": _observation_signal_metrics(obs),
            }
            for obs in result.observations
        ],
        "findings": [
            {
                "dimension": finding.dimension,
                "classification": finding.classification.value,
                "severity": finding.severity.value if finding.severity else None,
                "summary": finding.summary,
                "confidence": finding.confidence,
                "signalMetrics": _finding_signal_metrics(finding),
            }
            for finding in result.findings
        ],
        "recommendations": [
            {
                "category": rec.category,
                "text": rec.text,
                "confidence": rec.confidence,
                "findingDimensions": [f.dimension for f in rec.findings],
            }
            for rec in result.recommendations
        ],
        "overallConfidence": result.overall_confidence,
    }


def _snake_to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.title() for part in tail)
