"""Downloader implementation for fetching documents via HTTP."""

from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from brf_scraper.base import BaseInterface
from brf_scraper.config import DownloaderSettings
from brf_scraper.downloader.models import (
    Document,
    DownloadMetadata,
    DownloadRequest,
    DownloadResult,
    DownloadStatus,
)
from brf_scraper.exceptions import DownloaderError, FileTooLargeError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# MIME type detection for common PDF-related extensions
_MIME_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
    ".xml": "application/xml",
}


def _guess_filename_from_url(url: str) -> str:
    """Extract a filename from a URL path.

    Args:
        url: The URL to parse.

    Returns:
        Decoded filename, or 'index.html' if path is empty.
    """
    parsed = urlparse(url)
    path = unquote(parsed.path)
    if not path or path.endswith("/"):
        return "index.html"
    return Path(path).name


def _guess_mime_type(filename: str, content_type_header: str | None = None) -> str:
    """Determine MIME type from content-type header or filename extension.

    Args:
        filename: Original filename.
        content_type_header: Content-Type header value.

    Returns:
        MIME type string.
    """
    if content_type_header:
        # Strip parameters (e.g. "; charset=utf-8")
        mime = content_type_header.split(";")[0].strip()
        if mime:
            return mime

    ext = Path(filename).suffix.lower()
    return _MIME_TYPES.get(ext, "application/octet-stream")


class Downloader(BaseInterface):
    """HTTP document downloader.

    Downloads files via HTTP and computes checksums, detects MIME types,
    and extracts download metadata. Uses the built-in httpx client.
    """

    def __init__(
        self,
        settings: DownloaderSettings | None = None,
        http_client: Any | None = None,
    ) -> None:
        """Initialize downloader.

        Args:
            settings: Downloader configuration.
            http_client: Optional pre-configured httpx.AsyncClient.
        """
        self._settings = settings or DownloaderSettings()
        self._client: Any = http_client
        self._owns_client = http_client is None

    @property
    def settings(self) -> DownloaderSettings:
        """Get downloader settings."""
        return self._settings

    async def initialize(self) -> None:
        """Initialize HTTP client."""
        if self._client is None:
            import httpx

            self._client = httpx.AsyncClient(
                timeout=self._settings.chunk_size,
                follow_redirects=True,
                headers={"User-Agent": "BRF-Scraper/0.1.0"},
            )
        logger.info("downloader_initialized")

    async def close(self) -> None:
        """Close HTTP client."""
        if self._owns_client and self._client:
            await self._client.aclose()
            self._client = None
        logger.info("downloader_closed")

    async def download(self, request: DownloadRequest) -> DownloadResult:
        """Download a document from the given request.

        Args:
            request: Download request with URL and metadata.

        Returns:
            DownloadResult with the downloaded document or error info.
        """
        from datetime import datetime as _dt

        started_at = _dt.now()
        monotonic_start = time.monotonic()

        logger.info(
            "download_started",
            url=str(request.document_url),
            request_id=str(request.id),
        )

        try:
            url = str(request.document_url)
            response = await self._client.get(
                url,
                headers={"Accept": "application/pdf, */*"},
            )

            elapsed = time.monotonic() - monotonic_start

            # Check HTTP status
            if response.status_code < 200 or response.status_code >= 400:
                return DownloadResult(
                    request_id=request.id,
                    status=DownloadStatus.FAILED,
                    error=f"HTTP {response.status_code}",
                    error_code="HTTP_ERROR",
                    started_at=started_at,
                    completed_at=_dt.now(),
                )

            content = response.content

            # Check file size
            if len(content) > self._settings.max_file_size:
                raise FileTooLargeError(
                    file_size=len(content),
                    max_size=self._settings.max_file_size,
                )

            # Compute checksum
            sha256 = hashlib.sha256(content).hexdigest()

            # Detect MIME type and filename
            content_type_header = response.headers.get("content-type")
            filename = _guess_filename_from_url(url)
            mime_type = _guess_mime_type(filename, content_type_header)

            # Extract metadata
            download_metadata = DownloadMetadata(
                content_type=content_type_header,
                content_length=int(response.headers.get("content-length", len(content))),
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
                http_headers=dict(response.headers),
                download_source=url,
                response_time=elapsed,
            )

            document = Document(
                source_url=url,
                original_filename=filename,
                sha256_checksum=sha256,
                file_size=len(content),
                mime_type=mime_type,
                download_status=DownloadStatus.COMPLETED,
                download_metadata=download_metadata,
                downloaded_at=_dt.now(),
                metadata=request.metadata,
            )

            logger.info(
                "download_completed",
                url=url,
                sha256=sha256[:16],
                size=len(content),
                mime_type=mime_type,
                elapsed=elapsed,
            )

            return DownloadResult(
                request_id=request.id,
                document=document,
                status=DownloadStatus.COMPLETED,
                started_at=started_at,
                completed_at=_dt.now(),
            )

        except FileTooLargeError:
            raise

        except Exception as e:
            elapsed = time.monotonic() - monotonic_start
            logger.error(
                "download_failed",
                url=str(request.document_url),
                error=str(e),
                elapsed=elapsed,
            )
            return DownloadResult(
                request_id=request.id,
                status=DownloadStatus.FAILED,
                error=str(e),
                error_code="DOWNLOAD_ERROR",
                started_at=started_at,
                completed_at=_dt.now(),
            )

    async def download_bytes(self, url: str) -> bytes:
        """Download raw bytes from a URL.

        Args:
            url: URL to download.

        Returns:
            Response content bytes.

        Raises:
            DownloaderError: If download fails.
        """
        try:
            response = await self._client.get(url)
            response.raise_for_status()
            result: bytes = response.content
            return result
        except Exception as e:
            raise DownloaderError(
                f"Failed to download: {url}: {e}",
                details={"url": url, "error": str(e)},
            ) from e
