"""Reads the mandatory key figures straight from an annual report's text.

Since fiscal year 2023 every Swedish housing association must state the same
key figures in its förvaltningsberättelse (ÅRL 6 kap. 3 a §, BFNAR 2023:1):
årsavgift per kvm, skuldsättning per kvm (total and per bostadsrätt yta),
sparande per kvm, räntekänslighet, energikostnad per kvm and årsavgifternas
andel av rörelseintäkterna — usually as rows of the flerårsöversikt table,
newest year first:

    Skuldsättning, kr/kvm 7 587 7 951 8 042 8 151 8 402
    Räntekänslighet, % 8 10 10 10 10

The output is a STARTING POINT for the Köpanalys reviewer, never shown to a
customer as it is: the review console prefills its form with it and the
reviewer checks every value against the report before publishing
(frontend/src/lib/brf/reviews.ts). So this is tuned to be right or silent:
a row whose numbers can't be split into one plausible value per year is
skipped rather than guessed.

The hard part is Swedish number formatting: thousands are separated by
spaces, the same character that separates the year columns, so
"1 604 1 656 1 513 1 561" has to be split using how many years the table
shows, the rule that a thousands group is exactly three digits, and the
plausible range of the figure.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# Plausible ranges per figure (same as the review form's, frontend/src/lib/brf/figures.ts).
RANGES: dict[str, tuple[float, float]] = {
    "annualFeePerSqm": (50, 5000),
    "debtPerSqmBr": (0, 150000),
    "debtPerSqmTotal": (0, 150000),
    "savingsPerSqm": (-10000, 10000),
    "interestSensitivityPct": (0, 300),
    "energyCostPerSqm": (0, 3000),
    "feeShareOfRevenuePct": (0, 100),
    "equityRatioPct": (-100, 100),
}

_YEAR_RE = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")
_NUMBER_TOKEN_RE = re.compile(r"^[-−–]?\d+(?:,\d+)?%?$")


def _clean(line: str) -> str:
    line = line.replace("(cid:9)", " ").replace("(cid:20)", " ").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", " ", line).strip()


def _trailing_numbers(line: str) -> tuple[str, list[str]]:
    """Splits "Label text 1 604 1 656" into ("Label text", ["1", "604", "1", "656"])."""
    tokens = line.split(" ")
    numbers: list[str] = []
    while tokens and _NUMBER_TOKEN_RE.match(tokens[-1]):
        numbers.insert(0, tokens.pop())
    return " ".join(tokens), numbers


def _token_value(token: str) -> float:
    token = token.rstrip("%").replace("−", "-").replace("–", "-").replace(",", ".")
    return float(token)


def _partitions(tokens: list[str], count: int) -> Iterable[list[float]]:
    """Every way to read `tokens` as exactly `count` numbers.

    A number is a first group of 1-3 digits (no leading zero unless it is
    "0", optionally signed) followed by any number of exactly-three-digit
    groups; a decimal part (",5") or a percent sign ends the number.
    """
    def rec(i: int, remaining: int) -> Iterable[list[float]]:
        if remaining == 0:
            if i == len(tokens):
                yield []
            return
        if i >= len(tokens):
            return
        first = tokens[i]
        digits = first.lstrip("-−–").rstrip("%")
        int_part = digits.split(",")[0]
        if len(int_part) > 3 and "," not in digits and not first.endswith("%"):
            # A token longer than three digits is a complete number on its own (e.g. "2024" style or "12345").
            for rest in rec(i + 1, remaining - 1):
                yield [_token_value(first)] + rest
            return
        if len(int_part) > 1 and int_part.startswith("0"):
            return  # "008" can't start a number — it is a thousands group
        # Try extending with following 3-digit groups.
        j = i
        text = first
        while True:
            closed = "," in text or text.endswith("%")
            for rest in rec(j + 1, remaining - 1):
                yield [_token_value(text.replace(" ", ""))] + rest
            if closed or j + 1 >= len(tokens):
                return
            nxt = tokens[j + 1]
            nxt_int = nxt.rstrip("%").split(",")[0]
            if nxt.startswith(("-", "−", "–")) or len(nxt_int) != 3 or not nxt_int.isdigit():
                return
            text = text + " " + nxt
            j += 1

    yield from rec(0, count)


def _smoothness(values: list[float]) -> float:
    """Largest ratio between neighbouring years' values — year-on-year figures rarely jump 10x."""
    worst = 1.0
    for a, b in zip(values, values[1:]):
        hi, lo = max(abs(a), abs(b)), min(abs(a), abs(b))
        worst = max(worst, hi / max(lo, 1.0))
    return worst


