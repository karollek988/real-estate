"""Tests for the mortgage rates provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.mortgage_rates import MortgageRateProvider
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    json_transport,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> MortgageRateProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return MortgageRateProvider(client, clock=fixed_clock)


# Sample SCB response: 4 fixation periods × 2 months = 8 values
_SAMPLE_MORTGAGE_RATES = {
    "dimension": {
        "Rantebindningstid": {
            "label": "original rate fixation",
            "category": {
                "index": {
                    "1.1.1": 0,
                    "1.1.2.2.1": 1,
                    "1.1.2.2.2": 2,
                    "1.1.2.3": 3,
                },
                "label": {
                    "1.1.1": "Up to 3 months",
                    "1.1.2.2.1": "Over 1–3 years",
                    "1.1.2.2.2": "Over 3–5 years",
                    "1.1.2.3": "Over 5 years",
                },
            },
        },
        "ContentsCode": {
            "label": "observations",
            "category": {
                "index": {"000004ZW": 0},
                "label": {"000004ZW": "Percent"},
            },
        },
        "Tid": {
            "label": "month",
            "category": {
                "index": {"2026M04": 0, "2026M05": 1},
                "label": {"2026M04": "2026M04", "2026M05": "2026M05"},
            },
        },
    },
    "value": [
        3.75,
        3.72,
        4.21,
        4.18,
        4.45,
        4.42,
        4.68,
        4.65,
    ],
}


class TestMortgageRateProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "mortgage_rates"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=12)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "mortgage_rates"
        assert len(result.findings) == 4

    def test_collect_returns_latest_period(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.validity is not None
            assert finding.validity.start == "2026-05-01"
            assert finding.validity.end == "2026-05-31"

    def test_collect_keys_match_fixation_periods(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        keys = sorted(f.key for f in result.findings)
        assert keys == [
            "mortgage_rate.fixed_1_3yr",
            "mortgage_rate.fixed_3_5yr",
            "mortgage_rate.fixed_5yr_plus",
            "mortgage_rate.floating_rate",
        ]

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
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) == 4

    def test_fetched_at_populated(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_source_metadata(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert source.name == "Statistics Sweden (SCB)"
        assert source.license == "CC0 1.0"

    def test_detail_shows_fixation_period_name(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        floating = [f for f in result.findings if "floating" in f.key]
        assert floating
        assert "Up to 3 months" in floating[0].detail  # type: ignore[union-attr]

    def test_values_are_floats(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert isinstance(finding.value, float)
            assert finding.unit == "percent"

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(json_transport(_SAMPLE_MORTGAGE_RATES))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
