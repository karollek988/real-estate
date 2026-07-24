"""Tests for housing market provider base and HemnetListingsProvider."""

from __future__ import annotations

import pytest

from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.models import ProviderStatus
from market_intelligence.providers.housing_market_base import (
    HemnetListingsProvider,
    HousingMarketProvider,
)
from tests.market_intelligence.conftest import fixed_clock, fixed_iso


class TestHousingMarketProvider:
    def test_is_abstract(self) -> None:
        with pytest.raises(TypeError):
            HousingMarketProvider()  # type: ignore[abstract]


class TestHemnetListingsProvider:
    def test_no_data_when_empty(self) -> None:
        provider = HemnetListingsProvider(clock=fixed_clock)
        context = MarketContext(country="SE", municipality="Stockholm")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA
        assert result.detail is not None
        assert "No pre-fetched" in result.detail

    def test_collect_with_data(self) -> None:
        listings = [
            {"key": "listing_count", "value": 150, "unit": "listings"},
            {"key": "asking_price_median", "value": 4500000, "unit": "SEK"},
        ]
        provider = HemnetListingsProvider(clock=fixed_clock, listings_data=listings)
        context = MarketContext(country="SE", municipality="Stockholm", county="Stockholms län")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        assert len(result.findings) == 2

        count_finding = result.findings[0]
        assert count_finding.domain == "housing_market"
        assert count_finding.key == "listing_count"
        assert count_finding.value == 150
        assert count_finding.country == "SE"
        assert count_finding.municipality == "Stockholm"

        price_finding = result.findings[1]
        assert price_finding.key == "asking_price_median"
        assert price_finding.value == 4500000

    def test_source_metadata(self) -> None:
        listings = [{"key": "listing_count", "value": 100}]
        provider = HemnetListingsProvider(clock=fixed_clock, listings_data=listings)
        context = MarketContext(country="SE", municipality="Gothenburg")
        result = provider.collect(context)

        assert result.status == ProviderStatus.OK
        source = result.findings[0].source
        assert source.name == "Hemnet"
        assert source.license == "proprietary"

    def test_fetched_at(self) -> None:
        listings = [{"key": "listing_count", "value": 100}]
        provider = HemnetListingsProvider(clock=fixed_clock, listings_data=listings)
        context = MarketContext(country="SE", municipality="Malmö")
        result = provider.collect(context)

        for finding in result.findings:
            assert finding.fetched_at == fixed_iso()

    def test_coverage_built_from_context(self) -> None:
        listings = [{"key": "listing_count", "value": 100}]
        provider = HemnetListingsProvider(clock=fixed_clock, listings_data=listings)
        context = MarketContext(
            country="SE",
            county="Stockholms län",
            municipality="Stockholm",
        )
        result = provider.collect(context)

        assert result.findings[0].coverage is not None
        assert "Stockholm" in result.findings[0].coverage

    def test_empty_entries_no_data(self) -> None:
        listings = [{"key": "listing_count", "value": None}]
        provider = HemnetListingsProvider(clock=fixed_clock, listings_data=listings)
        context = MarketContext(country="SE", municipality="Stockholm")
        result = provider.collect(context)

        assert result.status == ProviderStatus.NO_DATA

    def test_provider_id(self) -> None:
        provider = HemnetListingsProvider(clock=fixed_clock)
        assert provider.id == "hemnet_listings"
        assert provider.data_category == "listing"

    def test_required_level(self) -> None:
        provider = HemnetListingsProvider(clock=fixed_clock)
        assert provider.required_level == GeographicLevel.MUNICIPALITY

    def test_supported_levels(self) -> None:
        provider = HemnetListingsProvider(clock=fixed_clock)
        assert GeographicLevel.MUNICIPALITY in provider.supported_levels
        assert GeographicLevel.COUNTY in provider.supported_levels
        assert GeographicLevel.COUNTRY not in provider.supported_levels

    def test_conforms_to_provider_contract(self) -> None:
        from market_intelligence.conformance import check_provider

        provider = HemnetListingsProvider(clock=fixed_clock)
        context = MarketContext(country="SE", municipality="Stockholm")
        violations = check_provider(provider, context)
        assert violations == []
