"""Crawl queue with deduplication and priority support."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from typing import Any
from urllib.parse import urlparse

from brf_scraper.crawler.models import CrawlRequest


class CrawlQueue:
    """Priority queue for crawl requests with deduplication."""

    def __init__(self, max_size: int = 10000) -> None:
        """Initialize crawl queue.

        Args:
            max_size: Maximum queue size
        """
        self._max_size = max_size
        self._queue: asyncio.PriorityQueue[tuple[int, float, CrawlRequest]] = asyncio.PriorityQueue(
            maxsize=max_size
        )
        self._seen: OrderedDict[str, bool] = OrderedDict()
        self._count = 0.0

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for deduplication."""
        parsed = urlparse(url)
        # Remove fragment, normalize scheme and netloc
        normalized = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path}"
        # Remove trailing slash
        if normalized.endswith("/"):
            normalized = normalized[:-1]
        return normalized

    @property
    def size(self) -> int:
        """Get current queue size."""
        return self._queue.qsize()

    @property
    def seen_count(self) -> int:
        """Get number of seen URLs."""
        return len(self._seen)

    def is_empty(self) -> bool:
        """Check if queue is empty."""
        return self._queue.empty()

    def is_full(self) -> bool:
        """Check if queue is full."""
        return self._queue.full()

    def has_url(self, url: str) -> bool:
        """Check if URL has been seen."""
        normalized = self._normalize_url(url)
        return normalized in self._seen

    def put(self, request: CrawlRequest) -> bool:
        """Add a request to the queue.

        Args:
            request: Crawl request to add

        Returns:
            True if added, False if duplicate or full
        """
        normalized = self._normalize_url(str(request.url))

        if normalized in self._seen:
            return False

        if self._queue.full():
            return False

        self._seen[normalized] = True
        self._count += 0.001
        # Use negative priority for max-heap (higher priority first)
        priority = -request.priority
        self._queue.put_nowait((priority, self._count, request))
        return True

    async def put_async(self, request: CrawlRequest) -> bool:
        """Add a request to the queue asynchronously.

        Args:
            request: Crawl request to add

        Returns:
            True if added, False if duplicate or full
        """
        normalized = self._normalize_url(str(request.url))

        if normalized in self._seen:
            return False

        if self._queue.full():
            return False

        self._seen[normalized] = True
        self._count += 0.001
        priority = -request.priority
        await self._queue.put((priority, self._count, request))
        return True

    def get(self) -> CrawlRequest | None:
        """Get next request from queue.

        Returns:
            CrawlRequest or None if empty
        """
        if self._queue.empty():
            return None

        _, _, request = self._queue.get_nowait()
        return request

    async def get_async(self) -> CrawlRequest | None:
        """Get next request from queue asynchronously.

        Returns:
            CrawlRequest or None if empty
        """
        try:
            _, _, request = await asyncio.wait_for(self._queue.get(), timeout=0.1)
            return request
        except (TimeoutError, asyncio.QueueEmpty):
            return None

    def clear(self) -> None:
        """Clear the queue."""
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        self._seen.clear()
        self._count = 0.0

    def get_stats(self) -> dict[str, Any]:
        """Get queue statistics."""
        return {
            "size": self.size,
            "seen_count": self.seen_count,
            "is_empty": self.is_empty(),
            "is_full": self.is_full(),
        }
