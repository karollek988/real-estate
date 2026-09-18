"""Tests for the SCB housing market provider."""

from __future__ import annotations

from datetime import timedelta

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.scb_housing_market import ScbHousingMarketProvider
from tests.market_intelligence.conftest import (
    always_monotonic,
    error_transport,
    fixed_clock,
    fixed_iso,
    json_transport,
    network_error_transport,
    never_sleep,
)


def _make_provider(transport_fn) -> ScbHousingMarketProvider:
    config = EngineConfig()
    client = HttpClient(
        config,
        transport=transport_fn,
        sleep=never_sleep,
        monotonic=always_monotonic,
    )
    return ScbHousingMarketProvider(client, clock=fixed_clock)


def _scb_response(values: list, periods: dict | None = None) -> dict:
    """Helper to build a minimal SCB JSON-stat2 response."""
    if periods is None:
        periods = {"2025K3": 0, "2025K4": 1, "2026K1": 2}
    return {
        "dimension": {
            "Tid": {
                "label": "quarter",
                "category": {
                    "index": periods,
                    "label": {k: k for k in periods},
                },
            },
        },
        "value": values,
    }


class TestScbHousingMarketProvider:
    def test_attributes(self) -> None:
        p = _make_provider(json_transport({}))
        assert p.id == "scb_housing_market"
        assert p.trust_tier.value == "registry_authority"
        assert p.cache_ttl == timedelta(hours=24)
        assert p.required_level == GeographicLevel.COUNTRY

    def test_collect_ok(self) -> None:
        provider = _make_provider(json_transport(_scb_response([120.5, 121.0, 122.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert result.provider_id == "scb_housing_market"
        assert len(result.findings) == 9

        hpi = [f for f in result.findings if f.key == "house_price_index"]
        tx = [f for f in result.findings if f.key == "transactions"]
        cons = [f for f in result.findings if f.key == "new_construction"]
        assert len(hpi) == 3
        assert len(tx) == 3
        assert len(cons) == 3

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
        assert "All SCB tables failed" in result.detail  # type: ignore[union-attr]

    def test_collect_network_error(self) -> None:
        provider = _make_provider(network_error_transport())
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.ERROR
        assert result.detail is not None
        assert "transport error" in result.detail.lower()

    def test_collect_empty_response(self) -> None:
        provider = _make_provider(json_transport(_scb_response([])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_collect_none_country(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0])))
        context = MarketContext()
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK

    def test_fetched_at_populated(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_source_metadata(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        source = result.findings[0].source
        assert "SCB" in source.name
        assert source.license == "CC0 1.0"

    def test_validity_windows(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0, 101.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        first = result.findings[0]
        assert first.validity is not None
        assert first.validity.start == "2025-07-01"
        assert first.validity.end == "2025-09-30"

    def test_detail_shows_table(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert "TAB1150" in result.findings[0].detail

    def test_findings_sorted_by_period(self) -> None:
        provider = _make_provider(json_transport(_scb_response([100.0, 101.0, 102.0])))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        for key in ("house_price_index", "transactions", "new_construction"):
            key_values = [f.value for f in result.findings if f.key == key]
            assert key_values == sorted(key_values), f"{key} should be sorted by period"

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = _make_provider(json_transport(_scb_response([100.0])))
        context = MarketContext(country="SE")
        violations = check_provider(provider, context)
        assert violations == []

    def test_price_index_with_region_dimension(self) -> None:
        """SCB's live TAB1150 now carries a Region dimension (national "00"
        plus 3 metro areas + 8 riksomraden) that an earlier version of this
        parser silently ignored, reading `value` as if Tid were the only
        dimension. That happened to still return the correct national
        figures (region "00" is index 0, and this table's ContentsCode has
        exactly one category, so no accidental offset) - but it silently
        *dropped* every other region's data. This response has a second
        region at a non-zero index specifically to catch that regression:
        the old code would have returned only 2 findings (Sweden's), never
        erroring, just silently discarding Stockholm's.
        """
        response = {
            "dimension": {
                "Region": {
                    "category": {
                        "index": {"00": 0, "0010": 1},
                        "label": {"00": "Sweden", "0010": "Greater Stockholm"},
                    },
                },
                "ContentsCode": {"category": {"index": {"BO0501K2": 0}, "label": {"BO0501K2": "Index"}}},
                "Tid": {
                    "category": {
                        "index": {"2025K3": 0, "2025K4": 1},
                        "label": {"2025K3": "2025K3", "2025K4": "2025K4"},
                    },
                },
            },
            # Row-major: region slowest, Tid fastest (ContentsCode size 1 contributes no offset).
            "value": [900.0, 910.0, 1200.0, 1210.0],
        }
        provider = _make_provider(json_transport(response))
        context = MarketContext(country="SE")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        hpi = [f for f in result.findings if f.key == "house_price_index"]
        assert len(hpi) == 4, "must yield both regions' series, not just Sweden's"

        sweden = {f.validity.start: f.value for f in hpi if f.region == "00"}  # type: ignore[union-attr]
        stockholm = {f.validity.start: f.value for f in hpi if f.region == "0010"}  # type: ignore[union-attr]
        assert sweden == {"2025-07-01": 900.0, "2025-10-01": 910.0}
        assert stockholm == {"2025-07-01": 1200.0, "2025-10-01": 1210.0}
        assert all(f.coverage == "national" for f in hpi if f.region == "00")
        assert all(f.coverage == "region" for f in hpi if f.region == "0010")
