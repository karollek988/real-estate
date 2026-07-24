"""Tests for market_intelligence.runner — EngineRunner isolation, deadlines, caching."""

from __future__ import annotations

from pathlib import Path

from market_intelligence.cache import ProviderCache
from market_intelligence.config import EngineConfig
from market_intelligence.context import MarketContext
from market_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
)
from market_intelligence.providers.base import Provider, Stage
from market_intelligence.providers.registry import ProviderRegistry
from market_intelligence.runner import EngineRunner
from tests.market_intelligence.conftest import (
    CrashingProvider,
    DisabledProvider,
    GatedProvider,
    NoDataProvider,
    OkProvider,
    fixed_clock,
    fixed_iso,
)


def _make_runner(
    providers: list[Provider] | None = None,
    disabled: frozenset[str] | None = None,
    cache: ProviderCache | None = None,
    config_overrides: dict | None = None,
) -> EngineRunner:
    import dataclasses

    config = EngineConfig(**(config_overrides or {}))
    if disabled:
        config = dataclasses.replace(config, disabled_providers=disabled)
    registry = ProviderRegistry()
    if providers:
        registry.register_all(providers)
    return EngineRunner(registry, config, cache=cache, clock=fixed_clock)


class TestEngineRunner:
    def test_single_provider(self) -> None:
        runner = _make_runner([OkProvider()])
        runs = runner.run(MarketContext(country="SE"))
        assert len(runs) == 1
        assert runs[0].result.status == ProviderStatus.OK
        assert len(runs[0].result.findings) == 1

    def test_multiple_providers_parallel(self) -> None:
        runner = _make_runner([OkProvider(), NoDataProvider()])
        runs = runner.run(MarketContext(country="SE"))
        assert len(runs) == 2
        ids = {r.result.provider_id for r in runs}
        assert ids == {"ok_provider", "no_data_provider"}

    def test_crashing_provider_isolated(self) -> None:
        runner = _make_runner([OkProvider(), CrashingProvider()])
        runs = runner.run(MarketContext(country="SE"))
        ok_runs = [r for r in runs if r.result.provider_id == "ok_provider"]
        crash_runs = [r for r in runs if r.result.provider_id == "crashing_provider"]
        assert len(ok_runs) == 1
        assert ok_runs[0].result.status == ProviderStatus.OK
        assert len(crash_runs) == 1
        assert crash_runs[0].result.status == ProviderStatus.ERROR
        assert "RuntimeError" in crash_runs[0].result.detail  # type: ignore[union-attr]

    def test_disabled_provider(self) -> None:
        runner = _make_runner(
            [OkProvider(), DisabledProvider()],
            disabled=frozenset({"disabled_provider"}),
        )
        runs = runner.run(MarketContext(country="SE"))
        ok_runs = [r for r in runs if r.result.provider_id == "ok_provider"]
        disabled_runs = [r for r in runs if r.result.provider_id == "disabled_provider"]
        assert len(ok_runs) == 1
        assert ok_runs[0].result.status == ProviderStatus.OK
        assert len(disabled_runs) == 1
        assert disabled_runs[0].result.status == ProviderStatus.DISABLED

    def test_gated_provider_skipped_when_context_too_coarse(self) -> None:
        runner = _make_runner([GatedProvider()])
        runs = runner.run(MarketContext(country="SE"))
        assert len(runs) == 1
        assert runs[0].result.status == ProviderStatus.NO_DATA
        assert "municipality" in runs[0].result.detail  # type: ignore[union-attr]

    def test_gated_provider_runs_when_context_sufficient(self) -> None:
        runner = _make_runner([GatedProvider()])
        runs = runner.run(MarketContext(country="SE", municipality="Stockholm"))
        assert len(runs) == 1
        assert runs[0].result.status == ProviderStatus.OK
        assert runs[0].result.findings[0].municipality == "Stockholm"

    def test_cache_fresh_hit(self, tmp_path: Path) -> None:
        cache = ProviderCache(tmp_path / "cache", clock=fixed_clock)
        provider = OkProvider()
        runner = _make_runner([provider], cache=cache)

        # First run: fetches from provider
        runs1 = runner.run(MarketContext(country="SE"))
        assert runs1[0].from_cache is False

        # Second run: served from cache
        runs2 = runner.run(MarketContext(country="SE"))
        assert runs2[0].from_cache is True
        assert runs2[0].duration_ms == 0

    def test_cache_disabled_when_no_ttl(self) -> None:
        class NoTTLProvider(Provider):
            id = "no_ttl"
            stage = Stage.PARALLEL
            cache_ttl = None

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id=self.id,
                    status=ProviderStatus.OK,
                    findings=[
                        Finding(
                            domain="test",
                            key="v",
                            value=1,
                            source=Source(name="s"),
                            trust_tier=TrustTier.DIRECTORY,
                            fetched_at=fixed_iso(),
                        )
                    ],
                )

        runner = _make_runner([NoTTLProvider()])
        runs1 = runner.run(MarketContext(country="SE"))
        runs2 = runner.run(MarketContext(country="SE"))
        assert runs1[0].from_cache is False
        assert runs2[0].from_cache is False

    def test_every_registered_provider_appears(self) -> None:
        runner = _make_runner([OkProvider(), NoDataProvider(), CrashingProvider()])
        runs = runner.run(MarketContext(country="SE"))
        ids = {r.result.provider_id for r in runs}
        assert ids == {"ok_provider", "no_data_provider", "crashing_provider"}

    def test_error_result_id_mismatch(self) -> None:
        class MismatchProvider(Provider):
            id = "mismatch"
            stage = Stage.PARALLEL

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="wrong_id",
                    status=ProviderStatus.OK,
                    findings=[
                        Finding(
                            domain="test",
                            key="v",
                            value=1,
                            source=Source(name="s"),
                            trust_tier=TrustTier.DIRECTORY,
                            fetched_at=fixed_iso(),
                        )
                    ],
                )

        runner = _make_runner([MismatchProvider()])
        runs = runner.run(MarketContext(country="SE"))
        assert runs[0].result.status == ProviderStatus.ERROR
        assert "wrong_id" in runs[0].result.detail  # type: ignore[union-attr]
