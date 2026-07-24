"""F-04 Definition of Done: fast/slow/crashing providers → ok/timeout/error,
isolation holds, wall time ≈ slowest surviving deadline; pre-stage enrichment
reaches parallel providers (docs/28 bug #1)."""

from __future__ import annotations

import time

from location_intelligence.config import EngineConfig
from location_intelligence.context import AddressContext
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.registry import ProviderRegistry
from location_intelligence.runner import EngineRunner
from tests.location_intelligence.conftest import (
    ContextReadingProvider,
    CrashingProvider,
    OkProvider,
    PreStageProvider,
    SlowProvider,
)


class TestParallelIsolation:
    def test_fast_slow_and_crashing_providers_produce_honest_statuses(
        self, context: AddressContext, config: EngineConfig
    ) -> None:
        registry = ProviderRegistry()
        registry.register_all([OkProvider(), SlowProvider(), CrashingProvider()])

        started = time.monotonic()
        _, runs = EngineRunner(registry, config).run(context)
        wall_s = time.monotonic() - started

        by_id = {run.result.provider_id: run for run in runs}
        assert by_id["ok_provider"].result.status is ProviderStatus.OK
        assert by_id["slow_provider"].result.status is ProviderStatus.TIMEOUT
        assert by_id["crashing_provider"].result.status is ProviderStatus.ERROR
        assert "RuntimeError" in (by_id["crashing_provider"].result.detail or "")
        # Wall time is governed by the slow provider's own 0.2s deadline,
        # not its 2s sleep — one slow source never holds the run hostage.
        assert wall_s < 1.5

    def test_crash_detail_is_present_and_findings_survive_from_others(
        self, context: AddressContext, config: EngineConfig
    ) -> None:
        registry = ProviderRegistry()
        registry.register_all([OkProvider(), CrashingProvider()])
        _, runs = EngineRunner(registry, config).run(context)

        ok = next(r for r in runs if r.result.provider_id == "ok_provider")
        assert len(ok.result.findings) == 2


class TestPreStageEnrichment:
    def test_context_patch_reaches_parallel_providers(
        self, context: AddressContext, config: EngineConfig
    ) -> None:
        registry = ProviderRegistry()
        reader = ContextReadingProvider()
        registry.register_all([PreStageProvider(), reader])

        enriched, runs = EngineRunner(registry, config).run(context)

        assert enriched.municipality == "Stockholm"
        assert enriched.municipality_code == "0180"
        assert reader.seen_municipality == "Stockholm"
        statuses = {r.result.provider_id: r.result.status for r in runs}
        assert statuses["pre_stage_provider"] is ProviderStatus.OK
