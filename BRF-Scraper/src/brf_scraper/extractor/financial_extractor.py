"""Financial data extraction from Swedish annual reports.

Parses text extracted from PDF annual reports (arsredovisningar) to find
financial metrics. Uses keyword matching and Swedish number formatting.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from brf_scraper.utils.logging import get_logger

from .models import Evidence, ExtractedValue
from .pdf_reader import PDFDocument

logger = get_logger(__name__)

# ── Swedish number parsing ─────────────────────────────────────────────
# Swedish format: "1 234 567" or "1 234 567,89" (spaces as thousand sep)
_SWEDISH_NUMBER = re.compile(
    r"[\s\xa0]*(-?\d[\d\s\xa0]*\d)(?:[,.](\d{1,2}))?"
)


def parse_swedish_number(text: str) -> float | None:
    """Parse a Swedish-formatted number from text.

    Examples:
        "1 234 567" -> 1234567
        "1 234,56" -> 1234.56
        "-345 000" -> -345000
        "1.234.567,89" -> 1234567.89
    """
    text = text.strip()
    if not text:
        return None

    # Handle parenthetical negatives: "(1 234)" -> -1234
    negated = False
    if text.startswith("(") and text.endswith(")"):
        negated = True
        text = text[1:-1].strip()

    # Remove currency symbols and labels
    text = re.sub(r"[SEKkr\s]+$", "", text)
    text = re.sub(r"^\s*[SEKkr]+\s*", "", text)

    # Try to match number pattern
    m = _SWEDISH_NUMBER.search(text)
    if not m:
        return None

    integer_part = m.group(1).replace(" ", "").replace("\xa0", "")
    decimal_part = m.group(2)

    try:
        if decimal_part:
            value = float(f"{integer_part}.{decimal_part}")
        else:
            value = float(integer_part)
    except (ValueError, TypeError):
        return None

    if negated:
        value = -value

    return value


# ── Keyword specificity ──────────────────────────────────────────────
# A field's "keywords" list may mix plain strings (matched as a whole
# word/phrase, unchanged behavior) with KeywordSpec entries that also rank
# and filter matches by what qualifies them. This is the one, reusable
# mechanism for disambiguating "which occurrence of this word is the one
# actually meant" - e.g. preferring "Summa skulder" (a grand total) over
# "Långfristiga skulder" (a different, more specific line item) without
# hardcoding a new keyword string.

@dataclass(frozen=True)
class KeywordSpec:
    """A label to search for, with optional rules for ranking/rejecting
    matches that are qualified by a different, more specific concept.

    A plain string keyword is equivalent to KeywordSpec(phrase) with no
    boost_qualifiers - every existing field keeps its current behavior
    unless it opts in.

    When boost_qualifiers IS set: a match with no qualifying word
    immediately before it, or one from boost_qualifiers (e.g. "summa"),
    is an acceptable candidate - the boosted ones are tried first. A match
    immediately preceded by any OTHER word (e.g. "långfristiga skulder")
    is assumed to name a distinct, more specific line item and is
    rejected outright rather than mistaken for this field.
    """

    phrase: str
    boost_qualifiers: tuple[str, ...] = ()


def _as_keyword_spec(keyword: "str | KeywordSpec") -> KeywordSpec:
    """Normalize a keywords-list entry to a KeywordSpec."""
    return keyword if isinstance(keyword, KeywordSpec) else KeywordSpec(phrase=keyword)


def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    """Whole word/phrase match - never matches inside a longer compound
    word (e.g. "skulder" will not match inside "Leverantörsskulder")."""
    return re.compile(r"(?<!\w)" + re.escape(phrase.lower()) + r"(?!\w)")


# ── Field definitions ──────────────────────────────────────────────────
# Each field maps: canonical_name -> (keywords to search for, unit)

INCOME_STATEMENT_FIELDS = {
    "revenue": {
        "keywords": [
            "bruttointäkter", "bruttointäkter", "intäkter",
            "nettointäkter", "omsättning", "omsättningen",
            "total intäkt", "summa intäkter",
            "nettoomsättning", "nettoomsättningen",
            "rörelseintäkter", "summa rörelseintäkter",
            "rörelseintäkter m.m.",
        ],
        "unit": "SEK",
    },
    "operating_costs": {
        "keywords": [
            "rörelsekostnader", "rörelsekostnaden",
            "kostnader för rörelsen", "kostnader",
            "driftskostnader", "rörelseens kostnader",
        ],
        "unit": "SEK",
    },
    "operating_profit": {
        "keywords": [
            "rörelseresultat", "rörelse resultat",
            "resultat från rörelse", "driftsresultat",
        ],
        "unit": "SEK",
    },
    "financial_income": {
        "keywords": [
            "finansintäkter", "finans intäkter",
            "intäkter från finansverksamhet",
        ],
        "unit": "SEK",
    },
    "financial_costs": {
        "keywords": [
            "finanskostnader", "finans kostnader",
            "kostnader för finansverksamhet", "räntekostnader",
        ],
        "unit": "SEK",
    },
    "profit_before_tax": {
        "keywords": [
            "resultat före skatt", "resultat fore skatt",
            "vinst före skatt", "resultatet före beskattning",
            "resultat efter finansiella poster",
            "resultat före avdrag för skatt",
        ],
        "unit": "SEK",
    },
    "profit_after_tax": {
        "keywords": [
            "resultat efter skatt", "resultat efter beskattning",
            "vinst efter skatt", "årets resultat", "arets resultat",
        ],
        "unit": "SEK",
    },
}

BALANCE_SHEET_FIELDS = {
    "total_assets": {
        "keywords": [
            "summa tillgångar", "tillgångar totalt",
            "totala tillgångar", "tillgångar",
        ],
        "unit": "SEK",
    },
    "current_assets": {
        "keywords": [
            "omsättningstillgångar", "omsättningstillgång",
        ],
        "unit": "SEK",
    },
    "fixed_assets": {
        "keywords": [
            "anläggningstillgångar", "anläggningstillgång",
        ],
        "unit": "SEK",
    },
    "total_equity": {
        "keywords": [
            "eget kapital", "aktiekapital och overskottsfond",
            "eget kapital totalt", "eget kapital incl",
        ],
        "unit": "SEK",
    },
    "total_liabilities": {
        "keywords": [
            "skulder totalt",
            KeywordSpec("skulder", boost_qualifiers=("summa", "totalt")),
            "skulder excl kortfristiga",
        ],
        "unit": "SEK",
    },
    "long_term_debt": {
        "keywords": [
            "skulder > 1 år", "skulder > 1 ar",
            "skulder mer än 1 år", "långfristiga skulder",
            "lanfristiga skulder", "långfristiga skulder totalt",
            "skulder till kreditinstitut",
            "långfristiga skulder exklusive",
        ],
        "unit": "SEK",
    },
    "short_term_debt": {
        "keywords": [
            "skulder < 1 år", "skulder < 1 ar",
            "skulder kortare än 1 år", "kortfristiga skulder",
        ],
        "unit": "SEK",
    },
    "cash_and_bank": {
        "keywords": [
            "kassa och bank", "kassa", "bank",
            "likvida medel",
        ],
        "unit": "SEK",
    },
}

APARTMENT_FIELDS = {
    "number_of_apartments": {
        "keywords": [
            "antal lägenheter", "antal lagener",
            "ägarlägenheter", "bostadsrätter",
            "antalet lägenheter", "bostadslägenheter",
            "bostäder",
        ],
        "unit": "count",
    },
    "number_of_rental": {
        "keywords": [
            "uthyrningslägenheter", "uthyrda lägenheter",
            "hyreslägenheter", "uthyrda",
            "antal uthyrningslägenheter",
        ],
        "unit": "count",
    },
    "number_of_commercial": {
        "keywords": [
            "lokaler", "affärslokaler", "kommeriella lokaler",
            "kontorslokaler", "butikslokaler",
            "antal lokaler",
        ],
        "unit": "count",
    },
    "avg_monthly_fee": {
        "keywords": [
            "genomsnittlig avgift", "medelavgift",
            "månadsavgift", "genomsnittsavgift",
            "årsavgift per",
        ],
        "unit": "SEK/month",
    },
    "parking_spaces": {
        "keywords": [
            "parkeringar", "parkering", "bilkvitter",
            "garageplatser", "garage",
            "parkeringsplatser",
        ],
        "unit": "count",
    },
    "garage_spaces": {
        "keywords": [
            "garageplatser", "garage",
            "antal garage",
        ],
        "unit": "count",
    },
    "storage_units": {
        "keywords": [
            "förråd", "forrad", "förrådsutrymme",
            "magasin", "förrådsutrymmen",
        ],
        "unit": "count",
    },
}

PROPERTY_FIELDS = {
    "building_area_sqm": {
        "keywords": [
            "byggnadsarea", "byggnadens area",
            "total area", "boarea",
        ],
        "unit": "m2",
    },
    "residential_area_sqm": {
        "keywords": [
            "boarea", "boarea totalt",
            "bostadsarea", "lägenheters totalarea",
        ],
        "unit": "m2",
    },
    "commercial_area_sqm": {
        "keywords": [
            "lokalarea", "lokalers area",
            "kommeriell area",
        ],
        "unit": "m2",
    },
    "year_built": {
        "keywords": [
            "byggår", "bygg ar", "uppförd",
            "byggnaden uppförd", "tillkommit år",
        ],
        "unit": "year",
    },
    "energy_class": {
        "keywords": [
            "energiklass", "energieffektivitet",
        ],
        "unit": "",
    },
    "land_ownership": {
        "keywords": [
            "äganderätt", "äganderatt",
            "tomträtt", "tomtratt",
            "markägande", "fast egendom",
        ],
        "unit": "",
    },
}


# ── Core extraction logic ──────────────────────────────────────────────

def _find_value_near_keyword(
    doc: PDFDocument,
    keywords: list,
    page_hint: int | None = None,
) -> ExtractedValue | None:
    """Search for a keyword in the document and extract the nearest number.

    Strategy:
    1. Find the keyword on the hinted page (or search all pages)
    2. Look for a number on the same line, to the right of the keyword
    3. If not found, look for a number on the next line
    4. If not found, look for a number in the same column area

    `keywords` entries may be plain strings or KeywordSpec instances (see
    KeywordSpec above). Matching is whole word/phrase, not raw substring,
    so a keyword never matches inside an unrelated compound word. Page
    and keyword traversal order is unchanged from before; the only new
    behavior is *which line* is tried first when a keyword has more than
    one matching line on the same page - ranked by KeywordSpec, if given.
    """
    pages_to_search = (
        [page_hint] if page_hint and doc.get_page(page_hint)
        else range(1, doc.total_pages + 1)
    )

    for page_num in pages_to_search:
        page = doc.get_page(page_num)
        if not page or page.char_count < 10:
            continue

        lines = page.text.split("\n")

        for kw in keywords:
            spec = _as_keyword_spec(kw)
            pattern = _phrase_pattern(spec.phrase)

            # Collect every matching line on this page, ranking boosted
            # qualifiers (e.g. "Summa X") ahead of unqualified matches,
            # and dropping matches qualified by something else entirely
            # (e.g. "Långfristiga X") when the field declared boost
            # qualifiers - only then is such disambiguation meaningful.
            candidates: list[tuple[int, int]] = []  # (line_index, match_start)
            for i, line in enumerate(lines):
                m = pattern.search(line.lower())
                if not m:
                    continue
                is_boosted = False
                if spec.boost_qualifiers:
                    preceding = line[: m.start()].lower().rstrip().split()
                    preceding_word = preceding[-1] if preceding else ""
                    is_boosted = preceding_word in spec.boost_qualifiers
                    if preceding_word and not is_boosted:
                        continue
                candidates.append((i, m.start(), is_boosted))

            candidates.sort(key=lambda c: (not c[2], c[0]))

            for i, match_start, _is_boosted in candidates:
                line = lines[i]

                # Strategy 1: Number on the same line, after the keyword
                after_kw = line[match_start + len(spec.phrase):]
                num, ambiguous = _extract_first_number_after_ex(after_kw, 0)
                if num is not None:
                    # A second number-group immediately follows the one we
                    # kept - this line has at least two values on it (e.g.
                    # current year + comparison year) and the Swedish
                    # grouping heuristic used to split them is a guess, not
                    # a parse. Demote below the HIGH-confidence threshold so
                    # extractor/validation.py never scores it - do not
                    # guess which of the two numbers is right.
                    confidence = 0.55 if ambiguous else 0.85
                    label = line.strip()[:100]
                    if ambiguous:
                        label = (label + " [ambiguous: multiple values on line]")[:100]
                    return ExtractedValue(
                        value=num,
                        evidence=Evidence(
                            page=page_num,
                            field="",
                            label=label,
                            confidence=confidence,
                            snippet=line.strip()[:300],
                        ),
                    )

                # Strategy 2: Number on the next line
                if i + 1 < len(lines):
                    num = _extract_number_from_text(lines[i + 1])
                    if num is not None:
                        return ExtractedValue(
                            value=num,
                            evidence=Evidence(
                                page=page_num,
                                field="",
                                label=line.strip()[:100],
                                confidence=0.75,
                                snippet=f"{line.strip()[:150]} | {lines[i+1].strip()[:150]}",
                            ),
                        )

                # Strategy 3: Number two lines below
                if i + 2 < len(lines):
                    num = _extract_number_from_text(lines[i + 2])
                    if num is not None:
                        return ExtractedValue(
                            value=num,
                            evidence=Evidence(
                                page=page_num,
                                field="",
                                label=line.strip()[:100],
                                confidence=0.65,
                                snippet=f"{line.strip()[:100]} | {lines[i+2].strip()[:150]}",
                            ),
                        )

    return None


def _extract_number_from_text(text: str) -> float | None:
    """Extract the first number from a text line.

    Handles Swedish formatting: "1 234 567" or "1 234,56"
    Only extracts the FIRST number, not the entire line.
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # Handle parenthetical negatives: "(1 234)" -> -1234
    negated = False
    if text.startswith("(") and text.endswith(")"):
        negated = True
        text = text[1:-1].strip()

    # Remove currency symbols and labels
    text = re.sub(r"[SEKkr\s]+$", "", text)
    text = re.sub(r"^\s*[SEKkr]+\s*", "", text)

    # Match first number: digits possibly separated by spaces/non-breaking spaces
    # Then optionally a decimal comma with 1-2 digits
    m = re.match(
        r"(-?\d[\d\s\xa0]*\d)(?:[,.](\d{1,2}))?(?:\s|$)",
        text,
    )
    if not m:
        # Try single digit
        m = re.match(r"(-?\d)(?:[,.](\d{1,2}))?(?:\s|$)", text)

    if m:
        integer_part = m.group(1).replace(" ", "").replace("\xa0", "")
        decimal_part = m.group(2)
        try:
            if decimal_part:
                value = float(f"{integer_part}.{decimal_part}")
            else:
                value = float(integer_part)
            if negated:
                value = -value
            return value
        except (ValueError, TypeError):
            pass

    return None


