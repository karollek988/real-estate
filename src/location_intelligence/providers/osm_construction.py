"""Construction provider (task K-01, provider P13).

"What is currently under construction near this address?" — the single
cheapest signal in the whole future-value catalog (doc 36 Tier 1 #3):
`construction=*` / `building=construction` tagged sites are already
covered by the same Overpass client `osm_poi.py` uses, just a different
tag filter and a wider radius (construction visibility/impact reaches
further than a walkable-amenity radius).

This is a separate findings domain from `osm_poi` (doc 38 P13) even
though it shares the Overpass client family: construction is a
future-value signal, not an amenity-presence count. Community-tagged data
(coverage and tagging habits vary), so tier is `DIRECTORY` — never
`REGISTRY_AUTHORITY` — matching doc 36 §4.4's guidance that OSM proxies
must never outrank an official source on the same question. Doc 38 P7's
kommun bygglov diarium is the future *official* upgrade for the same
question; this provider is the honest, free, national-coverage stand-in
until that's built.
"""

from __future__ import annotations

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
    element_coords,
    haversine_m,
    matches_filter,
    run_overpass_query,
)
from location_intelligence.proximity import proximity_info

RADIUS_M = 1500.0
NEAREST_N = 10

#: An element matching any of these is an active construction site.
_FILTERS: tuple[str, ...] = (
    '["construction"]',
    '["building"="construction"]',
    '["landuse"="construction"]',
)

_SOURCE = Source(
    name="OpenStreetMap Overpass API",
    url="https://overpass-api.de/api/interpreter",
    license="ODbL — © OpenStreetMap contributors",
)


class OsmConstructionProvider(Provider):
    id = "osm_construction"
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
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no coordinates available for a radius query",
            )
        lat, lon = context.latitude, context.longitude

        try:
            payload = run_overpass_query(self._client, _build_query(lat, lon), self.deadline_s)
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

        sites = _sites(elements, lat, lon)
        sites.sort(key=lambda s: s[0])
        fetched_at = self._clock().isoformat()

        count_finding = Finding(
            domain="construction",
            key=f"construction_site_count_within_{int(RADIUS_M)}m",
            value=len(sites),
            unit="count",
            source=_SOURCE,
            trust_tier=self.trust_tier,
            fetched_at=fetched_at,
            coverage=f"{int(RADIUS_M)}m radius",
            latitude=lat,
            longitude=lon,
            detail="active construction sites tagged in OpenStreetMap; coverage and tagging "
            "completeness vary — absence here is not proof nothing is planned",
        )
        findings = [count_finding]

        if sites:
            nearest = [
                {
                    "name": name,
                    **proximity_info(slat, slon, distance, requested_radius_m=RADIUS_M).to_dict(),
                    "construction_type": ctype,
                }
                for distance, name, slat, slon, ctype in sites[:NEAREST_N]
            ]
            findings.append(
                Finding(
                    domain="construction",
                    key="construction_sites_nearest",
                    value=nearest,
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage=f"nearest {NEAREST_N} within {int(RADIUS_M)}m",
                    latitude=lat,
                    longitude=lon,
                )
            )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)


def _build_query(lat: float, lon: float) -> str:
    around = f"around:{int(RADIUS_M)},{lat},{lon}"
    lines = ["[out:json][timeout:25];", "("]
    for f in _FILTERS:
        lines.append(f"  node({around}){f};")
        lines.append(f"  way({around}){f};")
    lines.append(");")
    lines.append("out center tags;")
    return "\n".join(lines)


def _sites(
    elements: list[object], origin_lat: float, origin_lon: float
) -> list[tuple[float, str, float, float, str]]:
    sites: list[tuple[float, str, float, float, str]] = []
    for element in elements:
        if not isinstance(element, dict):
            continue
        tags = element.get("tags")
        tags = tags if isinstance(tags, dict) else {}
        if not any(matches_filter(tags, f) for f in _FILTERS):
            continue
        lat, lon = element_coords(element)
        if lat is None or lon is None:
            continue
        distance = haversine_m(origin_lat, origin_lon, lat, lon)
        name = tags.get("name")
        name = name if isinstance(name, str) and name.strip() else "unnamed construction site"
        ctype = _construction_type(tags)
        sites.append((distance, name, lat, lon, ctype))
    return sites


def _construction_type(tags: dict[str, object]) -> str:
    for key in ("construction", "building"):
        value = tags.get(key)
        if isinstance(value, str) and value and value != "yes":
            return value
    landuse = tags.get("landuse")
    if isinstance(landuse, str):
        return landuse
    return "unspecified"
