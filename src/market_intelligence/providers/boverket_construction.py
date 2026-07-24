"""Boverket construction provider (P-03).

Collects building permits and new construction statistics from Statistics
Sweden (SCB) — the authoritative source for Swedish construction data.
Boverket's own API covers regional planning catalogs, not permit
statistics.

Data source: SCB PxWebApi v2 (table BO0101G)
API: JSON-stat2, no key required.
"""

from __future__ import annotations

import calendar
import logging
from datetime import timedelta

from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpClient, HttpError
from market_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
    ValidityWindow,
    utcnow,
)
from market_intelligence.providers.base import Provider, Stage

logger = logging.getLogger(__name__)

SCB_CONSTRUCTION_RATE_LIMITS: dict[str, float] = {
    "statistikdatabasen.scb.se": 1.0,
}

_SCB_BASE_URL = "https://statistikdatabasen.scb.se/api/v2"
_TABLE_ID = "BO0101G"

_SOURCE = Source(
    name="Statistics Sweden (SCB) / Boverket",
    url="https://www.scb.se/",
    license="CC0 1.0",
)


class BoverketConstructionProvider(Provider):
    """Collects building permit and new construction data.

    Fetches quarterly building permit statistics (count and gross floor
    area) broken down by building type. Emits the latest quarter's data
    for each building type.
    """

    id = "boverket_construction"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=24)
    deadline_s = 20.0
    required_level = GeographicLevel.COUNTRY

    def __init__(self, client: HttpClient, clock=utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: MarketContext) -> ProviderResult:
        if context.country and context.country.upper() not in ("SE", "SVERIGE"):
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=(
                    f"Construction data only covers Sweden, context country "
                    f"is {context.country!r}"
                ),
            )

        try:
            data = self._fetch_data()
        except HttpError as exc:
            logger.warning("SCB construction API error: %s", exc)
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"HTTP error: {exc}",
            )
        except Exception as exc:
            logger.exception("Boverket construction provider failed")
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )

        try:
            findings = self._parse_response(data)
        except (KeyError, TypeError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Failed to parse construction data: {exc}",
            )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="No building permit data available",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )

    def _fetch_data(self) -> object:
        url = f"{_SCB_BASE_URL}/tables/{_TABLE_ID}/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _parse_response(self, data: object) -> list[Finding]:
        """Parse SCB JSON-stat2 building permit data."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        values = data.get("value")
        if not values or not isinstance(values, list):
            return []

        dimension = data.get("dimension", {})
        if not dimension:
            return []

        time_dim = dimension.get("Tid")
        if not time_dim:
            return []

        time_categories = time_dim.get("category", {})
        time_index = time_categories.get("index", {})

        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])
        if not time_periods:
            return []

        latest_period = time_periods[-1]
        period_start = _quarter_to_start(latest_period)
        period_end = _quarter_to_end(latest_period)

        now = self._clock().isoformat()
        findings: list[Finding] = []

        building_type_dim = dimension.get("Byggnadstyp")
        if not building_type_dim:
            return self._emit_aggregate(
                values, latest_period, time_index, now, period_start, period_end
            )

        bt_categories = building_type_dim.get("category", {})
        bt_index = bt_categories.get("index", {})
        bt_label = bt_categories.get("label", {})

        contents_dim = dimension.get("ContentsCode")
        contents_categories = contents_dim.get("category", {}) if contents_dim else {}
        contents_index = contents_categories.get("index", {})
        contents_label = contents_categories.get("label", {})

        id_list = data.get("id", [])
        size_list = data.get("size", [])

        time_axis = id_list.index("Tid") if "Tid" in id_list else -1
        bt_axis = id_list.index("Byggnadstyp") if "Byggnadstyp" in id_list else -1
        cc_axis = id_list.index("ContentsCode") if "ContentsCode" in id_list else -1

        for bt_code, bt_idx in bt_index.items():
            for cc_code, cc_idx in contents_index.items():
                flat_idx = self._flat_index(
                    size_list,
                    {
                        "Tid": (time_index.get(latest_period, 0), time_axis),
                        "Byggnadstyp": (bt_idx, bt_axis),
                        "ContentsCode": (cc_idx, cc_axis),
                    },
                )
                if flat_idx is None or flat_idx >= len(values):
                    continue
                val = values[flat_idx]
                if val is None:
                    continue

                bt_name = bt_label.get(bt_code, bt_code)
                cc_name = contents_label.get(cc_code, cc_code)

                is_area = "area" in cc_name.lower() or "sqm" in cc_name.lower()
                unit = "sqm" if is_area else "permits"
                key = "new_construction_area" if is_area else "building_permits_granted"

                findings.append(
                    Finding(
                        domain="housing_market",
                        key=key,
                        value=float(val),
                        unit=unit,
                        source=_SOURCE,
                        trust_tier=TrustTier.REGISTRY_AUTHORITY,
                        fetched_at=now,
                        country="SE",
                        coverage="national",
                        validity=ValidityWindow(start=period_start, end=period_end),
                        detail=f"{bt_name} ({cc_name})",
                    )
                )

        return findings

    def _emit_aggregate(
        self,
        values: list,
        period: str,
        time_index: dict,
        now: str,
        period_start: str | None,
        period_end: str | None,
    ) -> list[Finding]:
        """When no building-type breakdown, emit aggregate totals."""
        idx = time_index.get(period, 0)
        if idx >= len(values) or values[idx] is None:
            return []
        return [
            Finding(
                domain="housing_market",
                key="building_permits_granted",
                value=float(values[idx]),
                unit="permits",
                source=_SOURCE,
                trust_tier=TrustTier.REGISTRY_AUTHORITY,
                fetched_at=now,
                country="SE",
                coverage="national",
                validity=ValidityWindow(start=period_start, end=period_end),
                detail=period,
            )
        ]

    @staticmethod
    def _flat_index(sizes: list[int], axes: dict[str, tuple[int, int]]) -> int | None:
        """Compute flat array index from multi-dimensional coordinates."""
        if not sizes:
            return None
        stride = 1
        result = 0
        for i in range(len(sizes) - 1, -1, -1):
            axis_name = [name for name, (_, axis_idx) in axes.items() if axis_idx == i]
            if axis_name:
                coord = axes[axis_name[0]][0]
                result += coord * stride
            stride *= sizes[i]
        return result


def _quarter_to_start(code: str) -> str | None:
    """Convert quarter code (e.g. '2026K1') to ISO start date."""
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            quarter = int(parts[1])
            month = (quarter - 1) * 3 + 1
            return f"{parts[0]}-{month:02d}-01"
    return None


def _quarter_to_end(code: str) -> str | None:
    """Convert quarter code to ISO end date."""
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            year = int(parts[0])
            quarter = int(parts[1])
            end_month = quarter * 3
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    return None
