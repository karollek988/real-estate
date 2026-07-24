"""AddressContext contract: input parsing, patching, cache keys."""

from __future__ import annotations

import pytest

from location_intelligence.context import (
    AddressContext,
    InputMode,
    context_from_raw_input,
)


class TestContextFromRawInput:
    def test_address_input(self) -> None:
        ctx = context_from_raw_input("Dalagatan 30, Stockholm")
        assert ctx.input_mode is InputMode.ADDRESS
        assert ctx.latitude is None

    def test_coordinate_input(self) -> None:
        ctx = context_from_raw_input("59.343, 18.049")
        assert ctx.input_mode is InputMode.COORDINATES
        assert ctx.latitude == pytest.approx(59.343)
        assert ctx.longitude == pytest.approx(18.049)

    def test_empty_input_rejected(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            context_from_raw_input("   ")

    def test_out_of_range_coordinates_rejected(self) -> None:
        with pytest.raises(ValueError, match="latitude out of range"):
            AddressContext(
                raw_input="x", input_mode=InputMode.COORDINATES, latitude=95.0, longitude=18.0
            )


class TestPatching:
    def test_patched_returns_enriched_copy(self) -> None:
        ctx = context_from_raw_input("Dalagatan 30")
        enriched = ctx.patched(municipality="Stockholm", municipality_code="0180")
        assert enriched.municipality == "Stockholm"
        assert ctx.municipality is None  # original untouched

    def test_unknown_field_fails_loudly(self) -> None:
        ctx = context_from_raw_input("Dalagatan 30")
        with pytest.raises(ValueError, match="unknown AddressContext fields"):
            ctx.patched(muncipality="typo")


class TestCacheKey:
    def test_address_key_normalizes_case_and_whitespace(self) -> None:
        a = context_from_raw_input("Dalagatan  30,   Stockholm")
        b = context_from_raw_input("dalagatan 30, stockholm")
        assert a.cache_key() == b.cache_key()

    def test_coordinate_key_rounds_to_four_decimals(self) -> None:
        a = context_from_raw_input("59.34301, 18.04899")
        b = context_from_raw_input("59.34302, 18.04901")
        assert a.cache_key() == b.cache_key()
