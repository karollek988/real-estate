"""Directory scraper discovery provider for finding BRF websites."""

from __future__ import annotations

import asyncio
import re
from typing import Any, ClassVar
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.models import (
    DirectoryConfig,
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
)
from brf_scraper.exceptions import BrowserError, ValidationError


class DirectoryScraperDiscovery(BaseDiscoveryProvider):
    """Discovery provider that scrapes BRF directories.

    Scrapes known BRF directories like allabrf.se, brf.se, etc.
    """

    # Pre-configured directory configurations
    KNOWN_DIRECTORIES: ClassVar[dict[str, DirectoryConfig]] = {
        "allabrf": DirectoryConfig(
            base_url="https://www.allabrf.se",
            name="Alla BRF",
            max_pages=50,
            delay_between_requests=1.0,
        ),
        "brf_se": DirectoryConfig(
            base_url="https://www.brforeningen.se",
            name="Sveriges Bostadsrättsföreningars Riksförbund",
            max_pages=20,
            delay_between_requests=1.5,
        ),
    }

    def __init__(
        self,
        directories: list[str | DirectoryConfig] | None = None,
        respect_robots_txt: bool = True,
        custom_headers: dict[str, str] | None = None,
    ) -> None:
        """Initialize directory scraper.

        Args:
            directories: List of directory names or configs to scrape
            respect_robots_txt: Whether to respect robots.txt
            custom_headers: Custom HTTP headers
        """
        self._directories = directories or list(self.KNOWN_DIRECTORIES.keys())
        self._respect_robots_txt = respect_robots_txt
        self._custom_headers = custom_headers or {}
        self._client: Any = None
        self._robots_cache: dict[str, bool] = {}

    @property
    def name(self) -> str:
        """Provider name."""
        return "directory_scraper"

    @property
    def is_available(self) -> bool:
        """Check if provider is available."""
        import importlib.util

        return importlib.util.find_spec("httpx") is not None

    async def initialize(self) -> None:
        """Initialize the HTTP client."""
        try:
            import httpx

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "sv,en;q=0.5",
            }
            headers.update(self._custom_headers)

            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers=headers,
                follow_redirects=True,
            )
        except ImportError as err:
            raise BrowserError(
                message="httpx is required for directory scraping",
            ) from err

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def discover(
        self,
        directories: list[str] | None = None,
        **kwargs: Any,
    ) -> DiscoveryResult:
        """Discover BRF websites from directories.

        Args:
            directories: Directory names to scrape (uses defaults if None)

        Returns:
            DiscoveryResult with discovered BRFs
        """
        result = DiscoveryResult(source=DiscoverySource.DIRECTORY)

        if not self._client:
            await self.initialize()

        dirs_to_scrape = directories or self._directories

        for dir_name in dirs_to_scrape:
            try:
                config = self._get_directory_config(dir_name)
                dir_result = await self._scrape_directory(config)
                result.merge(dir_result)
            except Exception as e:
                result.add_error(f"Failed to scrape directory '{dir_name}': {e!s}")

        result.completed_at = result.completed_at or result.started_at
        return result

    def _get_directory_config(self, name: str | DirectoryConfig) -> DirectoryConfig:
        """Get directory configuration by name."""
        if isinstance(name, DirectoryConfig):
            return name

        if name in self.KNOWN_DIRECTORIES:
            return self.KNOWN_DIRECTORIES[name]

        raise ValidationError(
            message=f"Unknown directory: {name}. Available: {list(self.KNOWN_DIRECTORIES.keys())}",
        )

    async def _scrape_directory(self, config: DirectoryConfig) -> DiscoveryResult:
        """Scrape a single directory.

        Args:
            config: Directory configuration

        Returns:
            DiscoveryResult
        """
        result = DiscoveryResult(
            source=DiscoverySource.DIRECTORY,
            metadata={"directory_name": config.name, "base_url": str(config.base_url)},
        )

        # Check robots.txt if required
        if config.respect_robots_txt:
            if not await self._can_scrape(config):
                result.add_warning(f"Robots.txt disallows scraping {config.base_url}")
                return result

        # Scrape pages
        for page in range(1, config.max_pages + 1):
            try:
                page_url = self._build_page_url(config, page)
                brfs = await self._scrape_page(page_url, config)

                for brf in brfs:
                    result.add_brf(brf)

                if config.delay_between_requests > 0:
                    await asyncio.sleep(config.delay_between_requests)

            except Exception as e:
                result.add_error(f"Failed to scrape page {page}: {e!s}")
                break  # Stop on error

        return result

    def _build_page_url(self, config: DirectoryConfig, page: int) -> str:
        """Build URL for a directory page."""
        base = str(config.base_url).rstrip("/")

        # Common pagination patterns
        if page == 1:
            return base
        return f"{base}/page/{page}"

    async def _scrape_page(self, url: str, config: DirectoryConfig) -> list[DiscoveredBRF]:
        """Scrape a single page for BRF listings.

        Args:
            url: Page URL
            config: Directory configuration

        Returns:
            List of discovered BRFs
        """
        response = await self._client.get(url)
        response.raise_for_status()

        html = response.text
        return self._parse_page(html, url, config)

    def _parse_page(self, html: str, page_url: str, config: DirectoryConfig) -> list[DiscoveredBRF]:
        """Parse a directory page for BRF listings.

        Args:
            html: HTML content
            page_url: Page URL
            config: Directory configuration

        Returns:
            List of discovered BRFs
        """
        brfs = []
        seen_urls: set[str] = set()

        soup = BeautifulSoup(html, "lxml")
        brf_text_pattern = re.compile(r"bostadsrätt|BRF|förening", re.IGNORECASE)

        # Pattern 1: links with a BRF-related class, or BRF-related link text
        for link in soup.find_all("a", href=True):
            title = link.get_text(strip=True)
            if not title:
                continue

            classes = " ".join(str(c) for c in (link.get("class") or []))
            if "brf" not in classes.lower() and not brf_text_pattern.search(title):
                continue

            href = str(link["href"])
            full_url = urljoin(page_url, href)
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            brf = self._create_discovered_brf(title, full_url, config)
            if brf:
                brfs.append(brf)

        # Pattern 2: listing card containers wrapping a link
        for container in soup.select('[class*="listing"]'):
            card_link = container.find("a", href=True)
            if not isinstance(card_link, Tag):
                continue

            title = card_link.get_text(strip=True)
            if not title:
                continue

            href = str(card_link["href"])
            full_url = urljoin(page_url, href)
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            brf = self._create_discovered_brf(title, full_url, config)
            if brf:
                brfs.append(brf)

        # Pattern 3: structured data (JSON-LD)
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script.string or "")
                brfs.extend(self._parse_json_ld(data, page_url, config))
            except (json.JSONDecodeError, TypeError):
                continue

        return brfs

    def _create_discovered_brf(
        self, title: str, url: str, config: DirectoryConfig
    ) -> DiscoveredBRF | None:
        """Create a DiscoveredBRF from title and URL.

        Args:
            title: BRF name/title
            url: Website URL
            config: Directory configuration

        Returns:
            DiscoveredBRF or None if invalid
        """
        title = title.strip()
        if not title or not url:
            return None

        # Validate URL
        try:
            from pydantic import HttpUrl

            http_url = HttpUrl(url)
        except ValueError:
            return None

        # Try to extract city from title or URL
        city = self._extract_city(title, url)

        return DiscoveredBRF(
            name=title,
            website_url=http_url,
            source=DiscoverySource.DIRECTORY,
            city=city,
            raw_data={"directory": config.name, "page_url": url},
            confidence_score=0.8,
        )

    def _parse_json_ld(
        self, data: dict[str, Any] | list[Any], page_url: str, config: DirectoryConfig
    ) -> list[DiscoveredBRF]:
        """Parse JSON-LD structured data for BRFs."""
        brfs = []

        # Handle different JSON-LD types
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    brfs.extend(self._parse_json_ld(item, page_url, config))
            return brfs

        # Look for Organization or LocalBusiness types
        type_val = data.get("@type", "")
        if isinstance(type_val, list):
            type_val = " ".join(type_val)

        if any(t in type_val.lower() for t in ["organization", "localbusiness", "company"]):
            name = data.get("name", "")
            url = data.get("url", "")

            if name and url:
                brf = self._create_discovered_brf(name, url, config)
                if brf:
                    brfs.append(brf)

        # Check for itemListElement
        items = data.get("itemListElement", [])
        for item in items:
            if isinstance(item, dict):
                item_data = item.get("item", item)
                brfs.extend(self._parse_json_ld(item_data, page_url, config))

        return brfs

    def _extract_city(self, title: str, url: str) -> str | None:
        """Try to extract city name from title or URL."""
        # Common Swedish cities
        cities = [
            "Stockholm",
            "Göteborg",
            "Malmö",
            "Uppsala",
            "Linköping",
            "Örebro",
            "Västerås",
            "Helsingborg",
            "Jönköping",
            "Norrköping",
            "Lund",
            "Umeå",
            "Gävle",
            "Södertälje",
            "Eskilstuna",
            "Halmstad",
            "Växjö",
            "Sundsvall",
            "Luleå",
            "Trollhättan",
            "Östersund",
            "Borås",
            "Falun",
            "Kalmar",
            "Skellefteå",
            "Sölna",
            "Lidingö",
            "Täby",
            "Danderyd",
            " Nacka",
            "Värmdö",
            "Tyresö",
            "Haninge",
            "Salem",
            "Botkyrka",
            "Huddinge",
            "Staffanstorp",
            "Lomma",
            "Burlöv",
            "Svedala",
            "Vellinge",
            "Tomelilla",
            "Ystad",
            "Simrishamn",
            "Ängelholm",
            "Bjuv",
            "Svalöv",
            "Landskrona",
            "Höganäs",
            "Bromölla",
            "Osby",
            "Kristianstad",
            "Hässleholm",
            "Klippan",
            "Åkarp",
            "Sturup",
            "Munka-Ljungby",
            "Älmhult",
            "Markaryd",
            "Tranås",
            "Gislaved",
            "Vetlanda",
            "Eksjö",
            "Vimmerby",
            "Hultsfred",
            "Oskarshamn",
            "Västervik",
            "Gamleby",
            "Kisa",
            "Kinda",
            "Ydre",
            "Åtvidaberg",
            "Finspång",
            "Valdemarsvik",
            "Boxholm",
            "Aderberga",
            "Mjölby",
            "Mantorp",
            "Hjo",
            "Karlsborg",
            "Gullspång",
            "Götene",
            "Lidköping",
            "Skara",
            "Vara",
            "Gnosjö",
            "Villshärad",
            "Kinnekulle",
            "Brodde",
        ]

        text = f"{title} {url}".lower()
        for city in cities:
            if city.lower() in text:
                return city

        return None

    async def _can_scrape(self, config: DirectoryConfig) -> bool:
        """Check if robots.txt allows scraping."""
        base_url = str(config.base_url)
        parsed = urlparse(base_url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        if robots_url in self._robots_cache:
            return self._robots_cache[robots_url]

        try:
            response = await self._client.get(robots_url)
            if response.status_code == 200:
                # Simple check - look for User-agent: * and Disallow: /
                text = response.text.lower()
                if "disallow: /" in text and "user-agent: *" in text:
                    self._robots_cache[robots_url] = False
                    return False

            self._robots_cache[robots_url] = True
            return True

        except Exception:
            # If we can't check robots.txt, assume we can scrape
            return True
