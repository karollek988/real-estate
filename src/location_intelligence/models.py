"""The Intelligence Package envelope (task F-01).

Every finding this engine emits is validated here, at origin: a finding
without a source, a timestamp, and a trust tier does not exist (doc 37,
Task 2/3). Statuses follow the honest-absence convention from docs/28 —
`partial` and `error` must explain themselves (doc 28, bug #5).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

PACKAGE_FORMAT_VERSION = "1.0"

Clock = Callable[[], datetime]


def utcnow() -> datetime:
    return datetime.now(UTC)


class TrustTier(StrEnum):
    """Source trust ladder from docs/34 §5.2, extended with DERIVED (doc 36 §4.4).

    DERIVED marks signals this engine computes itself from lower-trust
    inputs (e.g. OSM snapshot deltas); it must never be presented as an
    external authority.
    """

    REGISTRY_AUTHORITY = "registry_authority"
    MANAGER_PORTAL = "manager_portal"
    DIRECTORY = "directory"
    USER = "user"
    DERIVED = "derived"


#: Confidence ceilings per tier (docs/34 §5.2, docs/36 §4.4). Recorded as
#: metadata for the analysis layer — this engine never applies them.
TRUST_TIER_CEILING: dict[TrustTier, float] = {
    TrustTier.REGISTRY_AUTHORITY: 1.0,
    TrustTier.MANAGER_PORTAL: 0.85,
    TrustTier.DIRECTORY: 0.6,
    TrustTier.USER: 0.5,
    TrustTier.DERIVED: 0.5,
}


class ProviderStatus(StrEnum):
    OK = "ok"
    PARTIAL = "partial"
    NO_DATA = "no_data"
    ERROR = "error"
    NOT_CONNECTED = "not_connected"
    DISABLED = "disabled"
    TIMEOUT = "timeout"


class FindingValidationError(ValueError):
    """A finding failed envelope validation and was rejected at build time."""


@dataclass(frozen=True, slots=True)
class Source:
    """Where a finding came from. `name` is mandatory — no source, no finding."""

    name: str
    url: str | None = None
    license: str | None = None

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise FindingValidationError("Source.name must be a non-empty string")

    def to_dict(self) -> dict[str, object]:
        return {"name": self.name, "url": self.url, "license": self.license}

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> Source:
        return cls(
            name=str(data["name"]),
            url=_as_str(data.get("url")),
            license=_as_str(data.get("license")),
        )


@dataclass(frozen=True, slots=True)
class ValidityWindow:
    """When a fact is *true*, as opposed to when it was *fetched* (doc 37, Task 10).

    ISO dates; either bound may be open. "Planned metro 2030" has a
    validity start in the future — the fetch date alone would mislead.
    """

    start: str | None = None
    end: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {"start": self.start, "end": self.end}

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> ValidityWindow:
        start = data.get("start")
        end = data.get("end")
        return cls(
            start=start if isinstance(start, str) else None,
            end=end if isinstance(end, str) else None,
        )


@dataclass(frozen=True, slots=True)
class Finding:
    """One collected fact with full provenance.

    `domain` groups findings by topic ("poi", "municipality", ...);
    `key` names the fact ("restaurant_count_within_1000m"); `value` is
    any JSON-serializable payload. Validation is strict by design — the
    Package Builder refuses findings that would break traceability.
    """

    domain: str
    key: str
    value: object
    source: Source
    trust_tier: TrustTier
    fetched_at: str
    unit: str | None = None
    coverage: str | None = None
    validity: ValidityWindow | None = None
    latitude: float | None = None
    longitude: float | None = None
    distance_m: float | None = None
    #: Standardized spatial context (doc 36 §4.1 proximity framework);
    #: populated by `location_intelligence.proximity` alongside distance_m.
    radius_bucket: str | None = None
    inside_requested_radius: bool | None = None
    detail: str | None = None

    def __post_init__(self) -> None:
        if not self.domain.strip():
            raise FindingValidationError("Finding.domain must be a non-empty string")
        if not self.key.strip():
            raise FindingValidationError(f"Finding.key must be non-empty (domain={self.domain!r})")
        if not isinstance(self.source, Source):
            raise FindingValidationError(
                f"Finding {self.domain}.{self.key}: source must be a Source instance"
            )
        if not isinstance(self.trust_tier, TrustTier):
            raise FindingValidationError(
                f"Finding {self.domain}.{self.key}: trust_tier must be a TrustTier"
            )
        if not self.fetched_at.strip():
            raise FindingValidationError(
                f"Finding {self.domain}.{self.key}: fetched_at is required"
            )
        try:
            datetime.fromisoformat(self.fetched_at)
        except ValueError as exc:
            raise FindingValidationError(
                f"Finding {self.domain}.{self.key}: fetched_at is not ISO-8601: "
                f"{self.fetched_at!r}"
            ) from exc
        try:
            json.dumps(self.value)
        except (TypeError, ValueError) as exc:
            raise FindingValidationError(
                f"Finding {self.domain}.{self.key}: value is not JSON-serializable "
                f"({type(self.value).__name__})"
            ) from exc

    def to_dict(self) -> dict[str, object]:
        return {
            "domain": self.domain,
            "key": self.key,
            "value": self.value,
            "unit": self.unit,
            "source": self.source.to_dict(),
            "trust_tier": self.trust_tier.value,
            "trust_ceiling": TRUST_TIER_CEILING[self.trust_tier],
            "fetched_at": self.fetched_at,
            "coverage": self.coverage,
            "validity": self.validity.to_dict() if self.validity else None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "distance_m": self.distance_m,
            "radius_bucket": self.radius_bucket,
            "inside_requested_radius": self.inside_requested_radius,
            "detail": self.detail,
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> Finding:
        validity_raw = data.get("validity")
        return cls(
            domain=str(data["domain"]),
            key=str(data["key"]),
            value=data.get("value"),
            unit=_as_str(data.get("unit")),
            source=Source.from_dict(_as_dict(data["source"])),
            trust_tier=TrustTier(str(data["trust_tier"])),
            fetched_at=str(data["fetched_at"]),
            coverage=_as_str(data.get("coverage")),
            validity=(ValidityWindow.from_dict(_as_dict(validity_raw)) if validity_raw else None),
            latitude=_as_float(data.get("latitude")),
            longitude=_as_float(data.get("longitude")),
            distance_m=_as_float(data.get("distance_m")),
            radius_bucket=_as_str(data.get("radius_bucket")),
            inside_requested_radius=_as_bool(data.get("inside_requested_radius")),
            detail=_as_str(data.get("detail")),
        )


@dataclass(slots=True)
class ProviderResult:
    """What one provider's `collect()` returns — findings plus an honest status.

    Rules enforced here (doc 28 bug #5, doc 37 Task 2):
    - `partial` and `error` must carry a `detail` explaining themselves.
    - a result with findings cannot claim `no_data`.
    """

    provider_id: str
    status: ProviderStatus
    findings: list[Finding] = field(default_factory=list)
    detail: str | None = None
    context_patch: dict[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.provider_id.strip():
            raise FindingValidationError("ProviderResult.provider_id must be non-empty")
        if self.status in (ProviderStatus.PARTIAL, ProviderStatus.ERROR) and not self.detail:
            raise FindingValidationError(
                f"ProviderResult({self.provider_id}): status {self.status.value!r} "
                "requires a detail explaining what happened"
            )
        if self.status is ProviderStatus.NO_DATA and self.findings:
            raise FindingValidationError(
                f"ProviderResult({self.provider_id}): no_data with findings is contradictory"
            )
        for item in self.findings:
            if not isinstance(item, Finding):
                raise FindingValidationError(
                    f"ProviderResult({self.provider_id}): findings must be Finding instances"
                )

    def to_dict(self) -> dict[str, object]:
        return {
            "provider_id": self.provider_id,
            "status": self.status.value,
            "detail": self.detail,
            "findings": [f.to_dict() for f in self.findings],
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> ProviderResult:
        findings_raw = data.get("findings") or []
        if not isinstance(findings_raw, list):
            raise FindingValidationError("ProviderResult.findings must be a list")
        return cls(
            provider_id=str(data["provider_id"]),
            status=ProviderStatus(str(data["status"])),
            findings=[Finding.from_dict(_as_dict(f)) for f in findings_raw],
            detail=_as_str(data.get("detail")),
        )


@dataclass(slots=True)
class ProviderRun:
    """A provider result plus how it was obtained — timing, cache, staleness."""

    result: ProviderResult
    duration_ms: int
    from_cache: bool = False
    stale: bool = False

    def to_dict(self) -> dict[str, object]:
        data = self.result.to_dict()
        data["duration_ms"] = self.duration_ms
        data["from_cache"] = self.from_cache
        data["stale"] = self.stale
        return data


def _as_dict(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise FindingValidationError(f"expected a dict, got {type(value).__name__}")
    return value


def _as_float(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    raise FindingValidationError(f"expected a number or None, got {type(value).__name__}")


def _as_str(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    raise FindingValidationError(f"expected a string or None, got {type(value).__name__}")


def _as_bool(value: object) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    raise FindingValidationError(f"expected a bool or None, got {type(value).__name__}")
