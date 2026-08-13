"""AI-based structured extraction from besiktningsprotokoll (inspection
protocols) — free-text PDFs with no standardized layout, unlike annual
reports, so extract_annual_report()'s rule-based approach doesn't apply.

This is a sibling to financial_extractor.py, not an extension of
analysis_engine/narrator/: the narrator's job is to rewrite already-decided
structured facts into prose ("never invent a new fact"); this module's job
is the opposite — reading unstructured text and extracting new structured
facts that don't exist anywhere yet. Same anti-hallucination discipline as
the narrator's system prompt (see analysis_engine/narrator/openai_provider.py),
adapted for extraction: only report what the document itself states, quote
the source text for every finding, never invent a defect or severity beyond
what the text supports.
"""

from __future__ import annotations

import os
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, Field

from brf_scraper.extractor.pdf_reader import read_pdf
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

DEFAULT_MODEL = "gpt-4o-mini"
# Roughly 60 pages of dense Swedish inspection-report text — a hard cap so a
# single unusually long besiktningsprotokoll can't blow the caller's overall
# provider timeout budget (see pipeline.ts's timeoutMs for this source).
MAX_INPUT_CHARS = 120_000

SYSTEM_PROMPT = """Du analyserar ett besiktningsprotokoll för en bostad. \
Din uppgift är att extrahera de fynd (anmärkningar, brister, skador) som \
protokollet faktiskt beskriver — INTE att bedöma bostaden själv.

Du FÅR:
- lista varje konkret anmärkning eller brist som dokumentet nämner
- citera eller nära återge den mening i källtexten där anmärkningen står \
(source_excerpt)
- kategorisera varje fynd (t.ex. "tak", "fasad", "grund", "våtrum", "el", \
"vvs", "fönster", "övrigt")
- ange en allvarlighetsgrad (minor/moderate/significant/critical) baserad \
på hur protokollet självt beskriver fyndet (t.ex. "akut åtgärd krävs" är \
critical, "normalt slitage" är minor)
- återge en rekommendation ENDAST om protokollet självt uttrycker en

Du FÅR ALDRIG:
- hitta på en brist som inte nämns i texten
- gissa en allvarlighetsgrad som inte har stöd i hur texten beskriver fyndet
- lägga till egna rekommendationer som inte kommer direkt från dokumentet
- generalisera ("den här typen av hus har ofta...") — bara det som faktiskt \
står i just detta dokument
- uttrycka högre säkerhet än texten ger stöd för
- lägga till ett avsnitt som "finding" om det uttryckligen beskriver \
FRÅNVARO av brist (t.ex. "inga sprickor kunde observeras", "inga \
fuktindikationer", "inget att anmärka", "korrekt utfört enligt \
dokumentation"). Sådana avsnitt är bekräftelser på att allt var i sin \
ordning, inte en brist med "minor" allvarlighetsgrad — de ska helt \
uteslutas ur findings-listan. Nämn dem istället kort i summary om det är \
relevant (t.ex. "grund och våtrum uppvisade inga anmärkningar").

Om dokumentet inte innehåller några besiktningsfynd (t.ex. om det är fel \
dokumenttyp, eller texten gick inte att läsa meningsfullt), returnera en \
tom findings-lista och förklara varför i summary — hitta aldrig på \
fyllnadsinnehåll."""


class InspectionSeverity(StrEnum):
    MINOR = "minor"
    MODERATE = "moderate"
    SIGNIFICANT = "significant"
    CRITICAL = "critical"


class OverallCondition(StrEnum):
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    UNKNOWN = "unknown"


class InspectionFinding(BaseModel):
    """One defect/observation the inspection protocol itself describes."""

    category: str = Field(description="e.g. tak, fasad, grund, våtrum, el, vvs, fönster, övrigt")
    description: str = Field(description="Short factual description in Swedish, grounded in the source text")
    severity: InspectionSeverity
    recommendation: str | None = Field(default=None, description="Only if the document itself states one")
    source_excerpt: str | None = Field(default=None, description="Verbatim or near-verbatim snippet this finding is derived from")


