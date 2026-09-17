"""Single-image OCR extraction for annual reports (e.g. a phone photo of a
paper report page), producing the same PDFDocument shape pdf_reader.py and
docx_reader.py produce, so extract_annual_report()'s downstream parsing
needs no changes to handle this source too.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

from brf_scraper.utils.logging import get_logger

from .ocr import ocr_image
from .pdf_reader import PageText, PDFDocument

logger = get_logger(__name__)


def read_image(path: str | Path) -> PDFDocument:
    """OCR a single image file into a one-"page" PDFDocument."""
    path = str(path)
    doc = PDFDocument(path=path, total_pages=1)

    try:
        with Image.open(path) as image:
            text = ocr_image(image).strip()
        doc.pages.append(PageText(page_number=1, text=text))
    except Exception as e:
        logger.error("image_read_failed", path=path, error=str(e))

    if doc.is_text_based:
        logger.info("image_text_extracted", path=path, total_chars=sum(p.char_count for p in doc.pages))
    else:
        logger.warning("image_no_text_extracted", path=path)

    return doc
