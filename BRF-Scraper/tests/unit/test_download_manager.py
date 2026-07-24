"""Tests for DownloadManager."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from brf_scraper.downloader.downloader import Downloader
from brf_scraper.downloader.manager import DownloadManager
from brf_scraper.downloader.models import (
    Document,
    DownloadRequest,
    DownloadStatus,
)
from brf_scraper.downloader.sqlite_metadata import SqliteMetadataRepository
from brf_scraper.storage.local import LocalStorage


def _make_document(
    source_url: str = "https://example.com/report.pdf",
    sha256: str | None = None,
    status: DownloadStatus = DownloadStatus.COMPLETED,
) -> Document:
    return Document(
        source_url=source_url,
        original_filename="report.pdf",
        sha256_checksum=sha256 or ("a" * 64),
        file_size=1024,
        mime_type="application/pdf",
        download_status=status,
    )


def _make_request(
    url: str = "https://example.com/report.pdf",
) -> DownloadRequest:
    return DownloadRequest(
        source_url="https://example.com",
        document_url=url,
    )


class TestDownloadManager:
    """Tests for DownloadManager."""

    @pytest.fixture
    async def components(
        self, tmp_path: object
    ) -> tuple[Downloader, LocalStorage, SqliteMetadataRepository]:
        """Create test components."""
        import pathlib

        db_path = pathlib.Path(str(tmp_path)) / "test.db"
        storage_dir = pathlib.Path(str(tmp_path)) / "storage"

        metadata_repo = SqliteMetadataRepository(
            database_url=f"sqlite+aiosqlite:///{db_path}",
        )
        storage = LocalStorage(base_dir=storage_dir)

        return (
            Downloader(http_client=AsyncMock()),
            storage,
            metadata_repo,
        )

    @pytest.fixture
    async def manager(
        self,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> DownloadManager:
        """Create a DownloadManager with test components."""
        downloader, storage, metadata_repo = components
        mgr = DownloadManager(
            downloader=downloader,
            storage=storage,
            metadata_repo=metadata_repo,
            max_concurrent=2,
        )
        await mgr.initialize()
        yield mgr  # type: ignore[misc]
        await mgr.close()

    @pytest.mark.asyncio
    async def test_manager_stats_empty(self, manager: DownloadManager) -> None:
        stats = manager.stats
        assert stats["total"] == 0
        assert stats["completed"] == 0
        assert stats["success_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_download_success(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, _ = components

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"pdf content"
        mock_response.headers = {"content-type": "application/pdf"}
        mock_response.raise_for_status = MagicMock()

        downloader._client.get = AsyncMock(return_value=mock_response)

        request = _make_request()
        result = await manager.download(request)

        assert result.status == DownloadStatus.COMPLETED
        assert result.document is not None
        assert result.document.stored_path is not None

    @pytest.mark.asyncio
    async def test_download_detects_duplicate_by_url(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        _downloader, _, metadata_repo = components

        # Pre-populate with existing document
        existing = _make_document()
        await metadata_repo.save(existing)

        request = _make_request(url=str(existing.source_url))
        result = await manager.download(request)

        assert result.status == DownloadStatus.DUPLICATE
        assert result.document is not None
        assert result.document.id == existing.id

    @pytest.mark.asyncio
    async def test_download_detects_duplicate_by_checksum(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, metadata_repo = components

        content = b"same content"
        import hashlib

        checksum = hashlib.sha256(content).hexdigest()

        # Mock downloader to return consistent checksum
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = content
        mock_response.headers = {"content-type": "application/pdf"}
        downloader._client.get = AsyncMock(return_value=mock_response)

        # Pre-populate with existing document with same checksum
        existing = _make_document(
            source_url="https://other.com/report.pdf",
            sha256=checksum,
        )
        existing.download_status = DownloadStatus.COMPLETED
        await metadata_repo.save(existing)

        request = _make_request()
        result = await manager.download(request)

        # Should detect duplicate by checksum
        assert result.status == DownloadStatus.DUPLICATE

    @pytest.mark.asyncio
    async def test_download_stores_bytes(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, storage, _ = components

        content = b"test pdf content"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = content
        mock_response.headers = {"content-type": "application/pdf"}
        mock_response.raise_for_status = MagicMock()

        downloader._client.get = AsyncMock(return_value=mock_response)

        request = _make_request()
        result = await manager.download(request)

        assert result.document is not None
        assert result.document.stored_path is not None
        stored = await storage.load(result.document.stored_path)
        assert stored == content

    @pytest.mark.asyncio
    async def test_download_persists_metadata(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, metadata_repo = components

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"content"
        mock_response.headers = {"content-type": "application/pdf"}
        mock_response.raise_for_status = MagicMock()

        downloader._client.get = AsyncMock(return_value=mock_response)

        request = _make_request()
        result = await manager.download(request)

        assert result.document is not None
        fetched = await metadata_repo.get(result.document.id)
        assert fetched is not None
        assert fetched.download_status == DownloadStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_download_failure_propagates(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, _ = components

        mock_response = MagicMock()
        mock_response.status_code = 500
        downloader._client.get = AsyncMock(return_value=mock_response)

        request = _make_request()
        result = await manager.download(request)

        assert result.status == DownloadStatus.FAILED

    @pytest.mark.asyncio
    async def test_stats_after_operations(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, _ = components

        # One success
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"content"
        mock_response.headers = {"content-type": "application/pdf"}
        mock_response.raise_for_status = MagicMock()
        downloader._client.get = AsyncMock(return_value=mock_response)

        await manager.download(_make_request(url="https://a.se/report.pdf"))

        # One failure
        mock_response_fail = MagicMock()
        mock_response_fail.status_code = 500
        downloader._client.get = AsyncMock(return_value=mock_response_fail)

        await manager.download(_make_request(url="https://b.se/report.pdf"))

        stats = manager.stats
        assert stats["total"] == 2
        assert stats["completed"] == 1
        assert stats["failed"] == 1
        assert stats["success_rate"] == 0.5

    @pytest.mark.asyncio
    async def test_check_duplicate(self, manager: DownloadManager) -> None:
        result = await manager.check_duplicate("x" * 64)
        assert result is None

    @pytest.mark.asyncio
    async def test_download_many(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        downloader, _, _ = components

        # Each request makes 2 HTTP calls (download + download_bytes). Under
        # real concurrency (max_concurrent=2), those calls from different
        # requests interleave on the shared mock, so responses must be
        # resolved by URL rather than consumed off a flat ordered queue.
        content_by_url = {
            f"https://example.com/report{i}.pdf": f"content{i}".encode() for i in range(3)
        }

        async def fake_get(url: str, *args: object, **kwargs: object) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = content_by_url[url]
            mock_resp.headers = {"content-type": "application/pdf"}
            mock_resp.raise_for_status = MagicMock()
            return mock_resp

        downloader._client.get = AsyncMock(side_effect=fake_get)

        requests = [_make_request(url=f"https://example.com/report{i}.pdf") for i in range(3)]

        results = await manager.download_many(requests)
        assert len(results) == 3
        assert all(r.status == DownloadStatus.COMPLETED for r in results)

    @pytest.mark.asyncio
    async def test_download_many_concurrent_duplicate_checksum(
        self,
        manager: DownloadManager,
        components: tuple[Downloader, LocalStorage, SqliteMetadataRepository],
    ) -> None:
        """Two concurrent downloads of identical content must never both
        be persisted as COMPLETED: the atomic checksum claim in
        DownloadManager must resolve the race to exactly one COMPLETED
        and one DUPLICATE, regardless of scheduling order.
        """
        downloader, _, metadata_repo = components

        same_content = b"identical annual report bytes"

        async def fake_get(url: str, *args: object, **kwargs: object) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = same_content
            mock_resp.headers = {"content-type": "application/pdf"}
            mock_resp.raise_for_status = MagicMock()
            return mock_resp

        downloader._client.get = AsyncMock(side_effect=fake_get)

        requests = [
            _make_request(url="https://example.com/dup-a.pdf"),
            _make_request(url="https://example.com/dup-b.pdf"),
        ]

        results = await manager.download_many(requests)

        assert len(results) == 2
        statuses = sorted(r.status for r in results)
        assert statuses == sorted([DownloadStatus.COMPLETED, DownloadStatus.DUPLICATE])

        import hashlib

        checksum = hashlib.sha256(same_content).hexdigest()
        stored = await metadata_repo.list_documents()
        assert sum(1 for doc in stored if doc.sha256_checksum == checksum) == 1
