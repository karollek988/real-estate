"""Polisen crime events provider (task C-01/C-02, provider P10a).

Per-address crime data does not exist in Sweden by design (doc 28) — this
provider reports what genuinely exists: Polisen.se's public events feed
(`polisen.se/api/events`), keyless JSON, near-real-time. Verified live:
`locationname` filters reliably by *county* name (`location.name` is
always "<Län> län", never a kommun or street), and `location.gps` is a
fixed county centroid, not the event's real coordinates — so this is
explicitly county-level, `DIRECTORY` tier (real, official-adjacent, but
not a structured/versioned statistics product; doc 36 §2.5/§4.4), never
presented as more precise than it is.

BRÅ's static regional crime-statistics tables (task C-03) are a separate,
periodic-ingest source (no API, download + parse pipeline) and are not
built here — flagged as follow-up, consistent with the honest-absence
principle rather than silently substituting Polisen's incident *log* for
BRÅ's crime *statistics*, which answer different questions.
"""

from __future__ import annotations

import urllib.parse
from datetime import UTC, datetime, timedelta

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
from location_intelligence.municipality import KommunRegister, load_register
from location_intelligence.providers.base import Provider, Stage

POLISEN_BASE_URL = "https://polisen.se/api/events"
POLISEN_HOST = "polisen.se"
POLISEN_RATE_LIMITS = {POLISEN_HOST: 1.0}

RECENT_WINDOW_DAYS = 30
MAX_ITEMS = 15

_SOURCE = Source(
    name="Polisen.se händelser (events)",
    url="https://polisen.se/aktuellt/handelser/",
    license="Open, public authority data",
)


class PolisenCrimeProvider(Provider):
    id = "polisen_crime"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY
    cache_ttl = None
    deadline_s = 15.0

    def __init__(
        self, client: HttpClient, register: KommunRegister | None = None, clock: Clock = utcnow
    ) -> None:
        self._client = client
        self._register = register if register is not None else load_register()
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.county_code is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no county resolved for this address yet",
            )
        county_name = self._register.county_name(context.county_code)
        if county_name is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=f"county code {context.county_code} not found in the SCB register",
            )

        try:
            payload = self._client.get_json(POLISEN_BASE_URL, params={"locationname": county_name})
        except (HttpError, OSError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Polisen request failed: {exc}",
            )

        if not isinstance(payload, list):
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail="Polisen response was not a list of events",
            )

        events: list[dict[str, object]] = []
        for raw in payload:
            if not isinstance(raw, dict):
                continue
            parsed = _parse_event(raw)
            if parsed is not None:
                events.append(parsed)

        if not events:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=f"Polisen returned no events for {county_name}",
            )

        now = self._clock()
        cutoff = now - timedelta(days=RECENT_WINDOW_DAYS)
        recent = [e for e in events if (dt := _dt_of(e)) is not None and dt >= cutoff]

        fetched_at = now.isoformat()
        findings = [
            Finding(
                domain="crime",
                key=f"police_event_count_last_{RECENT_WINDOW_DAYS}d",
                value=len(recent),
                unit="count",
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage=f"county-level ({county_name})",
                detail="Polisen's public events log, not BRÅ crime statistics; county-level "
                "centroid coordinates, not per-event locations",
            )
        ]

        events.sort(key=lambda e: _dt_of(e) or datetime.min.replace(tzinfo=UTC), reverse=True)
        recent_items = [{k: v for k, v in e.items() if k != "_dt"} for e in events[:MAX_ITEMS]]
        findings.append(
            Finding(
                domain="crime",
                key="police_events_recent",
                value=recent_items,
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage=f"county-level ({county_name})",
            )
        )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)


def _dt_of(event: dict[str, object]) -> datetime | None:
    dt = event.get("_dt")
    return dt if isinstance(dt, datetime) else None


def _parse_event(event: dict[str, object]) -> dict[str, object] | None:
    name = event.get("name")
    if not isinstance(name, str):
        return None
    dt_raw = event.get("datetime")
    dt = _parse_datetime(dt_raw) if isinstance(dt_raw, str) else None
    location = event.get("location")
    location_name = location.get("name") if isinstance(location, dict) else None
    return {
        "title": name,
        "type": event.get("type"),
        "summary": event.get("summary"),
        "datetime": dt_raw,
        "location_name": location_name,
        "url": _absolute_url(event.get("url")),
        "_dt": dt,
    }


def _parse_datetime(raw: str) -> datetime | None:
    try:
        return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S %z")
    except ValueError:
        return None


def _absolute_url(url: object) -> str | None:
    if not isinstance(url, str):
        return None
    if url.startswith("http"):
        return url
    return urllib.parse.urljoin("https://polisen.se", url)
