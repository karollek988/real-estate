"""Tests for the SCB sub-national provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.scb_subnational import ScbSubnationalProvider
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> ScbSubnationalProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return ScbSubnationalProvider(client, clock=fixed_clock)


def _make_population_response(
    values: list[float | None],
    periods: list[str],
    regions: list[tuple[str, str]],
) -> dict:
    """Build a minimal JSON-stat2 response with Region × Tid dimensions."""
    return {
        "value": values,
        "dimension": {
            "Region": {
                "category": {
                    "index": {r[0]: i for i, r in enumerate(regions)},
                    "label": {r[0]: r[1] for r in regions},
                }
            },
            "Tid": {
                "category": {
                    "index": {p: i for i, p in enumerate(periods)},
                    "label": {p: p for p in periods},
                }
            },
        },
    }


def _make_employment_response(
    values: list[float | None],
    periods: list[str],
    regions: list[tuple[str, str]],
    contents: list[tuple[str, str]],
) -> dict:
    """Build a JSON-stat2 response with Region × ContentsCode × Tid dimensions."""
    return {
        "value": values,
        "dimension": {
            "Region": {
                "category": {
                    "index": {r[0]: i for i, r in enumerate(regions)},
                    "label": {r[0]: r[1] for r in regions},
                }
            },
            "ContentsCode": {
                "category": {
                    "index": {c[0]: i for i, c in enumerate(contents)},
                    "label": {c[0]: c[1] for c in contents},
                }
            },
            "Tid": {
                "category": {
                    "index": {p: i for i, p in enumerate(periods)},
                    "label": {p: p for p in periods},
                }
            },
        },
    }


_REGIONS = [("00", "Sweden"), ("01", "Stockholm"), ("12", "Skåne")]
_PERIODS = ["2024"]
_CONTENTS = [("000006J6", "employment_rate"), ("000006J1", "unemployment_rate")]

_POPULATION_RESPONSE = _make_population_response(
    values=[10560000, 2400000, 150000],
    periods=_PERIODS,
    regions=_REGIONS,
)

_AVERAGE_AGE_RESPONSE = _make_population_response(
    values=[41.2, 39.5, 40.8],
    periods=["2025"],
    regions=_REGIONS,
)

_EMPLOYMENT_RESPONSE = _make_employment_response(
    values=[72.5, 5.2, 75.0, 4.8, 68.0, 6.1],
    periods=_PERIODS,
    regions=_REGIONS,
    contents=_CONTENTS,
)


class TestScbSubnationalProvider:
    def test_attributes(self) -> None:
        p = _make_provider(_make_transport({}))
        assert p.id == "scb_subnational"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok_multiple_tables(self) -> None:
        call_count = [0]
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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
        assert result.provider_id == "scb_subnational"
        # 3 regions × 1 population + 3 regions × 1 average_age + 3 regions × 2 employment
        assert len(result.findings) == 12

        keys = {f.key for f in result.findings}
        assert "population" in keys
        assert "average_age" in keys
        assert "employment_rate" in keys
        assert "unemployment_rate" in keys

    def test_collect_wrong_country(self) -> None:
        provider = _make_provider(_make_transport({}))
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
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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
        assert len(result.findings) == 12

    def test_population_finding_details(self) -> None:
        call_count = [0]
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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

        pop = [f for f in result.findings if f.key == "population"]
        assert len(pop) == 3

        sweden_pop = [f for f in pop if f.region == "Sweden"][0]
        assert sweden_pop.value == 10560000
        assert sweden_pop.unit == "persons"
        assert sweden_pop.country == "SE"
        assert sweden_pop.coverage == "national"
        assert sweden_pop.validity is not None
        assert sweden_pop.validity.start == "2024-01-01"
        assert sweden_pop.validity.end == "2024-12-31"

        stockholm_pop = [f for f in pop if f.county == "Stockholm"][0]
        assert stockholm_pop.value == 2400000
        assert stockholm_pop.coverage == "county"
        assert stockholm_pop.municipality is None

    def test_average_age_finding_details(self) -> None:
        call_count = [0]
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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

        ages = [f for f in result.findings if f.key == "average_age"]
        assert len(ages) == 3

        sweden_age = [f for f in ages if f.region == "Sweden"][0]
        assert sweden_age.value == 41.2
        assert sweden_age.unit == "years"

    def test_employment_finding_details(self) -> None:
        call_count = [0]
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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

        emp = [f for f in result.findings if f.key == "employment_rate"]
        assert len(emp) == 3

        sweden_emp = [f for f in emp if f.region == "Sweden"][0]
        assert sweden_emp.value == 72.5
        assert sweden_emp.unit == "percent"

        unemp = [f for f in result.findings if f.key == "unemployment_rate"]
        assert len(unemp) == 3

        sweden_unemp = [f for f in unemp if f.region == "Sweden"][0]
        assert sweden_unemp.value == 5.2
        assert sweden_unemp.unit == "percent"

    def test_source_metadata(self) -> None:
        call_count = [0]
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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
        responses = [_POPULATION_RESPONSE]
        call_count = [0]

        def partial_transport(request, timeout):
            call_count[0] += 1
            import json as _json

            from market_intelligence.http_client import HttpResponse

            if call_count[0] <= len(responses):
                return HttpResponse(
                    status=200,
                    body=_json.dumps(responses[call_count[0] - 1]).encode("utf-8"),
                )
            return HttpResponse(status=500, body=b"error")

        provider = _make_provider(partial_transport)
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.PARTIAL
        assert len(result.findings) >= 3
        assert result.detail is not None
        assert "Partial" in result.detail

    def test_empty_response(self) -> None:
        empty = _make_population_response(values=[], periods=[], regions=[])
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
        responses = [_POPULATION_RESPONSE, _AVERAGE_AGE_RESPONSE, _EMPLOYMENT_RESPONSE]

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


def _make_transport(responses: dict):
    """Create a transport function that returns the given response."""
    import json as _json

    from market_intelligence.http_client import HttpResponse

    def transport(request, timeout):
        return HttpResponse(
            status=200,
            body=_json.dumps(responses).encode("utf-8"),
        )

    return transport
