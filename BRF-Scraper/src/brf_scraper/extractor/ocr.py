"""Shared Tesseract OCR helper — the one place image-to-text happens for
scanned PDF pages (pdf_reader.py), directly uploaded report photos
(image_reader.py), and the listing-screenshot endpoint in api/server.py.

Best-effort by design: any failure (missing tesseract binary, corrupt
image, unsupported format) returns "" rather than raising. OCR is always a
fallback/best-effort path here, never a hard dependency — callers already
treat "no text extracted" as a normal, handled outcome.
"""
from __future__ import annotations

from PIL import Image, ImageOps

from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# Swedish first (annual reports and Hemnet listings are Swedish-language),
# English second (numbers/units/the occasional English loanword still OCR
# correctly under either, and some listings mix in English marketing copy).
LANGUAGES = "swe+eng"

# A word belongs to the row above/below it if its vertical position is
# within this fraction of the taller of the two words' heights — generous
# enough to absorb baseline/ascender jitter between words Tesseract boxed
# separately, tight enough not to merge two genuinely different table rows.
_ROW_BAND_FRACTION = 0.6

# A horizontal gap wider than this multiple of the row's text height is
# treated as a column boundary (label -> first figure, or figure -> the
# next year's comparison figure) rather than a normal space between two
# words of the same phrase. Measured against a real scanned annual report:
# within-number gaps ("1" -> "260" -> "185") ran ~0.4-0.6x the text height;
# the gap from a label to its first figure, and between the two years'
# figures, ran 5x-30x it — a wide margin either side of this threshold.
_COLUMN_GAP_HEIGHT_MULTIPLE = 1.5


def ocr_image(image: Image.Image) -> str:
    """Run Tesseract OCR on a PIL image and return the extracted text, with
    words reassembled into lines by their actual vertical position on the
    page rather than Tesseract's own reading-order guess.

    `pytesseract.image_to_string` was the original implementation here, but
    on a multi-column financial statement (line-item labels on the left,
    two years of figures in right-aligned columns — exactly how every
    Swedish BRF annual report's income statement and balance sheet are
    laid out) Tesseract's automatic page segmentation frequently reads the
    page as separate blocks: every label top-to-bottom, THEN every number
    top-to-bottom, rather than row by row. That silently breaks every
    downstream keyword search in financial_extractor.py, which all assume
    a value appears on the same line as (or just below) its label — a
    scanned report would OCR to real text yet still extract almost nothing,
    with no error anywhere to explain why. Confirmed against a real scanned
    BRF annual report: `image_to_string` put every label in one block and
    every number in another; grouping by vertical position below restored
    the correct "label  value  value" line for every statement row.
    """
    try:
        import pytesseract

        prepared = ImageOps.exif_transpose(image) or image
        prepared = ImageOps.grayscale(prepared)
        prepared = ImageOps.autocontrast(prepared)
        data = pytesseract.image_to_data(prepared, lang=LANGUAGES, output_type=pytesseract.Output.DICT)
        return _reconstruct_rows(data)
    except Exception as e:
        logger.warning("ocr_failed", error=str(e))
        return ""


def _reconstruct_rows(data: dict) -> str:
    """Rebuild OCR'd text as lines ordered top-to-bottom, left-to-right,
    from Tesseract's per-word bounding boxes — undoing any block/column
    grouping Tesseract's own page segmentation applied. See ocr_image()
    for why this matters for tabular financial statements.

    A wide gap between two words on the same reconstructed line (a label
    to its first figure, or one year's figure to the next year's) is kept
    as a double space rather than collapsed to one. financial_extractor.py's
    Swedish-number parser already relies on exactly that distinction — a
    single space joins the thousand-groups of ONE number ("1 260 185"), a
    wider gap separates two DIFFERENT numbers on the same line (this year
    vs. the comparison year) — so losing it here would make every
    multi-column row look like one run-on number or get flagged ambiguous.
    """
    count = len(data.get("text", []))
    words = []
    for i in range(count):
        text = data["text"][i].strip()
        if not text:
            continue
        words.append(
            {
                "text": text,
                "left": data["left"][i],
                "top": data["top"][i],
                "width": data["width"][i],
                "height": data["height"][i],
            }
        )
    if not words:
        return ""

    words.sort(key=lambda w: w["top"])

    rows: list[list[dict]] = [[words[0]]]
    row_top = words[0]["top"]
    row_height = words[0]["height"]
    for word in words[1:]:
        if abs(word["top"] - row_top) <= max(row_height, word["height"]) * _ROW_BAND_FRACTION:
            rows[-1].append(word)
            row_top = min(row_top, word["top"])
            row_height = max(row_height, word["height"])
        else:
            rows.append([word])
            row_top = word["top"]
            row_height = word["height"]

    lines = []
    for row in rows:
        row.sort(key=lambda w: w["left"])
        parts = [row[0]["text"]]
        for prev, word in zip(row, row[1:]):
            gap = word["left"] - (prev["left"] + prev["width"])
            is_column_boundary = gap > max(prev["height"], word["height"]) * _COLUMN_GAP_HEIGHT_MULTIPLE
            parts.append("  " if is_column_boundary else " ")
            parts.append(word["text"])
        lines.append("".join(parts))
    return "\n".join(lines)
