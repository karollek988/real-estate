"""Tests for market_intelligence.builder — PackageBuilder, MarketDataPackage."""

from __future__ import annotations

import pytest

from market_intelligence import ENGINE_VERSION
from market_intelligence.builder import PackageBuilder
from market_intelligence.context import MarketContext
from market_intelligence.models import (
    Finding,
    FindingValidationError,
    ProviderResult,
    ProviderRun,
    ProviderStatus,
    Source,
    TrustTier,
)
from tests.market_intelligence.conftest import fixed_clock, fixed_iso


@pytest.fixture
def builder() -> PackageBuilder:
    return PackageBuilder(clock=fixed_clock)


@pytest.fixture
def sample_runs() -> list[ProviderRun]:
    return [
        ProviderRun(
            result=ProviderResult(
                provider_id="provider_a",
                status=ProviderStatus.OK,
                findings=[
                    Finding(
                        domain="macro_economy",
                        key="policy_rate",
                        value=3.5,
                        source=Source(name="Riksbank"),
                        trust_tier=TrustTier.REGISTRY_AUTHORITY,
                        fetched_at=fixed_iso(),
                        unit="percent",
                        country="SE",
                    )
                ],
            ),
            duration_ms=150,
        ),
        ProviderRun(
            result=ProviderResult(
                provider_id="provider_b",
                status=ProviderStatus.NO_DATA,
                detail="no data",
            ),
            duration_ms=50,
        ),
    ]


class TestPackageBuilder:
    def test_build_package(self, builder: PackageBuilder, sample_runs: list[ProviderRun]) -> None:
        context = MarketContext(country="SE")
        package = builder.build(context, sample_runs)

        assert package.engine_version == ENGINE_VERSION
        assert package.format_version == "1.0"
        assert package.built_at == fixed_iso()
        assert package.scope["country"] == "SE"
        assert len(package.providers) == 2

    def test_providers_sorted_by_id(
        self, builder: PackageBuilder, sample_runs: list[ProviderRun]
    ) -> None:
        context = MarketContext(country="SE")
        package = builder.build(context, sample_runs)

        ids = [p["provider_id"] for p in package.providers]
        assert ids == sorted(ids)

    def test_summary_counts(self, builder: PackageBuilder, sample_runs: list[ProviderRun]) -> None:
        context = MarketContext(country="SE")
        package = builder.build(context, sample_runs)

        assert package.summary["providers_total"] == 2
        assert package.summary["findings_total"] == 1
        assert package.summary["providers_by_status"] == {
            "no_data": 1,
            "ok": 1,
        }

    def test_duplicate_provider_ids_rejected(self, builder: PackageBuilder) -> None:
        run = ProviderRun(
            result=ProviderResult(
                provider_id="dup",
                status=ProviderStatus.NO_DATA,
                detail="no data",
            ),
            duration_ms=0,
        )
        with pytest.raises(FindingValidationError, match="duplicate"):
            builder.build(MarketContext(country="SE"), [run, run])

    def test_empty_runs(self, builder: PackageBuilder) -> None:
        package = builder.build(MarketContext(), [])
        assert package.summary["providers_total"] == 0
        assert package.summary["findings_total"] == 0
        assert package.providers == []

    def test_to_json(self, builder: PackageBuilder, sample_runs: list[ProviderRun]) -> None:
        package = builder.build(MarketContext(country="SE"), sample_runs)
        json_str = package.to_json()
        assert "policy_rate" in json_str
        assert '"provider_a"' in json_str

    def test_to_dict(self, builder: PackageBuilder, sample_runs: list[ProviderRun]) -> None:
        package = builder.build(MarketContext(country="SE"), sample_runs)
        d = package.to_dict()
        assert d["engine_version"] == ENGINE_VERSION
        assert isinstance(d["providers"], list)

    def test_stale_providers_in_summary(self, builder: PackageBuilder) -> None:
        runs = [
            ProviderRun(
                result=ProviderResult(
                    provider_id="stale_p",
                    status=ProviderStatus.OK,
                    findings=[
                        Finding(
                            domain="test",
                            key="v",
                            value=1,
                            source=Source(name="s"),
                            trust_tier=TrustTier.DIRECTORY,
                            fetched_at=fixed_iso(),
                        )
                    ],
                ),
                duration_ms=100,
                stale=True,
            )
        ]
        package = builder.build(MarketContext(country="SE"), runs)
        assert package.summary["stale_providers"] == ["stale_p"]
