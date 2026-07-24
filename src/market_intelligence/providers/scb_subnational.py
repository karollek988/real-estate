"""SCB sub-national population & employment provider (P-07).

Collects population and employment data at county/municipality level from
Statistics Sweden (SCB) via the PxWebApi v2.

Tables:
- TAB637: Average age by region and sex (1998-2025)
- TAB638: Population by region, marital status, age and sex (1968-2024)
- TAB1267: Population 1 November by region, age and sex (2002-2024)
- TAB5655: Labour market status by region, sex, age and birth region (2020-2025)

Data source: https://statistikdatabasen.scb.se/api/v2/
API: JSON-stat2, no key required, rate-limited to 30 req/10s.
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

_EMPLOYMENT_CONTENTS = {
    "000006J6": "employment_rate",
    "000006J1": "unemployment_rate",
}


class ScbSubnationalProvider(Provider):
    """Collects Swedish sub-national population & employment data from SCB.

    Emits findings for:
    - population: Total population by region (TAB1267, annual)
    - average_age: Average age by region (TAB637, annual)
    - employment_rate: Employment rate by region (TAB5655, annual)
    - unemployment_rate: Unemployment rate by region (TAB5655, annual)
    """

    id = "scb_subnational"
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
                    f"SCB sub-national only covers Sweden, context country "
                    f"is {context.country!r}"
                ),
            )

        findings: list[Finding] = []
        errors: list[str] = []

        for table_id, fetch_fn, parser, label in [
            ("TAB1267", self._fetch_table_get, self._parse_population, "population"),
            ("TAB637", self._fetch_table_get, self._parse_average_age, "average_age"),
            ("TAB5655", self._fetch_table_employment, self._parse_employment, "employment"),
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
                detail="No sub-national data available from SCB",
            )

        status = ProviderStatus.PARTIAL if errors else ProviderStatus.OK
        detail = f"Partial: {'; '.join(errors)}" if errors else None

        return ProviderResult(
            provider_id=self.id,
            status=status,
            findings=findings,
            detail=detail,
        )

    def _fetch_table_get(self, table_id: str) -> object:
        """Fetch a table from SCB PxWebApi v2 via GET."""
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _fetch_table_employment(self, table_id: str) -> object:
        """Fetch TAB5655 via POST with filters to reduce payload size.

        Filters: total sex, total age, total birth region,
        only employment rate and unemployment rate contents codes.
        """
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        body = {
            "query": [
                {
                    "code": "ContentsCode",
                    "selection": {
                        "filter": "item",
                        "values": list(_EMPLOYMENT_CONTENTS.keys()),
                    },
                },
                {
                    "code": "Kon",
                    "selection": {"filter": "item", "values": ["0"]},
                },
                {
                    "code": "Alder",
                    "selection": {"filter": "item", "values": ["0"]},
                },
                {
                    "code": "Fodelseregion",
                    "selection": {"filter": "item", "values": ["0"]},
                },
            ],
            "response": {"format": "json-stat2"},
        }
        return self._client.post_json(url, body=body, timeout_s=15.0)

    def _parse_population(self, data: object) -> list[Finding]:
        """Parse TAB1267: Population 1 November by region, age and sex."""
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
            if region_idx >= len(values):
                continue

            raw_value = values[region_idx]
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
                    domain="regional",
                    key="population",
                    value=value,
                    unit="persons",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage=geo["coverage"],
                    region=geo["region"],
                    county=geo["county"],
                    municipality=geo["municipality"],
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB1267 {period_label}",
                )
            )

        return findings

    def _parse_average_age(self, data: object) -> list[Finding]:
        """Parse TAB637: Average age by region and sex."""
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
            if region_idx >= len(values):
                continue

            raw_value = values[region_idx]
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
                    domain="regional",
                    key="average_age",
                    value=value,
                    unit="years",
                    source=_SOURCE,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage=geo["coverage"],
                    region=geo["region"],
                    county=geo["county"],
                    municipality=geo["municipality"],
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB637 {period_label}",
                )
            )

        return findings

    def _parse_employment(self, data: object) -> list[Finding]:
        """Parse TAB5655: Labour market status (employment/unemployment rates).

        Expected POST-filtered response has dimensions:
        Region × ContentsCode × Tid (other dims eliminated by query).
        """
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
            for contents_code, contents_idx in contents_index.items():
                flat_idx = region_idx * contents_size + contents_idx
                if flat_idx >= len(values):
                    continue

                raw_value = values[flat_idx]
                if raw_value is None:
                    continue

                try:
                    value = float(raw_value)
                except (TypeError, ValueError):
                    continue

                finding_key = _EMPLOYMENT_CONTENTS.get(contents_code)
                if not finding_key:
                    continue

                region_name = region_label.get(region_code, region_code)
                period_label = time_label.get(latest_period, latest_period)
                period_start = f"{latest_period}-01-01"
                period_end = f"{latest_period}-12-31"

                geo = _region_to_geo(region_code, region_name)

                findings.append(
                    Finding(
                        domain="regional",
                        key=finding_key,
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
                        detail=f"TAB5655 {period_label}",
                    )
                )

        return findings


def _region_to_geo(region_code: str, region_name: str) -> dict[str, str | None]:
    """Convert SCB region code to geographic components."""
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
