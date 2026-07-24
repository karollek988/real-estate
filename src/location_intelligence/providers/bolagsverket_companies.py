"""Bolagsverket company statistics provider (task G-01, provider P12a).

"Is business activity growing in this area?" — Bolagsverket publishes a
monthly open-data CSV (`ftgstat_oppna.csv`, CC BY 2.5 SE, confirmed live)
of company registration events per kommun, broken down by legal form
(aktiebolag, handelsbolag, ...). No API, no per-address signal — kommun
level only, exactly the shape doc 36 §2.8 found: the best available
*area*-level business-activity proxy, not a "new business opened near
you" feed (which doesn't exist in Sweden).

**Field-meaning caveat**: Bolagsverket's own technical description of
this file's `handelse` (event) codes sits behind a CAPTCHA wall this
provider could not get past. The three codes are labeled here from the
data's own magnitude pattern, verified live for Stockholm kommun's most
recent month — `handelse=2` values run ~100-1000x larger than `1`/`3` for
the same legal form (175,819 vs. 988 vs. 183 for aktiebolag), which is
only consistent with 2 = cumulative active stock and 1/3 = monthly
in/out flow. This is a confident inference from real data, not a
guess from the label text — but it is not an official confirmation, and
every finding says so via `detail`.
"""

from __future__ import annotations

import csv
import io

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

BOLAGSVERKET_CSV_URL = "https://static.bolagsverket.se/statistik/ftgstat_oppna.csv"
BOLAGSVERKET_HOST = "static.bolagsverket.se"
BOLAGSVERKET_RATE_LIMITS = {BOLAGSVERKET_HOST: 0.2}

_SOURCE = Source(
    name="Bolagsverket företagsstatistik (ftgstat_oppna.csv)",
    url="https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/nedladdningsbarafiler.2517.html",
    license="CC BY 2.5 SE",
)

#: Legal-form CSV columns to sum for the "all forms" total; AB (aktiebolag)
#: is reported separately too since it's the dominant, most decision-legible
#: business form for a home buyer skimming the package.
_FORM_COLUMNS = (
    "AB",
    "BAB",
    "BF",
    "BRF",
    "EK",
    "E",
    "SE",
    "FL",
    "FAB",
    "HB",
    "I",
    "KB",
    "KHF",
    "MB",
    "SF",
    "SB",
    "TSF",
    "BFL",
    "OFB",
    "SCE",
    "S",
    "EGTS",
    "FOF",
    "TPAB",
    "OTPB",
    "TPF",
)

_HANDELSE_LABELS = {
    "1": ("new_registrations", "monthly new-registration count (inferred label, see docstring)"),
    "2": ("active_total", "cumulative active-company stock (inferred label, see docstring)"),
    "3": ("deregistrations", "monthly deregistration count (inferred label, see docstring)"),
}


class BolagsverketCompaniesProvider(Provider):
    id = "bolagsverket_companies"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.REGISTRY_AUTHORITY
    cache_ttl = None
    deadline_s = 45.0

    def __init__(self, client: HttpClient, clock: Clock = utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.municipality_code is None or context.county_code is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no municipality/county resolved for this address yet",
            )

        try:
            text = self._client.get_text(BOLAGSVERKET_CSV_URL, timeout_s=self.deadline_s)
        except (HttpError, OSError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"Bolagsverket CSV request failed: {exc}",
            )

        try:
            county_num = str(int(context.county_code))
            kommun_num = str(int(context.municipality_code[-2:]))
        except ValueError:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"could not parse municipality/county code {context.municipality_code!r}",
            )

        rows = _kommun_rows(text, county_num, kommun_num)
        if not rows:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="Bolagsverket CSV had no rows for this kommun",
            )

        latest_period = max(row["armanad"] for row in rows)
        latest_rows = [r for r in rows if r["armanad"] == latest_period]
        fetched_at = self._clock().isoformat()
        year, month = latest_period[:4], latest_period[4:]

        findings = []
        for row in latest_rows:
            code = row.get("handelse", "")
            label = _HANDELSE_LABELS.get(code)
            if label is None:
                continue
            key, note = label
            ab_count = _int_or_none(row.get("AB"))
            total_count = sum(c for c in (_int_or_none(row.get(f)) for f in _FORM_COLUMNS) if c)
            findings.append(
                Finding(
                    domain="companies",
                    key=f"{key}_all_forms",
                    value=total_count,
                    unit="count",
                    source=_SOURCE,
                    trust_tier=self.trust_tier,
                    fetched_at=fetched_at,
                    coverage="kommun-level",
                    detail=f"{note}; period {year}-{month}",
                )
            )
            if ab_count is not None:
                findings.append(
                    Finding(
                        domain="companies",
                        key=f"{key}_aktiebolag",
                        value=ab_count,
                        unit="count",
                        source=_SOURCE,
                        trust_tier=self.trust_tier,
                        fetched_at=fetched_at,
                        coverage="kommun-level",
                        detail=f"{note}; period {year}-{month}; aktiebolag (AB) only",
                    )
                )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="Bolagsverket CSV rows found but no recognized event-type codes",
            )

        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=findings)


def _kommun_rows(text: str, county_num: str, kommun_num: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    return [
        row
        for row in reader
        if row.get("SATELAN") == county_num and row.get("SATEKOMMUN") == kommun_num
    ]


def _int_or_none(raw: str | None) -> int | None:
    if raw is None:
        return None
    stripped = raw.strip()
    if not stripped:
        return None
    try:
        return int(stripped)
    except ValueError:
        return None
