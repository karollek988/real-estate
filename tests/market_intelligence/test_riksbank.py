"""Tests for the SCB-based Riksbank interest rate provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.riksbank_interest_rate import (
    RiksbankInterestRateProvider,
)
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    json_transport,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> RiksbankInterestRateProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return RiksbankInterestRateProvider(client, clock=fixed_clock)


_SAMPLE_SCB_SOUNDNESS = {
    "dimension": {
        "FinansiellIndikator": {
            "label": "indicator",
            "category": {
                "index": {"I037": 0, "I006": 1},
                "label": {
                    "I037": "Residential real estate prices",
                    "I006": "Return on assets",
                },
            },
        },
        "ContentsCode": {
            "label": "observations",
            "category": {
                "index": {"000000AE": 0},
                "label": {"000000AE": "Percent"},
            },
        },
        "Tid": {
            "label": "quarter",
            "category": {
                "index": {"2025K3": 0, "2025K4": 1, "2026K1": 2},
                "label": {
                    "2025K3": "2025K3",
                    "2025K4": "2025K4",
                    "2026K1": "2026K1",
                },
            },
        },
    },
    "value": [133.34, 133.20, 133.26, 5.5, 5.2, 5.1],
}


class TestRiksbankInterestRateProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "riksbank_interest_rate"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=12)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "riksbank_interest_rate"
        assert len(result.findings) == 6

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

        assert result.status in (ProviderStatus.NO_DATA, ProviderStatus.ERROR)

    def test_collect_no_values(self) -> None:
        provider = _make_provider(json_transport({"dimension": {"Tid": {}}, "value": []}))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_collect_invalid_json(self) -> None:
        from tests.market_intelligence.conftest import canned_transport

        provider = _make_provider(canned_transport(200, b"not json"))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR

    def test_collect_none_country(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) == 6

    def test_fetched_at_populated(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_source_metadata(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert "Riksbank" in source.name
        assert source.license == "CC0 1.0"

    def test_validity_windows(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        first = result.findings[0]
        assert first.validity is not None
        assert first.validity.start == "2025-07-01"
        assert first.validity.end == "2025-09-30"

        last_by_period = [
            f for f in result.findings if f.validity and f.validity.start == "2026-01-01"
        ]
        assert last_by_period
        assert last_by_period[0].validity is not None
        assert last_by_period[0].validity.start == "2026-01-01"
        assert last_by_period[0].validity.end == "2026-03-31"

    def test_detail_shows_indicator_name(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        rees_findings = [f for f in result.findings if "I037" in f.key]
        assert rees_findings
        assert rees_findings[0].detail == "Residential real estate prices"

    def test_findings_sorted_by_indicator_then_period(self) -> None:
        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        keys = [f.key for f in result.findings]
        assert len(keys) == 6

        indicator_keys = [k.split(".")[-1] for k in keys]
        unique_indicators = list(dict.fromkeys(indicator_keys))
        assert len(unique_indicators) == 2

        periods_per_indicator = len(keys) // len(unique_indicators)
        for i in range(0, len(keys), periods_per_indicator):
            chunk = keys[i : i + periods_per_indicator]
            assert len(set(chunk)) == 1, "same indicator grouped together"

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(json_transport(_SAMPLE_SCB_SOUNDNESS))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