def _extract_first_number_after(text: str, position: int) -> float | None:
    """Extract the first number from text starting at a given position.

    Thin wrapper around `_extract_first_number_after_ex` for callers that
    don't need to know whether the split was ambiguous.
    """
    value, _ambiguous = _extract_first_number_after_ex(text, position)
    return value


def _extract_first_number_after_ex(text: str, position: int) -> tuple[float | None, bool]:
    """Extract the first number from text starting at a given position, and
    report whether a second number-like group immediately follows it.

    Handles Swedish formatting where numbers are space-separated.
    When two numbers appear on the same line (current + comparison year),
    we split based on Swedish number grouping rules — but that split is a
    heuristic guess, not a parse: if a further group remains right after
    the number we kept, this line had at least two values on it and the
    grouping rules could plausibly have kept the wrong one. Callers use the
    `ambiguous` flag to keep such matches out of the Decision Engine rather
    than trusting a guess at full confidence (see extractor/validation.py).

    Swedish number rules:
    - Leading group: 1-3 digits
    - All subsequent groups: exactly 3 digits
    - Example: "2 640 000" (1+3+3 digits)
    - Example: "10 310 000" (2+3+3 digits)
    """
    substring = text[position:]
    if not substring or not substring.strip():
        return None, False

    substring = substring.strip()

    # Handle parenthetical negatives
    negated = False
    if substring.startswith("("):
        negated = True
        substring = substring[1:].strip()

    # Remove currency symbols
    substring = re.sub(r"^\s*[SEKkr]+\s*", "", substring)

    # Split into groups of digits separated by single spaces
    # (double spaces indicate column separators, which we handle separately)
    m = re.match(r"(-?\d+(?: \d+)*)", substring)
    if not m:
        return None, False

    full_match = m.group(1)
    parts = full_match.split(" ")
    ambiguous = False

    # Build the first number using Swedish grouping rules:
    # - First group (after optional minus): 1-3 digits
    # - Subsequent groups: exactly 3 digits
    kept = [parts[0]]
    leading_digits = len(parts[0].lstrip("-"))

    if leading_digits > 3:
        # Leading group has more than 3 digits - this is unusual for Swedish format
        # Just return it as-is
        raw = full_match
    else:
        for i in range(1, len(parts)):
            group = parts[i]
            if len(group) == 3:
                # Could be continuation or new number.
                # Look ahead: if the NEXT group after this one is also 3 digits,
                # this group is likely part of the current number (thousands).
                # If the next group is NOT 3 digits, this group completes the number.
                if i + 1 < len(parts) and len(parts[i + 1]) == 3:
                    # Next group is also 3 digits - continue building
                    kept.append(group)
                elif i + 1 >= len(parts):
                    # No more groups - this is the last group of this number
                    kept.append(group)
                    break
                else:
                    # Next group is NOT 3 digits - this group completes the number
                    # (the next group starts a new number)
                    kept.append(group)
                    break
            else:
                # Not 3 digits - must be start of new number
                break

        raw = " ".join(kept)
        ambiguous = len(kept) < len(parts)

    # Parse the Swedish number
    integer_part = raw.replace(" ", "").replace("\xa0", "")
    decimal_match = re.search(r"[,.](\d{1,2})$", integer_part)
    if decimal_match:
        integer_part = integer_part[:decimal_match.start()]
        decimal_part = decimal_match.group(1)
        try:
            value = float(f"{integer_part}.{decimal_part}")
        except ValueError:
            return None, False
    else:
        try:
            value = float(integer_part)
        except ValueError:
            return None, False

    if negated:
        value = -value
    return value, ambiguous


