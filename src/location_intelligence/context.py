"""The address context every provider receives as input.

Wave 1 defines the contract only. The Address Resolver (Wave 2, task
A-02) will populate the resolved fields; until then a context built from
raw input carries the raw string and the input mode, nothing more.
"""

from __future__ import annotations

import dataclasses
import re
from dataclasses import dataclass
from enum import StrEnum


class InputMode(StrEnum):
    ADDRESS = "address"
    COORDINATES = "coordinates"


class GeocodePrecision(StrEnum):
    """How precisely the coordinates locate the property.

    Radius-based providers must not run on coarse precision (Wave 2,
    task A-05) — the level is part of the contract from day one so
    findings always carry it.
    """

    ROOFTOP = "rooftop"
    STREET = "street"
    POSTAL = "postal"
    MUNICIPALITY = "municipality"


_PRECISION_RANK: dict[GeocodePrecision, int] = {
    GeocodePrecision.ROOFTOP: 3,
    GeocodePrecision.STREET: 2,
    GeocodePrecision.POSTAL: 1,
    GeocodePrecision.MUNICIPALITY: 0,
}


def precision_at_least(actual: GeocodePrecision | None, minimum: GeocodePrecision) -> bool:
    """True when `actual` is at least as fine as `minimum`. None is coarsest."""
    if actual is None:
        return False
    return _PRECISION_RANK[actual] >= _PRECISION_RANK[minimum]


_COORDINATE_PATTERN = re.compile(
    r"^\s*(?P<lat>[-+]?\d{1,2}(?:\.\d+)?)\s*,\s*(?P<lon>[-+]?\d{1,3}(?:\.\d+)?)\s*$"
)

_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True, slots=True)
class AddressContext:
    """Normalized input identity passed to every provider.

    Immutable; pre-stage providers enrich it via :meth:`patched`, and the
    runner threads the enriched copy to later providers (the in-memory
    sequencing rule from docs/28, bug #1).
    """

    raw_input: str
    input_mode: InputMode
    latitude: float | None = None
    longitude: float | None = None
    municipality: str | None = None
    municipality_code: str | None = None
    county_code: str | None = None
    postal_code: str | None = None
    precision: GeocodePrecision | None = None
    warnings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.raw_input.strip():
            raise ValueError("AddressContext.raw_input must be a non-empty string")
        if self.latitude is not None and not -90.0 <= self.latitude <= 90.0:
            raise ValueError(f"latitude out of range: {self.latitude}")
        if self.longitude is not None and not -180.0 <= self.longitude <= 180.0:
            raise ValueError(f"longitude out of range: {self.longitude}")

    def patched(self, **updates: object) -> AddressContext:
        """Return a copy with the given fields replaced.

        Unknown field names raise immediately — a pre-stage provider
        patching a typo'd key must fail loudly, not silently no-op.
        """
        valid = {f.name for f in dataclasses.fields(self)}
        unknown = set(updates) - valid
        if unknown:
            raise ValueError(f"unknown AddressContext fields: {sorted(unknown)}")
        return dataclasses.replace(self, **updates)  # type: ignore[arg-type]

    def cache_key(self) -> str:
        """Stable cache identity for this input.

        Coordinates are rounded to ~11 m (4 decimals) so trivially
        different inputs share cache entries; addresses are normalized
        on whitespace and case only (real canonicalization is the Wave 2
        resolver's job).
        """
        if self.latitude is not None and self.longitude is not None:
            return f"{self.latitude:.4f},{self.longitude:.4f}"
        return _WHITESPACE.sub(" ", self.raw_input.strip().lower())

    def to_dict(self) -> dict[str, object]:
        return {
            "raw_input": self.raw_input,
            "input_mode": self.input_mode.value,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "municipality": self.municipality,
            "municipality_code": self.municipality_code,
            "county_code": self.county_code,
            "postal_code": self.postal_code,
            "precision": self.precision.value if self.precision else None,
            "warnings": list(self.warnings),
        }


def context_from_raw_input(raw_input: str) -> AddressContext:
    """Build an unresolved context from CLI/API input.

    Recognizes "lat,lon" as coordinate input; everything else is treated
    as a free-text address awaiting the Wave 2 resolver.
    """
    match = _COORDINATE_PATTERN.match(raw_input)
    if match:
        return AddressContext(
            raw_input=raw_input,
            input_mode=InputMode.COORDINATES,
            latitude=float(match.group("lat")),
            longitude=float(match.group("lon")),
        )
    return AddressContext(raw_input=raw_input, input_mode=InputMode.ADDRESS)
