"""Tests for discovery providers."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.models import DiscoveryResult, DiscoverySource
from brf_scraper.discovery.search_engine import SearchEngine, SearchEngineDiscovery
from brf_scraper.discovery.seed_urls import SeedUrlDiscovery


class MockDiscoveryProvider(BaseDiscoveryProvider):
    """Mock discovery provider for testing."""

    def __init__(self, name: str = "mock", is_available: bool = True) -> None:
        self._name = name
        self._is_available = is_available
        self._initialized = False
        self._closed = False

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_available(self) -> bool:
        return self._is_available

    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
        result.add_brf(
            __import__("brf_scraper.discovery.models", fromlist=["DiscoveredBRF"]).DiscoveredBRF(
                name="Mock BRF",
                website_url="https://mock.se",
                source=DiscoverySource.UNKNOWN,
            )
        )
        return result

    async def initialize(self) -> None:
        self._initialized = True

    async def close(self) -> None:
        self._closed = True


class TestBaseDiscoveryProviderInterface:
    """Tests for BaseDiscoveryProvider interface."""

    def test_provider_interface(self) -> None:
        """Test that MockDiscoveryProvider implements interface."""
        provider = MockDiscoveryProvider()

        assert hasattr(provider, "name")
        assert hasattr(provider, "is_available")
        assert hasattr(provider, "discover")
        assert hasattr(provider, "initialize")
        assert hasattr(provider, "close")

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        """Test async context manager."""
        provider = MockDiscoveryProvider()

        async with provider as p:
            assert p._initialized is True

        assert provider._closed is True


class TestSearchEngineDiscovery:
    """Tests for SearchEngineDiscovery provider."""

    def test_provider_type(self) -> None:
        """Test provider type."""
        provider = SearchEngineDiscovery()
        assert provider.name == "search_engine_duckduckgo"

    def test_provider_name_google(self) -> None:
        """Test provider name for Google."""
        provider = SearchEngineDiscovery(engine=SearchEngine.GOOGLE)
        assert provider.name == "search_engine_google"

    def test_is_available_duckduckgo(self) -> None:
        """Test DuckDuckGo is always available."""
        provider = SearchEngineDiscovery(engine=SearchEngine.DUCKDUCKGO)
        assert provider.is_available is True

    def test_is_available_google_no_key(self) -> None:
        """Test Google is not available without API key."""
        provider = SearchEngineDiscovery(engine=SearchEngine.GOOGLE)
        assert provider.is_available is False

    def test_is_available_google_with_key(self) -> None:
        """Test Google is available with API key."""
        provider = SearchEngineDiscovery(
            engine=SearchEngine.GOOGLE,
            api_key="test_key",
            search_engine_id="test_engine_id",
        )
        assert provider.is_available is True

    def test_is_available_bing_no_key(self) -> None:
        """Test Bing is not available without API key."""
        provider = SearchEngineDiscovery(engine=SearchEngine.BING)
        assert provider.is_available is False

    def test_is_available_bing_with_key(self) -> None:
        """Test Bing is available with API key."""
        provider = SearchEngineDiscovery(engine=SearchEngine.BING, api_key="test_key")
        assert provider.is_available is True

    @pytest.mark.asyncio
    async def test_initialize(self) -> None:
        """Test provider initialization."""
        provider = SearchEngineDiscovery()

        with patch("httpx.AsyncClient"):
            await provider.initialize()
            assert provider._client is not None

    @pytest.mark.asyncio
    async def test_close(self) -> None:
        """Test provider close."""
        provider = SearchEngineDiscovery()
        mock_client = AsyncMock()
        provider._client = mock_client

        await provider.close()

        mock_client.aclose.assert_called_once()
        assert provider._client is None

    def test_is_brf_url_valid(self) -> None:
        """Test URL validation for BRF sites."""
        provider = SearchEngineDiscovery()

        assert provider._is_brf_url("https://www.brftest.se") is True
        assert provider._is_brf_url("https://bostadsratt.se") is True
        assert provider._is_brf_url("https://example.com/arsredovisning") is True

    def test_is_brf_url_excluded(self) -> None:
        """Test URL validation excludes non-BRF sites."""
        provider = SearchEngineDiscovery()

        assert provider._is_brf_url("https://www.google.com") is False
        assert provider._is_brf_url("https://facebook.com/test") is False
        assert provider._is_brf_url("https://twitter.com/test") is False

    def test_extract_brf_name_from_title(self) -> None:
        """Test BRF name extraction from title."""
        provider = SearchEngineDiscovery()

        name = provider._extract_brf_name("BRF Test | Official Site", "https://test.se")
        assert name == "BRF Test"

    def test_extract_brf_name_from_url(self) -> None:
        """Test BRF name extraction from URL."""
        provider = SearchEngineDiscovery()

        name = provider._extract_brf_name("", "https://www.brf-test.se")
        assert name == "Brf Test"


class TestSeedUrlDiscovery:
    """Tests for SeedUrlDiscovery provider."""

    def test_provider_type(self) -> None:
        """Test provider type."""
        provider = SeedUrlDiscovery()
        assert provider.name == "seed_url"

    def test_is_available(self) -> None:
        """Test provider is always available."""
        provider = SeedUrlDiscovery()
        assert provider.is_available is True

    @pytest.mark.asyncio
    async def test_discover_with_custom_urls(self) -> None:
        """Test discovery with custom URLs."""
        provider = SeedUrlDiscovery(seed_urls=["https://brf1.se", "https://brf2.se"])

        result = await provider.discover(include_defaults=False)

        assert result.total_found == 2
        assert result.source == DiscoverySource.SEED_URL

    @pytest.mark.asyncio
    async def test_discover_with_defaults(self) -> None:
        """Test discovery with default URLs."""
        provider = SeedUrlDiscovery()

        result = await provider.discover(include_defaults=True, cities=["stockholm"])

        assert result.total_found > 0
        # Check that Stockholm URLs are included
        urls = [str(brf.website_url) for brf in result.brfs]
        assert any("brbacka" in url or "kista" in url for url in urls)

    @pytest.mark.asyncio
    async def test_discover_with_file(self, tmp_path) -> None:
        """Test discovery with file."""
        url_file = tmp_path / "urls.txt"
        url_file.write_text("https://brf1.se\nhttps://brf2.se\n")

        provider = SeedUrlDiscovery(file_path=str(url_file))
        result = await provider.discover(include_defaults=False)

        assert result.total_found == 2

    def test_load_from_file(self, tmp_path) -> None:
        """Test loading URLs from file."""
        url_file = tmp_path / "urls.txt"
        url_file.write_text("https://brf1.se\nhttps://brf2.se\n")

        provider = SeedUrlDiscovery()
        seed_list = provider.load_from_file(str(url_file))

        assert len(seed_list.urls) == 2
        assert len(provider._seed_lists) == 1

    def test_add_urls(self) -> None:
        """Test adding URLs."""
        provider = SeedUrlDiscovery()
        provider.add_urls(["https://brf1.se", "https://brf2.se"], name="custom")

        assert len(provider._seed_lists) == 1
        assert provider._seed_lists[0].name == "custom"

    def test_extract_name_from_url(self) -> None:
        """Test name extraction from URL."""
        provider = SeedUrlDiscovery()

        name = provider._extract_name_from_url("https://www.brf-test.se")
        assert name == "Brf Test"

    def test_extract_name_from_url_simple(self) -> None:
        """Test name extraction from simple URL."""
        provider = SeedUrlDiscovery()

        name = provider._extract_name_from_url("https://brfstockholm.se")
        assert name == "Brfstockholm"
