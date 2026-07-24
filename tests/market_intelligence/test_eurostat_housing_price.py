"""Tests for the Eurostat housing price index provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.eurostat_housing_price import (
    EurostatHousingPriceProvider,
)
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    network_error_transport,
    never_sleep,
    text_transport,
)


def _make_provider(transport_fn) -> EurostatHousingPriceProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return EurostatHousingPriceProvider(client, clock=fixed_clock)


_SAMPLE_TSV = (
    "freq,purchase,unit,geo\\TIME_PERIOD\t2024-Q1\t2024-Q2\t2024-Q3\t2024-Q4\n"
    "Q,DW_EXST,I15_Q,SE\t129.65\t130.42\t130.29\t127.23\n"
    "Q,DW_EXST,I15_Q,NO\t157.46\t155.99\t161.14\t158.31\n"
    "Q,DW_EXST,I15_Q,DK\t140.39\t136.75\t141.06\t145.42\n"
    "Q,DW_EXST,I15_Q,EU\t161.16\t163.08\t157.73\t160.30\n"
)


class TestEurostatHousingPriceProvider:
    def test_attributes(self) -> None:
        p = _make_provider(text_transport(""))
        assert p.id == "eurostat_housing_price"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "eurostat_housing_price"
        assert len(result.findings) > 0

    def test_sweden_findings_present(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        se_findings = [f for f in result.findings if f.country == "SE"]
        assert len(se_findings) == 4

        values = [f.value for f in se_findings]
        assert 129.65 in values
        assert 127.23 in values

    def test_peer_countries_included(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        countries = {f.country for f in result.findings}
        assert "SE" in countries
        assert "NO" in countries
        assert "DK" in countries
        assert "EU" in countries

    def test_collect_wrong_country(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="US")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA or len(result.findings) == 0

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
        provider = _make_provider(text_transport(""))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_collect_none_country(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) > 0

    def test_fetched_at_populated(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_source_metadata(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert source.name == "Eurostat"
        assert source.license == "CC BY 4.0"

    def test_validity_windows(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        first = result.findings[0]
        assert first.validity is not None
        assert first.validity.start is not None
        assert first.validity.end is not None

    def test_detail_shows_index(self) -> None:
        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert "hpi_2015=100" in result.findings[0].detail

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(text_transport(_SAMPLE_TSV))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
