"""Tests for metadata repository."""

from __future__ import annotations

from uuid import uuid4

import pytest

from brf_scraper.downloader.models import (
    Document,
    DownloadMetadata,
    DownloadStatus,
)
from brf_scraper.downloader.sqlite_metadata import SqliteMetadataRepository


def _make_document(
    source_url: str = "https://example.com/report.pdf",
    sha256: str | None = None,
    status: DownloadStatus = DownloadStatus.COMPLETED,
) -> Document:
    """Create a test document."""
    return Document(
        source_url=source_url,
        original_filename="report.pdf",
        sha256_checksum=sha256 or ("a" * 64),
        file_size=1024,
        mime_type="application/pdf",
        download_status=status,
        download_metadata=DownloadMetadata(
            content_type="application/pdf",
            content_length=1024,
        ),
    )


class TestSqliteMetadataRepository:
    """Tests for SqliteMetadataRepository."""

    @pytest.fixture
    async def repo(self, tmp_path: object) -> SqliteMetadataRepository:
        """Create an in-memory SQLite metadata repository."""
        import pathlib

        db_path = pathlib.Path(str(tmp_path)) / "test_metadata.db"
        repo = SqliteMetadataRepository(
            database_url=f"sqlite+aiosqlite:///{db_path}",
        )
        await repo.initialize()
        yield repo  # type: ignore[misc]
        await repo.close()

    @pytest.mark.asyncio
    async def test_save_and_get(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document()
        await repo.save(doc)

        fetched = await repo.get(doc.id)
        assert fetched is not None
        assert fetched.source_url == doc.source_url
        assert fetched.sha256_checksum == doc.sha256_checksum

    @pytest.mark.asyncio
    async def test_get_nonexistent(self, repo: SqliteMetadataRepository) -> None:
        result = await repo.get(uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_save_updates_existing(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document()
        await repo.save(doc)

        doc.file_size = 2048
        await repo.save(doc)

        fetched = await repo.get(doc.id)
        assert fetched is not None
        assert fetched.file_size == 2048

    @pytest.mark.asyncio
    async def test_get_by_checksum(self, repo: SqliteMetadataRepository) -> None:
        checksum = "b" * 64
        doc = _make_document(sha256=checksum)
        await repo.save(doc)

        found = await repo.get_by_checksum(checksum)
        assert found is not None
        assert found.id == doc.id

    @pytest.mark.asyncio
    async def test_get_by_checksum_not_found(self, repo: SqliteMetadataRepository) -> None:
        result = await repo.get_by_checksum("c" * 64)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_source_url(self, repo: SqliteMetadataRepository) -> None:
        url = "https://brf.se/report.pdf"
        doc = _make_document(source_url=url)
        await repo.save(doc)

        found = await repo.get_by_source_url(url)
        assert found is not None
        assert found.id == doc.id

    @pytest.mark.asyncio
    async def test_get_by_source_url_not_found(self, repo: SqliteMetadataRepository) -> None:
        result = await repo.get_by_source_url("https://nonexistent.se")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_status(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document(status=DownloadStatus.PENDING)
        await repo.save(doc)

        await repo.update_status(doc.id, DownloadStatus.COMPLETED)

        fetched = await repo.get(doc.id)
        assert fetched is not None
        assert fetched.download_status == DownloadStatus.COMPLETED
        assert fetched.downloaded_at is not None

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, repo: SqliteMetadataRepository) -> None:
        from brf_scraper.exceptions import StorageError

        with pytest.raises(StorageError):
            await repo.update_status(uuid4(), DownloadStatus.COMPLETED)

    @pytest.mark.asyncio
    async def test_list_documents(self, repo: SqliteMetadataRepository) -> None:
        doc1 = _make_document(source_url="https://a.se/report.pdf", sha256="a" * 64)
        doc2 = _make_document(source_url="https://b.se/report.pdf", sha256="b" * 64)
        await repo.save(doc1)
        await repo.save(doc2)

        docs = await repo.list_documents()
        assert len(docs) == 2

    @pytest.mark.asyncio
    async def test_list_documents_with_status_filter(self, repo: SqliteMetadataRepository) -> None:
        doc1 = _make_document(
            source_url="https://a.se/report.pdf",
            sha256="a" * 64,
            status=DownloadStatus.COMPLETED,
        )
        doc2 = _make_document(
            source_url="https://b.se/report.pdf",
            sha256="b" * 64,
            status=DownloadStatus.FAILED,
        )
        await repo.save(doc1)
        await repo.save(doc2)

        completed = await repo.list_documents(status=DownloadStatus.COMPLETED)
        assert len(completed) == 1
        assert completed[0].id == doc1.id

    @pytest.mark.asyncio
    async def test_count(self, repo: SqliteMetadataRepository) -> None:
        assert await repo.count() == 0

        doc = _make_document()
        await repo.save(doc)
        assert await repo.count() == 1

    @pytest.mark.asyncio
    async def test_count_with_status(self, repo: SqliteMetadataRepository) -> None:
        doc1 = _make_document(
            source_url="https://a.se/report.pdf",
            sha256="a" * 64,
            status=DownloadStatus.COMPLETED,
        )
        doc2 = _make_document(
            source_url="https://b.se/report.pdf",
            sha256="b" * 64,
            status=DownloadStatus.FAILED,
        )
        await repo.save(doc1)
        await repo.save(doc2)

        assert await repo.count(status=DownloadStatus.COMPLETED) == 1
        assert await repo.count(status=DownloadStatus.FAILED) == 1

    @pytest.mark.asyncio
    async def test_delete(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document()
        await repo.save(doc)
        assert await repo.exists(doc.id) is True

        deleted = await repo.delete(doc.id)
        assert deleted is True
        assert await repo.exists(doc.id) is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, repo: SqliteMetadataRepository) -> None:
        deleted = await repo.delete(uuid4())
        assert deleted is False

    @pytest.mark.asyncio
    async def test_exists(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document()
        await repo.save(doc)
        assert await repo.exists(doc.id) is True

    @pytest.mark.asyncio
    async def test_exists_false(self, repo: SqliteMetadataRepository) -> None:
        assert await repo.exists(uuid4()) is False

    @pytest.mark.asyncio
    async def test_save_new_inserts_when_unique(self, repo: SqliteMetadataRepository) -> None:
        doc = _make_document(sha256="f" * 64)
        result = await repo.save_new(doc)

        assert result.id == doc.id
        fetched = await repo.get(doc.id)
        assert fetched is not None

    @pytest.mark.asyncio
    async def test_save_new_returns_existing_on_checksum_conflict(
        self, repo: SqliteMetadataRepository
    ) -> None:
        checksum = "g" * 64
        first = _make_document(source_url="https://a.se/report.pdf", sha256=checksum)
        await repo.save_new(first)

        second = _make_document(source_url="https://b.se/report.pdf", sha256=checksum)
        result = await repo.save_new(second)

        assert result.id == first.id
        assert await repo.count() == 1

    @pytest.mark.asyncio
    async def test_is_duplicate(self, repo: SqliteMetadataRepository) -> None:
        checksum = "d" * 64
        doc = _make_document(sha256=checksum)
        await repo.save(doc)

        assert await repo.is_duplicate(checksum) is True
        assert await repo.is_duplicate("e" * 64) is False

    @pytest.mark.asyncio
    async def test_document_roundtrip_preserves_metadata(
        self, repo: SqliteMetadataRepository
    ) -> None:
        doc = _make_document()
        doc.download_metadata.http_headers = {"x-request-id": "abc"}
        doc.metadata = {"year": 2024, "brf_name": "Test BRF"}
        await repo.save(doc)

        fetched = await repo.get(doc.id)
        assert fetched is not None
        assert fetched.download_metadata.http_headers == {"x-request-id": "abc"}
        assert fetched.metadata == {"year": 2024, "brf_name": "Test BRF"}
