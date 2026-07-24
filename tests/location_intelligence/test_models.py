"""F-01 Definition of Done: envelope validates; invalid findings rejected clearly."""

from __future__ import annotations

import pytest

from location_intelligence.models import (
    Finding,
    FindingValidationError,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
)
from tests.location_intelligence.conftest import FIXED_FETCHED_AT, make_finding


class TestFindingValidation:
    def test_valid_finding_round_trips_through_dict(self) -> None:
        finding = make_finding()
        restored = Finding.from_dict(finding.to_dict())
        assert restored == finding

    def test_missing_source_name_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="Source.name"):
            Source(name="   ")

    def test_missing_fetched_at_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="fetched_at is required"):
            Finding(
                domain="test",
                key="k",
                value=1,
                source=Source(name="s"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at="  ",
            )

    def test_non_iso_fetched_at_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="not ISO-8601"):
            Finding(
                domain="test",
                key="k",
                value=1,
                source=Source(name="s"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at="yesterday",
            )

    def test_empty_domain_or_key_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="domain"):
            make_finding(domain=" ")
        with pytest.raises(FindingValidationError, match="key"):
            make_finding(key="")

    def test_non_json_serializable_value_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="not JSON-serializable"):
            make_finding(value=object())

    def test_trust_ceiling_is_exported_as_metadata(self) -> None:
        data = make_finding().to_dict()
        assert data["trust_tier"] == "registry_authority"
        assert data["trust_ceiling"] == 1.0

    def test_proximity_fields_default_to_none(self) -> None:
        finding = make_finding()
        assert finding.radius_bucket is None
        assert finding.inside_requested_radius is None
        data = finding.to_dict()
        assert data["radius_bucket"] is None
        assert data["inside_requested_radius"] is None

    def test_proximity_fields_round_trip_through_dict(self) -> None:
        finding = Finding(
            domain="poi",
            key="k",
            value=1,
            source=Source(name="s"),
            trust_tier=TrustTier.DIRECTORY,
            fetched_at=FIXED_FETCHED_AT,
            latitude=59.34,
            longitude=18.05,
            distance_m=123.4,
            radius_bucket="100-250m",
            inside_requested_radius=True,
        )
        restored = Finding.from_dict(finding.to_dict())
        assert restored == finding

    def test_non_bool_inside_requested_radius_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="expected a bool"):
            Finding.from_dict(
                {
                    **make_finding().to_dict(),
                    "inside_requested_radius": "yes",
                }
            )


class TestProviderResultValidation:
    def test_partial_without_detail_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="requires a detail"):
            ProviderResult(provider_id="p", status=ProviderStatus.PARTIAL)

    def test_error_without_detail_is_rejected(self) -> None:
        with pytest.raises(FindingValidationError, match="requires a detail"):
            ProviderResult(provider_id="p", status=ProviderStatus.ERROR)

    def test_no_data_with_findings_is_contradictory(self) -> None:
        with pytest.raises(FindingValidationError, match="contradictory"):
            ProviderResult(
                provider_id="p",
                status=ProviderStatus.NO_DATA,
                findings=[make_finding()],
            )

    def test_valid_result_round_trips_through_dict(self) -> None:
        result = ProviderResult(
            provider_id="p",
            status=ProviderStatus.OK,
            findings=[make_finding()],
        )
        restored = ProviderResult.from_dict(result.to_dict())
        assert restored.provider_id == "p"
        assert restored.status is ProviderStatus.OK
        assert restored.findings == result.findings
        assert restored.findings[0].fetched_at == FIXED_FETCHED_AT
