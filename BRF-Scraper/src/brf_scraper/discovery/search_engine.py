"""Search engine discovery provider for finding BRF websites."""

from __future__ import annotations

import asyncio
import re
from enum import StrEnum
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.models import (
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
    SearchQuery,
)
from brf_scraper.exceptions import BrowserError


class SearchEngine(StrEnum):
    """Supported search engines."""

    GOOGLE = "google"
    BING = "bing"
    DUCKDUCKGO = "duckduckgo"


class SearchEngineDiscovery(BaseDiscoveryProvider):
    """Discovery provider using search engines.

    Supports Google Custom Search API, Bing Web Search API,
    and DuckDuckGo (no API key required).
    """

    def __init__(
        self,
        engine: SearchEngine = SearchEngine.DUCKDUCKGO,
        api_key: str | None = None,
        search_engine_id: str | None = None,
        default_queries: list[str] | None = None,
        delay_between_requests: float = 1.0,
    ) -> None:
        """Initialize search engine discovery.

        Args:
            engine: Search engine to use
            api_key: API key for Google/Bing
            search_engine_id: Search engine ID (Google only)
            default_queries: Default search queries
            delay_between_requests: Delay between requests (seconds)
        """
        self._engine = engine
        self._api_key = api_key
        self._search_engine_id = search_engine_id
        self._default_queries = default_queries or [
            "bostadsrättsförening årsredovisning",
            "BRF årsredovisning pdf",
            "bostadsrättsförening Stockholm årsredovisning",
            "bostadsrättsförening Göteborg årsredovisning",
            "bostadsrättsförening Malmö årsredovisning",
        ]
        self._delay = delay_between_requests
        self._client: Any = None

    @property
    def name(self) -> str:
        """Provider name."""
        return f"search_engine_{self._engine.value}"

    @property
    def is_available(self) -> bool:
        """Check if provider is available."""
        if self._engine == SearchEngine.DUCKDUCKGO:
            return True
        return self._api_key is not None

    async def initialize(self) -> None:
        """Initialize the HTTP client."""
        try:
            import httpx

            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
            )
        except ImportError as err:
            raise BrowserError(
                message="httpx is required for search engine discovery",
            ) from err

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def discover(
        self,
        queries: list[str] | None = None,
        max_results_per_query: int = 10,
        **kwargs: Any,
    ) -> DiscoveryResult:
        """Discover BRF websites using search engine.

        Args:
            queries: Search queries to use (uses defaults if None)
            max_results_per_query: Max results per query

        Returns:
            DiscoveryResult with discovered BRFs
        """
        result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)

        if not self._client:
            await self.initialize()

        search_queries = queries or self._default_queries

        for query_text in search_queries:
            try:
                query = SearchQuery(query=query_text, max_results=max_results_per_query)
                brfs = await self._search(query)
                for brf in brfs:
                    result.add_brf(brf)

                if self._delay > 0:
                    await asyncio.sleep(self._delay)

            except Exception as e:
                result.add_error(f"Search failed for '{query_text}': {e!s}")

        result.completed_at = result.completed_at or result.started_at
        return result

    async def _search(self, query: SearchQuery) -> list[DiscoveredBRF]:
        """Execute a search query.

        Args:
            query: Search query

        Returns:
            List of discovered BRFs
        """
        if self._engine == SearchEngine.GOOGLE:
            return await self._search_google(query)
        elif self._engine == SearchEngine.BING:
            return await self._search_bing(query)
        else:
            return await self._search_duckduckgo(query)

    async def _search_google(self, query: SearchQuery) -> list[DiscoveredBRF]:
        """Search using Google Custom Search API."""
        if not self._api_key or not self._search_engine_id:
            raise BrowserError(
                message="Google API key and search engine ID required",
            )

        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": self._api_key,
            "cx": self._search_engine_id,
            "q": query.query,
            "num": min(query.max_results, 10),
            "lr": f"lang_{query.language}",
            "gl": query.country,
        }

        response = await self._client.get(url, params=params)
        response.raise_for_status()

        data = response.json()
        return self._parse_google_results(data)

    async def _search_bing(self, query: SearchQuery) -> list[DiscoveredBRF]:
        """Search using Bing Web Search API."""
        if not self._api_key:
            raise BrowserError(
                message="Bing API key required",
            )

        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": self._api_key}
        params = {
            "q": query.query,
            "count": query.max_results,
            "mkt": f"{query.language}-{query.country.upper()}",
            "safeSearch": "Strict" if query.safe_search else "Off",
        }

        response = await self._client.get(url, headers=headers, params=params)
        response.raise_for_status()

        data = response.json()
        return self._parse_bing_results(data)

    async def _search_duckduckgo(self, query: SearchQuery) -> list[DiscoveredBRF]:
        """Search using DuckDuckGo (no API key required)."""
        url = "https://html.duckduckgo.com/html/"
        params = {"q": query.query}

        response = await self._client.post(url, data=params)
        response.raise_for_status()

        return self._parse_duckduckgo_results(response.text)

    def _parse_google_results(self, data: dict[str, Any]) -> list[DiscoveredBRF]:
        """Parse Google Custom Search API response."""
        brfs = []
        items = data.get("items", [])

        for item in items:
            link = item.get("link", "")
            title = item.get("title", "")
            snippet = item.get("snippet", "")

            if self._is_brf_url(link):
                brf = DiscoveredBRF(
                    name=self._extract_brf_name(title, link),
                    website_url=link,
                    source=DiscoverySource.SEARCH_ENGINE,
                    confidence_score=0.7,
                    raw_data={"snippet": snippet, "title": title},
                )
                brfs.append(brf)

        return brfs

    def _parse_bing_results(self, data: dict[str, Any]) -> list[DiscoveredBRF]:
        """Parse Bing Web Search API response."""
        brfs = []
        web_pages = data.get("webPages", {}).get("value", [])

        for page in web_pages:
            url = page.get("url", "")
            name = page.get("name", "")
            snippet = page.get("snippet", "")

            if self._is_brf_url(url):
                brf = DiscoveredBRF(
                    name=self._extract_brf_name(name, url),
                    website_url=url,
                    source=DiscoverySource.SEARCH_ENGINE,
                    confidence_score=0.7,
                    raw_data={"snippet": snippet, "name": name},
                )
                brfs.append(brf)

        return brfs

    def _parse_duckduckgo_results(self, html: str) -> list[DiscoveredBRF]:
        """Parse DuckDuckGo HTML response."""
        brfs = []

        soup = BeautifulSoup(html, "lxml")

        for link in soup.select("a.result__a[href]"):
            url = str(link.get("href", ""))
            title = link.get_text(strip=True)
            if not url or not title:
                continue

            # DuckDuckGo uses redirects, extract actual URL
            actual_url = self._extract_duckduckgo_url(url)
            if actual_url and self._is_brf_url(actual_url):
                brf = DiscoveredBRF(
                    name=self._extract_brf_name(title, actual_url),
                    website_url=actual_url,
                    source=DiscoverySource.SEARCH_ENGINE,
                    confidence_score=0.6,
                    raw_data={"title": title, "duckduckgo_url": url},
                )
                brfs.append(brf)

        return brfs

    def _extract_duckduckgo_url(self, redirect_url: str) -> str | None:
        """Extract actual URL from DuckDuckGo redirect."""
        parsed = urlparse(redirect_url)
        if parsed.path == "/l/":
            # DuckDuckGo redirect format: /l/?uddg=<encoded_url>
            from urllib.parse import parse_qs, unquote

            params = parse_qs(parsed.query)
            if "uddg" in params:
                return unquote(params["uddg"][0])
        return redirect_url

    def _is_brf_url(self, url: str) -> bool:
        """Check if URL is likely a BRF website."""
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Exclude non-BRF domains
        excluded_domains = [
            "google.com",
            "bing.com",
            "duckduckgo.com",
            "facebook.com",
            "twitter.com",
            "linkedin.com",
            "youtube.com",
            "wikipedia.org",
        ]

        for excluded in excluded_domains:
            if excluded in domain:
                return False

        # Check for BRF-related patterns
        brf_patterns = [
            r"brf[\w\-]*\.",  # brf followed by word chars then dot (domain start)
            r"bostadsratt",
            r"rsredovisning",  # matches both arsredovisning and årsredovisning
            r"forening",
        ]

        text_to_check = f"{domain} {url}".lower()
        for pattern in brf_patterns:
            if re.search(pattern, text_to_check):
                return True

        return False

    def _extract_brf_name(self, title: str, url: str) -> str:
        """Extract BRF name from title or URL."""
        # Clean title
        name = title.strip()
        name = re.sub(r"\s*[-|].*$", "", name)  # Remove site name after separator
        name = re.sub(r"\s*\([^)]*\)\s*", "", name)  # Remove parentheses

        if not name:
            # Extract from URL
            parsed = urlparse(url)
            name = parsed.netloc.replace("www.", "").split(".")[0]
            name = name.replace("-", " ").replace("_", " ").title()

        return name
