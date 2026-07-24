"""Tests for the confidence-gated discovery pipeline."""

from __future__ import annotations

from typing import Any

import pytest

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.confidence import ConfidenceBand
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import DiscoveredBRF, DiscoveryResult, DiscoverySource
from brf_scraper.discovery.pipeline import DiscoveryPipeline
from brf_scraper.discovery.registry import SqliteVerifiedWebsiteRegistry
from brf_scraper.models.brf import BRF


class MockProvider(BaseDiscoveryProvider):
    """Mock provider returning a fixed set of candidates."""

    def __init__(self, brfs_to_return: list[dict[str, Any]] | None = None) -> None:
        self._brfs_to_return = brfs_to_return or []

    @property
    def name(self) -> str:
        return "mock"

    @property
    def is_available(self) -> bool:
        return True

    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
        for data in self._brfs_to_return:
            result.add_brf(
                DiscoveredBRF(
                    name=data.get("name", "Test BRF"),
                    website_url=data.get("url", "https://test.se"),
                    source=data.get("source", DiscoverySource.SEARCH_ENGINE),
                    organization_number=data.get("organization_number"),
                )
            )
        return result

    async def initialize(self) -> None:
        pass

    async def close(self) -> None:
        pass


@pytest.fixture
async def registry(tmp_path):
    """A fresh SQLite-backed registry for each test."""
    db_path = tmp_path / "pipeline-registry.db"
    repo = SqliteVerifiedWebsiteRegistry(database_url=f"sqlite+aiosqlite:///{db_path}")
    await repo.initialize()
    yield repo
    await repo.close()


class TestDiscoveryPipeline:
    """Tests for DiscoveryPipeline."""

    @pytest.mark.asyncio
    async def test_manual_override_skips_discovery(self, registry) -> None:
        """A manually supplied URL bypasses Discovery entirely and is HIGH confidence."""
        engine = DiscoveryEngine(providers=[])  # would raise if actually called
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Solgläntan")

        decision = await pipeline.resolve(target, manual_website_url="https://example-brf.se")

        assert decision.band == ConfidenceBand.HIGH
        assert decision.website_url == "https://example-brf.se"
        assert decision.should_continue_automatically is True

    @pytest.mark.asyncio
    async def test_manual_override_persists_to_registry(self, registry) -> None:
        """A manual override is stored as a user-confirmed verification."""
        engine = DiscoveryEngine(providers=[])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Solgläntan")

        await pipeline.resolve(target, manual_website_url="https://example-brf.se")
        stored = await registry.get("BRF Solgläntan")

        assert stored is not None
        assert stored.website_url == "https://example-brf.se"

    @pytest.mark.asyncio
    async def test_registry_hit_skips_discovery(self, registry) -> None:
        """A previously verified BRF is returned from the registry without running Discovery."""
        engine = DiscoveryEngine(providers=[])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Ekhagen")
        await pipeline.resolve(target, manual_website_url="https://ekhagen.se")

        decision = await pipeline.resolve(target)

        assert decision.from_registry is True
        assert decision.website_url == "https://ekhagen.se"
        assert decision.band == ConfidenceBand.HIGH

    @pytest.mark.asyncio
    async def test_high_confidence_discovery_result_persists(self, registry) -> None:
        """A HIGH-confidence Discovery result is written to the registry."""
        provider = MockProvider(
            brfs_to_return=[
                {
                    "name": "BRF Solgläntan",
                    "url": "https://brfsolglantan.se",
                    "source": DiscoverySource.SEED_URL,
                    "organization_number": "7691234567",
                }
            ]
        )
        engine = DiscoveryEngine(providers=[provider])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Solgläntan", organization_number="7691234567")

        decision = await pipeline.resolve(target)

        assert decision.band == ConfidenceBand.HIGH
        stored = await registry.get("BRF Solgläntan", organization_number="7691234567")
        assert stored is not None

    @pytest.mark.asyncio
    async def test_low_confidence_result_has_no_url(self, registry) -> None:
        """A LOW-confidence result never exposes a website_url, to prevent guessing."""
        provider = MockProvider(
            brfs_to_return=[
                {
                    "name": "Completely Unrelated Association",
                    "url": "https://unrelated.se",
                    "source": DiscoverySource.SEARCH_ENGINE,
                }
            ]
        )
        engine = DiscoveryEngine(providers=[provider])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Solgläntan", city="Stockholm")

        decision = await pipeline.resolve(target)

        assert decision.band == ConfidenceBand.LOW
        assert decision.website_url is None
        assert decision.should_continue_automatically is False
        assert decision.needs_user_confirmation is False

    @pytest.mark.asyncio
    async def test_no_candidates_is_low_confidence(self, registry) -> None:
        """No Discovery candidates at all is treated as LOW, not an error."""
        engine = DiscoveryEngine(providers=[MockProvider(brfs_to_return=[])])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Solgläntan")

        decision = await pipeline.resolve(target)

        assert decision.band == ConfidenceBand.LOW
        assert decision.website_url is None

    @pytest.mark.asyncio
    async def test_confirm_promotes_to_high_and_persists(self, registry) -> None:
        """confirm() records a user's acceptance of a candidate as HIGH confidence."""
        engine = DiscoveryEngine(providers=[])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=registry)
        target = BRF(name="BRF Ekhagen")

        decision = await pipeline.confirm(target, "https://ekhagen.se")

        assert decision.band == ConfidenceBand.HIGH
        assert decision.confidence == 1.0
        stored = await registry.get("BRF Ekhagen")
        assert stored is not None
        assert stored.website_url == "https://ekhagen.se"

    @pytest.mark.asyncio
    async def test_no_registry_still_works(self) -> None:
        """The pipeline works without a registry; it just never persists."""
        provider = MockProvider(
            brfs_to_return=[
                {
                    "name": "BRF Solgläntan",
                    "url": "https://brfsolglantan.se",
                    "source": DiscoverySource.SEED_URL,
                    "organization_number": "7691234567",
                }
            ]
        )
        engine = DiscoveryEngine(providers=[provider])
        pipeline = DiscoveryPipeline(discovery_engine=engine, registry=None)
        target = BRF(name="BRF Solgläntan", organization_number="7691234567")

        decision = await pipeline.resolve(target)

        assert decision.band == ConfidenceBand.HIGH
        assert decision.website_url == "https://brfsolglantan.se/"
