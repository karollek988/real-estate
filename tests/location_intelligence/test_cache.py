"""F-06 Definition of Done: fresh hit, expired refetch, stale-if-error."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from location_intelligence.cache import ProviderCache
from location_intelligence.config import EngineConfig
from location_intelligence.context import AddressContext
from location_intelligence.providers.registry import ProviderRegistry
from location_intelligence.runner import EngineRunner
from tests.location_intelligence.conftest import CountingProvider


class MutableClock:
    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


def make_runner(tmp_path: Path, provider: CountingProvider, clock: MutableClock) -> EngineRunner:
    registry = ProviderRegistry()
    registry.register(provider)
    cache = ProviderCache(tmp_path / "cache", clock=clock)
    return EngineRunner(registry, EngineConfig(), cache=cache, clock=clock)


class TestCacheBehavior:
    def test_second_run_within_ttl_hits_cache(
        self, tmp_path: Path, context: AddressContext
    ) -> None:
        clock = MutableClock(datetime(2026, 7, 20, 10, 0, tzinfo=UTC))
        provider = CountingProvider()
        runner = make_runner(tmp_path, provider, clock)

        _, first = runner.run(context)
        _, second = runner.run(context)

        assert provider.calls == 1
        assert first[0].from_cache is False
        assert second[0].from_cache is True
        assert second[0].stale is False
        assert second[0].result.findings[0].value == 1

    def test_expired_ttl_refetches(self, tmp_path: Path, context: AddressContext) -> None:
        clock = MutableClock(datetime(2026, 7, 20, 10, 0, tzinfo=UTC))
        provider = CountingProvider()  # cache_ttl = 1h
        runner = make_runner(tmp_path, provider, clock)

        runner.run(context)
        clock.advance(timedelta(hours=2))
        _, second = runner.run(context)

        assert provider.calls == 2
        assert second[0].from_cache is False
        assert second[0].result.findings[0].value == 2

    def test_failed_refetch_serves_stale_marked_copy(
        self, tmp_path: Path, context: AddressContext
    ) -> None:
        clock = MutableClock(datetime(2026, 7, 20, 10, 0, tzinfo=UTC))
        provider = CountingProvider()
        runner = make_runner(tmp_path, provider, clock)

        runner.run(context)  # populate cache with call #1
        clock.advance(timedelta(hours=2))  # expire it
        provider.fail = True
        _, third = runner.run(context)

        assert provider.calls == 2  # refetch was attempted
        assert third[0].from_cache is True
        assert third[0].stale is True  # visibly stale, not silently wrong
        assert third[0].result.findings[0].value == 1  # the old, real data

    def test_corrupt_cache_entry_is_a_miss_not_a_crash(
        self, tmp_path: Path, context: AddressContext
    ) -> None:
        clock = MutableClock(datetime(2026, 7, 20, 10, 0, tzinfo=UTC))
        provider = CountingProvider()
        runner = make_runner(tmp_path, provider, clock)

        runner.run(context)
        cache_files = list((tmp_path / "cache").rglob("*.json"))
        assert cache_files
        cache_files[0].write_text("{not json", encoding="utf-8")

        _, runs = runner.run(context)
        assert provider.calls == 2  # treated as a miss → real call
        assert runs[0].result.findings[0].value == 2
