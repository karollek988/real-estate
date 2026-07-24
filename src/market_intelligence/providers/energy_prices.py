"""Energy prices provider (P-10).

Collects electricity prices by consumption category from Statistics Sweden
(SCB) PxWebApi v2. Energy costs are a significant ongoing expense for
home buyers.

Table: TAB4310 — Electricity prices for households by consumption category
API: SCB PxWebApi v2, JSON-stat2, no key required.

Data source: https://statistikdatabasen.scb.se/
"""

from __future__ import annotations

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

SCB_HOST = "statistikdatabasen.scb.se"
SCB_RATE_LIMITS: dict[str, float] = {SCB_HOST: 1.0}

_SCB_API_BASE = "https://statistikdatabasen.scb.se/api/v2"

_SOURCE = Source(
    name="Statistics Sweden (SCB)",
    url="https://www.scb.se/",
    license="CC0 1.0",
)


class EnergyPriceProvider(Provider):
    """Collects electricity prices by consumption category from SCB.

    Emits findings for each consumption category:
    - energy_price.total_price: Total electricity price including grid fee and taxes
    - energy_price.energy_only: Pure energy cost (spot + margins)
    """

    id = "energy_prices"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=24)
    deadline_s = 15.0
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
                    f"Swedish energy prices only cover Sweden, "
                    f"context country is {context.country!r}"
                ),
            )

        try:
            data = self._fetch_energy_prices()
        except HttpError as exc:
            logger.warning("SCB energy prices API error: %s", exc)
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"HTTP error: {exc}",
            )
        except Exception as exc:
            logger.exception("Energy price provider failed")
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )

        try:
            findings = self._parse_prices(data)
        except (KeyError, TypeError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Failed to parse SCB response: {exc}",
            )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="No energy price data available from SCB",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )

    def _fetch_energy_prices(self) -> object:
        """Fetch TAB4310: Electricity prices by consumption category.

        Uses GET with full table — the table is small enough.
        """
        url = f"{_SCB_API_BASE}/tables/TAB4310/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _parse_prices(self, data: object) -> list[Finding]:
        """Parse SCB JSON-stat2 energy price response.

        Expected dimensions include consumption categories and time periods.
        We extract the latest period for each category.
        """
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        values = data.get("value", [])

        if not values or not dim:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []

        time_dim = dim.get("Tid", {})
        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})
        time_label = time_cat.get("label", {})

        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])
        if not time_periods:
            return []

        latest_period = time_periods[-1]

        # Find the first non-time dimension for categories
        category_index = {}
        category_label = {}
        for name, dim_data in dim.items():
            if name in ("Tid", "ContentsCode"):
                continue
            cat = dim_data.get("category", {})
            idx = cat.get("index", {})
            if idx:
                category_index = idx
                category_label = cat.get("label", {})
                break

        if not category_index:
            return []

        contents_dim = dim.get("ContentsCode", {})
        contents_cat = contents_dim.get("category", {})
        contents_index = contents_cat.get("index", {})

        time_size = len(time_index)
        contents_size = len(contents_index) if contents_index else 1

        for cat_code, cat_idx in category_index.items():
            period_idx = time_index.get(latest_period)
            if period_idx is None:
                continue

            flat_idx = cat_idx * contents_size * time_size + period_idx
            if flat_idx >= len(values):
                continue

            raw_value = values[flat_idx]
            if raw_value is None:
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            cat_name = category_label.get(cat_code, cat_code)
            period_label = time_label.get(latest_period, latest_period)
            period_start = _period_to_start(latest_period)
            period_end = _period_to_end(latest_period)

            findings.append(
                Finding(
                    domain="energy_costs",
                    key=f"electricity_price.{cat_code}",
                    value=value,
                    unit="öre_per_kwh",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage="national",
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB4310 {cat_name} ({period_label})",
                )
            )

        return findings


def _period_to_start(code: str) -> str | None:
    """Convert SCB period code to ISO start date.

    Handles: '2026H1' (half-year), '2026H2', '2026K1' (quarterly).
    """
    if "H" in code:
        parts = code.split("H")
        if len(parts) == 2:
            half = int(parts[1])
            month = (half - 1) * 6 + 1
            return f"{parts[0]}-{month:02d}-01"
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            quarter = int(parts[1])
            month = (quarter - 1) * 3 + 1
            return f"{parts[0]}-{month:02d}-01"
    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            return f"{parts[0]}-{parts[1].zfill(2)}-01"
    if code.isdigit() and len(code) == 4:
        return f"{code}-01-01"
    return None


def _period_to_end(code: str) -> str | None:
    """Convert SCB period code to ISO date end."""
    import calendar

    if "H" in code:
        parts = code.split("H")
        if len(parts) == 2:
            year = int(parts[0])
            half = int(parts[1])
            end_month = half * 6
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            year = int(parts[0])
            quarter = int(parts[1])
            end_month = quarter * 3
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            year = int(parts[0])
            month = int(parts[1])
            last_day = calendar.monthrange(year, month)[1]
            return f"{year}-{month:02d}-{last_day:02d}"
    if code.isdigit() and len(code) == 4:
        return f"{code}-12-31"
    return None
