"""Lantmäteriet detaljplan provider (future-development intelligence, provider P16).

"What is the municipality doing to this land, right now or soon?" —
Sweden's National Geodata Platform (Nationella geodataplattformen, NGP)
publishes an OGC API Features + STAC endpoint of **detaljplaner**
(binding municipal detailed development plans) since the 2022 mandate
that municipalities deliver plans digitally. Per plan this gives a real
processing status (`påbörjad`/`samråd`/`granskning`/`antagen`/
`överklagad`/`tillsyn`/`laga kraft`/`upphävd`/`avslutad`), key dates, and
links to the plan's own documents (`planbeskrivning`, `beslutshandling`,
`grundkarta`) — the single richest per-address signal found for municipal
planning, ongoing planning processes, and public consultation status
(`samråd` *is* the public-consultation phase). This is materially
different from Boverket's Planbestämmelsekatalogen/ÖP-katalog, which
describe plan-provision *vocabulary* and comprehensive-plan *metadata*,
not per-plan case status — those remain unbuilt; see
`docs/39_future_development_intelligence.md` for the full source survey
and why they were not prioritized this pass.

**Requires OAuth2 client credentials** (organization account via
Lantmäteriet's Geotorget, ~2 business days approval per Lantmäteriet's
own published process) — set `LANTMATERIET_CLIENT_ID` and
`LANTMATERIET_CLIENT_SECRET`. Without them this degrades to an honest
`not_connected`, matching the `TrafikverketInfrastructureProvider`
precedent for keyed sources.

**Field mapping is grounded in the live OpenAPI 2.2 spec and JSON Schema**
fetched directly from `namespace.lantmateriet.se` (not guessed), but the
*axis order* of returned WGS84 coordinates could not be verified against
a live response (no credentials available to this pass) — real-world OGC
API Features implementations disagree on lon/lat vs. lat/lon for
EPSG:4326 despite the nominal ISO convention. `_to_lat_lon` self-corrects
using Sweden's non-overlapping latitude (~55-69) / longitude (~10-24)
ranges rather than assuming either convention, so this degrades safely
regardless of which axis order the API actually returns.
"""

from __future__ import annotations

import base64
import json
import math
import os
import time
import urllib.parse
from collections.abc import Callable
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
from location_intelligence.proximity import haversine_m, proximity_info

TOKEN_URL = "https://api.lantmateriet.se/token"
SEARCH_URL = (
    "https://api.lantmateriet.se/distribution/geodatakatalog/sokning/v1/detaljplan/v2/search"
)
LANTMATERIET_HOST = "api.lantmateriet.se"
LANTMATERIET_RATE_LIMITS = {LANTMATERIET_HOST: 1.0}

#: EPSG:4326 requested for both the query bbox and the response geometries
#: (see module docstring: axis order is self-corrected on parse, not assumed).
_CRS_EPSG4326 = "http://www.opengis.net/def/crs/EPSG/0/4326"

RADIUS_M = 2000.0
NEAREST_N = 20

_SOURCE = Source(
    name="Lantmäteriet Nationella geodataplattformen (detaljplan)",
    url="https://www.lantmateriet.se/sv/nationella-geodataplattformen/datamangder/detaljplan/",
    license="Öppna data — attribution required",
)

#: Swedish plan-status vocabulary (from the live `detaljplan-ref-2.2.json`
#: schema's `planstatus` enum) glossed in English. This is a definitional
#: lookup, not a judgment — collection/normalization, not analysis.
_STATUS_GLOSS = {
    "påbörjad": "started",
    "samråd": "in public consultation (samråd)",
    "granskning": "in review (granskning)",
    "antagen": "adopted by the municipality, not yet legally binding",
    "överklagad": "adopted decision has been appealed",
    "tillsyn": "under supervision/appeal review",
    "laga kraft": "legally binding (final)",
    "upphävd": "repealed",
    "avslutad": "process concluded",
}

_ASSET_ROLE_GLOSS = {
    "detaljplan": "the plan itself",
    "beslutshandling": "the formal decision document",
    "grundkarta": "the base map",
    "planbeskrivning": "the plan description",
    "planeringsunderlag": "background planning material",
}


@dataclass(frozen=True, slots=True)
class _Token:
    value: str
    expires_at_monotonic: float


