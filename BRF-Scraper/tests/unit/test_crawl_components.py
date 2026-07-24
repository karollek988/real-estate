"""Tests for crawler components."""

from __future__ import annotations

import pytest
from pydantic import HttpUrl

from brf_scraper.crawler.link_extractor import LinkExtractor
from brf_scraper.crawler.models import CrawlRequest
from brf_scraper.crawler.pdf_detector import PdfDetector
from brf_scraper.crawler.queue import CrawlQueue
from brf_scraper.crawler.rate_limiter import RateLimiter
from brf_scraper.crawler.robots import RobotsManager


class TestPdfDetector:
    """Tests for PdfDetector."""

    def test_is_pdf_by_url(self) -> None:
        """Test PDF detection by URL."""
        detector = PdfDetector()

        assert detector.is_pdf_by_url("https://example.com/report.pdf") is True
        assert detector.is_pdf_by_url("https://example.com/REPORT.PDF") is True
        assert detector.is_pdf_by_url("https://example.com/page.html") is False

    def test_is_pdf_by_content_type(self) -> None:
        """Test PDF detection by Content-Type."""
        detector = PdfDetector()

        assert detector.is_pdf_by_content_type("application/pdf") is True
        assert detector.is_pdf_by_content_type("application/pdf; charset=utf-8") is True
        assert detector.is_pdf_by_content_type("text/html") is False
        assert detector.is_pdf_by_content_type(None) is False

    def test_is_pdf_by_magic_bytes(self) -> None:
        """Test PDF detection by magic bytes."""
        detector = PdfDetector()

        assert detector.is_pdf_by_magic_bytes(b"%PDF-1.4") is True
        assert detector.is_pdf_by_magic_bytes(b"<html>") is False
        assert detector.is_pdf_by_magic_bytes(b"") is False

    def test_detect_pdf(self) -> None:
        """Test full PDF detection."""
        detector = PdfDetector()

        result = detector.detect_pdf(url="https://example.com/report.pdf")
        assert result["is_pdf"] is True
        assert result["method"] == "url_extension"

        result = detector.detect_pdf(content_type="application/pdf")
        assert result["is_pdf"] is True
        assert result["method"] == "content_type"

    def test_extract_pdf_info(self) -> None:
        """Test PDF info extraction."""
        detector = PdfDetector()

        info = detector.extract_pdf_info("https://example.com/arsredovisning-2023.pdf")
        assert info["year"] == 2023
        assert "filename" in info


class TestLinkExtractor:
    """Tests for LinkExtractor."""

    def test_extract_links(self) -> None:
        """Test link extraction."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/page1">Link1</a><a href="https://other.com/page2">Link2</a>'

        links = extractor.extract_links(html)
        assert len(links) == 2

    def test_extract_internal_links(self) -> None:
        """Test internal link extraction."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/internal">Internal</a><a href="https://external.com">External</a>'

        internal = extractor.extract_internal_links(html)
        assert len(internal) == 1
        assert "example.com" in internal[0]

    def test_extract_external_links(self) -> None:
        """Test external link extraction."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/internal">Internal</a><a href="https://external.com">External</a>'

        external = extractor.extract_external_links(html)
        assert len(external) == 1
        assert "external.com" in external[0]

    def test_extract_pdf_links(self) -> None:
        """Test PDF link extraction."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/report.pdf">Report</a><a href="/page.html">Page</a>'

        pdfs = extractor.extract_pdf_links(html)
        assert len(pdfs) == 1
        assert ".pdf" in pdfs[0]

    def test_extract_document_links(self) -> None:
        """Test document link extraction."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/arsredovisning.pdf">Report</a><a href="/dokument">Docs</a>'

        docs = extractor.extract_document_links(html)
        assert len(docs) == 2

    def test_skip_javascript_urls(self) -> None:
        """Test skipping javascript URLs."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="javascript:void(0)">Link</a>'

        links = extractor.extract_links(html)
        assert len(links) == 0

    def test_resolve_relative_urls(self) -> None:
        """Test relative URL resolution."""
        extractor = LinkExtractor(base_url="https://example.com")
        html = '<a href="/relative">Link</a>'

        links = extractor.extract_links(html)
        assert len(links) == 1
        assert links[0].startswith("https://example.com")