def _detect_fiscal_year(doc: PDFDocument) -> int | None:
    """Detect the fiscal year from the document text."""
    full = doc.full_text[:3000]  # Check first few pages

    # Common patterns - ordered by specificity
    patterns = [
        (r"(?:arsredovisning|årsredovisning|redovisning)\s*(?:för|for)\s*(?:år\s*)?(\d{4})", 0.95),
        (r"(?:faktiskt|rapporterings)år\s*(\d{4})", 0.90),
        (r"(?:verksamhetsår|verksamhets ar)\s*(\d{4})", 0.85),
        (r"(\d{4})\s*(?:årsredovisning|arsredovisning)", 0.85),
        (r"(?:resultat|vinst)\s*(?:år\s*)?(\d{4})", 0.70),
    ]

    for pattern, confidence in patterns:
        m = re.search(pattern, full, re.IGNORECASE)
        if m:
            year = int(m.group(1))
            if 2000 <= year <= 2030:
                return year

    # Fallback: look for the most common year in the first 2 pages
    # (avoids picking up maturity dates or one-off references)
    first_pages = "\n".join(p.text for p in doc.pages[:2] if p.text)
    year_counts: dict[int, int] = {}
    for y in re.findall(r"\b(20[12]\d)\b", first_pages):
        yr = int(y)
        year_counts[yr] = year_counts.get(yr, 0) + 1

    if year_counts:
        # Return the most frequent year
        return max(year_counts, key=year_counts.get)  # type: ignore[arg-type]

    return None


