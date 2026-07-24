"""Tests for Downloader."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from brf_scraper.config import DownloaderSettings
from brf_scraper.downloader.downloader import (
    Downloader,
    _guess_filename_from_url,
    _guess_mime_type,
)
from brf_scraper.downloader.models import DownloadRequest, DownloadStatus
from brf_scraper.exceptions import FileTooLargeError


class TestGuessFilenameFromUrl:
    """Tests for _guess_filename_from_url helper."""

    def test_simple_pdf(self) -> None:
        assert _guess_filename_from_url("https://example.com/report.pdf") == "report.pdf"

    def test_nested_path(self) -> None:
        url = "https://example.com/path/to/report.pdf"
        assert _guess_filename_from_url(url) == "report.pdf"

    def test_url_encoded(self) -> None:
        url = "https://example.com/report%20file.pdf"
        assert _guess_filename_from_url(url) == "report file.pdf"

    def test_trailing_slash(self) -> None:
        assert _guess_filename_from_url("https://example.com/") == "index.html"

    def test_no_path(self) -> None:
        assert _guess_filename_from_url("https://example.com") == "index.html"


class TestGuessMimeType:
    """Tests for _guess_mime_type helper."""

    def test_pdf_extension(self) -> None:
        assert _guess_mime_type("report.pdf") == "application/pdf"

    def test_html_extension(self) -> None:
        assert _guess_mime_type("page.html") == "text/html"

    def test_content_type_header(self) -> None:
        result = _guess_mime_type(
            "file.bin",
            content_type_header="application/pdf; charset=utf-8",
        )
        assert result == "application/pdf"

    def test_content_type_header_preferred(self) -> None:
        result = _guess_mime_type(
            "file.txt",
            content_type_header="application/pdf",
        )
        assert result == "application/pdf"

    def test_unknown_extension(self) -> None:
        assert _guess_mime_type("file.xyz") == "application/octet-stream"


class TestDownloader:
    """Tests for Downloader."""

    @pytest.fixture
    def settings(self) -> DownloaderSettings:
        return DownloaderSettings(max_file_size=10 * 1024 * 1024)

    def _make_request(self, url: str = "https://example.com/report.pdf") -> DownloadRequest:
        return DownloadRequest(
            source_url="https://example.com",
            document_url=url,
        )

    @pytest.mark.asyncio
    async def test_downloader_init(self, settings: DownloaderSettings) -> None:
        downloader = Downloader(settings=settings)
        assert downloader.settings == settings

    @pytest.mark.asyncio
    async def test_initialize_creates_client(self, settings: DownloaderSettings) -> None:
        downloader = Downloader(settings=settings)
        await downloader.initialize()
        assert downloader._client is not None
        await downloader.close()

    @pytest.mark.asyncio
    async def test_close_releases_client(self, settings: DownloaderSettings) -> None:
        downloader = Downloader(settings=settings)
        await downloader.initialize()
        await downloader.close()
        assert downloader._client is None

    @pytest.mark.asyncio
    async def test_download_success(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"pdf content here"
        mock_response.headers = {
            "content-type": "application/pdf",
            "content-length": "16",
            "etag": '"abc123"',
            "last-modified": "Thu, 01 Jan 2024 00:00:00 GMT",
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        result = await downloader.download(request)

        assert result.status == DownloadStatus.COMPLETED
        assert result.document is not None
        assert result.document.sha256_checksum is not None
        assert len(result.document.sha256_checksum) == 64
        assert result.document.file_size == 16
        assert result.document.mime_type == "application/pdf"
        assert result.document.download_metadata.etag == '"abc123"'
        assert result.document.download_metadata.download_source == str(request.document_url)
        assert result.is_success is True

    @pytest.mark.asyncio
    async def test_download_http_error(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        result = await downloader.download(request)

        assert result.status == DownloadStatus.FAILED
        assert result.error_code == "HTTP_ERROR"
        assert "404" in result.error

    @pytest.mark.asyncio
    async def test_download_exception(self, settings: DownloaderSettings) -> None:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=ConnectionError("Network error"))

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        result = await downloader.download(request)

        assert result.status == DownloadStatus.FAILED
        assert result.error_code == "DOWNLOAD_ERROR"
        assert "Network error" in result.error

    @pytest.mark.asyncio
    async def test_download_file_too_large(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"x" * (20 * 1024 * 1024)  # 20MB > 10MB limit
        mock_response.headers = {"content-type": "application/pdf"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        with pytest.raises(FileTooLargeError):
            await downloader.download(request)

    @pytest.mark.asyncio
    async def test_download_records_response_time(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"content"
        mock_response.headers = {"content-type": "application/pdf"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        result = await downloader.download(request)

        assert result.document is not None
        assert result.document.download_metadata.response_time is not None
        assert result.document.download_metadata.response_time >= 0

    @pytest.mark.asyncio
    async def test_download_preserves_metadata(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"content"
        mock_response.headers = {
            "content-type": "application/pdf",
            "content-length": "7",
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()
        request.metadata = {"year": 2024, "brf_name": "Test BRF"}

        result = await downloader.download(request)

        assert result.document is not None
        assert result.document.metadata == {"year": 2024, "brf_name": "Test BRF"}

    @pytest.mark.asyncio
    async def test_download_bytes(self, settings: DownloaderSettings) -> None:
        mock_response = MagicMock()
        mock_response.content = b"raw bytes"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)

        content = await downloader.download_bytes("https://example.com/file.pdf")
        assert content == b"raw bytes"

    @pytest.mark.asyncio
    async def test_download_checksum_is_consistent(self, settings: DownloaderSettings) -> None:
        content = b"test content for checksum"
        import hashlib

        expected = hashlib.sha256(content).hexdigest()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = content
        mock_response.headers = {"content-type": "application/pdf"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        downloader = Downloader(settings=settings, http_client=mock_client)
        request = self._make_request()

        result = await downloader.download(request)

        assert result.document is not None
        assert result.document.sha256_checksum == expected
