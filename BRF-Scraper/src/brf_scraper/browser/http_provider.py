"""HTTP provider implementation using httpx."""

from __future__ import annotations

import random
import time
from typing import Any

import httpx

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]


def _get_random_user_agent() -> str:
    """Get a random user agent string."""
    return random.choice(USER_AGENTS)


class HttpProvider(BrowserProvider):
    """HTTP provider using httpx for fast, lightweight fetching.

    This provider is best for:
    - Static HTML pages
    - API endpoints
    - Sites that don't require JavaScript rendering
    """

    def __init__(self) -> None:
        """Initialize HTTP provider."""
        self._client: httpx.AsyncClient | None = None
        self._initialized = False

    @property
    def provider_type(self) -> ProviderType:
        """Get the provider type."""
        return ProviderType.HTTP

    @property
    def name(self) -> str:
        """Get the provider name."""
        return "httpx"

    @property
    def is_available(self) -> bool:
        """Check if httpx is available."""
        import importlib.util

        return importlib.util.find_spec("httpx") is not None

    async def initialize(self) -> None:
        """Initialize the HTTP client."""
        if self._initialized:
            return

        logger.info("http_provider_initializing")
        self._initialized = True

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._initialized = False
        logger.info("http_provider_closed")

    def _build_headers(self, config: BrowserConfig) -> dict[str, str]:
        """Build request headers."""
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        # Add user agent
        if config.user_agent:
            headers["User-Agent"] = config.user_agent
        elif config.user_agent_rotation:
            headers["User-Agent"] = _get_random_user_agent()
        else:
            headers["User-Agent"] = USER_AGENTS[0]

        # Add custom headers
        headers.update(config.headers)

        return headers

    def _build_client(self, config: BrowserConfig) -> httpx.AsyncClient:
        """Build HTTP client with configuration."""
        headers = self._build_headers(config)

        client_kwargs: dict[str, Any] = {
            "headers": headers,
            "timeout": httpx.Timeout(config.timeout),
            "follow_redirects": config.follow_redirects,
            "max_redirects": config.max_redirects,
            "verify": config.verify_ssl,
        }

        if config.proxy:
            client_kwargs["proxy"] = config.proxy

        return httpx.AsyncClient(**client_kwargs)

    def _parse_html_title(self, html: str) -> str:
        """Extract title from HTML."""
        import re

        match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        return match.group(1).strip() if match else ""

    def _parse_cookies(self, response: httpx.Response) -> dict[str, str]:
        """Parse cookies from response."""
        cookies: dict[str, str] = {}
        for cookie in response.cookies.items():
            cookies[cookie[0]] = cookie[1]
        return cookies

    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL using HTTP.

        Args:
            url: URL to fetch.
            config: Optional configuration.
            **kwargs: Additional options.

        Returns:
            FetchResult with response data.
        """
        config = config or BrowserConfig()
        start_time = time.monotonic()

        logger.info("http_fetch_start", url=url)

        try:
            client = self._build_client(config)
            async with client as client:
                response = await client.get(url)
                elapsed = time.monotonic() - start_time

                html = response.text
                title = self._parse_html_title(html)

                result = FetchResult(
                    original_url=url,
                    final_url=str(response.url),
                    provider_used=self.provider_type,
                    status_code=response.status_code,
                    response_headers=dict(response.headers),
                    html=html,
                    title=title,
                    response_time=elapsed,
                    redirect_count=len(response.history),
                    cookies=self._parse_cookies(response),
                    content_length=len(html.encode("utf-8")),
                    encoding=response.encoding,
                )

                logger.info(
                    "http_fetch_complete",
                    url=url,
                    status=response.status_code,
                    elapsed=elapsed,
                )

                return result

        except httpx.TimeoutException as e:
            elapsed = time.monotonic() - start_time
            logger.error("http_fetch_timeout", url=url, elapsed=elapsed)
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error=f"Timeout: {e!s}",
                error_code="TIMEOUT",
                response_time=elapsed,
            )

        except httpx.TooManyRedirects as e:
            elapsed = time.monotonic() - start_time
            logger.error("http_fetch_redirects", url=url, error=str(e))
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error=f"Too many redirects: {e!s}",
                error_code="TOO_MANY_REDIRECTS",
                response_time=elapsed,
            )

        except httpx.HTTPStatusError as e:
            elapsed = time.monotonic() - start_time
            logger.error("http_fetch_status_error", url=url, status=e.response.status_code)
            return FetchResult(
                original_url=url,
                final_url=str(e.response.url),
                provider_used=self.provider_type,
                status_code=e.response.status_code,
                error=f"HTTP {e.response.status_code}: {e!s}",
                error_code="HTTP_ERROR",
                response_time=elapsed,
            )

        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.error("http_fetch_error", url=url, error=str(e))
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error=str(e),
                error_code="PROVIDER_ERROR",
                response_time=elapsed,
            )
