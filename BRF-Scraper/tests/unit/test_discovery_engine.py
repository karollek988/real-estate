"""Tests for DiscoveryEngine."""

from __future__ import annotations

from typing import Any

import pytest

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import DiscoveredBRF, DiscoveryResult, DiscoverySource
from brf_scraper.exceptions import BrowserError


class MockProvider(BaseDiscoveryProvider):
    """Mock provider for testing."""

    def __init__(
        self,
        name: str = "mock",
        brfs_to_return: list[dict[str, Any]] | None = None,
        should_fail: bool = False,
    ) -> None:
        self._name = name
        self._brfs_to_return = brfs_to_return or []
        self._should_fail = should_fail

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_available(self) -> bool:
        return True

    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        if self._should_fail:
            raise Exception(f"Provider {self._name} failed")

        result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
        for brf_data in self._brfs_to_return:
            result.add_brf(
                DiscoveredBRF(
                    name=brf_data.get("name", "Test BRF"),
                    website_url=brf_data.get("url", "https://test.se"),
                    source=DiscoverySource.UNKNOWN,
                )
            )
        return result

    async def initialize(self) -> None:
        pass

    async def close(self) -> None:
        pass


class TestDiscoveryEngine:
    """Tests for DiscoveryEngine."""

    def test_create_engine(self) -> None:
        """Test creating a DiscoveryEngine."""
        engine = DiscoveryEngine()

        assert engine.providers == []
        assert engine.strategy == "sequential"

    def test_create_engine_with_providers(self) -> None:
        """Test creating engine with providers."""
        provider1 = MockProvider(name="provider1")
        provider2 = MockProvider(name="provider2")

        engine = DiscoveryEngine(providers=[provider1, provider2])

        assert len(engine.providers) == 2

    def test_add_provider(self) -> None:
        """Test adding a provider."""
        engine = DiscoveryEngine()
        provider = MockProvider(name="test")

        engine.add_provider(provider)

        assert len(engine.providers) == 1
        assert engine.providers[0].name == "test"

    def test_add_provider_no_duplicates(self) -> None:
        """Test adding same provider twice."""
        engine = DiscoveryEngine()
        provider = MockProvider(name="test")

        engine.add_provider(provider)
        engine.add_provider(provider)

        assert len(engine.providers) == 1

    def test_remove_provider(self) -> None:
        """Test removing a provider."""
        engine = DiscoveryEngine()
        provider = MockProvider(name="test")
        engine.add_provider(provider)

        result = engine.remove_provider(provider)

        assert result is True
        assert len(engine.providers) == 0

    def test_remove_provider_not_found(self) -> None:
        """Test removing non-existent provider."""
        engine = DiscoveryEngine()
        provider = MockProvider(name="test")

        result = engine.remove_provider(provider)

        assert result is False

    def test_get_provider(self) -> None:
        """Test getting provider by name."""
        engine = DiscoveryEngine()
        provider = MockProvider(name="test")
        engine.add_provider(provider)

        result = engine.get_provider("test")

        assert result is not None
        assert result.name == "test"

    def test_get_provider_not_found(self) -> None:
        """Test getting non-existent provider."""
        engine = DiscoveryEngine()

        result = engine.get_provider("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_initialize(self) -> None:
        """Test initializing all providers."""
        provider1 = MockProvider(name="p1")
        provider2 = MockProvider(name="p2")

        engine = DiscoveryEngine(providers=[provider1, provider2])
        await engine.initialize()

        # Verify providers are initialized (no exception thrown)

    @pytest.mark.asyncio
    async def test_close(self) -> None:
        """Test closing all providers."""
        provider1 = MockProvider(name="p1")
        provider2 = MockProvider(name="p2")

        engine = DiscoveryEngine(providers=[provider1, provider2])
        await engine.close()

        # Verify providers are closed (no exception thrown)

    @pytest.mark.asyncio
    async def test_discover_no_providers(self) -> None:
        """Test discover with no providers."""
        engine = DiscoveryEngine()

        with pytest.raises(BrowserError):
            await engine.discover()

    @pytest.mark.asyncio
    async def test_discover_sequential(self) -> None:
        """Test sequential discovery."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )
        provider2 = MockProvider(
            name="p2",
            brfs_to_return=[{"name": "BRF 2", "url": "https://brf2.se"}],
        )

        engine = DiscoveryEngine(providers=[provider1, provider2], strategy="sequential")
        result = await engine.discover()

        assert result.total_found == 2

    @pytest.mark.asyncio
    async def test_discover_parallel(self) -> None:
        """Test parallel discovery."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )
        provider2 = MockProvider(
            name="p2",
            brfs_to_return=[{"name": "BRF 2", "url": "https://brf2.se"}],
        )

        engine = DiscoveryEngine(providers=[provider1, provider2], strategy="parallel")
        result = await engine.discover()

        assert result.total_found == 2

    @pytest.mark.asyncio
    async def test_discover_with_provider_filter(self) -> None:
        """Test discovery with provider filter."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )
        provider2 = MockProvider(
            name="p2",
            brfs_to_return=[{"name": "BRF 2", "url": "https://brf2.se"}],
        )

        engine = DiscoveryEngine(providers=[provider1, provider2])
        result = await engine.discover(providers=["p1"])

        assert result.total_found == 1

    @pytest.mark.asyncio
    async def test_discover_provider_failure(self) -> None:
        """Test discovery with provider failure."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )
        provider2 = MockProvider(name="p2", should_fail=True)

        engine = DiscoveryEngine(providers=[provider1, provider2])
        result = await engine.discover()

        # Should have 1 success and 1 error
        assert result.total_found == 1
        assert len(result.errors) == 1

    @pytest.mark.asyncio
    async def test_discover_deduplication(self) -> None:
        """Test URL deduplication."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[
                {"name": "BRF 1", "url": "https://brf.se"},
                {"name": "BRF 1 dup", "url": "https://brf.se"},
            ],
        )

        engine = DiscoveryEngine(providers=[provider1], deduplicate=True)
        result = await engine.discover()

        assert result.total_found == 1

    @pytest.mark.asyncio
    async def test_discover_no_deduplication(self) -> None:
        """Test no deduplication when disabled."""
        provider1 = MockProvider(
            name="p1",
            brfs_to_return=[
                {"name": "BRF 1", "url": "https://brf.se"},
                {"name": "BRF 1 dup", "url": "https://brf.se"},
            ],
        )

        engine = DiscoveryEngine(providers=[provider1], deduplicate=False)
        result = await engine.discover()

        assert result.total_found == 2

    @pytest.mark.asyncio
    async def test_discover_all(self) -> None:
        """Test discover_all convenience method."""
        provider = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )

        engine = DiscoveryEngine(providers=[provider])
        result = await engine.discover_all()

        assert result.total_found == 1

    def test_get_stats(self) -> None:
        """Test getting engine statistics."""
        provider1 = MockProvider(name="p1")
        provider2 = MockProvider(name="p2")

        engine = DiscoveryEngine(providers=[provider1, provider2])
        stats = engine.get_stats()

        assert stats["total_providers"] == 2
        assert stats["strategy"] == "sequential"
        assert stats["deduplicate"] is True
        assert "p1" in stats["provider_names"]

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        """Test async context manager."""
        provider = MockProvider(
            name="p1",
            brfs_to_return=[{"name": "BRF 1", "url": "https://brf1.se"}],
        )

        async with DiscoveryEngine(providers=[provider]) as engine:
            result = await engine.discover()
            assert result.total_found == 1
