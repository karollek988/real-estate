"""A-02 Definition of Done: the input matrix — clean address, no street
number, coords-only, garbage — each with correct mode/fields/warnings."""

from __future__ import annotations

from location_intelligence.context import context_from_raw_input
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.address_resolver import AddressResolver


def resolve(raw: str) -> tuple[ProviderStatus, dict[str, object]]:
    result = AddressResolver().collect(context_from_raw_input(raw))
    return result.status, result.context_patch


class TestAddressResolver:
    def test_clean_address_resolves_kommun_and_postal(self) -> None:
        status, patch = resolve("Dalagatan 30, 113 24 Stockholm")
        assert status is ProviderStatus.OK
        assert patch["municipality"] == "Stockholm"
        assert patch["municipality_code"] == "0180"
        assert patch["county_code"] == "01"
        assert patch["postal_code"] == "113 24"
        assert "warnings" not in patch

    def test_kommun_suffix_form_resolves(self) -> None:
        _, patch = resolve("Storgatan 1, Göteborgs stad")
        assert patch["municipality_code"] == "1480"

    def test_address_without_street_number_warns(self) -> None:
        status, patch = resolve("Storgatan, Lund")
        assert status is ProviderStatus.OK
        assert patch["municipality"] == "Lund"
        warnings = patch["warnings"]
        assert isinstance(warnings, tuple)
        assert any("street number" in w for w in warnings)

    def test_commaless_address_still_finds_kommun(self) -> None:
        _, patch = resolve("Dalagatan 30 Stockholm")
        assert patch["municipality_code"] == "0180"

    def test_coordinate_input_is_no_data(self) -> None:
        result = AddressResolver().collect(context_from_raw_input("59.343, 18.049"))
        assert result.status is ProviderStatus.NO_DATA
        assert result.context_patch == {}

    def test_garbage_input_warns_and_never_guesses(self) -> None:
        status, patch = resolve("qwertyuiop")
        assert status is ProviderStatus.OK
        assert "municipality" not in patch
        assert "postal_code" not in patch
        warnings = patch["warnings"]
        assert isinstance(warnings, tuple)
        assert any("municipality not recognized" in w for w in warnings)

    def test_postal_code_without_space_is_normalized(self) -> None:
        _, patch = resolve("Dalagatan 30, 11324 Stockholm")
        assert patch["postal_code"] == "113 24"

    def test_district_name_does_not_resolve_to_a_wrong_kommun(self) -> None:
        # "Vasastan" is a Stockholm district, not a kommun — the resolver
        # must leave municipality unset (missing ok, incorrect not).
        _, patch = resolve("Dalagatan 30, Vasastan")
        assert "municipality" not in patch