def _read_row(tokens: list[str], field: str, year_columns: int | None) -> float | None:
    """The newest year's value of one table row, or None if the row can't be read unambiguously."""
    lo, hi = RANGES[field]
    # The header's column count is only a preference: a page can carry more than
    # one table, and a newly mandatory figure often has fewer years than the rest.
    max_count = min(len(tokens), 10)
    candidates: list[list[float]] = []
    for count in range(1, max_count + 1):
        for values in _partitions(tokens, count):
            if all(lo <= v <= hi for v in values):
                candidates.append(values)
    if not candidates:
        return None
    if year_columns:
        exact = [c for c in candidates if len(c) == year_columns]
        if exact:
            candidates = exact
    # Prefer the smoothest reading; on a tie, more columns (each value standing alone).
    candidates.sort(key=lambda c: (_smoothness(c), -len(c)))
    best = candidates[0]
    if len(candidates) > 1 and _smoothness(candidates[1]) == _smoothness(best) and candidates[1][0] != best[0]:
        return None  # genuinely ambiguous
    return best[0]


# Row labels. Order matters: the more specific patterns come first.
_LABELS: list[tuple[str, re.Pattern[str]]] = [
    ("feeShareOfRevenuePct", re.compile(r"^årsavgift(?:er|ernas|ers)?\b.*(andel|/\s*totala|/tot)", re.I)),
    ("annualFeePerSqm", re.compile(r"^(?!grund)årsavgift(?:er)?\b(?!.*grundavgift).*(kvm|m²|m2)", re.I)),
    ("debtPerSqmBr", re.compile(r"^skuldsättning\b.*(bostadsrätt|br-yta|bostadsrättsyta)", re.I)),
    ("debtPerSqmTotal", re.compile(r"^skuldsättning\b(?!.*bostadsrätt)", re.I)),
    # Reports from before the 2023 rules often call it "Lån per kvm".
    ("debtPerSqmTotal", re.compile(r"^lån\s+(?:per\s+)?(?:kvm|m²|m2|kr/kvm)", re.I)),
    ("savingsPerSqm", re.compile(r"^sparande\b", re.I)),
    ("interestSensitivityPct", re.compile(r"^räntekänslighet\b(?!.*grundavgift)", re.I)),
    ("energyCostPerSqm", re.compile(r"^energikostnad", re.I)),
    ("equityRatioPct", re.compile(r"^soliditet\b", re.I)),
]


@dataclass
class KeyFigure:
    field: str
    value: float
    page: int
    line: str


# "2023/24" or "2022 - 2023" — but not a date like "2024-12-31".
_BROKEN_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\s*[-/]\s*(?:(?:19|20)\d{2}|\d{2})\b(?![-/]\d)")


def _year_columns(lines: list[str]) -> int | None:
    """How many year columns the key-figure table on this page has (from its header row)."""
    best = None
    for line in lines:
        cleaned = _clean(line)
        # Broken fiscal years: "2022 - 2023 2021 - 2022" or "2023/24 2022/23".
        broken = _BROKEN_YEAR_RE.findall(cleaned)
        if len(broken) >= 2 and len(_BROKEN_YEAR_RE.sub("", cleaned).strip()) <= 25:
            best = max(best or 0, len(broken))
            continue
        years = _YEAR_RE.findall(cleaned)
        # A header row is (almost) only years: "2024 2023 2022 2021" or "Nyckeltal 2024-12-31 2023-12-31 ...".
        if len(years) >= 2 and len(re.sub(r"[\d\-\s/]", "", cleaned)) <= 25:
            values = [int(y) for y in years]
            if all(abs(a - b) == 1 for a, b in zip(values, values[1:])):
                best = max(best or 0, len(values))
    return best


