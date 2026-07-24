"""Tests for crawler models."""

from __future__ import annotations

import pytest
from pydantic import HttpUrl

from brf_scraper.crawler.models import (
    ContentType,
    CrawlConfig,
    CrawlMetrics,
    CrawlRequest,
    CrawlResponse,
    CrawlStatus,
    DocumentReference,
    DocumentStatus,
)


class TestContentType:
    def test_content_type_values(self) -> None:
        assert ContentType.PDF == "pdf"
        assert ContentType.HTML == "html"

    def test_content_type_count(self) -> None:
        assert len(ContentType) >= 3


class TestDocumentStatus:
    def test_document_status_values(self) -> None:
        assert DocumentStatus.DISCOVERED == "discovered"


class TestCrawlStatus:
    def test_crawl_status_values(self) -> None:
        assert CrawlStatus.PENDING == "pending"
        assert CrawlStatus.RUNNING == "running"
        assert CrawlStatus.COMPLETED == "completed"


class TestDocumentReference:
    def test_create_document_reference(self) -> None:
        doc = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/report.pdf"),
        )
        assert doc.document_url is not None

    def test_document_reference_is_pdf(self) -> None:
        doc = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/report.pdf"),
            content_type=ContentType.PDF,
        )
        assert doc.is_pdf() is True

    def test_document_reference_has_size(self) -> None:
        doc = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/report.pdf"),
            size=1024,
        )
        assert doc.size == 1024


class TestCrawlRequest:
    def test_create_crawl_request(self) -> None:
        req = CrawlRequest(url=HttpUrl("https://example.com"))
        assert req.depth == 0

    def test_crawl_request_with_depth(self) -> None:
        req = CrawlRequest(url=HttpUrl("https://example.com"), depth=3)
        assert req.depth == 3


class TestCrawlResponse:
    def test_create_crawl_response(self) -> None:
        from uuid import uuid4

        resp = CrawlResponse(request_id=uuid4(), url=HttpUrl("https://example.com"))
        assert resp.status_code is None

    def test_crawl_response_success(self) -> None:
        from uuid import uuid4

        resp = CrawlResponse(
            request_id=uuid4(),
            url=HttpUrl("https://example.com"),
            status_code=200,
        )
        assert resp.is_success is True

    def test_crawl_response_error(self) -> None:
        from uuid import uuid4

        resp = CrawlResponse(
            request_id=uuid4(),
            url=HttpUrl("https://example.com"),
            status_code=500,
        )
        assert resp.is_success is False


class TestCrawlConfig:
    def test_create_crawl_config(self) -> None:
        config = CrawlConfig()
        assert config.max_depth >= 1
        assert config.max_pages >= 1

    def test_crawl_config_custom(self) -> None:
        config = CrawlConfig(max_depth=5, max_pages=100)
        assert config.max_depth == 5
        assert config.max_pages == 100


class TestCrawlMetrics:
    def test_create_crawl_metrics(self) -> None:
        metrics = CrawlMetrics()
        assert metrics.pages_crawled == 0

    def test_crawl_metrics_properties(self) -> None:
        metrics = CrawlMetrics()
        metrics.pages_crawled = 10
        metrics.pages_failed = 2
        assert metrics.pages_crawled == 10

    def test_crawl_metrics_average_response_time(self) -> None:
        metrics = CrawlMetrics()
        assert metrics.average_response_time == 0.0

    def test_crawl_metrics_record_response_time(self) -> None:
        metrics = CrawlMetrics()
        metrics.record_response_time(1.0)
        metrics.record_response_time(2.0)
        assert metrics.average_response_time == pytest.approx(1.5)

    def test_crawl_metrics_to_dict(self) -> None:
        metrics = CrawlMetrics()
        d = metrics.to_dict()
        assert "pages_crawled" in d
