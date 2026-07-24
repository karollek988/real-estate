"""F-02 Definition of Done: registration works; env-var disable needs no code change."""

from __future__ import annotations

import pytest

from location_intelligence.builder import PackageBuilder
from location_intelligence.config import EngineConfig
from location_intelligence.context import AddressContext
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.registry import ProviderRegistry
from location_intelligence.runner import EngineRunner
from tests.location_intelligence.conftest import NoDataProvider, OkProvider


class TestRegistry:
    def test_register_and_lookup(self) -> None:
        registry = ProviderRegistry()
        registry.register_all([OkProvider(), NoDataProvider()])
        assert len(registry) == 2
        assert "ok_provider" in registry

    def test_duplicate_id_rejected(self) -> None:
        registry = ProviderRegistry()
        registry.register(OkProvider())
        with pytest.raises(ValueError, match="already registered"):
            registry.register(OkProvider())

    def test_missing_id_rejected(self) -> None:
        class Anonymous(OkProvider):
            id = ""

        with pytest.raises(ValueError, match="has no id"):
            ProviderRegistry().register(Anonymous())


class TestDisabledProviders:
    def test_env_var_parsing(self) -> None:
        config = EngineConfig.from_env({"DISABLED_PROVIDERS": "ok_provider, other ,, "})
        assert config.disabled_providers == frozenset({"ok_provider", "other"})

    def test_disabled_provider_is_visibly_skipped(self, context: AddressContext) -> None:
        registry = ProviderRegistry()
        registry.register_all([OkProvider(), NoDataProvider()])
        config = EngineConfig(disabled_providers=frozenset({"ok_provider"}))

        _, runs = EngineRunner(registry, config).run(context)
        package = PackageBuilder().build(context, runs)

        by_id = {run.result.provider_id: run for run in runs}
        assert by_id["ok_provider"].result.status is ProviderStatus.DISABLED
        assert by_id["no_data_provider"].result.status is ProviderStatus.NO_DATA
        # The disabled provider still appears in the package — visible skip.
        assert package.summary["providers_by_status"] == {"disabled": 1, "no_data": 1}
