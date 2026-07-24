"""Municipal economics provider (P-09).

Collects municipality-level economic indicators from Statistics Sweden (SCB)
PxWebApi v2: employment, disposable income, and municipal tax rates.

These data points answer: "Is the local economy healthy? What will my
ongoing costs look like?"

Tables:
- TAB6383: Employment by municipality (2022-2024)
- TAB1792: Disposable income by municipality (1997-2023)
- TAB2017: Municipal tax rates (2000-2026)

Data source: https://statistikdatabasen.scb.se/api/v2/
API: JSON-stat2, no key required.
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


class MunicipalEconomicsProvider(Provider):
    """Collects municipality-level economic indicators from SCB.

    Emits findings for:
    - employment_rate: Employment rate by municipality (TAB6383)
    - disposable_income: Disposable income per capita by municipality (TAB1792)
    - municipal_tax_rate: Municipal tax rate by municipality (TAB2017)
    """

    id = "municipal_economics"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=24)
    deadline_s = 45.0
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
                    f"SCB municipal economics only covers Sweden, "
                    f"context country is {context.country!r}"
                ),
            )

        findings: list[Finding] = []
        errors: list[str] = []

        for table_id, fetch_fn, parser, label in [
            ("TAB6383", self._fetch_employment, self._parse_employment, "employment"),
            ("TAB1792", self._fetch_income, self._parse_income, "income"),
            ("TAB2017", self._fetch_tax_rates, self._parse_tax_rates, "tax_rates"),
        ]:
            try:
                data = fetch_fn(table_id)
                table_findings = parser(data)
                findings.extend(table_findings)
            except HttpError as exc:
                errors.append(f"{label}: HTTP {exc}")
                logger.warning("SCB %s fetch failed: %s", label, exc)
            except Exception as exc:
                errors.append(f"{label}: {type(exc).__name__}: {exc}")
                logger.warning("SCB %s parse failed: %s", label, exc)

        if not findings and errors:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"All SCB tables failed: {'; '.join(errors)}",
            )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="No municipal economics data available from SCB",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
            detail="; ".join(errors) if errors else None,
        )

    def _fetch_employment(self, table_id: str) -> object:
        """Fetch TAB6383: Employment by municipality."""
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        body = {
            "query": [
                {
                    "code": "ContentsCode",
                    "selection": {
                        "filter": "item",
                        "values": ["000006J6"],
                    },
                },
                {
                    "code": "Kon",
                    "selection": {"filter": "item", "values": ["0"]},
                },
            ],
            "response": {"format": "json-stat2"},
        }
        return self._client.post_json(url, body=body, timeout_s=15.0)

    def _fetch_income(self, table_id: str) -> object:
        """Fetch TAB1792: Disposable income by municipality."""
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        body = {
            "query": [
                {
                    "code": "ContentsCode",
                    "selection": {
                        "filter": "item",
                        "values": ["00000VEK"],
                    },
                },
            ],
            "response": {"format": "json-stat2"},
        }
        return self._client.post_json(url, body=body, timeout_s=15.0)

    def _fetch_tax_rates(self, table_id: str) -> object:
        """Fetch TAB2017: Municipal tax rates."""
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _parse_employment(self, data: object) -> list[Finding]:
        """Parse TAB6383: Employment by municipality."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        region_dim = dim.get("Region", {})
        time_dim = dim.get("Tid", {})

        region_cat = region_dim.get("category", {})
        region_index = region_cat.get("index", {})
        region_label = region_cat.get("label", {})

        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})
        time_label = time_cat.get("label", {})

        values = data.get("value", [])
        if not values or not region_index or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        if not time_periods:
            return []

        latest_period = time_periods[-1]

        for region_code, region_idx in region_index.items():
            period_idx = time_index.get(latest_period)
            if period_idx is None:
                continue

            flat_idx = region_idx * len(time_periods) + period_idx
            if flat_idx >= len(values):
                continue

            raw_value = values[flat_idx]
            if raw_value is None:
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            region_name = region_label.get(region_code, region_code)
            period_label = time_label.get(latest_period, latest_period)
            period_start = f"{latest_period}-01-01"
            period_end = f"{latest_period}-12-31"

            geo = _region_to_geo(region_code, region_name)

            findings.append(
                Finding(
                    domain="municipal_economics",
                    key="employment_rate",
                    value=value,
                    unit="percent",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage=geo["coverage"],
                    region=geo["region"],
                    county=geo["county"],
                    municipality=geo["municipality"],
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB6383 {period_label}",
                )
            )

        return findings

    def _parse_income(self, data: object) -> list[Finding]:
        """Parse TAB1792: Disposable income by municipality."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        region_dim = dim.get("Region", {})
        time_dim = dim.get("Tid", {})

        region_cat = region_dim.get("category", {})
        region_index = region_cat.get("index", {})
        region_label = region_cat.get("label", {})

        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})
        time_label = time_cat.get("label", {})

        values = data.get("value", [])
        if not values or not region_index or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        if not time_periods:
            return []

        latest_period = time_periods[-1]

        for region_code, region_idx in region_index.items():
            period_idx = time_index.get(latest_period)
            if period_idx is None:
                continue

            flat_idx = region_idx * len(time_periods) + period_idx
            if flat_idx >= len(values):
                continue

            raw_value = values[flat_idx]
            if raw_value is None:
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            region_name = region_label.get(region_code, region_code)
            period_label = time_label.get(latest_period, latest_period)
            period_start = f"{latest_period}-01-01"
            period_end = f"{latest_period}-12-31"

            geo = _region_to_geo(region_code, region_name)

            findings.append(
                Finding(
                    domain="municipal_economics",
                    key="disposable_income_per_capita",
                    value=value,
                    unit="SEK",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage=geo["coverage"],
                    region=geo["region"],
                    county=geo["county"],
                    municipality=geo["municipality"],
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB1792 {period_label}",
                )
            )

        return findings

    def _parse_tax_rates(self, data: object) -> list[Finding]:
        """Parse TAB2017: Municipal tax rates."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        region_dim = dim.get("Region", {})
        time_dim = dim.get("Tid", {})
        contents_dim = dim.get("ContentsCode", {})

        region_cat = region_dim.get("category", {})
        region_index = region_cat.get("index", {})
        region_label = region_cat.get("label", {})

        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})
        time_label = time_cat.get("label", {})

        contents_cat = contents_dim.get("category", {})
        contents_index = contents_cat.get("index", {})

        values = data.get("value", [])
        if not values or not region_index or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        if not time_periods:
            return []

        latest_period = time_periods[-1]
        contents_size = len(contents_index) if contents_index else 1

        for region_code, region_idx in region_index.items():
            period_idx = time_index.get(latest_period)
            if period_idx is None:
                continue

            flat_idx = region_idx * contents_size * len(time_periods) + period_idx
            if flat_idx >= len(values):
                continue

            raw_value = values[flat_idx]
            if raw_value is None:
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            region_name = region_label.get(region_code, region_code)
            period_label = time_label.get(latest_period, latest_period)
            period_start = f"{latest_period}-01-01"
            period_end = f"{latest_period}-12-31"

            geo = _region_to_geo(region_code, region_name)

            findings.append(
                Finding(
                    domain="municipal_economics",
                    key="municipal_tax_rate",
                    value=value,
                    unit="percent",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage=geo["coverage"],
                    region=geo["region"],
                    county=geo["county"],
                    municipality=geo["municipality"],
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB2017 {period_label}",
                )
            )

        return findings


def _region_to_geo(region_code: str, region_name: str) -> dict[str, str | None]:
    """Convert SCB region code to geographic components.

    SCB codes:
    - "00" = national total
    - 2-digit = county (e.g. "01" = Stockholms län)
    - 4-digit = municipality (e.g. "0180" = Stockholm municipality)
    """
    if region_code == "00":
        return {
            "coverage": "national",
            "region": "Sweden",
            "county": None,
            "municipality": None,
        }

    if len(region_code) == 2:
        return {
            "coverage": "county",
            "region": region_name,
            "county": region_name,
            "municipality": None,
        }

    if len(region_code) == 4:
        return {
            "coverage": "municipality",
            "region": region_name,
            "county": None,
            "municipality": region_name,
        }

    return {
        "coverage": "unknown",
        "region": region_name,
        "county": None,
        "municipality": None,
    }
