"""Tests for market_intelligence.providers.base — Provider ABC."""

from __future__ import annotations

import pytest

from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.models import ProviderResult, ProviderStatus, TrustTier
from market_intelligence.providers.base import Provider, Stage


def test_provider_is_abstract() -> None:
    with pytest.raises(TypeError):
        Provider()  # type: ignore[abstract]


class ConcreteProvider(Provider):
    id = "concrete"
    stage = Stage.PARALLEL

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.NO_DATA,
            detail="no data",
        )


class TestProvider:
    def test_default_attributes(self) -> None:
        p = ConcreteProvider()
        assert p.id == "concrete"
        assert p.stage == Stage.PARALLEL
        assert p.trust_tier == TrustTier.DIRECTORY
        assert p.cache_ttl is None
        assert p.deadline_s is None
        assert p.required_level is None

    def test_collect_returns_provider_result(self) -> None:
        p = ConcreteProvider()
        result = p.collect(MarketContext(country="SE"))
        assert isinstance(result, ProviderResult)
        assert result.provider_id == "concrete"

    def test_custom_attributes(self) -> None:
        from datetime import timedelta

        class CustomProvider(Provider):
            id = "custom"
            stage = Stage.PARALLEL
            trust_tier = TrustTier.REGISTRY_AUTHORITY
            cache_ttl = timedelta(hours=1)
            deadline_s = 10.0
            required_level = GeographicLevel.MUNICIPALITY

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id=self.id,
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        p = CustomProvider()
        assert p.trust_tier == TrustTier.REGISTRY_AUTHORITY
        assert p.cache_ttl == timedelta(hours=1)
        assert p.deadline_s == 10.0
        assert p.required_level == GeographicLevel.MUNICIPALITY
