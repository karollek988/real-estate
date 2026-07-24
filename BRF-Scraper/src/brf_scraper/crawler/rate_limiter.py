"""Rate limiter for crawl requests."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict


class RateLimiter:
    """Token bucket rate limiter for crawl requests."""

    def __init__(
        self,
        requests_per_second: float = 1.0,
        burst_size: int = 5,
        per_domain: bool = True,
    ) -> None:
        """Initialize rate limiter.

        Args:
            requests_per_second: Maximum requests per second
            burst_size: Maximum burst size
            per_domain: Whether to rate limit per domain
        """
        self._rps = requests_per_second
        self._burst_size = burst_size
        self._per_domain = per_domain
        self._tokens: dict[str, float] = defaultdict(lambda: float(burst_size))
        self._last_refill: dict[str, float] = defaultdict(time.time)
        self._lock = asyncio.Lock()

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL."""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.netloc or "global"

    def _refill_tokens(self, domain: str) -> None:
        """Refill tokens for a domain."""
        now = time.time()
        elapsed = now - self._last_refill[domain]
        self._tokens[domain] = min(
            self._burst_size,
            self._tokens[domain] + elapsed * self._rps,
        )
        self._last_refill[domain] = now

    async def acquire(self, url: str) -> float:
        """Acquire a token for making a request.

        Args:
            url: URL to request

        Returns:
            Time to wait before making the request
        """
        domain = self._get_domain(url) if self._per_domain else "global"

        async with self._lock:
            self._refill_tokens(domain)

            if self._tokens[domain] >= 1.0:
                self._tokens[domain] -= 1.0
                return 0.0

            # Calculate wait time
            wait_time = (1.0 - self._tokens[domain]) / self._rps
            self._tokens[domain] = 0.0
            return wait_time

    async def wait_and_acquire(self, url: str) -> None:
        """Wait and acquire a token.

        Args:
            url: URL to request
        """
        wait_time = await self.acquire(url)
        if wait_time > 0:
            await asyncio.sleep(wait_time)

    def get_tokens(self, url: str) -> float:
        """Get available tokens for a domain.

        Args:
            url: URL to check

        Returns:
            Available tokens
        """
        domain = self._get_domain(url) if self._per_domain else "global"
        self._refill_tokens(domain)
        return self._tokens[domain]

    def reset(self) -> None:
        """Reset the rate limiter."""
        self._tokens.clear()
        self._last_refill.clear()
