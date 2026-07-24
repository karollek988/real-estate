"""Wave 2 integration: resolver → geocoder → package builder, end to end.

The unit-level test uses a canned Nominatim transport; the live test
(marked ``integration``, excluded by default) verifies the A-03 DoD
against the real service: Dalagatan 30 resolves to known coordinates at
street precision or better.
"""

from __future__ import annotations

import json
import urllib.request

import pytest

from location_intelligence.builder import PackageBuilder
from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.providers import default_registry
from location_intelligence.runner import EngineRunner
from tests.location_intelligence.test_geocoder import FORWARD_HIT


class TestPipelineWithCannedGeocoder:
    def test_full_run_produces_enriched_package(self) -> None:
        def transport(request: urllib.request.Request, timeout: float) -> HttpResponse:
            return HttpResponse(200, json.dumps(FORWARD_HIT).encode("utf-8"))

        client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
        registry = default_registry(client=client)
        context = context_from_raw_input("Dalagatan 30, 113 24 Stockholm")

        enriched, runs = EngineRunner(registry, EngineConfig()).run(context)
        package = PackageBuilder().build(enriched, runs)

        assert enriched.municipality == "Stockholm"
        assert enriched.municipality_code == "0180"
        assert enriched.latitude == pytest.approx(59.3435764)
        assert enriched.precision is not None and enriched.precision.value == "rooftop"

        data = package.to_dict()
        address = data["address"]
        assert address["municipality_code"] == "0180"  # type: ignore[index]
        assert address["precision"] == "rooftop"  # type: ignore[index]
        summary = data["summary"]
        # address_resolver + nominatim_geocoder always ok; skolverket_schools
        # also degrades honestly to ok-with-zero-counts here since the canned
        # transport returns the same (Nominatim-shaped list) payload to every
        # request, including Skolverket's bulk list call, which its "not a
        # dict" guard turns into an empty, honestly-zero result rather than
        # an error. Every other network provider gets the same malformed
        # payload and degrades to error/no_data/not_connected instead.
        assert summary["providers_by_status"]["ok"] == 3  # type: ignore[index]
        assert summary["findings_total"] == 4  # type: ignore[index]


@pytest.mark.integration
class TestLiveGeocoding:
    def test_dalagatan_30_resolves_to_known_coordinates(self) -> None:
        registry = default_registry()
        context = context_from_raw_input("Dalagatan 30, Stockholm")
        enriched, _ = EngineRunner(registry, EngineConfig()).run(context)

        assert enriched.latitude == pytest.approx(59.343, abs=0.01)
        assert enriched.longitude == pytest.approx(18.049, abs=0.01)
        assert enriched.precision is not None
        assert enriched.precision.value in ("rooftop", "street")
        assert enriched.municipality_code == "0180"
