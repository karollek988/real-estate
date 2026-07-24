"""OSM/POI provider (tasks O-01..O-04, provider P3).

One Overpass client, one query covering every requested category — cheaper
than issuing 18 separate Overpass calls and well within Overpass's element
limits for a single walkable radius. Categories are classified from the
returned tags in Python (not via 18 separate `out count;` blocks) so a
single element (e.g. a supermarket that is also tagged `shop=convenience`)
never needs a second round-trip.

Per category this reports an exact count within a fixed radius (doc 28
bug #6: never fake "nearest" from an unsorted sample) plus the nearest N
named POIs *with coordinates and real computed distances* — Overpass does
not sort by distance, so distance is always computed here from the
returned lat/lon, never assumed from result order.
"""

from __future__ import annotations

from dataclasses import dataclass

from location_intelligence.context import AddressContext, GeocodePrecision
from location_intelligence.http_client import HttpClient, HttpError
from location_intelligence.models import (
    Clock,
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
    utcnow,
)
from location_intelligence.providers.base import Provider, Stage
from location_intelligence.providers.overpass_client import (
    OVERPASS_BASE_URL,
    OVERPASS_RATE_LIMITS,
    element_coords,
    haversine_m,
    matches_filter,
    run_overpass_query,
)
from location_intelligence.proximity import proximity_info

__all__ = ["OsmPoiProvider", "OVERPASS_RATE_LIMITS"]

RADIUS_M = 1000.0
NEAREST_N = 5

_SOURCE = Source(
    name="OpenStreetMap Overpass API",
    url=OVERPASS_BASE_URL,
    license="ODbL — © OpenStreetMap contributors",
)


@dataclass(frozen=True, slots=True)
class _Category:
    key: str
    label: str
    #: One or more `["tag"="value"]` Overpass filters; an element matching
    #: any of them belongs to this category.
    filters: tuple[str, ...]


#: Category catalog per Wave 3 customer-value priority list. Order is the
#: order categories appear in the package.
CATEGORIES: tuple[_Category, ...] = (
    _Category("restaurant", "Restaurants", ('["amenity"="restaurant"]',)),
    _Category("cafe", "Cafés", ('["amenity"="cafe"]',)),
    _Category(
        "grocery",
        "Grocery stores",
        ('["shop"="supermarket"]', '["shop"="convenience"]', '["shop"="grocery"]'),
    ),
    _Category("school", "Schools", ('["amenity"="school"]',)),
    _Category("preschool", "Preschools", ('["amenity"="kindergarten"]',)),
    _Category("pharmacy", "Pharmacies", ('["amenity"="pharmacy"]',)),
    _Category("hospital", "Hospitals", ('["amenity"="hospital"]',)),
    _Category("health_center", "Health centers", ('["amenity"="clinic"]', '["amenity"="doctors"]')),
    _Category("gym", "Gyms", ('["leisure"="fitness_centre"]',)),
    _Category("park", "Parks", ('["leisure"="park"]',)),
    _Category("playground", "Playgrounds", ('["leisure"="playground"]',)),
    _Category("bus_stop", "Bus stops", ('["highway"="bus_stop"]',)),
    _Category(
        "subway_station",
        "Subway stations",
        ('["railway"="station"]["station"="subway"]', '["station"="subway"]'),
    ),
    _Category(
        "train_station",
        "Train stations",
        ('["railway"="station"]["station"!="subway"]', '["railway"="halt"]'),
    ),
    _Category("charging_station", "Charging stations", ('["amenity"="charging_station"]',)),
    _Category("parking", "Parking", ('["amenity"="parking"]',)),
    _Category("library", "Libraries", ('["amenity"="library"]',)),
    _Category(
        "sports_facility",
        "Sports facilities",
        ('["leisure"="sports_centre"]', '["leisure"="stadium"]', '["leisure"="pitch"]'),
    ),
)

#: First-match-wins classification order — a `railway=station` node tagged
#: `station=subway` must land in `subway_station`, not `train_station`, so
#: that category is tried first.
_CLASSIFICATION_ORDER: tuple[str, ...] = tuple(
    c.key
    for c in sorted(
        CATEGORIES,
        key=lambda c: 0 if c.key == "subway_station" else 1,
    )
)


