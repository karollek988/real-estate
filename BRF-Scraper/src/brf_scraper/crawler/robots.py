"""Robots.txt manager for crawl compliance."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser


class RobotsManager:
    """Manages robots.txt parsing and compliance."""

    def __init__(
        self,
        user_agent: str = "*",
        cache_ttl: int = 3600,
    ) -> None:
        """Initialize robots manager.

        Args:
            user_agent: User agent string for robots.txt
            cache_ttl: Cache time-to-live in seconds
        """
        self._user_agent = user_agent
        self._cache_ttl = cache_ttl
        self._cache: dict[str, tuple[RobotFileParser, float]] = {}
        self._client: Any = None

    async def initialize(self) -> None:
        """Initialize HTTP client."""
        try:
            import httpx

            self._client = httpx.AsyncClient(timeout=10.0)
        except ImportError:
            pass

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _get_base_url(self, url: str) -> str:
        """Get base URL for robots.txt."""
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def _is_cache_valid(self, base_url: str) -> bool:
        """Check if cached robots.txt is still valid."""
        import time

        if base_url not in self._cache:
            return False
        _, timestamp = self._cache[base_url]
        return (time.time() - timestamp) < self._cache_ttl

    async def fetch_robots_txt(self, url: str) -> RobotFileParser:
        """Fetch and parse robots.txt for a URL.

        Args:
            url: URL to check robots.txt for

        Returns:
            Parsed RobotFileParser
        """
        base_url = self._get_base_url(url)

        if self._is_cache_valid(base_url):
            parser, _ = self._cache[base_url]
            return parser

        parser = RobotFileParser()
        robots_url = f"{base_url}/robots.txt"

        try:
            if self._client:
                response = await self._client.get(robots_url)
                if response.status_code == 200:
                    parser.parse(response.text.splitlines())
                # If robots.txt not found, parser defaults to allow everything
        except Exception:
            # On error, parser defaults to allow everything
            pass

        import time

        self._cache[base_url] = (parser, time.time())
        return parser

    async def can_fetch(self, url: str, user_agent: str | None = None) -> bool:
        """Check if URL can be fetched according to robots.txt.

        Args:
            url: URL to check
            user_agent: User agent (uses default if None)

        Returns:
            True if allowed, False otherwise
        """
        agent = user_agent or self._user_agent
        parser = await self.fetch_robots_txt(url)
        return parser.can_fetch(agent, url)

    async def get_crawl_delay(self, url: str, user_agent: str | None = None) -> float | None:
        """Get crawl delay for URL.

        Args:
            url: URL to check
            user_agent: User agent (uses default if None)

        Returns:
            Crawl delay in seconds or None
        """
        agent = user_agent or self._user_agent
        parser = await self.fetch_robots_txt(url)
        delay = parser.crawl_delay(agent)
        return float(delay) if delay is not None else None

    def clear_cache(self) -> None:
        """Clear the robots.txt cache."""
        self._cache.clear()

    async def __aenter__(self) -> RobotsManager:
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
