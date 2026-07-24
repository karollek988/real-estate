"""SCB macro economy provider (P-02).

Collects CPI, inflation, population, employment, and unemployment from
Statistics Sweden (SCB) via the PxWebApi v2. All data is national.

Data source: https://statistikdatabasen.scb.se/api/v2/
API: JSON-stat2, no key required, rate-limited to 30 req/10s.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from enum import StrEnum

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

SCB_RATE_LIMITS: dict[str, float] = {
    "statistikdatabasen.scb.se": 1.0,
}

_SCB_BASE_URL = "https://statistikdatabasen.scb.se/api/v2"


class _Dataset(StrEnum):
    CPI = "cpi"
    POPULATION = "population"
    UNEMPLOYMENT = "unemployment"


_DATASET_CONFIG: dict[_Dataset, dict[str, str]] = {
    _Dataset.CPI: {
        "table": "PR0101A",
        "contents_code": "000004VU",
        "key": "cpi_index",
        "unit": "index_2020=100",
    },
    _Dataset.POPULATION: {
        "table": "BE0101",
        "contents_code": "000002",
        "key": "total_population",
        "unit": "persons",
    },
    _Dataset.UNEMPLOYMENT: {
        "table": "AM0301",
        "contents_code": "000004VU",
        "key": "unemployment_rate",
        "unit": "percent",
    },
}

_SOURCE = Source(
    name="Statistics Sweden (SCB)",
    url="https://www.scb.se/",
    license="CC0 1.0",
)


class ScbMacroEconomyProvider(Provider):
    """Collects macro-economic indicators from Statistics Sweden.

    Fetches CPI, population, and unemployment in parallel HTTP calls.
    Each metric is emitted as a separate finding.
    """

    id = "scb_macro_economy"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=6)
    deadline_s = 30.0
    required_level = GeographicLevel.COUNTRY

    def __init__(self, client: HttpClient, clock=utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: MarketContext) -> ProviderResult:
        if context.country and context.country.upper() not in ("SE", "SVERIGE"):
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=(f"SCB only covers Sweden, context country is " f"{context.country!r}"),
            )

        now = self._clock().isoformat()
        all_findings: list[Finding] = []
        errors: list[str] = []

        for dataset in _Dataset:
            config = _DATASET_CONFIG[dataset]
            try:
                data = self._fetch_table(config["table"])
                findings = self._parse_json_stat(data, dataset, config, now)
                all_findings.extend(findings)
            except HttpError as exc:
                logger.warning("SCB %s API error: %s", dataset.value, exc)
                errors.append(f"{dataset.value}: HTTP {exc.status}")
            except Exception as exc:
                logger.warning("SCB %s parse error: %s", dataset.value, exc)
                errors.append(f"{dataset.value}: {type(exc).__name__}")

        if not all_findings and errors:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"All SCB datasets failed: {'; '.join(errors)}",
            )

        if not all_findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="No data available from SCB",
            )

        status = ProviderStatus.PARTIAL if errors else ProviderStatus.OK
        detail = f"Partial: {'; '.join(errors)}" if errors else None

        return ProviderResult(
            provider_id=self.id,
            status=status,
            findings=all_findings,
            detail=detail,
        )

    def _fetch_table(self, table_id: str) -> object:
        """Fetch the latest data from an SCB PxWeb table."""
        url = f"{_SCB_BASE_URL}/tables/{table_id}/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _parse_json_stat(
        self,
        data: object,
        dataset: _Dataset,
        config: dict[str, str],
        now: str,
    ) -> list[Finding]:
        """Parse a JSON-stat2 response into findings."""
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
        time_label = time_categories.get("label", {})

        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        if not time_periods:
            return []

        latest_period = time_periods[-1]
        latest_idx = time_index[latest_period]

        if latest_idx >= len(values):
            return []

        latest_value = values[latest_idx]
        if latest_value is None:
            return []

        period_label = time_label.get(latest_period, latest_period)
        period_start = _scb_period_to_start(latest_period)
        period_end = _scb_period_to_end(latest_period)

        return [
            Finding(
                domain="macro_economy",
                key=config["key"],
                value=float(latest_value),
                unit=config["unit"],
                source=_SOURCE,
                trust_tier=TrustTier.REGISTRY_AUTHORITY,
                fetched_at=now,
                country="SE",
                coverage="national",
                validity=ValidityWindow(start=period_start, end=period_end),
                detail=period_label,
            )
        ]


def _scb_period_to_start(code: str) -> str | None:
    """Convert SCB period code to ISO start date.

    Handles: '2026M01' (monthly), '2026K1' (quarterly), '2026' (annual).
    """
    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            return f"{parts[0]}-{parts[1].zfill(2)}-01"
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            quarter = int(parts[1])
            month = (quarter - 1) * 3 + 1
            return f"{parts[0]}-{month:02d}-01"
    if code.isdigit() and len(code) == 4:
        return f"{code}-01-01"
    return None


def _scb_period_to_end(code: str) -> str | None:
    """Convert SCB period code to ISO end date."""
    import calendar

    if "M" in code:
        parts = code.split("M")
        if len(parts) == 2:
            year = int(parts[0])
            month = int(parts[1])
            last_day = calendar.monthrange(year, month)[1]
            return f"{year}-{month:02d}-{last_day:02d}"
    if "K" in code:
        parts = code.split("K")
        if len(parts) == 2:
            year = int(parts[0])
            quarter = int(parts[1])
            end_month = quarter * 3
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    if code.isdigit() and len(code) == 4:
        return f"{code}-12-31"
    return None
