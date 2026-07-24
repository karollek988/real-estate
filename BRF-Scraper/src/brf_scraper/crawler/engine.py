"""Crawler engine orchestrator."""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlparse

from brf_scraper.crawler.models import (
    CrawlConfig,
    CrawlMetrics,
    CrawlRequest,
    CrawlStatus,
    DocumentReference,
)
from brf_scraper.crawler.queue import CrawlQueue
from brf_scraper.crawler.rate_limiter import RateLimiter
from brf_scraper.crawler.robots import RobotsManager
from brf_scraper.crawler.worker import CrawlerWorker


class CrawlerEngine:
    """Orchestrates web crawling operations."""

    def __init__(
        self,
        config: CrawlConfig | None = None,
    ) -> None:
        """Initialize crawler engine.

        Args:
            config: Crawl configuration
        """
        self._config = config or CrawlConfig()
        self._queue = CrawlQueue(max_size=self._config.max_pages * 2)
        self._rate_limiter = RateLimiter(
            requests_per_second=1.0 / max(self._config.delay_between_requests, 0.1),
            burst_size=self._config.max_concurrent,
        )
        self._robots_manager = RobotsManager(
            user_agent=self._config.user_agent,
        )
        self._workers: list[CrawlerWorker] = []
        self._metrics = CrawlMetrics()
        self._documents: list[DocumentReference] = []
        self._status = CrawlStatus.PENDING
        self._active_tasks = 0
        self._lock = asyncio.Lock()

    @property
    def metrics(self) -> CrawlMetrics:
        """Get crawl metrics."""
        return self._metrics

    @property
    def documents(self) -> list[DocumentReference]:
        """Get discovered documents."""
        return self._documents.copy()

    @property
    def status(self) -> CrawlStatus:
        """Get engine status."""
        return self._status

    async def initialize(self) -> None:
        """Initialize the engine and workers."""
        await self._robots_manager.initialize()

        # Create workers
        for _ in range(self._config.max_concurrent):
            worker = CrawlerWorker(config=self._config)
            await worker.initialize()
            self._workers.append(worker)

    async def close(self) -> None:
        """Close the engine and workers."""
        for worker in self._workers:
            await worker.close()
        self._workers.clear()
        await self._robots_manager.close()

    async def crawl(
        self,
        start_url: str,
        max_pages: int | None = None,
    ) -> CrawlMetrics:
        """Crawl starting from a URL.

        Args:
            start_url: Starting URL
            max_pages: Maximum pages to crawl (overrides config)

        Returns:
            CrawlMetrics with results
        """
        self._status = CrawlStatus.RUNNING
        self._metrics.started_at = self._metrics.started_at or __import__("datetime").datetime.now()
        pages_limit = max_pages or self._config.max_pages

        # Add start URL to queue
        start_request = CrawlRequest(
            url=start_url,
            depth=0,
            priority=10,
        )
        await self._queue.put_async(start_request)

        # Process queue
        try:
            await self._process_queue(pages_limit)
        except Exception as e:
            self._status = CrawlStatus.FAILED
            self._metrics.completed_at = __import__("datetime").datetime.now()
            raise e

        self._status = CrawlStatus.COMPLETED
        self._metrics.completed_at = __import__("datetime").datetime.now()
        return self._metrics

    async def _process_queue(self, pages_limit: int) -> None:
        """Process the crawl queue.

        Args:
            pages_limit: Maximum pages to process
        """
        semaphore = asyncio.Semaphore(self._config.max_concurrent)

        while not self._queue.is_empty():
            # Check page limit
            if self._metrics.pages_crawled >= pages_limit:
                break

            request = await self._queue.get_async()
            if request is None:
                await asyncio.sleep(0.1)
                continue

            # Check robots.txt
            if self._config.respect_robots_txt:
                can_fetch = await self._robots_manager.can_fetch(str(request.url))
                if not can_fetch:
                    self._metrics.blocked_pages += 1
                    continue

            # Rate limiting
            await self._rate_limiter.wait_and_acquire(str(request.url))

            # Crawl with semaphore
            async with semaphore:
                self._active_tasks += 1
                try:
                    await self._crawl_page(request)
                finally:
                    self._active_tasks -= 1

        # Wait for active tasks to complete
        while self._active_tasks > 0:
            await asyncio.sleep(0.1)

    async def _crawl_page(self, request: CrawlRequest) -> None:
        """Crawl a single page.

        Args:
            request: Crawl request
        """
        if not self._workers:
            return

        worker = self._workers[0]

        try:
            response = await worker.crawl(request)

            # Update metrics
            self._metrics.pages_crawled += 1
            if response.response_time:
                self._metrics.record_response_time(response.response_time)

            # Count links
            for link in response.links:
                if self._is_internal(link):
                    self._metrics.internal_links += 1
                else:
                    self._metrics.external_links += 1

            # Add documents
            self._documents.extend(response.documents)
            self._metrics.pdfs_found += len(response.documents)

            # Add new URLs to queue
            if request.depth < self._config.max_depth:
                for link in response.links:
                    if self._is_internal(link):
                        new_request = CrawlRequest(
                            url=link,
                            depth=request.depth + 1,
                            parent_url=str(request.url),
                        )
                        await self._queue.put_async(new_request)

        except Exception:
            self._metrics.pages_failed += 1

    def _is_internal(self, url: str) -> bool:
        """Check if URL is internal.

        Args:
            url: URL to check

        Returns:
            True if internal
        """
        if not self._documents:
            return True

        parsed = urlparse(url)
        # Use the first document's source domain as reference
        if self._documents:
            source_domain = urlparse(str(self._documents[0].source_url)).netloc
            return parsed.netloc == source_domain
        return True

    def get_all_links(self) -> list[str]:
        """Get all discovered links.

        Returns:
            List of all discovered URLs
        """
        return []

    def get_documents_by_type(self, content_type: str) -> list[DocumentReference]:
        """Get documents filtered by content type.

        Args:
            content_type: Content type to filter by

        Returns:
            List of matching documents
        """
        return [doc for doc in self._documents if doc.content_type.value == content_type]

    def get_pdf_documents(self) -> list[DocumentReference]:
        """Get all PDF documents.

        Returns:
            List of PDF documents
        """
        return [doc for doc in self._documents if doc.is_pdf()]

    def reset(self) -> None:
        """Reset the engine."""
        self._queue.clear()
        self._metrics = CrawlMetrics()
        self._documents.clear()
        self._status = CrawlStatus.PENDING

    async def __aenter__(self) -> CrawlerEngine:
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
