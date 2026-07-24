"""Tests for market_intelligence.conformance — provider admission gate."""

from __future__ import annotations

from datetime import timedelta

import pytest

from market_intelligence.conformance import check_provider
from market_intelligence.context import MarketContext
from market_intelligence.models import (
    ProviderResult,
    ProviderStatus,
)
from market_intelligence.providers.base import Provider
from tests.market_intelligence.conftest import (
    CrashingProvider,
    GatedProvider,
    NoDataProvider,
    OkProvider,
    PartialProvider,
)


@pytest.fixture
def context() -> MarketContext:
    return MarketContext(country="SE", municipality="Stockholm")


class TestCheckProvider:
    def test_conformant_provider(self, context: MarketContext) -> None:
        violations = check_provider(OkProvider(), context)
        assert violations == []

    def test_no_data_provider(self, context: MarketContext) -> None:
        violations = check_provider(NoDataProvider(), context)
        assert violations == []

    def test_crashing_provider(self, context: MarketContext) -> None:
        violations = check_provider(CrashingProvider(), context)
        assert len(violations) == 1
        assert "RuntimeError" in violations[0]

    def test_partial_provider(self, context: MarketContext) -> None:
        violations = check_provider(PartialProvider(), context)
        assert violations == []

    def test_gated_provider(self) -> None:
        # Municipality context is sufficient for GatedProvider
        ctx = MarketContext(country="SE", municipality="Stockholm")
        violations = check_provider(GatedProvider(), ctx)
        assert violations == []

    def test_invalid_id(self, context: MarketContext) -> None:
        class BadIdProvider(Provider):
            id = "BAD-ID!"

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="bad_id",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(BadIdProvider(), context)
        assert any("snake_case" in v for v in violations)

    def test_empty_id(self, context: MarketContext) -> None:
        class EmptyIdProvider(Provider):
            id = ""

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="empty",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(EmptyIdProvider(), context)
        assert any("snake_case" in v for v in violations)

    def test_invalid_trust_tier(self, context: MarketContext) -> None:
        class BadTierProvider(Provider):
            id = "bad_tier"
            trust_tier = "not_a_tier"  # type: ignore[assignment]

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="bad_tier",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(BadTierProvider(), context)
        assert any("TrustTier" in v for v in violations)

    def test_invalid_cache_ttl(self, context: MarketContext) -> None:
        class BadTTLProvider(Provider):
            id = "bad_ttl"
            cache_ttl = timedelta(seconds=-1)

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="bad_ttl",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(BadTTLProvider(), context)
        assert any("cache_ttl" in v for v in violations)

    def test_negative_deadline(self, context: MarketContext) -> None:
        class BadDeadlineProvider(Provider):
            id = "bad_deadline"
            deadline_s = -5.0

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="bad_deadline",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(BadDeadlineProvider(), context)
        assert any("deadline_s" in v for v in violations)

    def test_collect_raises_shortcircuits(self, context: MarketContext) -> None:
        class RaisesProvider(Provider):
            id = "raises"

            def collect(self, context: MarketContext) -> ProviderResult:
                raise ValueError("boom")

        violations = check_provider(RaisesProvider(), context)
        assert len(violations) == 1
        assert "ValueError" in violations[0]

    def test_ok_with_no_findings_rejected(self, context: MarketContext) -> None:
        class EmptyOkProvider(Provider):
            id = "empty_ok"

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="empty_ok",
                    status=ProviderStatus.OK,
                )

        violations = check_provider(EmptyOkProvider(), context)
        assert any("no findings" in v for v in violations)

    def test_provider_id_mismatch(self, context: MarketContext) -> None:
        class MismatchProvider(Provider):
            id = "my_id"

            def collect(self, context: MarketContext) -> ProviderResult:
                return ProviderResult(
                    provider_id="wrong_id",
                    status=ProviderStatus.NO_DATA,
                    detail="no data",
                )

        violations = check_provider(MismatchProvider(), context)
        assert any("provider_id" in v for v in violations)
