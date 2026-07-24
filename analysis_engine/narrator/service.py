"""AI narration layer between the Aggregator and the Report Generator.

Contract:
  - report.py's generate_report() is called unmodified and is always the
    source of every number, table, verdict word, signal, and traceability
    line in the output. This module never recomputes or rewrites any of
    that — reasoning.py + calculator.py remain the sole source of truth.
  - The only thing this module ever replaces is the free-text "Nuläge"
    block in section 1, which report.py itself builds from the same
    verdict['summary'] bullet list every other section is built from.
  - If the provider fails for any reason, the unmodified template report
    is returned unchanged - a broken/unreachable AI provider must never
    block report generation, same convention as every data provider in
    this codebase.
"""

from __future__ import annotations

import logging

from calculator import CalculatedMetrics
from reasoning import ReasoningResult
from report import compute_verdict_from_reasoning, generate_report

from .base import NarrationError, NarrationProvider
from .payload import build_payload

logger = logging.getLogger("kopanalys.narrator")

_NULAGE_HEADER = "  Nuläge:"


def generate_ai_report(
    extracted: dict,
    metrics: CalculatedMetrics,
    reasoning: ReasoningResult,
    provider: NarrationProvider,
) -> tuple[str, bool]:
    """Return (report_text, ai_narration_used).

    ai_narration_used is False whenever the provider failed and the plain
    template report was returned instead - callers (and the comparison
    script) can use it to tell a real narration from a silent fallback.
    """
    template_report = generate_report(extracted, metrics, reasoning)
    verdict = compute_verdict_from_reasoning(reasoning)

    try:
        payload = build_payload(extracted, metrics, reasoning, verdict)
        narrative = provider.narrate(payload)
        ai_report = _splice_narrative(template_report, verdict, narrative)
    except NarrationError:
        logger.exception("AI narration failed; falling back to the template report")
        return template_report, False

    return ai_report, True


def _splice_narrative(template_report: str, verdict: dict, narrative: str) -> str:
    """Replace the template's "Nuläge" bullet block with the AI narrative.

    Everything else in template_report (verdict word, confidence, sections
    2-10) is untouched string content - only this one block, which is
    already 100% derived from the same verdict object, is swapped for a
    better-worded rendering of it.
    """
    old_lines = [_NULAGE_HEADER]
    for line in verdict["summary"].split("\n"):
        if line.strip():
            old_lines.append(f"    {line}")
    old_block = "\n".join(old_lines)

    if old_block not in template_report:
        # The template's structure changed under us - never silently
        # produce a corrupted report by guessing where to splice.
        raise NarrationError(
            "Could not locate the template's Nuläge block; report.py's "
            "output shape may have changed"
        )

    new_lines = ["  Nuläge (AI-sammanfattning):"]
    for line in narrative.split("\n"):
        if line.strip():
            new_lines.append(f"    {line.strip()}")
    new_block = "\n".join(new_lines)

    return template_report.replace(old_block, new_block, 1)
