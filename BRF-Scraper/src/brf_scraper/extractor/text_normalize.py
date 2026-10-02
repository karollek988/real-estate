"""Shared text-normalization helpers for matching OCR'd Swedish text.

Tesseract frequently drops or mangles å/ä/ö on a scanned page while getting
the rest of a word right (confirmed against a real scanned annual report:
"rörelsekostnader" came back "rorelsekostnader", "lägenheter" came back
"lagenheter"). Every regex/keyword match against page text in this package
should fold through here first rather than assuming perfect diacritics, and
every literal pattern should be written assuming ITS OWN diacritics will
also be folded away before comparison.
"""
from __future__ import annotations

_DIACRITIC_FOLD = str.maketrans({"å": "a", "ä": "a", "ö": "o"})


def fold_diacritics(text: str) -> str:
    """Lowercase, then fold å/ä/ö to their plain-ASCII equivalents.

    Every character this touches folds one-to-one (single codepoint to
    single codepoint), so the result is always the same length as the
    input — a match found against folded text can be sliced directly out
    of the original string at the same indices.
    """
    return text.lower().translate(_DIACRITIC_FOLD)
