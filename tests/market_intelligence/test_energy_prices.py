"""Tests for the energy prices provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.energy_prices import EnergyPriceProvider
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    json_transport,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> EnergyPriceProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return EnergyPriceProvider(client, clock=fixed_clock)


# Sample TAB4310: Electricity prices by consumption category
_SAMPLE_ENERGY_PRICES = {
    "dimension": {
        "Konsumtionsområde": {
            "label": "consumption area",
            "category": {
                "index": {"R1": 0, "R2": 1, "R3": 2},
                "label": {
                    "R1": "Small household",
                    "R2": "Medium household",
                    "R3": "Large household",
                },
            },
        },
        "ContentsCode": {
            "label": "observations",
            "category": {
                "index": {"000004VW": 0},
                "label": {"000004VW": "öre/kWh"},
            },
        },
        "Tid": {
            "label": "half-year",
            "category": {
                "index": {"2025H1": 0, "2025H2": 1, "2026H1": 2},
                "label": {
                    "2025H1": "2025H1",
                    "2025H2": "2025H2",
                    "2026H1": "2026H1",
                },
            },
        },
    },
    "value": [
        120.5,
        135.2,
        118.3,
        95.3,
        108.7,
        93.1,
        85.2,
        97.5,
        83.0,
    ],
}


class TestEnergyPriceProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "energy_prices"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "energy_prices"
        assert len(result.findings) == 3

    def test_collect_returns_latest_period(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.validity is not None
            assert finding.validity.start == "2026-01-01"
            assert finding.validity.end == "2026-06-30"

    def test_collect_values_are_floats(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert isinstance(finding.value, float)
            assert finding.unit == "öre_per_kwh"

    def test_collect_wrong_country(self) -> None:
        provider = _make_provider(json_transport({}))
        context = MarketContext(country="NO")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA
        assert "Sweden" in result.detail  # type: ignore[union-attr]

    def test_collect_http_error(self) -> None:
        provider = _make_provider(error_transport(503))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR
        assert "HTTP error" in result.detail  # type: ignore[union-attr]

    def test_collect_network_error(self) -> None:
        provider = _make_provider(network_error_transport())
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR
        assert result.detail is not None
        assert "transport error" in result.detail.lower()

    def test_collect_empty_response(self) -> None:
        provider = _make_provider(json_transport({"dimension": {}, "value": []}))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_collect_none_country(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) == 3

    def test_fetched_at_populated(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_source_metadata(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert source.name == "Statistics Sweden (SCB)"
        assert source.license == "CC0 1.0"

    def test_detail_shows_category_name(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        small = [f for f in result.findings if "R1" in f.key]
        assert small
        assert "Small household" in small[0].detail  # type: ignore[union-attr]

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(json_transport(_SAMPLE_ENERGY_PRICES))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