# A label that only becomes complete with the next line must look like a key-figure label, not prose.
_LABEL_HINT = re.compile(r"kvm|kr|%|andel|rörelseintäkter|bostadsrätt", re.I)


def _page_rows(page_number: int, text: str) -> dict[str, KeyFigure]:
    """Every key-figure row on one page (the first readable row per figure)."""
    raw_lines = [l for l in (text or "").splitlines() if l.strip()]
    if not raw_lines:
        return {}
    year_columns = _year_columns(raw_lines)
    lines = [_clean(l) for l in raw_lines]
    rows: dict[str, KeyFigure] = {}
    for i, line in enumerate(lines):
        label, numbers = _trailing_numbers(line)
        # A label wrapped over two lines ("Årsavgift per kvm upplåten med" / "bostadsrätt 790 772 ...").
        if not numbers and i + 1 < len(lines):
            nxt_label, nxt_numbers = _trailing_numbers(lines[i + 1])
            joined = f"{line} {nxt_label}".strip()
            if nxt_numbers and len(nxt_label) <= 45 and _LABEL_HINT.search(joined):
                label, numbers, line = joined, nxt_numbers, f"{line} {lines[i + 1]}"
        if not numbers or not label:
            continue
        for field, pattern in _LABELS:
            if not pattern.search(label):
                continue
            if field not in rows:
                value = _read_row(numbers, field, year_columns)
                if value is not None:
                    rows[field] = KeyFigure(field=field, value=value, page=page_number, line=line)
            break
    return rows


def extract_key_figures(pages: list[tuple[int, str]]) -> dict[str, KeyFigure]:
    """Reads the key figures from (page number, page text) pairs.

    The key figures sit together in one table, so the page with the most of
    them wins; other pages only fill in figures that table lacks. That keeps a
    stray number in a narrative page ("sparande över 200 kr/kvm är bra") from
    beating the real table row.
    """
    per_page = [rows for rows in (_page_rows(n, t) for n, t in pages) if rows]
    per_page.sort(key=len, reverse=True)
    found: dict[str, KeyFigure] = {}
    for rows in per_page:
        for field, figure in rows.items():
            found.setdefault(field, figure)
    return found


# ── Statements in the förvaltningsberättelse ─────────────────────────────────
# Only sentences whose subject is the association itself count, so a glossary
# entry ("En oäkta förening är ...") is never read as a statement about it.

_GENUINE = re.compile(
    r"föreningen\s+(?:är|utgör|betraktas\s+som|klassas\s+som|räknas\s+som)\s+(inte\s+|ej\s+)?"
    r"(?:ett\s+)?(?:privatbostadsföretag|(o?äkta)\s+(?:bostadsrätts)?förening)",
    re.I,
)
_LAND = re.compile(
    r"(?:föreningen|fastigheten|marken)\s+(?:innehar|innehas|äger|ägs|disponerar|upplåts)[^.]{0,80}?\b(tomträtt|äganderätt)",
    re.I,
)
_PLAN_TRUE = re.compile(r"(?:föreningen|det)\s+(?:har|finns)\s+(?:en\s+)?(?:aktuell|uppdaterad|gällande)?\s*underhållsplan", re.I)
_PLAN_FALSE = re.compile(r"föreningen\s+(?:saknar|har\s+ingen|har\s+inte\s+(?:någon|en))\s+(?:aktuell\s+)?underhållsplan", re.I)
_DATE = r"(\d{4}-\d{2}-\d{2}|\d{8})"
_FEE_DECIDED = re.compile(
    r"beslutat\w*\s+(?:att\s+|om\s+(?:en\s+)?)?(?:höja\s+(?:års)?avgifte?n?\s+med|(?:års)?avgiftshöjning\s+(?:med|på))\s+\+?(\d+(?:,\d+)?)\s*%"
    r"(?:[^.]{0,40}?(?:fr\.?\s?o\.?\s?m\.?|från|per)?\s*" + _DATE + r")?",
    re.I,
)
_FEE_SCHEDULED = re.compile(
    r"(?:års)?avgifte?n?\s+(?:höjs|kommer\s+att\s+höjas)\s+med\s+\+?(\d+(?:,\d+)?)\s*%\s*(?:fr\.?\s?o\.?\s?m\.?|från|per)\s*" + _DATE
    + r"|förändring\s+av\s+(?:års)?avgiften\s+med\s+\+?(\d+(?:,\d+)?)\s*%\s*(?:fr\.?\s?o\.?\s?m\.?|från|per)\s*" + _DATE,
    re.I,
)


