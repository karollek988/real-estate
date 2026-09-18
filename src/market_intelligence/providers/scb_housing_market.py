"""SCB housing market provider (P-06).

Collects comprehensive Swedish housing market data from SCB PxWebApi v2:
- Real estate price index for one/two-dwelling buildings (TAB1150, quarterly)
- Sold dwellings / transaction volume (TAB1167, quarterly)
- New construction completions (TAB4572, quarterly)

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

_SOURCE_PRICE_INDEX = Source(
    name="Statistics Sweden (SCB)",
    url="https://www.scb.se/",
    license="CC0 1.0",
)

_SOURCE_SOLD = Source(
    name="Statistics Sweden (SCB)",
    url="https://www.scb.se/",
    license="CC0 1.0",
)

_SOURCE_CONSTRUCTION = Source(
    name="Statistics Sweden (SCB)",
    url="https://www.scb.se/",
    license="CC0 1.0",
)


class ScbHousingMarketProvider(Provider):
    """Collects Swedish housing market data from SCB.

    Emits findings for:
    - house_price_index: Real estate price index (TAB1150)
    - transactions: Number of sold dwellings (TAB1167)
    - new_construction: Completed dwellings (TAB4572)
    """

    id = "scb_housing_market"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=24)
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
                detail=(
                    f"SCB housing market only covers Sweden, context country "
                    f"is {context.country!r}"
                ),
            )

        findings: list[Finding] = []
        errors: list[str] = []

        for table_id, parser, label in [
            ("TAB1150", self._parse_price_index, "price_index"),
            ("TAB1167", self._parse_transactions, "transactions"),
            ("TAB4572", self._parse_construction, "construction"),
        ]:
            try:
                data = self._fetch_table(table_id)
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
                detail="No housing market data available from SCB",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
            detail="; ".join(errors) if errors else None,
        )

    def _fetch_table(self, table_id: str) -> object:
        """Fetch a table from SCB PxWebApi v2."""
        url = f"{_SCB_API_BASE}/tables/{table_id}/data"
        params = {
            "lang": "en",
            "outputFormat": "json-stat2",
            "omitStubNotes": "true",
        }
        return self._client.get_json(url, params=params, timeout_s=15.0)

    def _parse_price_index(self, data: object) -> list[Finding]:
        """Parse TAB1150: Real estate price index (quarterly), one series per region.

        The table carries a `Region` dimension (national total "00" plus 3
        metro areas and 8 NUTS2-style macro-regions) that earlier code
        silently ignored, indexing `value` as if `Tid` were the only
        dimension. That happened to still read the correct national figures
        (Region "00" is index 0 in JSON-stat2's row-major flattening, and
        `ContentsCode` here has exactly one category, so `value[tid_idx]`
        and `value[0*len(Tid) + tid_idx]` are the same cell) - but it was
        correct by coincidence, not by construction, and it silently
        discarded the regional breakdown entirely. This resolves each cell
        by its actual flat index (`region_idx * n_periods + period_idx`,
        given ContentsCode's single category contributes no offset), so it
        stays correct even if SCB reorders regions, and yields every
        region's series instead of only "00" (Sweden) - `marketIntelligence.ts`
        currently only consumes the "00" rows, but Greater Stockholm/
        Gothenburg/Malmö (0010/0020/0030) and the 8 riksområden are real,
        available data for a future, more granular bridge.

        Scoped to this one table deliberately: TAB4572 (construction) has a
        4th dimension (`Hustyp`) this decoder doesn't account for, and
        nothing downstream consumes it yet - not worth the added complexity
        until it is.
        """
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        region_index: dict[str, int] = dim.get("Region", {}).get("category", {}).get("index", {}) or {"00": 0}
        region_labels: dict[str, str] = dim.get("Region", {}).get("category", {}).get("label", {})
        n_contents = max(len(dim.get("ContentsCode", {}).get("category", {}).get("index", {})), 1)
        time_index: dict[str, int] = dim.get("Tid", {}).get("category", {}).get("index", {})
        n_periods = len(time_index)

        value_list = data.get("value", [])
        if not value_list or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        stride = n_periods * n_contents

        for period, period_idx in sorted(time_index.items(), key=lambda kv: kv[1]):
            for region_code, region_idx in region_index.items():
                flat_idx = region_idx * stride + period_idx
                if flat_idx >= len(value_list) or value_list[flat_idx] is None:
                    continue
                try:
                    value = float(value_list[flat_idx])
                except (TypeError, ValueError):
                    continue

                region_name = region_labels.get(region_code, region_code)
                findings.append(
                    Finding(
                        domain="housing_market",
                        key="house_price_index",
                        value=value,
                        unit="index_1981_100",
                        source=_SOURCE_PRICE_INDEX,
                        trust_tier=TrustTier.REGISTRY_AUTHORITY,
                        fetched_at=now,
                        country="SE",
                        coverage="national" if region_code == "00" else "region",
                        region=region_code,
                        validity=ValidityWindow(start=_quarter_to_start(period), end=_quarter_to_end(period)),
                        detail=f"TAB1150 quarterly {period}, region={region_name} ({region_code})",
                    )
                )
        return findings

    def _parse_transactions(self, data: object) -> list[Finding]:
        """Parse TAB1167: Sold dwellings (quarterly)."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        time_dim = dim.get("Tid", {})
        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})

        value_list = data.get("value", [])
        if not value_list or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        for period in time_periods:
            period_idx = time_index[period]
            if period_idx >= len(value_list):
                continue

            raw_value = value_list[period_idx]
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
                    domain="housing_market",
                    key="transactions",
                    value=value,
                    unit="count",
                    source=_SOURCE_SOLD,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage="national",
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB1167 quarterly {period}",
                )
            )

        return findings

    def _parse_construction(self, data: object) -> list[Finding]:
        """Parse TAB4572: New construction completions (quarterly)."""
        if not isinstance(data, dict):
            raise ValueError(f"expected dict, got {type(data).__name__}")

        dim = data.get("dimension", {})
        time_dim = dim.get("Tid", {})
        time_cat = time_dim.get("category", {})
        time_index = time_cat.get("index", {})

        value_list = data.get("value", [])
        if not value_list or not time_index:
            return []

        now = self._clock().isoformat()
        findings: list[Finding] = []
        time_periods = sorted(time_index.keys(), key=lambda k: time_index[k])

        for period in time_periods:
            period_idx = time_index[period]
            if period_idx >= len(value_list):
                continue

            raw_value = value_list[period_idx]
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
                    domain="housing_market",
                    key="new_construction",
                    value=value,
                    unit="dwellings",
                    source=_SOURCE_CONSTRUCTION,
                    trust_tier=TrustTier.REGISTRY_AUTHORITY,
                    fetched_at=now,
                    country="SE",
                    coverage="national",
                    validity=ValidityWindow(start=period_start, end=period_end),
                    detail=f"TAB4572 quarterly {period}",
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
    """Convert SCB quarter code to ISO date end."""
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
