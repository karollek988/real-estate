"""Package Builder.

Deterministic by contract: the same context and runs produce a
byte-identical package (given the same clock). Providers are sorted
by id; JSON is emitted with sorted keys.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from market_intelligence import ENGINE_VERSION
from market_intelligence.context import MarketContext
from market_intelligence.models import (
    PACKAGE_FORMAT_VERSION,
    Clock,
    FindingValidationError,
    ProviderRun,
    utcnow,
)


@dataclass(slots=True)
class MarketDataPackage:
    """The engine's single deliverable — collection output, zero judgment."""

    format_version: str
    engine_version: str
    built_at: str
    scope: dict[str, object]
    providers: list[dict[str, object]]
    summary: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return {
            "format_version": self.format_version,
            "engine_version": self.engine_version,
            "built_at": self.built_at,
            "scope": self.scope,
            "providers": self.providers,
            "summary": self.summary,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, indent=2, ensure_ascii=False)


class PackageBuilder:
    def __init__(self, clock: Clock = utcnow, engine_version: str = ENGINE_VERSION) -> None:
        self._clock = clock
        self._engine_version = engine_version

    def build(self, context: MarketContext, runs: list[ProviderRun]) -> MarketDataPackage:
        seen: set[str] = set()
        for run in runs:
            provider_id = run.result.provider_id
            if provider_id in seen:
                raise FindingValidationError(
                    f"duplicate provider id in package input: {provider_id!r}"
                )
            seen.add(provider_id)

        ordered = sorted(runs, key=lambda run: run.result.provider_id)
        fetched_ats = sorted(
            finding.fetched_at for run in ordered for finding in run.result.findings
        )
        status_counts: dict[str, int] = {}
        for run in ordered:
            status = run.result.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        summary: dict[str, object] = {
            "providers_total": len(ordered),
            "providers_by_status": dict(sorted(status_counts.items())),
            "findings_total": sum(len(run.result.findings) for run in ordered),
            "oldest_finding_fetched_at": fetched_ats[0] if fetched_ats else None,
            "newest_finding_fetched_at": fetched_ats[-1] if fetched_ats else None,
            "stale_providers": sorted(run.result.provider_id for run in ordered if run.stale),
        }

        return MarketDataPackage(
            format_version=PACKAGE_FORMAT_VERSION,
            engine_version=self._engine_version,
            built_at=self._clock().isoformat(),
            scope=context.to_dict(),
            providers=[run.to_dict() for run in ordered],
            summary=summary,
        )