def _iso(date: str) -> str:
    return f"{date[:4]}-{date[4:6]}-{date[6:]}" if len(date) == 8 else date


def extract_statements(full_text: str, fiscal_year: int | None = None) -> dict[str, object]:
    """The disclosures the reviewer also records, when the report states them plainly about itself."""
    text = _clean(full_text.replace("\n", " "))
    out: dict[str, object] = {}

    m = _GENUINE.search(text)
    if m:
        negated = bool(m.group(1)) or (m.group(2) or "").lower() == "oäkta"
        out["isGenuine"] = not negated

    m = _LAND.search(text)
    if m:
        out["landTenure"] = "leasehold" if m.group(1).lower() == "tomträtt" else "owned"

    if _PLAN_FALSE.search(text):
        out["hasMaintenancePlan"] = False
    elif _PLAN_TRUE.search(text):
        out["hasMaintenancePlan"] = True

    # A decided fee change for the coming year — never a change that already happened.
    for m in list(_FEE_DECIDED.finditer(text)) + list(_FEE_SCHEDULED.finditer(text)):
        groups = [g for g in m.groups() if g]
        pct = next((g for g in groups if not re.fullmatch(_DATE, g)), None)
        date = next((g for g in groups if re.fullmatch(_DATE, g)), None)
        if pct is None:
            continue
        if date and fiscal_year and int(date[:4]) <= fiscal_year:
            continue
        if not date and m.re is _FEE_SCHEDULED:
            continue
        out["feeChangePct"] = float(pct.replace(",", "."))
        if date:
            out["feeChangeEffective"] = _iso(date)
        break
    return out


def _newest_header_year(text: str) -> int | None:
    """The year the report ends in, from the key-figure table's header row.

    A broken fiscal year counts as the year it ends: "2023/24" and
    "2022 - 2023" are reports for the year ending in 2024 and 2023.
    """
    best = None
    for line in (text or "").splitlines():
        cleaned = _clean(line)
        broken = _BROKEN_YEAR_RE.findall(cleaned)
        if len(broken) >= 2 and len(_BROKEN_YEAR_RE.sub("", cleaned).strip()) <= 25:
            for token in broken:
                start, end = re.split(r"\s*[-/]\s*", token)
                end_year = int(end) if len(end) == 4 else int(start[:2] + end)
                best = max(best or 0, end_year)
            continue
        years = [int(y) for y in _YEAR_RE.findall(cleaned)]
        if len(years) >= 2 and len(re.sub(r"[\d\-\s/]", "", cleaned)) <= 25:
            best = max(best or 0, max(years))
    return best


def key_figures_payload(pages: list[tuple[int, str]], fiscal_year: int | None) -> dict:
    """The JSON the upload endpoint returns: values keyed like the review form, plus where each was found.

    `fiscal_year` is the extractor's own guess; the key-figure table's header
    is more reliable when there is one (it also handles broken fiscal years).
    """
    figures = extract_key_figures(pages)
    values: dict[str, object] = {f: kf.value for f, kf in figures.items()}
    evidence = {f: f"s. {kf.page}: {kf.line}" for f, kf in figures.items()}
    if figures:
        table_page = next(iter(figures.values())).page
        fiscal_year = _newest_header_year(next((t for n, t in pages if n == table_page), "")) or fiscal_year
    statements = extract_statements("\n".join(t for _, t in pages), fiscal_year)
    for key, value in statements.items():
        values.setdefault(key, value)
    if fiscal_year:
        values["fiscalYear"] = fiscal_year
    return {"values": values, "evidence": evidence}
