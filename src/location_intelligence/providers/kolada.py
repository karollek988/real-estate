"""Kolada provider (task M-02, provider P4b).

Kolada (RKA — Rådet för främjande av kommunala analyser) publishes ~5,000
municipal KPIs, keyed by the same 4-digit kommun code SCB uses. This
provider selects ten decision-relevant KPIs (economy, schools, safety,
housing, civic life — doc 36 §2.2's "Kolada municipal KPIs" scope) rather
than the whole catalog: home buyers need a handful of comparable signals,
not a statistics dump.

Each KPI's latest published `period` is resolved from the KPI's own data
response (never assumed as "this year"), same discipline as the SCB
provider's `Tid` handling — Kolada KPIs publish on independent schedules.
"""

from __future__ import annotations

from dataclasses import dataclass

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

KOLADA_BASE_URL = "https://api.kolada.se/v3"

_SOURCE = Source(
    name="Kolada (RKA)",
    url="https://www.kolada.se",
    license="Open data",
)

_COVERAGE = "kommun-level"


@dataclass(frozen=True, slots=True)
class _Kpi:
    id: str
    key: str
    label: str
    unit: str


#: Ten decision-relevant KPIs (doc 38 M-02: "~10 decision-relevant KPIs").
KPIS: tuple[_Kpi, ...] = (
    _Kpi("N01963", "population_change_yoy_pct", "Population change vs. previous year", "percent"),
    _Kpi("N00900", "municipal_tax_rate_pct", "Total municipal tax rate", "percent"),
    _Kpi(
        "N15507",
        "grade9_merit_value",
        "Grade 9 school results, home municipality (avg. of 17 subjects)",
        "points",
    ),
    _Kpi("N02281", "unemployment_native_born_pct", "Unemployment, native-born, 20-64", "percent"),
    _Kpi("N00301", "safety_security_index", "Safety & security index", "index"),
    _Kpi(
        "N07956",
        "rental_housing_share_pct",
        "Rental apartments, share of housing stock",
        "percent",
    ),
    _Kpi("N11701", "preschool_group_size", "Children per group in preschool", "children"),
    _Kpi("N05401", "voter_turnout_pct", "Voter turnout, latest municipal election", "percent"),
    _Kpi(
        "N07803", "bike_path_m_per_capita", "Bike path length per inhabitant", "meters/inhabitant"
    ),
    _Kpi("N00304", "income_wealth_index", "Income & wealth index", "index"),
)


class KoladaProvider(Provider):
    id = "kolada"
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

        fetched_at = self._clock().isoformat()
        findings: list[Finding] = []
        errors: list[str] = []

        for kpi in KPIS:
            try:
                finding = self._fetch_kpi(kpi, context.municipality_code, fetched_at)
            except (HttpError, OSError, ValueError, KeyError, TypeError) as exc:
                errors.append(f"{kpi.key}: {exc}")
                continue
            if finding is not None:
                findings.append(finding)

        if not findings:
            detail = (
                "; ".join(errors) if errors else "Kolada returned no data for this municipality"
            )
            return ProviderResult(provider_id=self.id, status=ProviderStatus.NO_DATA, detail=detail)

        if errors:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.PARTIAL,
                findings=findings,
                detail="; ".join(errors),
            )
        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)

    def _fetch_kpi(self, kpi: _Kpi, municipality_code: str, fetched_at: str) -> Finding | None:
        payload = self._client.get_json(
            f"{KOLADA_BASE_URL}/data/kpi/{kpi.id}/municipality/{municipality_code}"
        )
        if not isinstance(payload, dict):
            return None
        values = payload.get("values")
        if not isinstance(values, list) or not values:
            return None

        latest = max(
            (v for v in values if isinstance(v, dict) and isinstance(v.get("period"), int)),
            key=lambda v: v["period"],
            default=None,
        )
        if latest is None:
            return None

        period_values = latest.get("values")
        if not isinstance(period_values, list) or not period_values:
            return None

        total = next(
            (v for v in period_values if isinstance(v, dict) and v.get("gender") == "T"),
            period_values[0] if isinstance(period_values[0], dict) else None,
        )
        if total is None or not isinstance(total.get("value"), int | float):
            return None

        return Finding(
            domain="municipality",
            key=kpi.key,
            value=total["value"],
            unit=kpi.unit,
            source=_SOURCE,
            trust_tier=self.trust_tier,
            fetched_at=fetched_at,
            coverage=_COVERAGE,
            detail=f"{kpi.label} (Kolada {kpi.id}, period={latest['period']})",
        )