class TestCrawlQueue:
    """Tests for CrawlQueue."""

    def test_create_queue(self) -> None:
        """Test creating a CrawlQueue."""
        queue = CrawlQueue()

        assert queue.is_empty() is True
        assert queue.size == 0

    def test_put_and_get(self) -> None:
        """Test put and get operations."""
        queue = CrawlQueue()
        request = CrawlRequest(url=HttpUrl("https://example.com"))

        result = queue.put(request)
        assert result is True
        assert queue.size == 1

        got = queue.get()
        assert got is not None
        assert str(got.url) == "https://example.com/"

    def test_deduplication(self) -> None:
        """Test URL deduplication."""
        queue = CrawlQueue()
        request1 = CrawlRequest(url=HttpUrl("https://example.com"))
        request2 = CrawlRequest(url=HttpUrl("https://example.com"))

        queue.put(request1)
        result = queue.put(request2)

        assert result is False
        assert queue.size == 1

    def test_has_url(self) -> None:
        """Test has_url method."""
        queue = CrawlQueue()
        request = CrawlRequest(url=HttpUrl("https://example.com"))

        assert queue.has_url("https://example.com") is False
        queue.put(request)
        assert queue.has_url("https://example.com") is True

    def test_priority_order(self) -> None:
        """Test priority ordering."""
        queue = CrawlQueue()
        low_priority = CrawlRequest(url=HttpUrl("https://low.com"), priority=1)
        high_priority = CrawlRequest(url=HttpUrl("https://high.com"), priority=10)

        queue.put(low_priority)
        queue.put(high_priority)

        first = queue.get()
        assert first is not None
        assert "high" in str(first.url)

    def test_clear(self) -> None:
        """Test clear method."""
        queue = CrawlQueue()
        request = CrawlRequest(url=HttpUrl("https://example.com"))
        queue.put(request)

        queue.clear()
        assert queue.is_empty() is True
        assert queue.seen_count == 0


class TestRateLimiter:
    """Tests for RateLimiter."""

    def test_create_rate_limiter(self) -> None:
        """Test creating a RateLimiter."""
        limiter = RateLimiter(requests_per_second=10.0)

        assert limiter._rps == 10.0

    @pytest.mark.asyncio
    async def test_acquire(self) -> None:
        """Test acquire method."""
        limiter = RateLimiter(requests_per_second=100.0, burst_size=10)

        wait_time = await limiter.acquire("https://example.com")
        assert wait_time == 0.0

    @pytest.mark.asyncio
    async def test_wait_and_acquire(self) -> None:
        """Test wait_and_acquire method."""
        limiter = RateLimiter(requests_per_second=100.0, burst_size=10)

        await limiter.wait_and_acquire("https://example.com")

    def test_reset(self) -> None:
        """Test reset method."""
        limiter = RateLimiter()
        limiter.reset()

        tokens = limiter.get_tokens("https://example.com")
        assert tokens == pytest.approx(limiter._burst_size, abs=0.01)


class TestRobotsManager:
    """Tests for RobotsManager."""

    def test_create_robots_manager(self) -> None:
        """Test creating a RobotsManager."""
        manager = RobotsManager()

        assert manager._user_agent == "*"

    def test_get_base_url(self) -> None:
        """Test _get_base_url method."""
        manager = RobotsManager()

        base_url = manager._get_base_url("https://example.com/page/path")
        assert base_url == "https://example.com"

    def test_clear_cache(self) -> None:
        """Test clear_cache method."""
        manager = RobotsManager()
        manager._cache["test"] = (None, 0.0)

        manager.clear_cache()
        assert len(manager._cache) == 0
