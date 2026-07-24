"""Seed URL discovery provider for finding BRF websites."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from brf_scraper.config import PROJECT_ROOT
from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.models import (
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
    SeedUrlList,
)
from brf_scraper.exceptions import BrowserError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# Default location of the seed URL defaults file, grouped by city. Editing
# this file adds/removes default seed coverage without any code changes.
DEFAULT_SEEDS_PATH = PROJECT_ROOT / "configs" / "seed_urls.yaml"


class SeedUrlDiscovery(BaseDiscoveryProvider):
    """Discovery provider that uses a known list of seed URLs.

    This provider loads BRF websites from:
    - A text file (one URL per line)
    - A Python list of URLs
    - A configurable YAML defaults file, grouped by city
    """

    def __init__(
        self,
        seed_urls: list[str] | SeedUrlList | None = None,
        file_path: str | Path | None = None,
        validate_urls: bool = True,
        defaults_path: str | Path | None = None,
    ) -> None:
        """Initialize seed URL discovery.

        Args:
            seed_urls: List of URLs or SeedUrlList object
            file_path: Path to file containing URLs
            validate_urls: Whether to validate URLs
            defaults_path: Path to the YAML file of default seed URLs
                grouped by city. Defaults to configs/seed_urls.yaml.
        """
        self._validate_urls = validate_urls
        self._seed_lists: list[SeedUrlList] = []
        self._cities: list[str] = []
        self._defaults_path = Path(defaults_path) if defaults_path else DEFAULT_SEEDS_PATH
        self._default_seed_urls: dict[str, list[str]] | None = None

        if isinstance(seed_urls, SeedUrlList):
            self._seed_lists.append(seed_urls)
        elif seed_urls:
            self._seed_lists.append(
                SeedUrlList(name="custom", urls=[url for url in seed_urls if url])
            )

        if file_path:
            try:
                seed_list = SeedUrlList.from_file(str(file_path), name="file")
                self._seed_lists.append(seed_list)
            except Exception as e:
                raise BrowserError(
                    message=f"Failed to load seed URLs from {file_path}: {e!s}",
                ) from e

    def _load_default_seed_urls(self) -> dict[str, list[str]]:
        """Load and cache the default seed URLs from the YAML defaults file.

        Returns:
            Mapping of city name to list of seed URLs. Empty if the
            defaults file does not exist.
        """
        if self._default_seed_urls is not None:
            return self._default_seed_urls

        if not self._defaults_path.exists():
            logger.warning("seed_defaults_file_not_found", path=str(self._defaults_path))
            self._default_seed_urls = {}
            return self._default_seed_urls

        try:
            with self._defaults_path.open(encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            self._default_seed_urls = {
                str(city): [str(url) for url in urls] for city, urls in data.items()
            }
        except Exception as e:
            raise BrowserError(
                message=f"Failed to load seed defaults from {self._defaults_path}: {e!s}",
            ) from e

        return self._default_seed_urls

    @property
    def name(self) -> str:
        """Provider name."""
        return "seed_url"

    @property
    def is_available(self) -> bool:
        """Check if provider is available."""
        return True  # Always available

    async def initialize(self) -> None:
        """Initialize the provider."""
        pass

    async def close(self) -> None:
        """Close the provider."""
        pass

    async def discover(
        self,
        include_defaults: bool = True,
        cities: list[str] | None = None,
        **kwargs: Any,
    ) -> DiscoveryResult:
        """Discover BRF websites from seed URLs.

        Args:
            include_defaults: Whether to include default seed URLs
            cities: Cities to include from defaults

        Returns:
            DiscoveryResult with discovered BRFs
        """
        result = DiscoveryResult(source=DiscoverySource.SEED_URL)

        # Add custom seed lists
        for seed_list in self._seed_lists:
            for url in seed_list.urls:
                brf = self._create_discovered_brf(url, seed_list)
                if brf:
                    result.add_brf(brf)

        # Add default seed URLs
        if include_defaults:
            default_seed_urls = self._load_default_seed_urls()
            cities_to_include = cities or list(default_seed_urls.keys())
            for city in cities_to_include:
                if city.lower() in default_seed_urls:
                    for default_url in default_seed_urls[city.lower()]:
                        brf = self._create_discovered_brf_from_default(default_url, city)
                        if brf:
                            result.add_brf(brf)

        result.completed_at = result.completed_at or result.started_at
        return result

    def _create_discovered_brf(
        self, url: str | Any, seed_list: SeedUrlList
    ) -> DiscoveredBRF | None:
        """Create a DiscoveredBRF from a URL.

        Args:
            url: Website URL (str or HttpUrl)
            seed_list: Source seed list

        Returns:
            DiscoveredBRF or None if invalid
        """
        try:
            from pydantic import HttpUrl

            # Convert to string if HttpUrl object
            url_str = str(url)

            # Validate URL
            http_url = HttpUrl(url_str)

            # Extract name from URL
            name = self._extract_name_from_url(url_str)

            return DiscoveredBRF(
                name=name,
                website_url=http_url,
                source=DiscoverySource.SEED_URL,
                raw_data={"seed_list": seed_list.name},
                confidence_score=1.0,
            )
        except Exception:
            return None

    def _create_discovered_brf_from_default(self, url: str, city: str) -> DiscoveredBRF | None:
        """Create a DiscoveredBRF from a default seed URL.

        Args:
            url: Website URL
            city: City name

        Returns:
            DiscoveredBRF or None if invalid
        """
        from pydantic import HttpUrl

        brf = self._create_discovered_brf(url, SeedUrlList(name="default", urls=[HttpUrl(url)]))
        if brf:
            brf.city = city.title()
            brf.raw_data["city"] = city
        return brf

    def _extract_name_from_url(self, url: str) -> str:
        """Extract BRF name from URL.

        Args:
            url: Website URL

        Returns:
            Extracted name
        """
        parsed = urlparse(url)
        domain = parsed.netloc.lower()

        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]

        # Remove TLD
        name = domain.split(".")[0]

        # Clean up common patterns
        name = name.replace("-", " ").replace("_", " ")

        # Capitalize each word
        name = name.title()

        return name

    def load_from_file(self, file_path: str | Path) -> SeedUrlList:
        """Load seed URLs from a file.

        Args:
            file_path: Path to file

        Returns:
            SeedUrlList
        """
        seed_list = SeedUrlList.from_file(str(file_path), name="loaded")
        self._seed_lists.append(seed_list)
        return seed_list

    def add_urls(self, urls: list[str], name: str = "custom") -> None:
        """Add URLs to the seed list.

        Args:
            urls: List of URLs to add
            name: Name for the seed list
        """
        seed_list = SeedUrlList(name=name, urls=[url for url in urls if url])
        self._seed_lists.append(seed_list)

    @classmethod
    def from_cities(cls, cities: list[str]) -> SeedUrlDiscovery:
        """Create discovery provider from city names.

        Args:
            cities: List of city names

        Returns:
            SeedUrlDiscovery instance
        """
        provider = cls(seed_urls=[])
        provider._cities = cities
        return provider
