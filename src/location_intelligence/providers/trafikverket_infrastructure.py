"""Trafikverket infrastructure provider (task T-01/T-02, provider P8).

"What public investments are planned nearby?" for roads, rail, and public
transport infrastructure (Trafikverket's `Situation`/`Deviation` object
covers ongoing and planned roadworks, rail projects — including transit
expansion such as new metro/rail lines under construction — and traffic
disruptions; doc 28's endpoint-verified, field-mapping-unverified source).

**Requires a free API key** (self-service registration at
https://data.trafikverket.se/, doc 38 T-01) — set `TRAFIKVERKET_API_KEY`.
Without one this degrades to an honest `not_connected`, never a fabricated
empty result, per the ProviderStatus contract's existing `NOT_CONNECTED`
state (docs/28 pattern).

Field mapping (doc 38 T-01's "verify against a live response" task) is
documented here from Trafikverket's public Situation/Deviation schema —
unverified against live data pending key acquisition; this is called out
explicitly rather than silently assumed correct.
"""

from __future__ import annotations

import json
import os
from xml.sax.saxutils import escape

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

TRAFIKVERKET_BASE_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json"
TRAFIKVERKET_HOST = "api.trafikinfo.trafikverket.se"
TRAFIKVERKET_RATE_LIMITS = {TRAFIKVERKET_HOST: 0.5}

RADIUS_M = 2000
NEAREST_N = 15

_SOURCE = Source(
    name="Trafikverket Open API (Situation/Deviation)",
    url="https://data.trafikverket.se/",
    license="Open data, source attribution required",
)


class TrafikverketInfrastructureProvider(Provider):
    id = "trafikverket_infrastructure"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = None
    deadline_s = 15.0
    min_precision = GeocodePrecision.STREET

    def __init__(
        self, client: HttpClient, api_key: str | None = None, clock: Clock = utcnow
    ) -> None:
        self._client = client
        self._api_key = api_key if api_key is not None else os.environ.get("TRAFIKVERKET_API_KEY")
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if not self._api_key:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NOT_CONNECTED,
                detail="TRAFIKVERKET_API_KEY not configured — register a free key at "
                "https://data.trafikverket.se/",
            )
        if context.latitude is None or context.longitude is None:
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
                detail=f"Trafikverket request failed: {exc}",
            )

        error = _extract_error(payload)
        if error is not None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Trafikverket returned an error: {error}",
            )

        situations = _extract_situations(payload)
        fetched_at = self._clock().isoformat()

        count_finding = Finding(
            domain="infrastructure",
            key=f"infrastructure_project_count_within_{RADIUS_M}m",
            value=len(situations),
            unit="count",
            source=_SOURCE,
            trust_tier=self.trust_tier,
            fetched_at=fetched_at,
            coverage=f"{RADIUS_M}m radius",
            latitude=lat,
            longitude=lon,
        )
        findings = [count_finding]

        if situations:
            findings.append(
                Finding(
                    domain="infrastructure",
                    key="infrastructure_projects_nearest",
                    value=situations[:NEAREST_N],
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage=f"nearest {NEAREST_N} within {RADIUS_M}m",
                    latitude=lat,
                    longitude=lon,
                    detail="validity start/end are when the project is/was actually planned; "
                    "distinct from fetched_at (doc 37 observation-time vs validity-period rule)",
                )
            )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _query(self, lat: float, lon: float) -> object:
        query = _build_query(self._api_key or "", lat, lon)
        text = self._client.post_text(
            TRAFIKVERKET_BASE_URL,
            body=query.encode("utf-8"),
            headers={"Content-Type": "text/xml"},
            timeout_s=self.deadline_s,
        )
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise HttpError(
                f"Trafikverket returned non-JSON body: {exc}", url=TRAFIKVERKET_BASE_URL
            ) from exc


def _build_query(api_key: str, lat: float, lon: float) -> str:
    # WGS84 filter is "lon lat" order per Trafikverket's documented shape.
    return (
        "<REQUEST>"
        f'<LOGIN authenticationkey="{escape(api_key)}"/>'
        '<QUERY objecttype="Situation" schemaversion="1.5" limit="50">'
        "<FILTER>"
        f'<WITHIN name="Deviation.Geometry.WGS84" shape="center" '
        f'value="{lon} {lat}" radius="{RADIUS_M}m"/>'
        "</FILTER>"
        "</QUERY>"
        "</REQUEST>"
    )


def _extract_error(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "unexpected response shape"
    response = payload.get("RESPONSE")
    if not isinstance(response, dict):
        return None
    results = response.get("RESULT")
    if not isinstance(results, list):
        return None
    for result in results:
        if isinstance(result, dict) and "ERROR" in result:
            err = result["ERROR"]
            if isinstance(err, dict):
                return str(err.get("MESSAGE", err))
            return str(err)
    return None


def _extract_situations(payload: object) -> list[dict[str, object]]:
    if not isinstance(payload, dict):
        return []
    response = payload.get("RESPONSE")
    if not isinstance(response, dict):
        return []
    results = response.get("RESULT")
    if not isinstance(results, list):
        return []
    situations: list[dict[str, object]] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        raw = result.get("Situation")
        if not isinstance(raw, list):
            continue
        for situation in raw:
            parsed = _parse_situation(situation)
            if parsed is not None:
                situations.append(parsed)
    return situations


def _parse_situation(situation: object) -> dict[str, object] | None:
    if not isinstance(situation, dict):
        return None
    deviations = situation.get("Deviation")
    if not isinstance(deviations, list) or not deviations:
        return None
    deviation = deviations[0]
    if not isinstance(deviation, dict):
        return None
    return {
        "header": deviation.get("Header"),
        "message_type": deviation.get("MessageType"),
        "road_number": deviation.get("RoadNumber"),
        "start_time": deviation.get("StartTime"),
        "end_time": deviation.get("EndTime"),
    }
