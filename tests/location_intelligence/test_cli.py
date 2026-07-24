"""F-08 Definition of Done: the CLI prints a valid (mostly-empty) package."""

from __future__ import annotations

import json

import pytest

from location_intelligence.__main__ import main


class TestCli:
    """Unit CLI tests run with the network-touching geocoder disabled via
    DISABLED_PROVIDERS — proving the env toggle end-to-end at the same time."""

    NETWORK_PROVIDERS = (
        "nominatim_geocoder,osm_poi,scb_municipality,kolada,osm_construction,"
        "trafikverket_infrastructure,skolverket_schools,svt_local_news,polisen_crime,"
        "bolagsverket_companies,lantmateriet_detaljplan"
    )

    def test_address_input_prints_valid_package(
        self, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DISABLED_PROVIDERS", self.NETWORK_PROVIDERS)
        exit_code = main(["Dalagatan 30, Stockholm", "--no-cache"])
        assert exit_code == 0

        package = json.loads(capsys.readouterr().out)
        assert package["format_version"] == "1.0"
        assert package["address"]["raw_input"] == "Dalagatan 30, Stockholm"
        assert package["address"]["input_mode"] == "address"
        assert package["summary"]["providers_total"] == 12
        assert package["summary"]["providers_by_status"] == {"disabled": 11, "ok": 1}
        # The offline resolver still enriched identity from the SCB register.
        assert package["address"]["municipality_code"] == "0180"

    def test_coordinate_input_is_recognized(
        self, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DISABLED_PROVIDERS", self.NETWORK_PROVIDERS)
        exit_code = main(["59.343, 18.049", "--no-cache"])
        assert exit_code == 0

        package = json.loads(capsys.readouterr().out)
        assert package["address"]["input_mode"] == "coordinates"
        assert package["address"]["latitude"] == pytest.approx(59.343)
