"""Tests for market_intelligence.providers.registry — ProviderRegistry."""

from __future__ import annotations

import pytest

from market_intelligence.context import MarketContext
from market_intelligence.models import ProviderResult, ProviderStatus
from market_intelligence.providers.base import Provider, Stage
from market_intelligence.providers.registry import ProviderRegistry


class SimpleProvider(Provider):
    id = "simple"
    stage = Stage.PARALLEL

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(provider_id=self.id, status=ProviderStatus.NO_DATA, detail="no data")


class AnotherProvider(Provider):
    id = "another"
    stage = Stage.PARALLEL

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(provider_id=self.id, status=ProviderStatus.NO_DATA, detail="no data")


class TestProviderRegistry:
    def test_register_and_lookup(self) -> None:
        reg = ProviderRegistry()
        p = SimpleProvider()
        reg.register(p)
        assert "simple" in reg
        assert len(reg) == 1

    def test_register_all(self) -> None:
        reg = ProviderRegistry()
        reg.register_all([SimpleProvider(), AnotherProvider()])
        assert len(reg) == 2

    def test_duplicate_id_rejected(self) -> None:
        reg = ProviderRegistry()
        reg.register(SimpleProvider())
        with pytest.raises(ValueError, match="already registered"):
            reg.register(SimpleProvider())

    def test_no_id_rejected(self) -> None:
        class NoIdProvider(Provider):
            id = ""

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="x",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        reg = ProviderRegistry()
        with pytest.raises(ValueError, match="no id"):
            reg.register(NoIdProvider())

    def test_all_returns_list(self) -> None:
        reg = ProviderRegistry()
        reg.register_all([SimpleProvider(), AnotherProvider()])
        all_p = reg.all()
        assert len(all_p) == 2
        ids = {p.id for p in all_p}
        assert ids == {"simple", "another"}

    def test_by_stage(self) -> None:
        reg = ProviderRegistry()
        reg.register(SimpleProvider())
        parallel = reg.by_stage(Stage.PARALLEL)
        assert len(parallel) == 1
        assert parallel[0].id == "simple"

    def test_contains(self) -> None:
        reg = ProviderRegistry()
        reg.register(SimpleProvider())
        assert "simple" in reg
        assert "missing" not in reg
