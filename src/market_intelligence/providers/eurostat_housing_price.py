"""Eurostat housing price index provider (P-05).

Collects the EU House Price Index from Eurostat's SDMX 2.1 API.
Provides quarterly housing price data for Sweden and other EU countries,
enabling international comparison of housing market trends.

Data source: https://ec.europa.eu/eurostat/
API: SDMX 2.1 Dissemination, TSV format, no key required.
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

EUROSTAT_HOST = "ec.europa.eu"
EUROSTAT_RATE_LIMITS: dict[str, float] = {EUROSTAT_HOST: 2.0}

_EUROSTAT_BASE = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1"

_SOURCE = Source(
    name="Eurostat",
    url="https://ec.europa.eu/eurostat/",
    license="CC BY 4.0",
)

# Country codes to query for context
_EU_COUNTRY_CODES = {
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "FI": "Finland",
    "DE": "Germany",
    "FR": "France",
    "NL": "Netherlands",
    "BE": "Belgium",
    "AT": "Austria",
    "ES": "Spain",
    "IT": "Italy",
    "PT": "Portugal",
    "IE": "Ireland",
    "PL": "Poland",
    "CZ": "Czechia",
    "HU": "Hungary",
    "RO": "Romania",
    "BG": "Bulgaria",
    "HR": "Croatia",
    "SK": "Slovakia",
    "SI": "Slovenia",
    "EE": "Estonia",
    "LV": "Latvia",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "MT": "Malta",
    "CY": "Cyprus",
    "GR": "Greece",
    "GB": "United Kingdom",
    "CH": "Switzerland",
}


class EurostatHousingPriceProvider(Provider):
    """Collects EU House Price Index from Eurostat.

    Provides quarterly housing price index data (2015=100 baseline)
    for Sweden and comparable EU/EEA countries.
    """

    id = "eurostat_housing_price"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = timedelta(hours=24)
    deadline_s = 20.0
    required_level = GeographicLevel.COUNTRY

    def __init__(self, client: HttpClient, clock=utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: MarketContext) -> ProviderResult:
        country = context.country.upper() if context.country else "SE"
        if country in ("SVERIGE", "SWEDEN"):
            country = "SE"

        if country not in _EU_COUNTRY_CODES:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=f"Eurostat HPI does not cover country {country!r}",
            )

        geo_codes = self._select_geo_codes(country)

        try:
            data = self._fetch_hpi(geo_codes)
        except HttpError as exc:
            logger.warning("Eurostat API error: %s", exc)
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"HTTP error: {exc}",
            )
        except Exception as exc:
            logger.exception("Eurostat provider failed")
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )

        try:
            findings = self._parse_tsv(data, country)
        except (KeyError, TypeError, ValueError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Failed to parse Eurostat response: {exc}",
            )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="No housing price data available from Eurostat",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )

    def _select_geo_codes(self, country: str) -> list[str]:
        """Select relevant geo codes for comparison."""
        codes = [country]
        peers = {"SE": ["NO", "DK", "FI", "DE", "NL", "EU"]}
        for peer in peers.get(country, ["EU"]):
            if peer not in codes:
                codes.append(peer)
        return codes

    def _fetch_hpi(self, geo_codes: list[str]) -> str:
        """Fetch House Price Index from Eurostat SDMX 2.1 as TSV."""
        geo_filter = ",".join(geo_codes)
        url = f"{_EUROSTAT_BASE}/data/prc_hpi_q"
        params = {
            "geo": geo_filter,
            "sinceTimePeriod": "2020",
            "format": "TSV",
        }
        return self._client.get_text(url, params=params, timeout_s=15.0)

    def _parse_tsv(self, raw: str, primary_country: str) -> list[Finding]:
        """Parse Eurostat TSV into findings."""
        lines = raw.strip().split("\n")
        if len(lines) < 2:
            return []

        header = lines[0]
        time_periods = [t.strip() for t in header.split("\t")[1:] if t.strip()]

        now = self._clock().isoformat()
        findings: list[Finding] = []

        for line in lines[1:]:
            if not line.strip():
                continue

            parts = line.split("\t")
            if len(parts) < 2:
                continue

            row_key = parts[0]
            row_parts = row_key.split(",")
            if len(row_parts) < 4:
                continue

            freq = row_parts[0]
            purchase = row_parts[1]
            _unit = row_parts[2]
            geo = row_parts[3]

            if freq != "Q" or purchase != "DW_EXST":
                continue

            country_name = _EU_COUNTRY_CODES.get(geo, geo)
            is_primary = geo == primary_country

            for idx, raw_val in enumerate(parts[1:]):
                if idx >= len(time_periods):
                    break

                val_str = raw_val.strip()
                if not val_str or val_str in (":", ": @N"):
                    continue

                clean_val = val_str.split()[0] if val_str.split() else ""
                if not clean_val or clean_val in (":", ": @N"):
                    continue

                try:
                    value = float(clean_val)
                except ValueError:
                    continue

                period = time_periods[idx]
                period_start = _quarter_to_start_eu(period)
                period_end = _quarter_to_end_eu(period)

                coverage = "national" if is_primary else "international"
                detail_parts = ["hpi_2015=100"]
                if not is_primary:
                    detail_parts.append(country_name)

                findings.append(
                    Finding(
                        domain="housing_market",
                        key="house_price_index",
                        value=value,
                        unit="index_2015_100",
                        source=_SOURCE,
                        trust_tier=TrustTier.REGISTRY_AUTHORITY,
                        fetched_at=now,
                        country=geo,
                        coverage=coverage,
                        validity=ValidityWindow(start=period_start, end=period_end),
                        detail=" ".join(detail_parts),
                    )
                )

        return findings


def _quarter_to_start_eu(period: str) -> str | None:
    """Convert EU period string (e.g. '2025-Q3') to ISO date start."""
    if "-Q" in period:
        parts = period.split("-Q")
        if len(parts) == 2:
            year = int(parts[0])
            q = int(parts[1])
            month = (q - 1) * 3 + 1
            return f"{year}-{month:02d}-01"
    return None


def _quarter_to_end_eu(period: str) -> str | None:
    """Convert EU period string to ISO date end."""
    import calendar

    if "-Q" in period:
        parts = period.split("-Q")
        if len(parts) == 2:
            year = int(parts[0])
            q = int(parts[1])
            end_month = q * 3
            last_day = calendar.monthrange(year, end_month)[1]
            return f"{year}-{end_month:02d}-{last_day:02d}"
    return None
