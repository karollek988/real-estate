"""PDF text extraction using pdfplumber.

Handles text-based PDFs. Pages pdfplumber can't extract text from (scanned
images) fall back to OCR — see _ocr_page_image below.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

from brf_scraper.utils.logging import get_logger

from .ocr import ocr_image

logger = get_logger(__name__)

MIN_CHARS_PER_PAGE = 30


@dataclass
class PageText:
    """Text content from a single PDF page."""

    page_number: int  # 1-indexed
    text: str
    char_count: int = 0
    tables: list[list[list[str]]] = field(default_factory=list)

    def __post_init__(self):
        self.char_count = len(self.text)


@dataclass
class PDFDocument:
    """Extracted text from a PDF file."""

    path: str
    total_pages: int = 0
    pages: list[PageText] = field(default_factory=list)

    @property
    def is_text_based(self) -> bool:
        return any(p.char_count >= MIN_CHARS_PER_PAGE for p in self.pages)

    @property
    def pages_with_text(self) -> int:
        return sum(1 for p in self.pages if p.char_count >= MIN_CHARS_PER_PAGE)

    @property
    def full_text(self) -> str:
        """All page text concatenated with page separators."""
        return "\n\n--- PAGE BREAK ---\n\n".join(
            p.text for p in self.pages if p.char_count > 0
        )

    def get_page(self, number: int) -> PageText | None:
        """Get page by 1-indexed number."""
        for p in self.pages:
            if p.page_number == number:
                return p
        return None

    def search_text(self, query: str, max_results: int = 5) -> list[tuple[int, str]]:
        """Search for text across all pages. Returns [(page_number, context)]."""
        results = []
        query_lower = query.lower()
        for p in self.pages:
            if query_lower in p.text.lower():
                idx = p.text.lower().index(query_lower)
                start = max(0, idx - 80)
                end = min(len(p.text), idx + len(query) + 80)
                context = p.text[start:end]
                results.append((p.page_number, context))
                if len(results) >= max_results:
                    break
        return results

    def find_in_tables(
        self, keyword: str, value_column: int = 1
    ) -> list[tuple[int, float | str | None]]:
        """Search for a keyword in extracted tables and return values.

        Tables are lists of rows, each row is a list of cell values.
        We look for a row where the first cell contains the keyword,
        then return the value from the specified column.

        Returns list of (page_number, value) tuples.
        """
        results = []
        keyword_lower = keyword.lower()

        for page in self.pages:
            for table in page.tables:
                if not table or len(table) < 2:
                    continue

                # First row might be headers
                for row in table:
                    if not row or not row[0]:
                        continue

                    cell_text = str(row[0]).lower().strip()
                    if keyword_lower in cell_text:
                        # Found the row - get value from target column
                        if value_column < len(row):
                            val_str = str(row[value_column]).strip()
                            if val_str:
                                results.append((page.page_number, val_str))

        return results
        return results


def _ocr_page_image(pdf_path: str, page_index: int, dpi: int = 300) -> str:
    """Render one PDF page to an image (via PyMuPDF) and OCR it. Returns ""
    on any failure — a page OCR can't read just stays empty, same as a
    pdfplumber page with no extractable text."""
    try:
        import fitz  # PyMuPDF
        from PIL import Image

        with fitz.open(pdf_path) as doc:
            pix = doc[page_index].get_pixmap(dpi=dpi)
            image = Image.open(io.BytesIO(pix.tobytes("png")))
        return ocr_image(image)
    except Exception as e:
        logger.warning("page_ocr_failed", path=pdf_path, page=page_index + 1, error=str(e))
        return ""


def read_pdf(path: str | Path, max_pages: int = 50) -> PDFDocument:
    """Extract text from a PDF file.

    Returns a PDFDocument with per-page text. A page pdfplumber can't pull
    text from (a scanned image) falls back to OCR; only a page that still
    yields nothing after that stays empty.
    """
    path = str(path)
    doc = PDFDocument(path=path)

    try:
        with pdfplumber.open(path) as pdf:
            doc.total_pages = len(pdf.pages)
            pages_to_process = pdf.pages[:max_pages]

            for i, page in enumerate(pages_to_process):
                text = (page.extract_text() or "").strip()
                tables = page.extract_tables() or []
                if len(text) < MIN_CHARS_PER_PAGE:
                    ocr_text = _ocr_page_image(path, i).strip()
                    if len(ocr_text) > len(text):
                        text = ocr_text
                doc.pages.append(
                    PageText(
                        page_number=i + 1,
                        text=text,
                        tables=tables,
                    )
                )

    except Exception as e:
        logger.error("pdf_read_failed", path=path, error=str(e))
        return doc

    if doc.is_text_based:
        logger.info(
            "pdf_text_extracted",
            path=path,
            total_pages=doc.total_pages,
            pages_with_text=doc.pages_with_text,
            total_chars=sum(p.char_count for p in doc.pages),
        )
    else:
        logger.warning(
            "pdf_no_text_extracted",
            path=path,
            total_pages=doc.total_pages,
            hint="PDF appears to be a scanned image and OCR could not extract readable text from it either",
        )

    return doc
