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


def ocr_image(image: Image.Image) -> str:
    """Run Tesseract OCR on a PIL image and return the extracted text."""
    try:
        import pytesseract

        prepared = ImageOps.exif_transpose(image) or image
        prepared = ImageOps.grayscale(prepared)
        prepared = ImageOps.autocontrast(prepared)
        return pytesseract.image_to_string(prepared, lang=LANGUAGES)
    except Exception as e:
        logger.warning("ocr_failed", error=str(e))
        return ""
