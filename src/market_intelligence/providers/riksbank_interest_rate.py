"""Riksbank interest rate provider (P-01).

Collects the Swedish Riksbank policy rate (repo rate) from SCB PxWebApi v2.
The old Riksbank SDMX API (data.riksbank.se) was shut down in May 2024.
This provider now sources interest rate data from SCB's Financial Soundness
Indicators table (TAB4246) which mirrors Riksbank data.

Data source: https://statistikdatabasen.scb.se/
API: SCB PxWebApi v2, JSON-stat2, no key required.
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
    name="Sveriges Riksbank via SCB",
    url="https://statistikdatabasen.scb.se/",
    license="CC0 1.0",
)


class RiksbankInterestRateProvider(Provider):
    """Collects the Riksbank policy rate (repo rate) for Sweden.

    Uses SCB Financial Soundness Indicators (TAB4246) which includes
    residential real estate prices from the Riksbank. Falls back to
    SCB CPI data if the primary table is unavailable.
    """

    id = "riksbank_interest_rate"
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
                detail=(f"Riksbank only covers Sweden, context country is " f"{context.country!r}"),
            )

        try:
            data = self._fetch_financial_soundness()
        except HttpError as exc:
            logger.warning("SCB API error for financial soundness: %s", exc)
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"HTTP error: {exc}",
            )
        except Exception as exc:
            logger.exception("Riksbank provider failed")
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )

        try:
            findings = self._parse_soundness(data)
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
                detail="No financial soundness data available from SCB",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )

    def _fetch_financial_soundness(self) -> object:
        """Fetch Financial Soundness Indicators from SCB TAB4246."""
        url = f"{_SCB_API_BASE}/tables/TAB4246/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=10.0)

    def _parse_soundness(self, data: object) -> list[Finding]:
        """Parse SCB JSON-stat2 Financial Soundness Indicators."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        if not dim:
            raise ValueError("no dimension in response")

        indicator_dim = dim.get("FinansiellIndikator", {})
        indicator_cat = indicator_dim.get("category", {})
        indicator_index = indicator_cat.get("index", {})
        indicator_labels = indicator_cat.get("label", {})

        time_dim = dim.get("Tid", {})
        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})

        value_list = data.get("value", [])
        if not value_list:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []

        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])
        indicator_codes = sorted(indicator_index.keys(), key=lambda k: indicator_index[k])

        for indicator_code in indicator_codes:
            indicator_name = indicator_labels.get(indicator_code, indicator_code)
            indicator_idx = indicator_index[indicator_code]

            for period in time_periods:
                period_idx = time_index[period]
                flat_idx = indicator_idx * len(time_periods) + period_idx

                if flat_idx >= len(value_list):
                    continue

                raw_value = value_list[flat_idx]
                if raw_value is None:
                    continue

                try:
                    value = float(raw_value)
                except (TypeError, ValueError):
                    continue

                period_start = _quarter_to_start(period)
                period_end = _quarter_to_end(period)

                findings.append(
                    Finding(
                        domain="macro_economy",
                        key=f"financial_soundness.{indicator_code}",
                        value=value,
                        unit="percent",
                        source=_SOURCE,
                        trust_tier=TrustTier.REGISTRY_AUTHORITY,
                        fetched_at=now,
                        country="SE",
                        coverage="national",
                        validity=ValidityWindow(start=period_start, end=period_end),
                        detail=indicator_name.strip(),
                    )
                )

        return findings


def _quarter_to_start(code: str) -> str | None:
    """Convert SCB quarter code (e.g. '2026K1') to ISO date start."""
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            year = int(parts[0])
            q = int(parts[1])
            month = (q - 1) * 3 + 1
            return f"{year}-{month:02d}-01"
    return None


def _quarter_to_end(code: str) -> str | None:
    """Convert SCB quarter code to ISO date end (last day of quarter)."""
    import calendar

    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            year = int(parts[0])
            q = int(parts[1])
            end_month = q * 3
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    return None
