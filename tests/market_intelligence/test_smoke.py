"""Smoke test — market_intelligence package imports and full provider contract."""

from __future__ import annotations

from market_intelligence import ENGINE_VERSION
from market_intelligence.builder import PackageBuilder
from market_intelligence.config import EngineConfig
from market_intelligence.context import MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.providers import default_registry
from market_intelligence.providers.housing_market_base import (
    HemnetListingsProvider,
)
from market_intelligence.runner import EngineRunner
from tests.market_intelligence.conftest import (
    always_monotonic,
    json_transport,
    never_sleep,
)


def test_version_exists() -> None:
    assert ENGINE_VERSION


def test_default_registry_has_providers() -> None:
    registry = default_registry()
    assert len(registry) >= 3


def test_all_providers_conform() -> None:
    from market_intelligence.conformance import check_provider

    config = EngineConfig()
    client = HttpClient(
        config,
        transport=json_transport({"value": [], "dimension": {}}),
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    registry = default_registry(client=client)
    context = MarketContext(country="SE", municipality="Stockholm")

    for provider in registry.all():
        violations = check_provider(provider, context)
        assert violations == [], f"{provider.id} has violations: {violations}"


def test_package_roundtrip_with_mocked_providers() -> None:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=json_transport({"dataSets": [], "value": [], "dimension": {}}),
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    context = MarketContext(country="SE")
    registry = default_registry(client=client)
    runner = EngineRunner(registry, config)
    runs = runner.run(context)
    package = PackageBuilder().build(context, runs)
    json_str = package.to_json()

    assert "engine_version" in json_str
    assert "riksbank_interest_rate" in json_str
    assert "scb_macro_economy" in json_str
    assert "boverket_construction" in json_str


def test_hemnet_provider_independent() -> None:
    """Hemnet provider is not in default_registry — it needs external data."""
    registry = default_registry()
    assert "hemnet_listings" not in registry

    provider = HemnetListingsProvider()
    context = MarketContext(country="SE", municipality="Stockholm")
    result = provider.collect(context)
    assert result.status.value == "no_data"