class OsmPoiProvider(Provider):
    id = "osm_poi"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY
    cache_ttl = None
    deadline_s = 25.0
    min_precision = GeocodePrecision.STREET

    def __init__(self, client: HttpClient, clock: Clock = utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.latitude is None or context.longitude is None:
            # The runner's precision gate (min_precision) normally prevents
            # this; guarded here too since conformance calls collect()
            # directly, and a coordinate-less radius query would be wrong,
            # not just vague.
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no coordinates available for a radius query",
            )
        lat, lon = context.latitude, context.longitude

        try:
            payload = self._query(lat, lon)
        except (HttpError, OSError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Overpass request failed: {exc}",
            )

        elements = payload.get("elements") if isinstance(payload, dict) else None
        if not isinstance(elements, list):
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail="Overpass response had no elements array",
            )

        by_category = _classify(elements, lat, lon)
        fetched_at = self._clock().isoformat()
        findings: list[Finding] = []

        for category in CATEGORIES:
            items = by_category.get(category.key, [])
            items.sort(key=lambda item: item[0])
            findings.append(
                Finding(
                    domain="poi",
                    key=f"{category.key}_count_within_{int(RADIUS_M)}m",
                    value=len(items),
                    unit="count",
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage=f"{int(RADIUS_M)}m radius",
                    latitude=lat,
                    longitude=lon,
                    detail=category.label,
                )
            )
            if items:
                nearest = [
                    {
                        "name": name,
                        **proximity_info(
                            elat, elon, distance, requested_radius_m=RADIUS_M
                        ).to_dict(),
                    }
                    for distance, name, elat, elon in items[:NEAREST_N]
                ]
                findings.append(
                    Finding(
                        domain="poi",
                        key=f"{category.key}_nearest",
                        value=nearest,
                        source=_SOURCE,
                        trust_tier=self.trust_tier,
                        fetched_at=fetched_at,
                        coverage=f"nearest {NEAREST_N} within {int(RADIUS_M)}m",
                        latitude=lat,
                        longitude=lon,
                        detail=category.label,
                    )
                )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="Overpass returned no matching elements for any category",
            )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _query(self, lat: float, lon: float) -> object:
        return run_overpass_query(self._client, _build_query(lat, lon), self.deadline_s)


def _build_query(lat: float, lon: float) -> str:
    around = f"around:{int(RADIUS_M)},{lat},{lon}"
    lines = ["[out:json][timeout:25];", "("]
    for category in CATEGORIES:
        for f in category.filters:
            lines.append(f"  node({around}){f};")
            lines.append(f"  way({around}){f};")
    lines.append(");")
    lines.append("out center tags;")
    return "\n".join(lines)


def _classify(
    elements: list[object], origin_lat: float, origin_lon: float
) -> dict[str, list[tuple[float, str, float, float]]]:
    """Bucket raw Overpass elements into categories with computed distance."""
    by_category: dict[str, list[tuple[float, str, float, float]]] = {}
    for element in elements:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags")
        tags = tags if isinstance(tags, dict) else {}
        lat, lon = element_coords(element)
        if lat is None or lon is None:
            continue
        category = _classify_tags(tags)
        if category is None:
            continue
        distance = haversine_m(origin_lat, origin_lon, lat, lon)
        name = tags.get("name")
        name = name if isinstance(name, str) and name.strip() else category
        by_category.setdefault(category, []).append((distance, name, lat, lon))
    return by_category


_BY_KEY = {c.key: c for c in CATEGORIES}


def _classify_tags(tags: dict[str, object]) -> str | None:
    # Evaluate in `_CLASSIFICATION_ORDER` so subway beats train on shared tags.
    for key in _CLASSIFICATION_ORDER:
        if _matches(tags, _BY_KEY[key]):
            return key
    return None


def _matches(tags: dict[str, object], category: _Category) -> bool:
    return any(matches_filter(tags, filt) for filt in category.filters)
