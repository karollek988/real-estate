"""SCB Municipality provider (task M-01, provider P4a).

Port of the proven `scbDemographicsProvider` TS provider (`frontend/src/lib/
analysis/providers/scb.ts`) with its three pre-fixed bugs carried forward
verbatim (doc 28, design rules #2/#3 in doc 38):

1. Region/Tid column order is always resolved from the table's own
   `variables` metadata, never assumed.
2. The latest available `Tid` year is read from that metadata, never
   computed as `currentYear - 1` (SCB tables lag real time unevenly).
3. Kommun name -> SCB region code match is exact-4-digit-code lookup
   against the table's own `Region` variable, not a separate register.

Reports, only when the query returns a value: population_total,
population_growth_5yr_pct (growth over the most recent 5-year span the
table's own Tid axis actually has), median_income_sek_thousands,
share_post_secondary_education_pct. All findings are tagged
`coverage: kommun-level` (task M-01/P4 requirement) — never per-address.
"""

from __future__ import annotations

import json

from location_intelligence.context import AddressContext
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
from location_intelligence.providers.base import Provider, Stage

POPULATION_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/BE/BE0101/BE0101A/BefolkningNy"
INCOME_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/HE/HE0110/HE0110A/NetInk02"
EDUCATION_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/UF/UF0506/UF0506B/Utbildning"

_POST_SECONDARY_LEVELS = {"5", "6", "7"}

_SOURCE = Source(
    name="Statistics Sweden (SCB) PxWeb",
    url="https://www.scb.se/en/services/open-data-api/",
    license="Open data, source attribution required",
)

_COVERAGE = "kommun-level"