def _extract_fiscal_year_range(doc: PDFDocument) -> tuple[int | None, int | None]:
    """Try to find both fiscal year and comparison year."""
    full = doc.full_text[:5000]
    years = [int(y) for y in re.findall(r"\b(20[12]\d)\b", full)]
    if len(years) >= 2:
        years.sort(reverse=True)
        return years[0], years[1]
    elif years:
        return max(years), None
    return None, None


# ── Main extraction function ───────────────────────────────────────────

def extract_financial_data(
    doc: PDFDocument,
    page_hints: dict[str, int] | None = None,
) -> dict[str, ExtractedValue]:
    """Extract all financial fields from a PDF document.

    Uses two strategies:
    1. Table extraction (more accurate for columnar data)
    2. Text search fallback (for non-tabular layouts)

    Args:
        doc: The extracted PDF document
        page_hints: Optional mapping of field_name -> page_number to narrow search

    Returns:
        Dict of field_name -> ExtractedValue
    """
    results = {}
    page_hints = page_hints or {}

    all_fields = {**INCOME_STATEMENT_FIELDS, **BALANCE_SHEET_FIELDS}

    for field_name, config in all_fields.items():
        # Strategy 1: Try table extraction first (column 1 = current year)
        table_results = doc.find_in_tables(config["keywords"][0], value_column=1)
        if table_results:
            page_num, val_str = table_results[0]
            num = parse_swedish_number(val_str)
            if num is not None:
                results[field_name] = ExtractedValue(
                    value=num,
                    unit=config["unit"],
                    evidence=Evidence(
                        page=page_num,
                        field=field_name,
                        label=config["keywords"][0],
                        confidence=0.90,
                        snippet=f"table: {val_str}",
                    ),
                )
                continue

        # Strategy 2: Text search fallback
        ev = _find_value_near_keyword(
            doc,
            config["keywords"],
            page_hint=page_hints.get(field_name),
        )
        if ev:
            ev.evidence.field = field_name
            ev.unit = config["unit"]
            results[field_name] = ev

    return results


