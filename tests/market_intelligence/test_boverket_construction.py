"""Tests for the Boverket construction provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.boverket_construction import (
    BoverketConstructionProvider,
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


def _make_provider(transport_fn) -> BoverketConstructionProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return BoverketConstructionProvider(client, clock=fixed_clock)


def _make_construction_response() -> dict:
    """Build a realistic SCB JSON-stat2 building permit response."""
    return {
        "value": [
            1200,
            450000,
            800,
            300000,
            300,
            120000,
            150,
            80000,
        ],
        "dimension": {
            "Tid": {
                "category": {
                    "index": {"2025K3": 0, "2025K4": 1},
                    "label": {"2025K3": "Q3 2025", "2025K4": "Q4 2025"},
                }
            },
            "Byggnadstyp": {
                "category": {
                    "index": {"FLERBOSTADSHUS": 0, "ENSAMSTÅENDE": 1},
                    "label": {
                        "FLERBOSTADSHUS": "Multi-dwelling buildings",
                        "ENSAMSTÅENDE": "Single-dwelling houses",
                    },
                }
            },
            "ContentsCode": {
                "category": {
                    "index": {"0000J3": 0, "0000J4": 1},
                    "label": {
                        "0000J3": "Building permits, number",
                        "0000J4": "Building permits, area (sqm)",
                    },
                }
            },
        },
        "id": ["ContentsCode", "Tid", "Byggnadstyp"],
        "size": [2, 2, 2],
    }


class TestBoverketConstructionProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "boverket_construction"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "boverket_construction"
        assert len(result.findings) >= 1

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

    def test_collect_empty_response(self) -> None:
        provider = _make_provider(json_transport({"value": [], "dimension": {}}))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_collect_none_country(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK

    def test_finding_domains(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.domain == "housing_market"

    def test_finding_keys(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        keys = {f.key for f in result.findings}
        assert "building_permits_granted" in keys or "new_construction_area" in keys

    def test_validity_windows(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            if finding.validity is not None:
                assert finding.validity.start is not None
                assert finding.validity.end is not None

    def test_source_metadata(self) -> None:
        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert "SCB" in source.name or "Boverket" in source.name
        assert result.findings[0].fetched_at == fixed_iso()

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(json_transport(_make_construction_response()))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
