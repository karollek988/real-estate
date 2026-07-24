"""PDF detection utilities."""

from __future__ import annotations

import re
from typing import Any, ClassVar
from urllib.parse import urlparse


class PdfDetector:
    """Detects PDF documents by various methods."""

    # PDF magic bytes
    PDF_MAGIC_BYTES = b"%PDF"

    # Common PDF Content-Types
    PDF_CONTENT_TYPES: ClassVar[list[str]] = [
        "application/pdf",
        "application/x-pdf",
        "application/x-download",
        "binary/octet-stream",
    ]

    # PDF file extensions
    PDF_EXTENSIONS: ClassVar[list[str]] = [
        ".pdf",
        ".PDF",
    ]

    def __init__(self) -> None:
        """Initialize PDF detector."""
        pass

    def is_pdf_by_url(self, url: str) -> bool:
        """Check if URL points to a PDF by extension.

        Args:
            url: URL to check

        Returns:
            True if likely PDF
        """
        parsed = urlparse(url)
        path = parsed.path.lower()

        for ext in self.PDF_EXTENSIONS:
            if path.endswith(ext.lower()):
                return True

        return False

    def is_pdf_by_content_type(self, content_type: str | None) -> bool:
        """Check if Content-Type indicates PDF.

        Args:
            content_type: Content-Type header value

        Returns:
            True if PDF content type
        """
        if not content_type:
            return False

        # Remove parameters (e.g., "; charset=utf-8")
        mime_type = content_type.split(";")[0].strip().lower()

        return mime_type in self.PDF_CONTENT_TYPES

    def is_pdf_by_magic_bytes(self, data: bytes) -> bool:
        """Check if data starts with PDF magic bytes.

        Args:
            data: Data to check

        Returns:
            True if starts with %PDF
        """
        if len(data) < 4:
            return False
        return data[:4] == self.PDF_MAGIC_BYTES

    def is_pdf_by_headers(
        self,
        content_type: str | None = None,
        content_disposition: str | None = None,
        url: str | None = None,
    ) -> bool:
        """Check if response headers indicate PDF.

        Args:
            content_type: Content-Type header
            content_disposition: Content-Disposition header
            url: URL being fetched

        Returns:
            True if headers indicate PDF
        """
        # Check Content-Type
        if self.is_pdf_by_content_type(content_type):
            return True

        # Check Content-Disposition for .pdf filename
        if content_disposition:
            if ".pdf" in content_disposition.lower():
                return True

        # Check URL
        if url and self.is_pdf_by_url(url):
            return True

        return False

    def detect_pdf(
        self,
        url: str | None = None,
        content_type: str | None = None,
        content_disposition: str | None = None,
        data: bytes | None = None,
    ) -> dict[str, Any]:
        """Detect PDF using all available methods.

        Args:
            url: URL to check
            content_type: Content-Type header
            content_disposition: Content-Disposition header
            data: Response data

        Returns:
            Dictionary with detection results
        """
        result: dict[str, Any] = {
            "is_pdf": False,
            "confidence": 0.0,
            "method": None,
        }

        # Check by URL
        if url and self.is_pdf_by_url(url):
            result["is_pdf"] = True
            result["confidence"] = 0.8
            result["method"] = "url_extension"
            return result

        # Check by Content-Type
        if self.is_pdf_by_content_type(content_type):
            result["is_pdf"] = True
            result["confidence"] = 0.95
            result["method"] = "content_type"
            return result

        # Check by Content-Disposition
        if content_disposition and ".pdf" in content_disposition.lower():
            result["is_pdf"] = True
            result["confidence"] = 0.9
            result["method"] = "content_disposition"
            return result

        # Check by magic bytes
        if data and self.is_pdf_by_magic_bytes(data):
            result["is_pdf"] = True
            result["confidence"] = 0.99
            result["method"] = "magic_bytes"
            return result

        return result

    def extract_pdf_info(self, url: str) -> dict[str, Any]:
        """Extract PDF information from URL.

        Args:
            url: PDF URL

        Returns:
            Dictionary with PDF information
        """
        parsed = urlparse(url)
        path = parsed.path

        # Extract filename
        filename = path.split("/")[-1] if "/" in path else path

        # Remove extension
        if filename.lower().endswith(".pdf"):
            name = filename[:-4]
        else:
            name = filename

        # Try to extract year from filename
        year_match = re.search(r"(20\d{2})", name)
        year = int(year_match.group(1)) if year_match else None

        return {
            "filename": filename,
            "name": name,
            "year": year,
            "path": path,
            "domain": parsed.netloc,
        }
