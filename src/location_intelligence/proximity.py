"""Shared proximity framework (doc 36 §4.1 follow-up): standardized spatial
context for every finding, not analysis.

Every geographic finding this engine collects can carry the same five
facts about its relationship to the searched address: where it is, how
far away in a straight line, which standard radius bucket that falls
into, and whether it landed inside the radius the provider actually
searched. This module is the single place that math happens — providers
call `proximity_info` (when a distance is already computed, e.g. sorting
a "nearest N" list) or `compute_proximity` (when only two coordinate
pairs are known) instead of hand-rolling haversine + bucketing again.

Only straight-line distance is implemented here. Walking/driving distance
and travel time are a future engine (doc 36 GOAL list) — out of scope by
design, not by oversight.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from location_intelligence.models import Finding

__all__ = [
    "RADIUS_BUCKETS",
    "ProximityInfo",
    "compute_proximity",
    "enrich_finding",
    "haversine_m",
    "proximity_info",
    "radius_bucket_for",
]

_EARTH_RADIUS_M = 6_371_000.0

#: Standard radius-bucket ladder, shared by every provider (task requirement:
#: "use a consistent standard across every provider"). Each entry is the
#: bucket's exclusive upper bound; distances at or beyond the last bound
#: fall into the open-ended overflow bucket.
RADIUS_BUCKETS: tuple[tuple[float, str], ...] = (
    (100.0, "0-100m"),
    (250.0, "100-250m"),
    (500.0, "250-500m"),
    (1000.0, "500-1000m"),
    (3000.0, "1000-3000m"),
    (5000.0, "3000-5000m"),
)
_RADIUS_BUCKET_OVERFLOW = "5000m+"


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line (great-circle) distance between two WGS84 points, in meters."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def radius_bucket_for(distance_m: float) -> str:
    """The standard bucket label a distance falls into."""
    for bound, label in RADIUS_BUCKETS:
        if distance_m < bound:
            return label
    return _RADIUS_BUCKET_OVERFLOW


@dataclass(frozen=True, slots=True)
class ProximityInfo:
    """Standardized spatial context for one point relative to a search origin."""

    latitude: float
    longitude: float
    distance_m: float
    radius_bucket: str
    #: None when the provider did not search within a bounded radius (e.g.
    #: a kommun-wide bulk list) — "inside" is not a meaningful question then.
    inside_requested_radius: bool | None

    def to_dict(self) -> dict[str, object]:
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "distance_m": self.distance_m,
            "radius_bucket": self.radius_bucket,
            "inside_requested_radius": self.inside_requested_radius,
        }


def proximity_info(
    lat: float,
    lon: float,
    distance_m: float,
    *,
    requested_radius_m: float | None = None,
) -> ProximityInfo:
    """Build `ProximityInfo` from an already-computed distance.

    Use this when the caller already ran `haversine_m` (e.g. to sort a
    "nearest N" list) so the distance is never computed twice.
    """
    inside = None if requested_radius_m is None else distance_m <= requested_radius_m
    return ProximityInfo(
        latitude=lat,
        longitude=lon,
        distance_m=round(distance_m, 1),
        radius_bucket=radius_bucket_for(distance_m),
        inside_requested_radius=inside,
    )


def compute_proximity(
    origin_lat: float,
    origin_lon: float,
    lat: float,
    lon: float,
    *,
    requested_radius_m: float | None = None,
) -> ProximityInfo:
    """Build `ProximityInfo` from a search origin and a target point."""
    distance = haversine_m(origin_lat, origin_lon, lat, lon)
    return proximity_info(lat, lon, distance, requested_radius_m=requested_radius_m)


def enrich_finding(
    finding: Finding,
    *,
    origin_lat: float,
    origin_lon: float,
    lat: float,
    lon: float,
    requested_radius_m: float | None = None,
) -> Finding:
    """Return a copy of `finding` with standardized spatial context populated.

    For providers whose `Finding.value` describes a single geographic
    point (rather than a list of points, which carry proximity metadata
    per item instead — see `proximity_info`/`compute_proximity`).
    """
    info = compute_proximity(
        origin_lat, origin_lon, lat, lon, requested_radius_m=requested_radius_m
    )
    return replace(
        finding,
        latitude=info.latitude,
        longitude=info.longitude,
        distance_m=info.distance_m,
        radius_bucket=info.radius_bucket,
        inside_requested_radius=info.inside_requested_radius,
    )
