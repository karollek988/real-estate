"""F-05 Definition of Done: golden master — fixed inputs → byte-identical package."""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest

from location_intelligence.builder import PackageBuilder
from location_intelligence.context import AddressContext, InputMode
from location_intelligence.models import (
    FindingValidationError,
    ProviderResult,
    ProviderRun,
    ProviderStatus,
)
from tests.location_intelligence.conftest import make_finding

FIXED_BUILT_AT = datetime(2026, 7, 20, 12, 0, 0, tzinfo=UTC)


def fixed_clock() -> datetime:
    return FIXED_BUILT_AT


def make_runs() -> list[ProviderRun]:
    return [
        ProviderRun(
            result=ProviderResult(
                provider_id="zeta_provider",
                status=ProviderStatus.OK,
                findings=[make_finding(key="a_count", value=3)],
            ),
            duration_ms=120,
        ),
        ProviderRun(
            result=ProviderResult(
                provider_id="alpha_provider",
                status=ProviderStatus.NO_DATA,
            ),
            duration_ms=45,
        ),
    ]


def make_context() -> AddressContext:
    return AddressContext(raw_input="Dalagatan 30, Stockholm", input_mode=InputMode.ADDRESS)


class TestGoldenMaster:
    def test_build_is_deterministic_byte_for_byte(self) -> None:
        builder = PackageBuilder(clock=fixed_clock, engine_version="0.1.0")
        first = builder.build(make_context(), make_runs()).to_json()
        second = builder.build(make_context(), make_runs()).to_json()
        assert first == second

    def test_package_shape_and_ordering(self) -> None:
        builder = PackageBuilder(clock=fixed_clock, engine_version="0.1.0")
        package = builder.build(make_context(), make_runs())
        data = package.to_dict()

        assert data["format_version"] == "1.0"
        assert data["engine_version"] == "0.1.0"
        assert data["built_at"] == "2026-07-20T12:00:00+00:00"
        # Providers sorted by id for determinism, regardless of run order.
        provider_ids = [p["provider_id"] for p in data["providers"]]  # type: ignore[union-attr]
        assert provider_ids == ["alpha_provider", "zeta_provider"]

        summary = data["summary"]
        assert summary == {  # type: ignore[comparison-overlap]
            "providers_total": 2,
            "providers_by_status": {"no_data": 1, "ok": 1},
            "findings_total": 1,
            "oldest_finding_fetched_at": "2026-07-20T10:00:00+00:00",
            "newest_finding_fetched_at": "2026-07-20T10:00:00+00:00",
            "stale_providers": [],
        }

    def test_json_output_is_valid_and_sorted(self) -> None:
        builder = PackageBuilder(clock=fixed_clock)
        text = builder.build(make_context(), make_runs()).to_json()
        parsed = json.loads(text)
        assert list(parsed) == sorted(parsed)

    def test_duplicate_provider_ids_rejected(self) -> None:
        builder = PackageBuilder(clock=fixed_clock)
        runs = make_runs() + make_runs()
        with pytest.raises(FindingValidationError, match="duplicate provider id"):
            builder.build(make_context(), runs)

    def test_empty_run_list_builds_a_valid_mostly_empty_package(self) -> None:
        builder = PackageBuilder(clock=fixed_clock)
        package = builder.build(make_context(), [])
        assert package.summary["findings_total"] == 0
        assert package.summary["oldest_finding_fetched_at"] is None
        json.loads(package.to_json())  # still valid JSON
