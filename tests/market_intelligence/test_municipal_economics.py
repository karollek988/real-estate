"""Tests for the municipal economics provider."""

from __future__ import annotations

import json as _json
from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient, HttpResponse
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.municipal_economics import (
    MunicipalEconomicsProvider,
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


def _make_provider(transport_fn) -> MunicipalEconomicsProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return MunicipalEconomicsProvider(client, clock=fixed_clock)


def _multi_response_transport(*responses):
    """Create a transport that returns different JSON responses for each call."""
    call_count = [0]

    def _transport(request, timeout):
        idx = min(call_count[0], len(responses) - 1)
        call_count[0] += 1
        return HttpResponse(
            status=200,
            body=_json.dumps(responses[idx]).encode("utf-8"),
        )

    return _transport


# Sample TAB6383: Employment by municipality
_SAMPLE_EMPLOYMENT = {
    "dimension": {
        "Region": {
            "label": "region",
            "category": {
                "index": {"00": 0, "01": 1, "0180": 2, "1480": 3},
                "label": {
                    "00": "Total",
                    "01": "Stockholms län",
                    "0180": "Stockholm",
                    "1480": "Göteborg",
                },
            },
        },
        "Tid": {
            "label": "year",
            "category": {
                "index": {"2023": 0, "2024": 1},
                "label": {"2023": "2023", "2024": "2024"},
            },
        },
    },
    "value": [72.5, 73.1, 74.2, 74.8, 71.0, 71.5, 70.3, 70.8],
}

# Sample TAB1792: Disposable income
_SAMPLE_INCOME = {
    "dimension": {
        "Region": {
            "label": "region",
            "category": {
                "index": {"00": 0, "0180": 1, "1480": 2},
                "label": {
                    "00": "Total",
                    "0180": "Stockholm",
                    "1480": "Göteborg",
                },
            },
        },
        "Tid": {
            "label": "year",
            "category": {
                "index": {"2022": 0, "2023": 1},
                "label": {"2022": "2022", "2023": "2023"},
            },
        },
    },
    "value": [305000, 320000, 290000, 310000, 285000, 295000],
}

# Sample TAB2017: Tax rates
_SAMPLE_TAX_RATES = {
    "dimension": {
        "Region": {
            "label": "region",
            "category": {
                "index": {"0180": 0, "1480": 1, "1280": 2},
                "label": {
                    "0180": "Stockholm",
                    "1480": "Göteborg",
                    "1280": "Malmö",
                },
            },
        },
        "ContentsCode": {
            "label": "contents",
            "category": {
                "index": {"00000VXR": 0},
                "label": {"00000VXR": "Municipal tax rate"},
            },
        },
        "Tid": {
            "label": "year",
            "category": {
                "index": {"2025": 0, "2026": 1},
                "label": {"2025": "2025", "2026": "2026"},
            },
        },
    },
    "value": [29.82, 30.00, 28.50, 29.00, 32.37, 32.87],
}


class TestMunicipalEconomicsProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "municipal_economics"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok_all_tables(self) -> None:
        """When all 3 tables return data, provider emits OK with all findings."""
        transport = _multi_response_transport(_SAMPLE_EMPLOYMENT, _SAMPLE_INCOME, _SAMPLE_TAX_RATES)
        provider = _make_provider(transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "municipal_economics"
        # 4 employment + 3 income + 3 tax = 10
        assert len(result.findings) == 10

    def test_collect_wrong_country(self) -> None:
        provider = _make_provider(json_transport({}))
        context = MarketContext(country="NO")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA
        assert "Sweden" in result.detail  # type: ignore[union-attr]

    def test_collect_none_country(self) -> None:
        """When country is None, provider runs (Sweden-only by default)."""
        transport = _multi_response_transport(_SAMPLE_EMPLOYMENT)
        provider = _make_provider(transport)
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK

    def test_collect_http_error(self) -> None:
        provider = _make_provider(error_transport(503))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR
        assert "All SCB tables failed" in result.detail  # type: ignore[union-attr]

    def test_collect_network_error(self) -> None:
        provider = _make_provider(network_error_transport())
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR
        assert result.detail is not None

    def test_collect_empty_response(self) -> None:
        provider = _make_provider(json_transport({"dimension": {}, "value": []}))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_fetched_at_populated(self) -> None:
        """When employment table returns data, fetched_at is populated."""
        transport = _multi_response_transport(_SAMPLE_EMPLOYMENT)
        provider = _make_provider(transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_employment_findings_have_geographic_data(self) -> None:
        """Employment findings include municipality/county fields."""
        transport = _multi_response_transport(_SAMPLE_EMPLOYMENT)
        provider = _make_provider(transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        stockholms = [f for f in result.findings if f.county == "Stockholms län"]
        assert stockholms
        stockholm_muni = [f for f in result.findings if f.municipality == "Stockholm"]
        assert stockholm_muni

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        transport = _multi_response_transport(_SAMPLE_EMPLOYMENT)
        provider = _make_provider(transport)
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
