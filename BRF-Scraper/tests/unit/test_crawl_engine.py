"""Tests for CrawlerEngine."""

from __future__ import annotations

from pydantic import HttpUrl

from brf_scraper.crawler.engine import CrawlerEngine
from brf_scraper.crawler.models import (
    ContentType,
    CrawlConfig,
    CrawlStatus,
    DocumentReference,
)


class TestCrawlerEngine:
    """Tests for CrawlerEngine."""

    def test_create_engine(self) -> None:
        """Test creating a CrawlerEngine."""
        engine = CrawlerEngine()

        assert engine.status == CrawlStatus.PENDING
        assert engine.metrics.pages_crawled == 0
        assert len(engine.documents) == 0

    def test_create_engine_with_config(self) -> None:
        """Test creating engine with config."""
        config = CrawlConfig(max_depth=5, max_pages=50)
        engine = CrawlerEngine(config=config)

        assert engine._config.max_depth == 5
        assert engine._config.max_pages == 50

    def test_get_documents_by_type(self) -> None:
        """Test get_documents_by_type method."""
        engine = CrawlerEngine()

        doc1 = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/report.pdf"),
            content_type=ContentType.PDF,
        )
        doc2 = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/page.html"),
            content_type=ContentType.HTML,
        )
        engine._documents = [doc1, doc2]

        pdfs = engine.get_documents_by_type("pdf")
        assert len(pdfs) == 1

    def test_get_pdf_documents(self) -> None:
        """Test get_pdf_documents method."""
        engine = CrawlerEngine()

        doc = DocumentReference(
            source_url=HttpUrl("https://example.com"),
            document_url=HttpUrl("https://example.com/report.pdf"),
            content_type=ContentType.PDF,
        )
        engine._documents = [doc]

        pdfs = engine.get_pdf_documents()
        assert len(pdfs) == 1

    def test_reset(self) -> None:
        """Test reset method."""
        engine = CrawlerEngine()
        engine._metrics.pages_crawled = 10

        engine.reset()

        assert engine.status == CrawlStatus.PENDING
        assert engine.metrics.pages_crawled == 0

    def test_is_internal(self) -> None:
        """Test _is_internal method."""
        engine = CrawlerEngine()

        assert engine._is_internal("https://example.com/page") is True