def extract_apartment_data(
    doc: PDFDocument,
    page_hints: dict[str, int] | None = None,
) -> dict[str, ExtractedValue]:
    """Extract apartment and property metrics."""
    results = {}
    page_hints = page_hints or {}

    all_fields = {**APARTMENT_FIELDS, **PROPERTY_FIELDS}

    for field_name, config in all_fields.items():
        ev = _find_value_near_keyword(
            doc,
            config["keywords"],
            page_hint=page_hints.get(field_name),
        )
        if ev:
            ev.evidence.field = field_name
            ev.unit = config["unit"]
            results[field_name] = ev

    return results


def extract_loan_data(doc: PDFDocument) -> list[dict[str, ExtractedValue]]:
    """Extract loan portfolio data.

    Loans are typically in a table format on a dedicated page.
    We look for bank names and associated numbers, or the
    "Långfristiga skulder" section with loan details.
    """
    loans = []
    known_banks = [
        "handelsbanken", "seb", "swedbank", "nordea",
        "svenska handelsbanken", "skandia", "länsförsäkringar",
        "swedbank hypotek", "nordea hypotek", "seb hypotek",
        "ica banken", "sparbanken", "sparbanken swan",
        "jf-hypotek", "stabelo", "statens pensionsmyndigheter",
        "stadshypotek", "länsförsäkringar hypotek",
        "bf hypotek", "bostadsfrämjandet",
    ]

    # Strategy 1: Find bank names and extract loan data near them
    for page in doc.pages:
        text_lower = page.text.lower()
        for bank in known_banks:
            if bank not in text_lower:
                continue

            # Found a bank reference - try to extract loan data
            lines = page.text.split("\n")

            for i, line in enumerate(lines):
                if bank not in line.lower():
                    continue

                # Check if this looks like a loan table row
                # Format: "SEB 43901591 3,14% 2025-06-28 2 776 500 2 776 500"
                # or: "Stadshypotek AB 822329 4,35% 2025-06-03 3 003 000 3 003 000"
                
                # Extract interest rate (pattern: number,number%)
                rate_match = re.search(r"(\d+[,.]\d+)\s*%", line)
                interest_rate = None
                if rate_match:
                    interest_rate = parse_swedish_number(rate_match.group(1))

                # Extract amounts (large numbers)
                amounts = []
                for m in re.finditer(r"(\d[\d\s\xa0]*\d)(?:\s|$)", line):
                    num = parse_swedish_number(m.group(1))
                    if num and num > 1000:  # Only large amounts
                        amounts.append(num)

                if amounts and interest_rate and 0.1 < interest_rate < 15:
                    # This looks like a loan row
                    loan = {
                        "lender": ExtractedValue(
                            value=bank.title(),
                            evidence=Evidence(
                                page=page.page_number,
                                field="lender",
                                label=line.strip()[:100],
                                confidence=0.85,
                                snippet=line.strip()[:300],
                            ),
                        ),
                        "remaining_amount": ExtractedValue(
                            value=max(amounts),  # Use the larger amount
                            unit="SEK",
                            evidence=Evidence(
                                page=page.page_number,
                                field="remaining_amount",
                                label=line.strip()[:100],
                                confidence=0.80,
                                snippet=line.strip()[:300],
                            ),
                        ),
                        "interest_rate_percent": ExtractedValue(
                            value=interest_rate,
                            unit="%",
                            evidence=Evidence(
                                page=page.page_number,
                                field="interest_rate_percent",
                                label=line.strip()[:100],
                                confidence=0.80,
                                snippet=line.strip()[:300],
                            ),
                        ),
                    }

                    # Check for maturity date
                    date_match = re.search(r"(\d{4}-\d{2}-\d{2})", line)
                    if date_match:
                        loan["maturity_date"] = ExtractedValue(
                            value=date_match.group(1),
                            evidence=Evidence(
                                page=page.page_number,
                                field="maturity_date",
                                label=line.strip()[:100],
                                confidence=0.85,
                                snippet=line.strip()[:300],
                            ),
                        )

                    # Avoid duplicates
                    existing_lenders = []
                    for l in loans:
                        if isinstance(l, dict) and "lender" in l:
                            lender_val = l["lender"]
                            if hasattr(lender_val, 'value'):
                                existing_lenders.append(lender_val.value)
                    if bank.title() not in existing_lenders:
                        loans.append(loan)

    # Strategy 2: Look for "Långfristiga skulder" section with loan table
    if not loans:
        for page in doc.pages:
            text_lower = page.text.lower()
            if "långfristiga skulder" not in text_lower:
                continue

            lines = page.text.split("\n")
            for i, line in enumerate(lines):
                if "långfristiga skulder" not in line.lower():
                    continue

                # Found the section - look for loan details in nearby lines
                context_lines = lines[i:min(len(lines), i + 20)]
                context = "\n".join(context_lines)

                # Try to find bank names in this section
                for bank in known_banks:
                    if bank in context.lower():
                        loan = {"lender": ExtractedValue(
                            value=bank.title(),
                            evidence=Evidence(
                                page=page.page_number,
                                field="lender",
                                label=line.strip()[:100],
                                confidence=0.75,
                                snippet=context[:300],
                            ),
                        )}

                        # Look for numbers near the bank name
                        for cl in context_lines:
                            if bank in cl.lower():
                                numbers = re.findall(
                                    r"[\d\s\xa0]+[\d](?:[,.]\d{1,2})?",
                                    cl,
                                )
                                amounts = [parse_swedish_number(n) for n in numbers]
                                amounts = [a for a in amounts if a is not None]

                                if amounts:
                                    # Remaining amount is typically the larger number
                                    loan["remaining_amount"] = ExtractedValue(
                                        value=max(amounts),
                                        unit="SEK",
                                        evidence=Evidence(
                                            page=page.page_number,
                                            field="remaining_amount",
                                            label=cl.strip()[:100],
                                            confidence=0.70,
                                            snippet=cl[:300],
                                        ),
                                    )

                                # Look for interest rate on next lines
                                for cl2 in context_lines[i:i+5]:
                                    rate_match = re.search(r"(\d+[,.]\d+)\s*%", cl2)
                                    if rate_match:
                                        rate = parse_swedish_number(rate_match.group(1))
                                        if rate and 0.1 < rate < 15:
                                            loan["interest_rate_percent"] = ExtractedValue(
                                                value=rate,
                                                unit="%",
                                                evidence=Evidence(
                                                    page=page.page_number,
                                                    field="interest_rate_percent",
                                                    label=cl2.strip()[:100],
                                                    confidence=0.65,
                                                    snippet=cl2[:300],
                                                ),
                                            )
                                            break

                                if len(loan) >= 2:
                                    loans.append(loan)
                                break

    return loans
