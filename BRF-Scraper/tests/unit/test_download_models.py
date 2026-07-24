"""Tests for document acquisition models."""

from __future__ import annotations

from datetime import datetime

from brf_scraper.downloader.models import (
    Document,
    DownloadMetadata,
    DownloadRequest,
    DownloadResult,
    DownloadStatus,
)


class TestDownloadStatus:
    """Tests for DownloadStatus enum."""

    def test_download_status_values(self) -> None:
        assert DownloadStatus.PENDING == "pending"
        assert DownloadStatus.DOWNLOADING == "downloading"
        assert DownloadStatus.COMPLETED == "completed"
        assert DownloadStatus.FAILED == "failed"
        assert DownloadStatus.DUPLICATE == "duplicate"
        assert DownloadStatus.SKIPPED == "skipped"

    def test_download_status_count(self) -> None:
        assert len(DownloadStatus) == 6


class TestDownloadMetadata:
    """Tests for DownloadMetadata model."""

    def test_create_metadata(self) -> None:
        meta = DownloadMetadata()
        assert meta.content_type is None
        assert meta.content_length is None
        assert meta.etag is None
        assert meta.last_modified is None
        assert meta.http_headers == {}
        assert meta.download_source is None
        assert meta.response_time is None

    def test_create_metadata_with_values(self) -> None:
        meta = DownloadMetadata(
            content_type="application/pdf",
            content_length=1024,
            etag='"abc123"',
            last_modified="Thu, 01 Jan 2024 00:00:00 GMT",
            http_headers={"x-custom": "value"},
            download_source="https://example.com/file.pdf",
            response_time=1.5,
        )
        assert meta.content_type == "application/pdf"
        assert meta.content_length == 1024
        assert meta.etag == '"abc123"'
        assert meta.http_headers == {"x-custom": "value"}

    def test_to_dict(self) -> None:
        meta = DownloadMetadata(
            content_type="application/pdf",
            content_length=2048,
        )
        d = meta.to_dict()
        assert d["content_type"] == "application/pdf"
        assert d["content_length"] == 2048
        assert "http_headers" in d

    def test_to_dict_excludes_none(self) -> None:
        meta = DownloadMetadata(content_type="application/pdf")
        d = meta.to_dict()
        assert "content_length" not in d


class TestDocument:
    """Tests for Document model."""

    def test_create_document(self) -> None:
        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
        )
        assert str(doc.source_url) == "https://example.com/report.pdf"
        assert doc.original_filename == "report.pdf"
        assert doc.sha256_checksum == "a" * 64
        assert doc.file_size == 1024
        assert doc.mime_type == "application/pdf"
        assert doc.download_status == DownloadStatus.PENDING
        assert doc.stored_path is None
        assert doc.downloaded_at is None
        assert doc.id is not None

    def test_document_is_downloaded(self) -> None:
        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
            download_status=DownloadStatus.COMPLETED,
        )
        assert doc.is_downloaded is True

    def test_document_is_not_downloaded(self) -> None:
        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
        )
        assert doc.is_downloaded is False

    def test_document_is_duplicate(self) -> None:
        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
            download_status=DownloadStatus.DUPLICATE,
        )
        assert doc.is_duplicate is True

    def test_document_to_dict(self) -> None:
        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
        )
        d = doc.to_dict()
        assert "source_url" in d
        assert "sha256_checksum" in d
        assert "metadata" not in d


class TestDownloadRequest:
    """Tests for DownloadRequest model."""

    def test_create_request(self) -> None:
        req = DownloadRequest(
            source_url="https://brf.se",
            document_url="https://brf.se/report.pdf",
        )
        assert "brf.se" in str(req.source_url)
        assert "brf.se" in str(req.document_url)
        assert req.priority == 0
        assert req.id is not None

    def test_request_url_property(self) -> None:
        req = DownloadRequest(
            source_url="https://brf.se",
            document_url="https://brf.se/report.pdf",
        )
        assert req.url == "https://brf.se/report.pdf"

    def test_request_with_metadata(self) -> None:
        req = DownloadRequest(
            source_url="https://brf.se",
            document_url="https://brf.se/report.pdf",
            title="Annual Report 2024",
            filename="arsredovisning_2024.pdf",
            priority=5,
            metadata={"year": 2024},
        )
        assert req.title == "Annual Report 2024"
        assert req.priority == 5


class TestDownloadResult:
    """Tests for DownloadResult model."""

    def test_create_result(self) -> None:
        from uuid import uuid4

        result = DownloadResult(request_id=uuid4())
        assert result.status == DownloadStatus.PENDING
        assert result.document is None
        assert result.error is None
        assert result.is_success is False
        assert result.duration is None

    def test_result_is_success(self) -> None:
        from uuid import uuid4

        doc = Document(
            source_url="https://example.com/report.pdf",
            original_filename="report.pdf",
            sha256_checksum="a" * 64,
            file_size=1024,
            mime_type="application/pdf",
            download_status=DownloadStatus.COMPLETED,
        )
        result = DownloadResult(
            request_id=uuid4(),
            document=doc,
            status=DownloadStatus.COMPLETED,
        )
        assert result.is_success is True

    def test_result_duration(self) -> None:
        from uuid import uuid4

        result = DownloadResult(
            request_id=uuid4(),
            started_at=datetime(2024, 1, 1, 0, 0, 0),
            completed_at=datetime(2024, 1, 1, 0, 0, 5),
        )
        assert result.duration == 5.0
