"""A-01 Definition of Done: 290 kommuner resolvable both directions; county codes."""

from __future__ import annotations

from location_intelligence.municipality import load_register


class TestKommunRegister:
    def test_all_290_municipalities_present(self) -> None:
        register = load_register()
        assert register.municipality_count == 290

    def test_known_codes_resolve_to_names(self) -> None:
        register = load_register()
        assert register.municipality_name("0180") == "Stockholm"
        assert register.municipality_name("1480") == "Göteborg"
        assert register.municipality_name("0380") == "Uppsala"
        assert register.municipality_name("2584") == "Kiruna"

    def test_names_resolve_to_codes(self) -> None:
        register = load_register()
        assert register.municipality_code("Stockholm") == "0180"
        assert register.municipality_code("göteborg") == "1480"
        assert register.municipality_code("  Uppsala  ") == "0380"

    def test_suffix_and_genitive_forms(self) -> None:
        register = load_register()
        assert register.municipality_code("Stockholms kommun") == "0180"
        assert register.municipality_code("Göteborgs stad") == "1480"
        assert register.municipality_code("Stockholms") == "0180"
        assert register.municipality_code("Falu kommun") == "2080"  # irregular genitive

    def test_genuine_s_names_are_not_broken_by_genitive_strip(self) -> None:
        register = load_register()
        assert register.municipality_code("Borås") == "1490"
        assert register.municipality_code("Västerås") == "1980"

    def test_unknown_name_returns_none_never_guesses(self) -> None:
        register = load_register()
        assert register.municipality_code("Vasastan") is None  # district, not kommun
        assert register.municipality_code("") is None
        assert register.municipality_code("Oslo") is None

    def test_county_codes(self) -> None:
        register = load_register()
        assert register.county_code_for("0180") == "01"
        assert register.county_name("01") == "Stockholms län"
        assert register.county_code_for("9999") is None  # unknown kommun → no county