class InspectionExtractionResult(BaseModel):
    """Structured output of one besiktningsprotokoll interpretation.

    Deliberately mirrors brf_financial_analysis's signals/findings/
    recommendations shape (see BRF-Scraper's financial reasoning output) so
    the TypeScript Decision Engine's risk analyzer can consume this
    analogously to how housingAssociation.ts already consumes financial
    findings.
    """

    findings: list[InspectionFinding] = Field(default_factory=list)
    summary: str = Field(description="1-3 sentence factual overview of what the document covers")
    overall_condition: OverallCondition = OverallCondition.UNKNOWN
    document_date: str | None = None
    is_text_based: bool = True
    model: str = DEFAULT_MODEL
    extraction_confidence: float = Field(ge=0.0, le=1.0, default=0.0)


def _empty_result(reason: str, *, is_text_based: bool = True, model: str = DEFAULT_MODEL) -> InspectionExtractionResult:
    """The single degrade path every failure mode in this module funnels
    through — never raises past the caller, mirrors NarrationError's "must
    degrade, never crash the report" convention."""
    logger.warning("inspection_extraction_empty", reason=reason)
    return InspectionExtractionResult(
        findings=[],
        summary=f"Kunde inte tolka besiktningsprotokollet: {reason}",
        overall_condition=OverallCondition.UNKNOWN,
        is_text_based=is_text_based,
        model=model,
        extraction_confidence=0.0,
    )


def extract_inspection_findings(
    pdf_path: str | Path,
    api_key: str | None = None,
    model: str = DEFAULT_MODEL,
) -> InspectionExtractionResult:
    """Extract structured findings from a besiktningsprotokoll PDF via an
    LLM. Never raises — every failure mode (no API key, unreadable PDF,
    OpenAI error) degrades to an empty, zero-confidence result instead, so a
    flaky inspection-protocol document can never break the broader analysis
    pipeline that calls this.
    """
    resolved_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not resolved_key:
        return _empty_result("OPENAI_API_KEY är inte satt")

    doc = read_pdf(pdf_path, max_pages=100)
    if not doc.is_text_based:
        return _empty_result("PDF-filen verkar vara en inskannad bild utan textinnehåll", is_text_based=False, model=model)

    text = doc.full_text[:MAX_INPUT_CHARS]

    try:
        from openai import OpenAI
    except ImportError as e:
        return _empty_result(f"openai-paketet är inte installerat: {e}", model=model)

    try:
        client = OpenAI(api_key=resolved_key, timeout=60.0)
        response = client.chat.completions.parse(
            model=model,
            temperature=0.1,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            response_format=InspectionExtractionResult,
        )
    except Exception as e:  # noqa: BLE001 - any provider failure must degrade, never crash the pipeline
        return _empty_result(f"OpenAI-anrop misslyckades: {e}", model=model)

    parsed = response.choices[0].message.parsed if response.choices else None
    if parsed is None:
        return _empty_result("OpenAI returnerade inget tolkningsbart resultat", model=model)

    parsed.model = model
    parsed.is_text_based = True
    if parsed.extraction_confidence <= 0.0:
        # The model isn't asked to self-report confidence beyond the schema
        # default; derive a simple heuristic instead — non-empty findings on
        # readable text is the strongest signal we have without a second
        # verification pass (unlike financial extraction, free text has no
        # cross-validation source to check against).
        parsed.extraction_confidence = 0.8 if parsed.findings else 0.5

    logger.info(
        "inspection_extraction_done",
        pdf_path=str(pdf_path),
        findings=len(parsed.findings),
        overall_condition=parsed.overall_condition.value,
        confidence=parsed.extraction_confidence,
    )
    return parsed
