"""Nominatim geocoder provider (tasks A-03/A-04, provider P2).

Forward geocoding for address input, reverse for coordinate input. Port
of the proven `nominatim_geocoding` TS provider (docs/28) with the
precision-level contract added: every geocode declares how precisely it
located the property, and radius-based providers gate on it (task A-05).

Assumptions (documented per Wave 2 instructions):
- One request per analysis (limit=1, best match) — Nominatim's usage
  policy is honored via the shared client's per-host rate limit and the
  always-on User-Agent.
- `countrycodes=se` — this engine is for Swedish properties only.
- Precision mapping is conservative: an unrecognized result shape maps
  to MUNICIPALITY (the coarsest level), never to a finer one.
- Nominatim is community data (ODbL): trust tier DIRECTORY. The kommun
  *code* still comes from the SCB register lookup, never from Nominatim.
"""

from __future__ import annotations

from location_intelligence.context import AddressContext, GeocodePrecision, InputMode
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

NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
NOMINATIM_HOST = "nominatim.openstreetmap.org"
#: Nominatim usage policy: max 1 request/second.
NOMINATIM_RATE_LIMITS = {NOMINATIM_HOST: 1.1}

_SOURCE = Source(
    name="OpenStreetMap Nominatim",
    url=NOMINATIM_BASE_URL,
    license="ODbL — © OpenStreetMap contributors",
)

_MUNICIPALITY_KEYS = ("municipality", "city", "town", "village")


class NominatimGeocoder(Provider):
    id = "nominatim_geocoder"
    stage = Stage.PRE
    trust_tier = TrustTier.DIRECTORY
    deadline_s = 15.0

    def __init__(
        self,
        client: HttpClient,
        register: KommunRegister | None = None,
        clock: Clock = utcnow,
    ) -> None:
        self._client = client
        self._register = register if register is not None else load_register()
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        try:
            if context.input_mode is InputMode.COORDINATES:
                item = self._reverse(context)
            else:
                item = self._search(context)
        except (HttpError, OSError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Nominatim request failed: {exc}",
            )

        if item is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="Nominatim returned no result for this input",
            )

        return self._build_result(context, item)

    def _search(self, context: AddressContext) -> dict[str, object] | None:
        payload = self._client.get_json(
            f"{NOMINATIM_BASE_URL}/search",
            params={
                "q": context.raw_input,
                "format": "jsonv2",
                "addressdetails": "1",
                "limit": "1",
                "countrycodes": "se",
            },
        )
        if not isinstance(payload, list) or not payload:
            return None
        item = payload[0]
        return item if isinstance(item, dict) else None

    def _reverse(self, context: AddressContext) -> dict[str, object] | None:
        assert context.latitude is not None and context.longitude is not None
        payload = self._client.get_json(
            f"{NOMINATIM_BASE_URL}/reverse",
            params={
                "lat": f"{context.latitude}",
                "lon": f"{context.longitude}",
                "format": "jsonv2",
                "addressdetails": "1",
            },
        )
        if not isinstance(payload, dict) or "error" in payload:
            return None
        return payload

    def _build_result(self, context: AddressContext, item: dict[str, object]) -> ProviderResult:
        address = item.get("address")
        address = address if isinstance(address, dict) else {}
        precision = _precision_of(item, address)

        patch: dict[str, object] = {"precision": precision}
        if context.input_mode is InputMode.ADDRESS:
            try:
                patch["latitude"] = float(str(item["lat"]))
                patch["longitude"] = float(str(item["lon"]))
            except (KeyError, ValueError):
                return ProviderResult(
                    provider_id=self.id,
                    status=ProviderStatus.ERROR,
                    detail="Nominatim result had no parseable coordinates",
                )

        postcode = address.get("postcode")
        if context.postal_code is None and isinstance(postcode, str):
            patch["postal_code"] = postcode

        if context.municipality_code is None:
            code = self._municipality_code(address)
            if code is not None:
                patch["municipality"] = self._register.municipality_name(code)
                patch["municipality_code"] = code
                patch["county_code"] = self._register.county_code_for(code)

        display_name = item.get("display_name")
        findings = []
        if isinstance(display_name, str):
            lat = patch.get("latitude", context.latitude)
            lon = patch.get("longitude", context.longitude)
            findings.append(
                Finding(
                    domain="geocoding",
                    key="resolved_address",
                    value=display_name,
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=self._clock().isoformat(),
                    latitude=lat if isinstance(lat, float) else None,
                    longitude=lon if isinstance(lon, float) else None,
                    detail=f"geocode precision: {precision.value}",
                )
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
            context_patch=patch,
        )

    def _municipality_code(self, address: dict[str, object]) -> str | None:
        for key in _MUNICIPALITY_KEYS:
            name = address.get(key)
            if isinstance(name, str):
                code = self._register.municipality_code(name)
                if code is not None:
                    return code
        return None


def _precision_of(item: dict[str, object], address: dict[str, object]) -> GeocodePrecision:
    if "house_number" in address:
        return GeocodePrecision.ROOFTOP
    if "road" in address:
        return GeocodePrecision.STREET
    if item.get("addresstype") == "postcode" or "postcode" in address:
        return GeocodePrecision.POSTAL
    return GeocodePrecision.MUNICIPALITY
