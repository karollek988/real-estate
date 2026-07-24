"""Tests for market_intelligence.models — Finding, ProviderResult, Source validation."""

from __future__ import annotations

import pytest

from market_intelligence.models import (
    Finding,
    FindingValidationError,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
    ValidityWindow,
)
from tests.market_intelligence.conftest import fixed_iso


class TestSource:
    def test_valid_source(self) -> None:
        s = Source(name="SCB", url="https://scb.se", license="CC0")
        assert s.name == "SCB"

    def test_empty_name_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="non-empty"):
            Source(name="")

    def test_whitespace_name_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="non-empty"):
            Source(name="   ")

    def test_round_trip(self) -> None:
        s = Source(name="test", url="http://test.se", license="MIT")
        d = s.to_dict()
        restored = Source.from_dict(d)
        assert restored == s


class TestFinding:
    def test_valid_finding(self) -> None:
        f = Finding(
            domain="macro_economy",
            key="policy_rate",
            value=3.5,
            source=Source(name="Riksbank"),
            trust_tier=TrustTier.REGISTRY_AUTHORITY,
            fetched_at=fixed_iso(),
            unit="percent",
        )
        assert f.domain == "macro_economy"
        assert f.value == 3.5

    def test_empty_domain_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="non-empty"):
            Finding(
                domain="",
                key="test",
                value=1,
                source=Source(name="test"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at=fixed_iso(),
            )

    def test_empty_key_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="non-empty"):
            Finding(
                domain="test",
                key="",
                value=1,
                source=Source(name="test"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at=fixed_iso(),
            )

    def test_invalid_fetched_at_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="ISO-8601"):
            Finding(
                domain="test",
                key="test",
                value=1,
                source=Source(name="test"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at="not-a-date",
            )

    def test_non_serializable_value_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="JSON-serializable"):
            Finding(
                domain="test",
                key="test",
                value=set(),  # type: ignore[arg-type]
                source=Source(name="test"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at=fixed_iso(),
            )

    def test_round_trip(self) -> None:
        f = Finding(
            domain="housing_market",
            key="price_index",
            value=123.4,
            source=Source(name="SCB", url="https://scb.se"),
            trust_tier=TrustTier.REGISTRY_AUTHORITY,
            fetched_at=fixed_iso(),
            unit="index",
            country="SE",
            municipality="Stockholm",
        )
        d = f.to_dict()
        restored = Finding.from_dict(d)
        assert restored.domain == f.domain
        assert restored.key == f.key
        assert restored.value == f.value
        assert restored.country == "SE"
        assert restored.municipality == "Stockholm"


class TestProviderResult:
    def test_ok_with_findings(self) -> None:
        r = ProviderResult(
            provider_id="test",
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
        )
        assert r.status == ProviderStatus.OK

    def test_no_data_with_findings_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="contradictory"):
            ProviderResult(
                provider_id="test",
                status=ProviderStatus.NO_DATA,
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
            )

    def test_error_without_detail_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="requires a detail"):
            ProviderResult(
                provider_id="test",
                status=ProviderStatus.ERROR,
            )

    def test_partial_without_detail_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="requires a detail"):
            ProviderResult(
                provider_id="test",
                status=ProviderStatus.PARTIAL,
            )

    def test_empty_provider_id_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="non-empty"):
            ProviderResult(
                provider_id="",
                status=ProviderStatus.OK,
            )

    def test_round_trip(self) -> None:
        r = ProviderResult(
            provider_id="test",
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
        )
        d = r.to_dict()
        restored = ProviderResult.from_dict(d)
        assert restored.provider_id == r.provider_id
        assert restored.status == r.status
        assert len(restored.findings) == 1


class TestValidityWindow:
    def test_round_trip(self) -> None:
        vw = ValidityWindow(start="2025-01-01", end="2025-12-31")
        d = vw.to_dict()
        restored = ValidityWindow.from_dict(d)
        assert restored == vw

    def test_open_ended(self) -> None:
        vw = ValidityWindow(start="2025-01-01")
        d = vw.to_dict()
        restored = ValidityWindow.from_dict(d)
        assert restored.start == "2025-01-01"
        assert restored.end is None
