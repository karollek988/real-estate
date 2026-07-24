"""Tests for the SCB macro economy provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.scb_macro_economy import ScbMacroEconomyProvider
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    json_transport,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> ScbMacroEconomyProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return ScbMacroEconomyProvider(client, clock=fixed_clock)


def _make_json_stat(values: list[float | None], periods: list[str]) -> dict:
    """Build a minimal JSON-stat2 response."""
    return {
        "value": values,
        "dimension": {
            "Tid": {
                "category": {
                    "index": {p: i for i, p in enumerate(periods)},
                    "label": {p: p for p in periods},
                }
            }
        },
    }


_CPI_RESPONSE = _make_json_stat(
    values=[130.5, 131.2, 132.0],
    periods=["2025M10", "2025M11", "2025M12"],
)

_POPULATION_RESPONSE = _make_json_stat(
    values=[10551707, 10555000, 10560000],
    periods=["2024", "2025", "2026"],
)

_UNEMPLOYMENT_RESPONSE = _make_json_stat(
    values=[7.8, 7.5, 7.2],
    periods=["2025M10", "2025M11", "2025M12"],
)


class TestScbMacroEconomyProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "scb_macro_economy"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=6)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok_multiple_datasets(self) -> None:
        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "scb_macro_economy"
        assert len(result.findings) == 3

        keys = {f.key for f in result.findings}
        assert "cpi_index" in keys
        assert "total_population" in keys
        assert "unemployment_rate" in keys

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
        assert result.detail is not None
        assert "failed" in result.detail.lower()

    def test_collect_network_error(self) -> None:
        provider = _make_provider(network_error_transport())
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR

    def test_collect_none_country(self) -> None:
        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) == 3

    def test_cpi_finding_details(self) -> None:
        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        cpi = [f for f in result.findings if f.key == "cpi_index"][0]
        assert cpi.value == 132.0
        assert cpi.unit == "index_2020=100"
        assert cpi.country == "SE"
        assert cpi.coverage == "national"
        assert cpi.validity is not None
        assert cpi.validity.start == "2025-12-01"
        assert cpi.validity.end == "2025-12-31"

    def test_population_finding_details(self) -> None:
        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        pop = [f for f in result.findings if f.key == "total_population"][0]
        assert pop.value == 10560000
        assert pop.unit == "persons"
        assert pop.validity is not None
        assert pop.validity.start == "2026-01-01"
        assert pop.validity.end == "2026-12-31"

    def test_source_metadata(self) -> None:
        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.source.name == "Statistics Sweden (SCB)"
            assert finding.source.license == "CC0 1.0"
            assert finding.fetched_at == fixed_iso()

    def test_partial_failure(self) -> None:
        call_count = [0]

        def partial_transport(request, timeout):
            call_count[0] += 1
            import json as _json

            from market_intelligence.http_client import HttpResponse

            if call_count[0] == 1:
                return HttpResponse(
                    status=200,
                    body=_json.dumps(_CPI_RESPONSE).encode("utf-8"),
                )
            return HttpResponse(status=500, body=b"error")

        provider = _make_provider(partial_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.PARTIAL
        assert len(result.findings) >= 1
        assert result.detail is not None
        assert "Partial" in result.detail

    def test_empty_response(self) -> None:
        empty = _make_json_stat(values=[], periods=[])
        call_count = [0]

        def empty_transport(request, timeout):
            import json as _json

            from market_intelligence.http_client import HttpResponse

            call_count[0] += 1
            return HttpResponse(status=200, body=_json.dumps(empty).encode("utf-8"))

        provider = _make_provider(empty_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        call_count = [0]
        responses = [_CPI_RESPONSE, _POPULATION_RESPONSE, _UNEMPLOYMENT_RESPONSE]

        def rotating_transport(request, timeout):
            call_count[0] += 1
            idx = min(call_count[0] - 1, len(responses) - 1)
            import json as _json

            from market_intelligence.http_client import HttpResponse

            return HttpResponse(
                status=200,
                body=_json.dumps(responses[idx]).encode("utf-8"),
            )

        provider = _make_provider(rotating_transport)
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []
