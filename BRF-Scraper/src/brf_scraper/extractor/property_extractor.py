"""Property and personnel extraction from Swedish annual reports.

Extracts board members, property details, and other non-financial
information from the text of annual reports.
"""
from __future__ import annotations

import re

from brf_scraper.utils.logging import get_logger

from .models import Evidence, ExtractedValue
from .pdf_reader import PDFDocument
from .text_normalize import fold_diacritics

logger = get_logger(__name__)

# ── Board member extraction ────────────────────────────────────────────

BOARD_ROLES = {
    "ordförande": "chairman",
    "ordforande": "chairman",
    "viceordförande": "vice_chairman",
    "viceordforande": "vice_chairman",
    "kassör": "treasurer",
    "kassor": "treasurer",
    "sekreterare": "secretary",
    "styrelseledamot": "member",
    "ledamot": "member",
    "revisor": "auditor",
    "revisorsanstalt": "auditor_firm",
}

# Common Swedish first names to help identify person names
_SWEDISH_NAMES = {
    "anna", "erik", "karl", "lars", "anders", "johan", "per", "mikael",
    "magnus", "stefan", "thomas", "christian", "david", "martin", "peter",
    "jan", "gunnar", "borje", "sven", "niklas", "henrik", "robert",
    "ingrid", "maria", "karin", "helena", "eva", "mona", "gunilla",
    "lena", "birgitta", "margareta", "agneta", "ull-britt", "charlotte",
}


def extract_board_members(doc: PDFDocument) -> dict[str, ExtractedValue]:
    """Extract board member names and roles."""
    results = {}

    for page in doc.pages:
        lines = page.text.split("\n")
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()

            for swedish_role, english_role in BOARD_ROLES.items():
                if swedish_role not in line_lower:
                    continue

                if english_role in results:
                    continue  # Already found this role

                # Try to find a name near the role
                name = _find_name_near_role(line, lines, i)
                if name:
                    results[english_role] = ExtractedValue(
                        value=name,
                        evidence=Evidence(
                            page=page.page_number,
                            field=english_role,
                            label=line.strip()[:100],
                            confidence=0.80,
                            snippet=line.strip()[:300],
                        ),
                    )

    return results


def _find_name_near_role(
    role_line: str, all_lines: list[str], line_idx: int
) -> str | None:
    """Try to extract a person name near a role keyword."""
    # Strategy 1: Name on the same line after "Namn Namnsson" pattern
    # Common: "Ordförande: Anna Svensson" or "Ordförande Anna Svensson"
    m = re.search(
        r"(?:ordförande|ordforande|vice|kassör|sekreterare|ledamot|revisor)[s]?\s*[:\-–]?\s*([A-ZÅÄÖ][a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+)",
        role_line,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()

    # Strategy 2: Name on the next line
    if line_idx + 1 < len(all_lines):
        next_line = all_lines[line_idx + 1].strip()
        m = re.match(r"([A-ZÅÄÖ][a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+)", next_line)
        if m:
            return m.group(1).strip()

    return None


# ── Property detail extraction ─────────────────────────────────────────
#
# Patterns are written in their diacritic-FOLDED form (å/ä/ö -> a/a/o) and
# matched against fold_diacritics(page.text), not the raw page text — OCR
# frequently drops these on a scanned page (see text_normalize.py), and a
# literal "lägenheter" pattern simply never matches a scanned report's
# "lagenheter". Folding preserves string length/position 1:1, so values are
# still sliced back out of the ORIGINAL page.text by the match's offsets
# (never out of the folded text itself), keeping correct Swedish spelling
# wherever a field's value is text rather than a digit.

PROPERTY_PATTERNS = {
    "year_built": [
        r"byggar\s*[:\-–]?\s*(\d{4})",
        r"bygg\s*ar\s*[:\-–]?\s*(\d{4})",
        r"upprford\s*(\d{4})",
        r"tillkommit\s*(\d{4})",
        r"byggnaden\s*(\d{4})",
    ],
    "number_of_apartments": [
        r"antal\s*(?:lagenheter|bostadsratter)\s*[:\-–]?\s*(\d+)",
        r"(\d+)\s*(?:lagenheter|bostadsratter|bostader)",
    ],
    "energy_class": [
        r"energiklass\s*[:\-–]?\s*([a-f])\b",
    ],
    "land_ownership": [
        r"(aganderatt|tomtratt|tomtaganderatt)",
    ],
}


def extract_property_details(doc: PDFDocument) -> dict[str, ExtractedValue]:
    """Extract property details using regex patterns."""
    results = {}

    for page in doc.pages:
        folded_text = fold_diacritics(page.text)
        for field_name, patterns in PROPERTY_PATTERNS.items():
            if field_name in results:
                continue

            for pattern in patterns:
                m = re.search(pattern, folded_text)
                if m:
                    # Sliced from the ORIGINAL page text at the folded
                    # match's offsets (valid 1:1 — see module docstring),
                    # so a text value keeps its real å/ä/ö instead of the
                    # folded spelling used only to find it.
                    value = page.text[m.start(1):m.end(1)]
                    # Try to parse as number
                    try:
                        value = int(value)
                    except ValueError:
                        pass  # Keep as string (e.g., energy class "C")

                    results[field_name] = ExtractedValue(
                        value=value,
                        evidence=Evidence(
                            page=page.page_number,
                            field=field_name,
                            label=page.text[m.start():m.end()][:100],
                            # An anchored regex match (digit immediately
                            # adjacent to its keyword, e.g. "17 lägenheter")
                            # is at least as reliable as the keyword-proximity
                            # text search in financial_extractor.py's own
                            # Strategy 1 (confidence 0.85) — it was previously
                            # pinned to 0.80, just under HIGH_CONFIDENCE
                            # (0.85) in validation.py, so a value this module
                            # ever found was silently discarded as "uncertain"
                            # regardless of how unambiguous the match was.
                            confidence=0.90,
                            snippet=page.text[max(0, m.start() - 50):m.end() + 50][:300],
                        ),
                    )
                    break

    return results
