"""Tests for market_intelligence.context — MarketContext, GeographicLevel."""

from __future__ import annotations

import pytest

from market_intelligence.context import (
    GeographicLevel,
    MarketContext,
    level_at_least,
)


class TestMarketContext:
    def test_empty_context(self) -> None:
        ctx = MarketContext()
        assert ctx.geographic_level is None

    def test_country_level(self) -> None:
        ctx = MarketContext(country="SE")
        assert ctx.geographic_level == GeographicLevel.COUNTRY

    def test_region_level(self) -> None:
        ctx = MarketContext(country="SE", region="Stockholm")
        assert ctx.geographic_level == GeographicLevel.REGION

    def test_county_level(self) -> None:
        ctx = MarketContext(country="SE", county="Stockholms län")
        assert ctx.geographic_level == GeographicLevel.COUNTY

    def test_municipality_level(self) -> None:
        ctx = MarketContext(country="SE", municipality="Stockholm")
        assert ctx.geographic_level == GeographicLevel.MUNICIPALITY

    def test_postal_code_level(self) -> None:
        ctx = MarketContext(country="SE", postal_code="11120")
        assert ctx.geographic_level == GeographicLevel.POSTAL_CODE

    def test_most_specific_wins(self) -> None:
        ctx = MarketContext(
            country="SE",
            region="Stockholm",
            municipality="Stockholm",
        )
        assert ctx.geographic_level == GeographicLevel.MUNICIPALITY

    def test_cache_key_deterministic(self) -> None:
        ctx1 = MarketContext(country="SE", municipality="Stockholm")
        ctx2 = MarketContext(country="SE", municipality="Stockholm")
        assert ctx1.cache_key() == ctx2.cache_key()

    def test_cache_key_different_contexts(self) -> None:
        ctx1 = MarketContext(country="SE")
        ctx2 = MarketContext(country="NO")
        assert ctx1.cache_key() != ctx2.cache_key()

    def test_cache_key_normalizes_case(self) -> None:
        ctx1 = MarketContext(country="SE")
        ctx2 = MarketContext(country="se")
        assert ctx1.cache_key() == ctx2.cache_key()

    def test_to_dict(self) -> None:
        ctx = MarketContext(country="SE", municipality="Stockholm")
        d = ctx.to_dict()
        assert d["country"] == "SE"
        assert d["municipality"] == "Stockholm"
        assert d["geographic_level"] == "municipality"

    def test_patched(self) -> None:
        ctx = MarketContext(country="SE")
        patched = ctx.patched(municipality="Stockholm")
        assert patched.country == "SE"
        assert patched.municipality == "Stockholm"
        assert ctx.municipality is None  # original unchanged

    def test_patched_unknown_field_raises(self) -> None:
        ctx = MarketContext(country="SE")
        with pytest.raises(ValueError, match="unknown MarketContext fields"):
            ctx.patched(nonexistent="value")

    def test_frozen(self) -> None:
        ctx = MarketContext(country="SE")
        with pytest.raises(AttributeError):
            ctx.country = "NO"  # type: ignore[misc]


class TestLevelAtLeast:
    def test_none_is_coarsest(self) -> None:
        assert not level_at_least(None, GeographicLevel.COUNTRY)

    def test_equal_levels(self) -> None:
        assert level_at_least(GeographicLevel.COUNTRY, GeographicLevel.COUNTRY)
        assert level_at_least(GeographicLevel.MUNICIPALITY, GeographicLevel.MUNICIPALITY)

    def test_more_specific(self) -> None:
        assert level_at_least(GeographicLevel.MUNICIPALITY, GeographicLevel.COUNTRY)
        assert level_at_least(GeographicLevel.POSTAL_CODE, GeographicLevel.REGION)

    def test_less_specific(self) -> None:
        assert not level_at_least(GeographicLevel.COUNTRY, GeographicLevel.MUNICIPALITY)
        assert not level_at_least(GeographicLevel.REGION, GeographicLevel.POSTAL_CODE)