class ScbMunicipalityProvider(Provider):
    id = "scb_municipality"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    deadline_s = 15.0

    def __init__(self, client: HttpClient, clock: Clock = utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.municipality_code is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no municipality resolved for this address yet",
            )
        region_code = context.municipality_code
        fetched_at = self._clock().isoformat()
        findings: list[Finding] = []
        errors: list[str] = []

        try:
            findings.extend(self._population_findings(region_code, fetched_at))
        except (HttpError, OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"population: {exc}")

        try:
            findings.extend(self._income_findings(region_code, fetched_at))
        except (HttpError, OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"income: {exc}")

        try:
            findings.extend(self._education_findings(region_code, fetched_at))
        except (HttpError, OSError, ValueError, KeyError, TypeError) as exc:
            errors.append(f"education: {exc}")

        if not findings:
            detail = "; ".join(errors) if errors else "SCB returned no data for this municipality"
            return ProviderResult(provider_id=self.id, status=ProviderStatus.NO_DATA, detail=detail)

        if errors:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.PARTIAL,
                findings=findings,
                detail="; ".join(errors),
            )
        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _population_findings(self, region_code: str, fetched_at: str) -> list[Finding]:
        meta = self._client.get_json(POPULATION_TABLE)
        latest_year = _latest_year(meta)
        if latest_year is None:
            return []

        latest = _sum_values(
            self._query_pxweb(
                POPULATION_TABLE,
                [
                    {"code": "Region", "values": [region_code]},
                    {"code": "Civilstand", "values": ["OG", "G", "ÄNKL", "SK"]},
                    {"code": "Alder", "values": ["tot"]},
                    {"code": "Kon", "values": ["1", "2"]},
                    {"code": "ContentsCode", "values": ["BE0101N1"]},
                    {"code": "Tid", "values": [latest_year]},
                ],
            )
        )
        if latest is None:
            return []

        findings = [
            Finding(
                domain="municipality",
                key="population_total",
                value=round(latest),
                unit="people",
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage=_COVERAGE,
                validity=None,
                detail=f"SCB Tid={latest_year}",
            )
        ]

        past_year = str(int(latest_year) - 5)
        past = _sum_values(
            self._query_pxweb(
                POPULATION_TABLE,
                [
                    {"code": "Region", "values": [region_code]},
                    {"code": "Civilstand", "values": ["OG", "G", "ÄNKL", "SK"]},
                    {"code": "Alder", "values": ["tot"]},
                    {"code": "Kon", "values": ["1", "2"]},
                    {"code": "ContentsCode", "values": ["BE0101N1"]},
                    {"code": "Tid", "values": [past_year]},
                ],
            )
        )
        if past is not None and past > 0:
            growth_pct = round(((latest - past) / past) * 100, 1)
            findings.append(
                Finding(
                    domain="municipality",
                    key="population_growth_5yr_pct",
                    value=growth_pct,
                    unit="percent",
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage=_COVERAGE,
                    detail=f"SCB Tid {past_year}->{latest_year}",
                )
            )
        return findings

    def _income_findings(self, region_code: str, fetched_at: str) -> list[Finding]:
        meta = self._client.get_json(INCOME_TABLE)
        latest_year = _latest_year(meta)
        if latest_year is None:
            return []
        response = self._query_pxweb(
            INCOME_TABLE,
            [
                {"code": "Region", "values": [region_code]},
                {"code": "Kon", "values": ["1+2"]},
                {"code": "Alder", "values": ["20+"]},
                {"code": "ContentsCode", "values": ["000001ON"]},
                {"code": "Tid", "values": [latest_year]},
            ],
        )
        data = response.get("data") if isinstance(response, dict) else None
        if not data or not isinstance(data, list):
            return []
        try:
            value = float(data[0]["values"][0])
        except (KeyError, IndexError, ValueError, TypeError):
            return []
        return [
            Finding(
                domain="municipality",
                key="median_income_sek_thousands",
                value=value,
                unit="SEK thousands",
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage=_COVERAGE,
                detail=f"SCB Tid={latest_year}",
            )
        ]

    def _education_findings(self, region_code: str, fetched_at: str) -> list[Finding]:
        meta = self._client.get_json(EDUCATION_TABLE)
        latest_year = _latest_year(meta)
        if latest_year is None:
            return []
        response = self._query_pxweb(
            EDUCATION_TABLE,
            [
                {"code": "Region", "values": [region_code]},
                {"code": "Kon", "values": ["1", "2"]},
                {"code": "UtbildningsNiva", "values": ["1", "2", "3", "4", "5", "6", "7"]},
                {"code": "Tid", "values": [latest_year]},
            ],
        )
        if not isinstance(response, dict):
            return []
        data = response.get("data")
        if not isinstance(data, list) or not data:
            return []
        level_idx = _column_index(response, "UtbildningsNiva")
        if level_idx is None:
            return []

        post_secondary = 0.0
        total = 0.0
        for row in data:
            key = row.get("key") if isinstance(row, dict) else None
            values = row.get("values") if isinstance(row, dict) else None
            if not isinstance(key, list) or not isinstance(values, list) or level_idx >= len(key):
                continue
            try:
                n = float(values[0])
            except (ValueError, TypeError, IndexError):
                continue
            total += n
            if key[level_idx] in _POST_SECONDARY_LEVELS:
                post_secondary += n

        if total <= 0:
            return []
        share = round((post_secondary / total) * 1000) / 10
        return [
            Finding(
                domain="municipality",
                key="share_post_secondary_education_pct",
                value=share,
                unit="percent",
                source=_SOURCE,
                trust_tier=self.trust_tier,
                fetched_at=fetched_at,
                coverage=_COVERAGE,
                detail=f"SCB Tid={latest_year}",
            )
        ]

    def _query_pxweb(self, table_url: str, query: list[dict[str, str | list[str]]]) -> object:
        body = {
            "query": [
                {"code": q["code"], "selection": {"filter": "item", "values": q["values"]}}
                for q in query
            ],
            "response": {"format": "json"},
        }
        payload = self._client.post_text(
            table_url,
            body=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        return json.loads(payload)


def _latest_year(meta: object) -> str | None:
    if not isinstance(meta, dict):
        return None
    variables = meta.get("variables")
    if not isinstance(variables, list):
        return None
    for var in variables:
        if isinstance(var, dict) and var.get("code") == "Tid":
            values = var.get("values")
            if isinstance(values, list) and values:
                return str(values[-1])
    return None


def _column_index(response: dict[str, object], code: str) -> int | None:
    columns = response.get("columns")
    if not isinstance(columns, list):
        return None
    for i, column in enumerate(columns):
        if isinstance(column, dict) and column.get("code") == code:
            return i
    return None


def _sum_values(response: object) -> float | None:
    if not isinstance(response, dict):
        return None
    data = response.get("data")
    if not isinstance(data, list) or not data:
        return None
    total = 0.0
    for row in data:
        values = row.get("values") if isinstance(row, dict) else None
        if not isinstance(values, list) or not values:
            return None
        try:
            n = float(values[0])
        except (ValueError, TypeError):
            return None
        total += n
    return total