@dataclass(frozen=True, slots=True)
class _Plan:
    distance_m: float
    lat: float
    lon: float
    #: Everything JSON-serializable that isn't proximity metadata (id,
    #: status, dates, documents, raw properties, ...).
    fields: dict[str, object]


class LantmaterietDetaljplanProvider(Provider):
    id = "lantmateriet_detaljplan"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = None
    deadline_s = 20.0
    min_precision = GeocodePrecision.STREET

    def __init__(
        self,
        client: HttpClient,
        client_id: str | None = None,
        client_secret: str | None = None,
        clock: Clock = utcnow,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._client_id = (
            client_id if client_id is not None else os.environ.get("LANTMATERIET_CLIENT_ID")
        )
        self._client_secret = (
            client_secret
            if client_secret is not None
            else os.environ.get("LANTMATERIET_CLIENT_SECRET")
        )
        self._clock = clock
        self._monotonic = monotonic
        self._token: _Token | None = None

    def collect(self, context: AddressContext) -> ProviderResult:
        if not self._client_id or not self._client_secret:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NOT_CONNECTED,
                detail="LANTMATERIET_CLIENT_ID/LANTMATERIET_CLIENT_SECRET not configured — "
                "register an organization account at Lantmäteriet's Geotorget "
                "(https://www.lantmateriet.se/sv/nationella-geodataplattformen/"
                "konsument/bli-konsument-som-organisation/)",
            )
        if context.latitude is None or context.longitude is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no coordinates available for a radius query",
            )
        lat, lon = context.latitude, context.longitude

        try:
            payload = self._search(lat, lon)
        except (HttpError, OSError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Lantmäteriet detaljplan request failed: {exc}",
            )

        features = payload.get("features") if isinstance(payload, dict) else None
        if not isinstance(features, list):
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail="Lantmäteriet response had no features array",
            )

        plans = _parse_plans(features, lat, lon, context.municipality)
        plans = [p for p in plans if p.distance_m <= RADIUS_M]
        plans.sort(key=lambda p: p.distance_m)
        fetched_at = self._clock().isoformat()

        count_finding = Finding(
            domain="planning",
            key=f"detaljplan_count_within_{int(RADIUS_M)}m",
            value=len(plans),
            unit="count",
            source=_SOURCE,
            trust_tier=self.trust_tier,
            fetched_at=fetched_at,
            coverage=f"{int(RADIUS_M)}m radius",
            latitude=lat,
            longitude=lon,
            detail="detailed development plans (detaljplaner) delivered to the National "
            "Geodata Platform; only plans begun on/after 2022-01-01 are mandated to be "
            "here — older plans may be absent from this dataset, not necessarily absent "
            "in reality",
        )
        findings = [count_finding]

        if plans:
            nearest = [_public_view(p) for p in plans[:NEAREST_N]]
            findings.append(
                Finding(
                    domain="planning",
                    key="detaljplans_nearest",
                    value=nearest,
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage=f"nearest {NEAREST_N} within {int(RADIUS_M)}m",
                    latitude=lat,
                    longitude=lon,
                    detail="status vocabulary: "
                    + "; ".join(f"{sv}={en}" for sv, en in _STATUS_GLOSS.items()),
                )
            )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _search(self, lat: float, lon: float) -> object:
        token = self._access_token()
        dlat = RADIUS_M / 111_320.0
        dlon = RADIUS_M / (111_320.0 * math.cos(math.radians(lat)))
        bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]
        body = json.dumps(
            {
                "bbox": bbox,
                "limit": 200,
                "query": {"feature.typ": {"eq": "detaljplan"}},
            }
        ).encode("utf-8")
        query = urllib.parse.urlencode({"bbox-crs": _CRS_EPSG4326, "crs": _CRS_EPSG4326})
        text = self._client.post_text(
            f"{SEARCH_URL}?{query}",
            body=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            timeout_s=self.deadline_s,
        )
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise HttpError(f"Lantmäteriet returned non-JSON body: {exc}", url=SEARCH_URL) from exc

    def _access_token(self) -> str:
        now = self._monotonic()
        if self._token is not None and now < self._token.expires_at_monotonic:
            return self._token.value

        credentials = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode(
            "ascii"
        )
        body = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
        text = self._client.post_text(
            TOKEN_URL,
            body=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {credentials}",
            },
            timeout_s=self.deadline_s,
        )
        payload = json.loads(text)
        access_token = str(payload["access_token"])
        expires_in = float(payload.get("expires_in", 3600))
        # 30s safety margin so a token never expires mid-request.
        self._token = _Token(value=access_token, expires_at_monotonic=now + expires_in - 30)
        return access_token


