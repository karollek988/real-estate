"""A-05 Definition of Done: a radius-based provider is skipped with an
explicit reason when the geocode is too coarse, and runs when fine enough."""

from __future__ import annotations

from location_intelligence.config import EngineConfig
from location_intelligence.context import GeocodePrecision, context_from_raw_input
from location_intelligence.models import ProviderResult, ProviderStatus
from location_intelligence.providers.base import Provider
from location_intelligence.providers.registry import ProviderRegistry
from location_intelligence.runner import EngineRunner
from tests.location_intelligence.conftest import make_finding


class RadiusProvider(Provider):
    id = "radius_provider"
    min_precision = GeocodePrecision.STREET

    def __init__(self) -> None:
        self.called = False

    def collect(self, context: object) -> ProviderResult:  # type: ignore[override]
        self.called = True
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[make_finding(key="count_within_1000m", value=5)],
        )


def run_with(
    precision: GeocodePrecision | None, coords: bool = True
) -> tuple[RadiusProvider, list[ProviderStatus], str | None]:
    provider = RadiusProvider()
    registry = ProviderRegistry()
    registry.register(provider)
    context = context_from_raw_input("Dalagatan 30, Stockholm")
    if coords:
        context = context.patched(latitude=59.343, longitude=18.049, precision=precision)
    _, runs = EngineRunner(registry, EngineConfig()).run(context)
    return provider, [r.result.status for r in runs], runs[0].result.detail


class TestPrecisionGate:
    def test_municipality_centroid_geocode_skips_radius_provider(self) -> None:
        provider, statuses, detail = run_with(GeocodePrecision.MUNICIPALITY)
        assert provider.called is False
        assert statuses == [ProviderStatus.NO_DATA]
        assert detail is not None
        assert "requires street precision or better" in detail
        assert "municipality" in detail

    def test_missing_coordinates_skips_with_reason(self) -> None:
        provider, statuses, detail = run_with(None, coords=False)
        assert provider.called is False
        assert statuses == [ProviderStatus.NO_DATA]
        assert detail is not None and "no coordinates" in detail

    def test_street_precision_lets_provider_run(self) -> None:
        provider, statuses, _ = run_with(GeocodePrecision.STREET)
        assert provider.called is True
        assert statuses == [ProviderStatus.OK]

    def test_rooftop_precision_lets_provider_run(self) -> None:
        provider, statuses, _ = run_with(GeocodePrecision.ROOFTOP)
        assert provider.called is True
        assert statuses == [ProviderStatus.OK]
