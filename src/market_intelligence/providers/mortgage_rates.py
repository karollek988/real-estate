"""Mortgage rates provider (P-08).

Collects lending rates to households for housing loans, broken down by
original rate fixation period, from Statistics Sweden (SCB) PxWebApi v2.

This is the single most important missing data point for home buyers:
"What rate will I actually pay on a mortgage?"

Table: TAB5783 — Lending rates to households for housing loans
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

_FIXATION_PERIODS: dict[str, str] = {
    "1.1.1": "floating_rate",
    "1.1.2.2.1.1": "fixed_1_2yr",
    "1.1.2.2.1.2": "fixed_2_3yr",
    "1.1.2.2.1": "fixed_1_3yr",
    "1.1.2.2.2": "fixed_3_5yr",
    "1.1.2.3": "fixed_5yr_plus",
}


class MortgageRateProvider(Provider):
    """Collects mortgage rates by fixation period from SCB.

    Emits findings for each fixation period:
    - mortgage_rate.floating: rates up to 3 months (floating)
    - mortgage_rate.fixed_1_3yr: 1 to 3 year fixed
    - mortgage_rate.fixed_3_5yr: 3 to 5 year fixed
    - mortgage_rate.fixed_5yr_plus: 5+ year fixed
    """

    id = "mortgage_rates"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=12)
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
                    f"Swedish mortgage rates only cover Sweden, "
                    f"context country is {context.country!r}"
                ),
            )

        try:
            data = self._fetch_mortgage_rates()
        except HttpError as exc:
            logger.warning("SCB mortgage rates API error: %s", exc)
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"HTTP error: {exc}",
            )
        except Exception as exc:
            logger.exception("Mortgage rate provider failed")
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )

        try:
            findings = self._parse_rates(data)
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
                detail="No mortgage rate data available from SCB",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )

    def _fetch_mortgage_rates(self) -> object:
        """Fetch mortgage rates via POST to filter to relevant subsets.

        Filters:
        - Referenssektor = "1" (MFI + mortgage companies)
        - Motpartssektor = "2c" (households)
        - Avtal = "0200" (outstanding agreements — what buyers currently pay)
        - Rantebindningstid = floating, 1-3yr, 3-5yr, 5yr+ fixation periods
        """
        url = f"{_SCB_API_BASE}/tables/TAB5783/data"
        body = {
            "query": [
                {
                    "code": "Referenssektor",
                    "selection": {"filter": "item", "values": ["1"]},
                },
                {
                    "code": "Motpartssektor",
                    "selection": {"filter": "item", "values": ["2c"]},
                },
                {
                    "code": "Avtal",
                    "selection": {"filter": "item", "values": ["0200"]},
                },
                {
                    "code": "Rantebindningstid",
                    "selection": {
                        "filter": "item",
                        "values": ["1.1.1", "1.1.2.2.1", "1.1.2.2.2", "1.1.2.3"],
                    },
                },
            ],
            "response": {"format": "json-stat2"},
        }
        return self._client.post_json(url, body=body, timeout_s=15.0)

    def _parse_rates(self, data: object) -> list[Finding]:
        """Parse SCB JSON-stat2 mortgage rate response.

        Expected POST-filtered response has dimensions:
        Rantebindningstid × Tid (other dims eliminated by query).
        """
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        fixation_dim = dim.get("Rantebindningstid", {})
        time_dim = dim.get("Tid", {})

        fixation_cat = fixation_dim.get("category", {})
        fixation_index = fixation_cat.get("index", {})
        fixation_labels = fixation_cat.get("label", {})

        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})

        values = data.get("value", [])
        if not values or not fixation_index or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        if not time_periods:
            return []

        latest_period = time_periods[-1]

        for fixation_code, fixation_idx in fixation_index.items():
            finding_key = _FIXATION_PERIODS.get(fixation_code)
            if not finding_key:
                continue

            period_idx = time_index.get(latest_period)
            if period_idx is None:
                continue

            flat_idx = fixation_idx * len(time_periods) + period_idx
            if flat_idx >= len(values):
                continue

            raw_value = values[flat_idx]
            if raw_value is None:
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            period_start = _month_to_start(latest_period)
            period_end = _month_to_end(latest_period)

            findings.append(
                Finding(
                    domain="mortgage_rates",
                    key=f"mortgage_rate.{finding_key}",
                    value=value,
                    unit="percent",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage="national",
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=(
                        "Outstanding agreements, "
                        f"{fixation_labels.get(fixation_code, fixation_code)}"
                    ),
                )
            )

        return findings


def _month_to_start(code: str) -> str | None:
    """Convert SCB month code (e.g. '2026M05') to ISO date start."""
    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            return f"{parts[0]}-{parts[1].zfill(2)}-01"
    return None


def _month_to_end(code: str) -> str | None:
    """Convert SCB month code to ISO date end (last day of month)."""
    import calendar

    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            year = int(parts[0])
            month = int(parts[1])
            last_day = calendar.monthrange(year, month)[1]
            return f"{year}-{month:02d}-{last_day:02d}"
    return None