def _to_lat_lon(a: float, b: float) -> tuple[float, float]:
    """Self-correct EPSG:4326 axis order using Sweden's non-overlapping ranges.

    Swedish latitude (~55-69) and longitude (~10-24) ranges never overlap,
    so the correct order can be detected per-response instead of assumed —
    see module docstring for why this API's actual axis order is unverified.
    """
    if 54.0 <= a <= 70.0 and 9.0 <= b <= 25.0:
        return a, b
    return b, a


def _flatten_coords(node: object) -> list[tuple[float, float]]:
    if not isinstance(node, list) or not node:
        return []
    if isinstance(node[0], int | float):
        if len(node) >= 2:
            return [(float(node[0]), float(node[1]))]
        return []
    points: list[tuple[float, float]] = []
    for child in node:
        points.extend(_flatten_coords(child))
    return points


def _representative_point(geometry: object) -> tuple[float, float] | None:
    """Vertex-average approximation of the plan geometry's location.

    Not an area-weighted centroid — a documented approximation (module
    avoids adding a geometry/shapely dependency for one field). Good
    enough at typical detaljplan scale (city blocks, not vast areas).
    """
    if not isinstance(geometry, dict):
        return None
    raw_points = _flatten_coords(geometry.get("coordinates"))
    if not raw_points:
        return None
    avg_a = sum(p[0] for p in raw_points) / len(raw_points)
    avg_b = sum(p[1] for p in raw_points) / len(raw_points)
    return _to_lat_lon(avg_a, avg_b)


def _parse_plans(
    features: list[object], origin_lat: float, origin_lon: float, municipality: str | None
) -> list[_Plan]:
    plans: list[_Plan] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        properties = properties if isinstance(properties, dict) else {}
        point = _representative_point(feature.get("geometry"))
        if point is None:
            continue
        lat, lon = point
        distance = haversine_m(origin_lat, origin_lon, lat, lon)

        detaljplan = properties.get("detaljplan")
        detaljplan = detaljplan if isinstance(detaljplan, dict) else {}
        assets = feature.get("assets")
        assets = assets if isinstance(assets, dict) else {}
        documents = [
            {
                "role": (asset.get("roles") or [key])[0] if isinstance(asset, dict) else key,
                "role_meaning": _ASSET_ROLE_GLOSS.get(
                    (asset.get("roles") or [key])[0] if isinstance(asset, dict) else key
                ),
                "title": asset.get("title") if isinstance(asset, dict) else None,
                "url": asset.get("href") if isinstance(asset, dict) else None,
            }
            for key, asset in assets.items()
        ]

        status = detaljplan.get("status")
        plans.append(
            _Plan(
                distance_m=distance,
                lat=lat,
                lon=lon,
                fields={
                    "id": detaljplan.get("objektidentitet"),
                    "case_reference": detaljplan.get("beteckning"),
                    "name": detaljplan.get("namn"),
                    "status": status,
                    "status_meaning": (
                        _STATUS_GLOSS.get(status) if isinstance(status, str) else None
                    ),
                    "plan_type": detaljplan.get("typ"),
                    "authority": municipality,
                    "date_started": detaljplan.get("datumPaborjat"),
                    "date_status_changed": detaljplan.get("datumStatusforandring"),
                    "date_legally_binding": detaljplan.get("datumLagakraft"),
                    "updated_at": properties.get("datetime"),
                    "bbox": feature.get("bbox"),
                    "documents": documents,
                    "raw": properties,
                },
            )
        )
    return plans


def _public_view(plan: _Plan) -> dict[str, object]:
    info = proximity_info(plan.lat, plan.lon, plan.distance_m, requested_radius_m=RADIUS_M)
    return {**plan.fields, **info.to_dict()}
