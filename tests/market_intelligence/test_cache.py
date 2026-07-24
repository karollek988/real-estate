"""Tests for market_intelligence.cache — ProviderCache, CacheEntry."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import pytest

from market_intelligence.cache import ProviderCache
from market_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
)
from tests.market_intelligence.conftest import fixed_clock, fixed_iso


@pytest.fixture
def cache(tmp_path: Path) -> ProviderCache:
    return ProviderCache(tmp_path / "cache", clock=fixed_clock)


@pytest.fixture
def sample_result() -> ProviderResult:
    return ProviderResult(
        provider_id="test_provider",
        status=ProviderStatus.OK,
        findings=[
            Finding(
                domain="macro_economy",
                key="policy_rate",
                value=3.5,
                source=Source(name="Riksbank"),
                trust_tier=TrustTier.REGISTRY_AUTHORITY,
                fetched_at=fixed_iso(),
                unit="percent",
            )
        ],
    )


class TestProviderCache:
    def test_miss_on_empty(self, cache: ProviderCache) -> None:
        result = cache.get("provider", "key")
        assert result is None

    def test_put_and_get(self, cache: ProviderCache, sample_result: ProviderResult) -> None:
        cache.put("provider", "key", sample_result)
        entry = cache.get("provider", "key")
        assert entry is not None
        assert entry.result.provider_id == "test_provider"
        assert entry.result.status == ProviderStatus.OK

    def test_fresh_within_ttl(self, cache: ProviderCache, sample_result: ProviderResult) -> None:
        cache.put("provider", "key", sample_result)
        entry = cache.get("provider", "key")
        assert entry is not None
        assert entry.is_fresh(fixed_clock(), timedelta(hours=1))

    def test_stale_after_ttl(self, cache: ProviderCache, sample_result: ProviderResult) -> None:
        cache.put("provider", "key", sample_result)
        entry = cache.get("provider", "key")
        assert entry is not None
        assert not entry.is_fresh(fixed_clock(), timedelta(seconds=0))

    def test_different_providers_independent(
        self, cache: ProviderCache, sample_result: ProviderResult
    ) -> None:
        cache.put("provider_a", "key", sample_result)
        assert cache.get("provider_a", "key") is not None
        assert cache.get("provider_b", "key") is None

    def test_corrupt_entry_returns_none(self, cache: ProviderCache, tmp_path: Path) -> None:
        cache_dir = tmp_path / "cache"
        provider_dir = cache_dir / "bad_provider"
        provider_dir.mkdir(parents=True)
        (provider_dir / "abc123.json").write_text("not valid json")
        result = cache.get("bad_provider", "abc123")
        assert result is None

    def test_stored_at_timestamp(self, cache: ProviderCache, sample_result: ProviderResult) -> None:
        cache.put("provider", "key", sample_result)
        entry = cache.get("provider", "key")
        assert entry is not None
        assert entry.stored_at.isoformat() == fixed_iso()
