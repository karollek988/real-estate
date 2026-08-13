"""Pure, browser-independent heuristics for spotting and classifying
document links on a broker's page.

Ported from the proof-of-concept at Scraping-test/scrape.py (confirmed
working against a real Hemnet listing + broker site, downloading real
Stadgar/Energideklaration/Årsredovisning PDFs). Kept dependency-free from
Playwright/Camoufox so it's unit-testable against static HTML fixtures.
"""

from __future__ import annotations

import os
import re
from urllib.parse import urlparse

from brf_scraper.broker_discovery.models import BrokerDocumentType

DOC_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip")

DOC_KEYWORDS = [
    "objektbeskrivning", "prospekt", "planritning", "energideklaration",
    "stadgar", "årsredovisning", "arsredovisning", "bilaga",
    "dokument", "faktablad", "besiktningsprotokoll", "besiktning",
    "ladda ned", "ladda ner", "download", "attachment",
]

SHOW_MORE_TEXTS = [
    "visa fler", "visa alla", "läs mer", "fler dokument", "visa mer",
    "show more", "load more", "alla dokument",
]

TAB_TEXTS = ["Dokument", "Documents", "Övrigt", "Bilagor"]

# Ordered so more specific terms are checked before generic ones
# ("besiktningsprotokoll" before a bare "protokoll", etc.).
_CLASSIFICATION_RULES: list[tuple[BrokerDocumentType, tuple[str, ...]]] = [
    (BrokerDocumentType.ANNUAL_REPORT, ("årsredovisning", "arsredovisning")),
    (BrokerDocumentType.INSPECTION_REPORT, ("besiktningsprotokoll", "besiktning")),
    (BrokerDocumentType.ENERGY_DECLARATION, ("energideklaration",)),
    (BrokerDocumentType.BYLAWS, ("stadgar",)),
    (BrokerDocumentType.FLOOR_PLAN, ("planritning",)),
]


def safe_filename(name: str) -> str:
    """Sanitize a string for use as a filename."""
    name = name.strip().replace(" ", "_")
    name = re.sub(r"[^A-Za-z0-9._åäöÅÄÖ-]", "", name)
    return name or "dokument"


def guess_filename_from_url(url: str, fallback_ext: str = ".pdf") -> str:
    """Derive a filename from a URL's path, falling back to a generic name."""
    parsed = urlparse(url)
    base = os.path.basename(parsed.path)
    if not base or "." not in base:
        base = "dokument" + fallback_ext
    return safe_filename(base)


def looks_like_document(href: str, text: str) -> bool:
    """True if an href/link-text pair plausibly points at a downloadable
    document, per the PoC's proven heuristic: a matching file extension
    always counts; a keyword match only counts on a short, single-line
    link text (real document links are typically "Stadgar Brf X", not an
    entire property description paragraph that happens to contain a
    keyword)."""
    href_l = (href or "").lower()
    text_l = (text or "").lower().strip()

    if href_l.endswith(DOC_EXTENSIONS):
        return True
    if any(ext in href_l for ext in DOC_EXTENSIONS):
        return True

    is_short_single_line = bool(text_l) and "\n" not in text_l and len(text_l) < 80
    if is_short_single_line and any(kw in href_l for kw in DOC_KEYWORDS):
        return True
    if is_short_single_line and any(kw in text_l for kw in DOC_KEYWORDS):
        return True
    return False


def classify_document(url: str, text: str) -> BrokerDocumentType:
    """Classify a document link's type from its URL and link text, so the
    caller knows whether to route it to annual-report extraction, AI
    inspection-protocol interpretation, or plain storage. Never a
    system-level distinction (unlike looks_like_document's ok/not-a-match),
    so this always returns a value — OTHER when nothing matches."""
    haystack = f"{url} {text}".lower()
    for doc_type, keywords in _CLASSIFICATION_RULES:
        if any(kw in haystack for kw in keywords):
            return doc_type
    return BrokerDocumentType.OTHER
