"""Link extractor for HTML content."""

from __future__ import annotations

import re
from typing import Any, ClassVar
from urllib.parse import urljoin, urlparse


class LinkExtractor:
    """Extracts and filters links from HTML content."""

    # Swedish BRF-related keywords for document detection
    DOCUMENT_KEYWORDS: ClassVar[list[str]] = [
        "arsredovisning",
        "årsredovisning",
        "annual report",
        "dokument",
        "dokumentarkiv",
        "downloads",
        "filer",
        "ekonomi",
        "stadgar",
        "budget",
        "verksamhetsberättelse",
        "resultat",
        "balansrapport",
        "redovisning",
    ]

    # PDF-related keywords
    PDF_KEYWORDS: ClassVar[list[str]] = [
        "pdf",
        ".pdf",
        "document",
        "download",
        "ladda ner",
    ]

    def __init__(
        self,
        base_url: str,
        allowed_domains: list[str] | None = None,
        blocked_domains: list[str] | None = None,
    ) -> None:
        """Initialize link extractor.

        Args:
            base_url: Base URL for resolving relative links
            allowed_domains: Allowed domains (empty = all allowed)
            blocked_domains: Blocked domains
        """
        self._base_url = base_url
        self._base_domain = urlparse(base_url).netloc
        self._allowed_domains = allowed_domains or []
        self._blocked_domains = blocked_domains or []

    def extract_links(self, html: str, current_url: str | None = None) -> list[str]:
        """Extract all links from HTML content.

        Args:
            html: HTML content
            current_url: Current page URL for resolving relative links

        Returns:
            List of extracted URLs
        """
        urls: list[str] = []
        source_url = current_url or self._base_url

        # Pattern for href attributes
        href_pattern = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
        # Pattern for src attributes (for images, scripts, etc.)
        src_pattern = re.compile(r'src=["\']([^"\']+)["\']', re.IGNORECASE)
        # Pattern for data-url attributes
        data_url_pattern = re.compile(r'data-url=["\']([^"\']+)["\']', re.IGNORECASE)

        for pattern in [href_pattern, src_pattern, data_url_pattern]:
            matches = pattern.findall(html)
            for match in matches:
                url = self._resolve_url(match, source_url)
                if url:
                    urls.append(url)

        return list(set(urls))  # Deduplicate

    def extract_internal_links(self, html: str, current_url: str | None = None) -> list[str]:
        """Extract internal links from HTML content.

        Args:
            html: HTML content
            current_url: Current page URL

        Returns:
            List of internal URLs
        """
        all_links = self.extract_links(html, current_url)
        return [url for url in all_links if self._is_internal(url)]

    def extract_external_links(self, html: str, current_url: str | None = None) -> list[str]:
        """Extract external links from HTML content.

        Args:
            html: HTML content
            current_url: Current page URL

        Returns:
            List of external URLs
        """
        all_links = self.extract_links(html, current_url)
        return [url for url in all_links if not self._is_internal(url)]

    def extract_document_links(self, html: str, current_url: str | None = None) -> list[str]:
        """Extract links to documents (PDFs, reports, etc.).

        Args:
            html: HTML content
            current_url: Current page URL

        Returns:
            List of document URLs
        """
        all_links = self.extract_links(html, current_url)
        return [url for url in all_links if self._is_document_link(url, html)]

    def extract_pdf_links(self, html: str, current_url: str | None = None) -> list[str]:
        """Extract PDF links from HTML content.

        Args:
            html: HTML content
            current_url: Current page URL

        Returns:
            List of PDF URLs
        """
        all_links = self.extract_links(html, current_url)
        return [url for url in all_links if self._is_pdf_link(url)]

    def _resolve_url(self, url: str, base_url: str) -> str | None:
        """Resolve a URL relative to base URL.

        Args:
            url: URL to resolve
            base_url: Base URL

        Returns:
            Resolved URL or None if invalid
        """
        # Skip empty URLs, javascript, mailto, tel
        if not url or url.startswith(("javascript:", "mailto:", "tel:", "data:")):
            return None

        # Skip anchors only
        if url.startswith("#"):
            return None

        try:
            # Resolve relative URL
            resolved = urljoin(base_url, url)
            parsed = urlparse(resolved)

            # Must have scheme and netloc
            if not parsed.scheme or not parsed.netloc:
                return None

            # Only http/https
            if parsed.scheme not in ("http", "https"):
                return None

            # Check domain filters
            if not self._is_domain_allowed(parsed.netloc):
                return None

            return resolved
        except Exception:
            return None

    def _is_internal(self, url: str) -> bool:
        """Check if URL is internal (same domain).

        Args:
            url: URL to check

        Returns:
            True if internal
        """
        parsed = urlparse(url)
        return parsed.netloc == self._base_domain

    def _is_domain_allowed(self, domain: str) -> bool:
        """Check if domain is allowed.

        Args:
            domain: Domain to check

        Returns:
            True if allowed
        """
        # Check blocked domains
        for blocked in self._blocked_domains:
            if blocked in domain:
                return False

        # Check allowed domains (empty = all allowed)
        if self._allowed_domains:
            for allowed in self._allowed_domains:
                if allowed in domain:
                    return True
            return False

        return True

    def _is_pdf_link(self, url: str) -> bool:
        """Check if URL is likely a PDF.

        Args:
            url: URL to check

        Returns:
            True if likely PDF
        """
        url_lower = url.lower()

        # Check extension
        if url_lower.endswith(".pdf"):
            return True

        # Check URL patterns
        for keyword in self.PDF_KEYWORDS:
            if keyword in url_lower:
                return True

        return False

    def _is_document_link(self, url: str, html: str) -> bool:
        """Check if URL is likely a document.

        Args:
            url: URL to check
            html: HTML content for context

        Returns:
            True if likely document
        """
        url_lower = url.lower()

        # Check URL for document keywords
        for keyword in self.DOCUMENT_KEYWORDS:
            if keyword in url_lower:
                return True

        # Check if PDF
        if self._is_pdf_link(url):
            return True

        return False

    def get_link_context(self, url: str, html: str) -> dict[str, Any]:
        """Get context information for a link.

        Args:
            url: URL to get context for
            html: HTML content

        Returns:
            Dictionary with context information
        """
        context: dict[str, Any] = {
            "is_internal": self._is_internal(url),
            "is_pdf": self._is_pdf_link(url),
            "is_document": self._is_document_link(url, html),
        }

        # Try to find link text
        link_pattern = re.compile(
            rf'href=["\']({re.escape(url)})["\'][^>]*>([^<]*)</a>',
            re.IGNORECASE,
        )
        match = link_pattern.search(html)
        if match:
            context["link_text"] = match.group(2).strip()

        return context
