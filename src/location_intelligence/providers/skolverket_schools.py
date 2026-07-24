"""Skolverket schools provider (task S-01/S-02, provider P5).

"What is planned?" for schools: Skolverket's school unit register (v1,
keyless, national bulk list — the `kommunkod` query parameter is
documented but does not actually filter server-side, verified live, so
filtering happens client-side after one bulk fetch) tags each unit's
`Status` as `Aktiv` (active), `Vilande` (dormant/inactive), or `Planerad`
(planned) — the last one is a genuine future-value signal: a named new
school with a start date, directly answering "what's planned nearby."

Kommun-level counts (active/dormant/planned school units) come from the
bulk list alone — one request. For the `Planerad` subset specifically
(a handful per kommun, not hundreds) this fetches per-unit detail to get
address, coordinates, and start date; when the address has coordinates
those planned schools are distance-sorted, otherwise listed as-is
(kommun-level fallback). Only *presence and status* are reported here —
quality/results (meritvärde etc., doc 38 S-03) are future work.
"""

from __future__ import annotations

from location_intelligence.context import AddressContext
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
from location_intelligence.providers.overpass_client import haversine_m
from location_intelligence.proximity import proximity_info

SKOLVERKET_BASE_URL = "https://api.skolverket.se/skolenhetsregistret/v1"
SKOLVERKET_HOST = "api.skolverket.se"
SKOLVERKET_RATE_LIMITS = {SKOLVERKET_HOST: 0.5}

_SOURCE = Source(
    name="Skolverket Skolenhetsregistret",
    url="https://www.skolverket.se/om-skolverket/oppna-data/api-for-skolenhetsregistret",
    license="Open data",
)

_STATUS_KEYS = {
    "Aktiv": "active_school_count",
    "Vilande": "dormant_school_count",
    "Planerad": "planned_school_count",
}


class SkolverketSchoolsProvider(Provider):
    id = "skolverket_schools"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = None
    deadline_s = 20.0

    def __init__(self, client: HttpClient, clock: Clock = utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.municipality_code is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no municipality resolved for this address yet",
            )

        try:
            units = self._list_units(context.municipality_code)
        except (HttpError, OSError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Skolverket request failed: {exc}",
            )

        fetched_at = self._clock().isoformat()
        counts = dict.fromkeys(_STATUS_KEYS.values(), 0)
        for unit in units:
            status = unit.get("Status")
            key = _STATUS_KEYS.get(status) if isinstance(status, str) else None
            if key is not None:
                counts[key] += 1

        findings = [
            Finding(
                domain="schools",
                key=key,
                value=count,
                unit="count",
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage="kommun-level",
            )
            for key, count in counts.items()
        ]

        planned_codes: list[str] = []
        for u in units:
            code = u.get("Skolenhetskod")
            if u.get("Status") == "Planerad" and isinstance(code, str):
                planned_codes.append(code)
        planned_findings, errors = self._planned_school_findings(
            planned_codes, context.latitude, context.longitude, fetched_at
        )
        findings.extend(planned_findings)

        if errors:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.PARTIAL,
                findings=findings,
                detail="; ".join(errors),
            )
        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _list_units(self, municipality_code: str) -> list[dict[str, object]]:
        payload = self._client.get_json(f"{SKOLVERKET_BASE_URL}/skolenhet")
        if not isinstance(payload, dict):
            return []
        units = payload.get("Skolenheter")
        if not isinstance(units, list):
            return []
        return [u for u in units if isinstance(u, dict) and u.get("Kommunkod") == municipality_code]

    def _planned_school_findings(
        self,
        codes: list[str],
        origin_lat: float | None,
        origin_lon: float | None,
        fetched_at: str,
    ) -> tuple[list[Finding], list[str]]:
        if not codes:
            return [], []

        items: list[dict[str, object]] = []
        errors: list[str] = []
        for code in codes:
            try:
                detail = self._client.get_json(f"{SKOLVERKET_BASE_URL}/skolenhet/{code}")
            except (HttpError, OSError, ValueError) as exc:
                errors.append(f"planned school {code}: {exc}")
                continue
            parsed = _parse_planned_school(detail, origin_lat, origin_lon)
            if parsed is not None:
                items.append(parsed)

        if not items:
            return [], errors

        if origin_lat is not None and origin_lon is not None:
            items.sort(key=lambda item: _distance_sort_key(item))

        return [
            Finding(
                domain="schools",
                key="planned_schools",
                value=items,
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage="kommun-level" if origin_lat is None else None,
                detail="named schools with Status=Planerad and their registered start date",
            )
        ], errors


def _distance_sort_key(item: dict[str, object]) -> float:
    distance = item.get("distance_m")
    return distance if isinstance(distance, int | float) else float("inf")


def _parse_planned_school(
    detail: object, origin_lat: float | None, origin_lon: float | None
) -> dict[str, object] | None:
    if not isinstance(detail, dict):
        return None
    info = detail.get("SkolenhetInfo")
    if not isinstance(info, dict):
        return None

    address = info.get("Besoksadress")
    address = address if isinstance(address, dict) else {}
    geo = address.get("GeoData")
    geo = geo if isinstance(geo, dict) else {}

    item: dict[str, object] = {
        "name": info.get("Namn"),
        "school_forms": [
            f.get("Benamning")
            for f in info.get("Skolformer", [])
            if isinstance(f, dict) and f.get("Benamning")
        ],
        "address": address.get("Adress"),
        "postal_code": address.get("Postnr"),
        "start_date": info.get("Startdatum"),
    }

    lat_raw, lon_raw = geo.get("Koordinat_WGS84_Lat"), geo.get("Koordinat_WGS84_Lng")
    try:
        lat = float(lat_raw) if lat_raw is not None else None
        lon = float(lon_raw) if lon_raw is not None else None
    except (TypeError, ValueError):
        lat = lon = None

    if lat is not None and lon is not None:
        if origin_lat is not None and origin_lon is not None:
            # No bounded search radius here — this is a kommun-wide bulk
            # list, not a radius query — so inside_requested_radius stays
            # None (doc 36 §4.1: "None" means "not a meaningful question").
            distance = haversine_m(origin_lat, origin_lon, lat, lon)
            item.update(proximity_info(lat, lon, distance).to_dict())
        else:
            item["latitude"] = lat
            item["longitude"] = lon

    return item
