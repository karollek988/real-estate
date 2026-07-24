"""Crawler worker for async page fetching."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from brf_scraper.crawler.link_extractor import LinkExtractor
from brf_scraper.crawler.models import (
    ContentType,
    CrawlConfig,
    CrawlRequest,
    CrawlResponse,
    DocumentReference,
)
from brf_scraper.crawler.pdf_detector import PdfDetector


class CrawlerWorker:
    """Worker for crawling web pages."""

    def __init__(
        self,
        config: CrawlConfig,
        client: Any = None,
    ) -> None:
        """Initialize crawler worker.

        Args:
            config: Crawl configuration
            client: HTTP client (creates new if None)
        """
        self._config = config
        self._client = client
        self._pdf_detector = PdfDetector()
        self._link_extractor: LinkExtractor | None = None

    async def initialize(self) -> None:
        """Initialize HTTP client."""
        if self._client is None:
            try:
                import httpx

                self._client = httpx.AsyncClient(
                    timeout=self._config.timeout,
                    headers={"User-Agent": self._config.user_agent, **self._config.headers},
                    follow_redirects=self._config.follow_redirects,
                    max_redirects=self._config.max_redirects,
                )
            except ImportError as err:
                raise RuntimeError("httpx is required for crawling") from err

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def crawl(self, request: CrawlRequest) -> CrawlResponse:
        """Crawl a single URL.

        Args:
            request: Crawl request

        Returns:
            CrawlResponse with results
        """
        response = CrawlResponse(request_id=request.id, url=request.url)
        start_time = time.time()

        try:
            # Make HTTP request
            http_response = await self._fetch(str(request.url))
            response.status_code = http_response.status_code
            response.final_url = str(http_response.url)  # type: ignore[assignment]
            response.response_time = time.time() - start_time

            # Check if successful
            if http_response.status_code >= 400:
                response.error = f"HTTP {http_response.status_code}"
                return response

            # Get content type
            content_type_header = http_response.headers.get("content-type", "")
            response.content_type = content_type_header

            # Check if PDF
            if self._pdf_detector.is_pdf_by_content_type(content_type_header):
                doc = self._create_document_reference(
                    source_url=str(request.url),
                    document_url=str(http_response.url),
                    content_type_header=content_type_header,
                    headers=dict(http_response.headers),
                )
                response.documents.append(doc)
                return response

            # Check for PDF by URL
            if self._pdf_detector.is_pdf_by_url(str(request.url)):
                doc = self._create_document_reference(
                    source_url=str(request.url),
                    document_url=str(http_response.url),
                    content_type_header=content_type_header,
                    headers=dict(http_response.headers),
                )
                response.documents.append(doc)
                return response

            # Parse HTML
            if "text/html" in content_type_header:
                html = http_response.text
                response.html = html

                # Extract title
                title_match = __import__("re").search(
                    r"<title[^>]*>([^<]+)</title>", html, __import__("re").IGNORECASE
                )
                if title_match:
                    response.title = title_match.group(1).strip()

                # Initialize link extractor
                if self._link_extractor is None:
                    self._link_extractor = LinkExtractor(
                        base_url=str(request.url),
                        allowed_domains=self._config.allowed_domains,
                        blocked_domains=self._config.blocked_domains,
                    )

                # Extract links
                all_links = self._link_extractor.extract_links(html, str(request.url))
                response.links = all_links

                # Extract document links
                doc_links = self._link_extractor.extract_document_links(html, str(request.url))
                for doc_url in doc_links:
                    doc = self._create_document_reference(
                        source_url=str(request.url),
                        document_url=doc_url,
                        content_type_header=None,
                        headers={},
                    )
                    response.documents.append(doc)

        except Exception as e:
            response.error = str(e)
            response.response_time = time.time() - start_time

        return response

    async def _fetch(self, url: str) -> Any:
        """Fetch a URL with retry logic.

        Args:
            url: URL to fetch

        Returns:
            HTTP response
        """
        last_error = None
        for attempt in range(self._config.retry_count + 1):
            try:
                response = await self._client.get(url)
                return response
            except Exception as e:
                last_error = e
                if attempt < self._config.retry_count:
                    await asyncio.sleep(self._config.retry_delay * (2**attempt))

        raise last_error  # type: ignore[misc]

    async def head_request(self, url: str) -> dict[str, Any]:
        """Make a HEAD request to check URL headers.

        Args:
            url: URL to check

        Returns:
            Dictionary with header information
        """
        try:
            response = await self._client.head(url)
            return {
                "status_code": response.status_code,
                "content_type": response.headers.get("content-type"),
                "content_length": response.headers.get("content-length"),
                "etag": response.headers.get("etag"),
                "last_modified": response.headers.get("last-modified"),
                "content_disposition": response.headers.get("content-disposition"),
            }
        except Exception:
            return {}

    def _create_document_reference(
        self,
        source_url: str,
        document_url: str,
        content_type_header: str | None,
        headers: dict[str, str],
    ) -> DocumentReference:
        """Create a DocumentReference from URL and headers.

        Args:
            source_url: Source page URL
            document_url: Document URL
            content_type_header: Content-Type header
            headers: Response headers

        Returns:
            DocumentReference
        """
        # Extract PDF info
        pdf_info = self._pdf_detector.extract_pdf_info(document_url)

        # Get file size
        size = None
        if "content-length" in headers:
            try:
                size = int(headers["content-length"])
            except ValueError:
                pass

        # Determine content type
        content_type = ContentType.PDF
        if content_type_header and "pdf" not in content_type_header.lower():
            content_type = ContentType.UNKNOWN

        # Get ETag and Last-Modified
        etag = headers.get("etag")
        last_modified = headers.get("last-modified")

        return DocumentReference(
            source_url=source_url,
            document_url=document_url,
            title=pdf_info.get("name"),
            filename=pdf_info.get("filename"),
            mime_type=content_type_header or "application/pdf",
            size=size,
            year=pdf_info.get("year"),
            content_type=content_type,
            etag=etag,
            last_modified=last_modified,
            confidence=0.9 if content_type == ContentType.PDF else 0.5,
        )

    async def __aenter__(self) -> CrawlerWorker:
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.close()
