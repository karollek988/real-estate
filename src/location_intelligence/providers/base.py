"""The Provider contract (task F-02) — the doc 28 `DataProvider` pattern in Python.

Every provider: one module, one responsibility, independent `collect()`,
honest statuses, individually disableable, no knowledge of any other
provider. The runner isolates each call (task F-04), so a provider may
raise on unexpected failure — but well-behaved providers degrade to an
`error`-status result themselves with a real detail.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from enum import StrEnum

from location_intelligence.context import AddressContext, GeocodePrecision
from location_intelligence.models import ProviderResult, TrustTier


class Stage(StrEnum):
    """PRE providers run sequentially first and may enrich the context
    (address resolution, geocoding). PARALLEL providers run concurrently
    against the enriched context (doc 28 bug #1, doc 37 Task 6)."""

    PRE = "pre"
    PARALLEL = "parallel"


class Provider(ABC):
    """Base class for all providers.

    Class attributes declare the contract the runner and cache honor:

    - ``id``: unique, stable identifier (used in DISABLED_PROVIDERS,
      cache paths, and package output).
    - ``stage``: PRE (sequential, context-enriching) or PARALLEL.
    - ``trust_tier``: default tier for this provider's findings.
    - ``cache_ttl``: how long a result stays fresh; ``None`` disables
      caching. Match the source's real update cadence (docs/36 §5).
    - ``deadline_s``: per-run time budget; ``None`` uses the engine
      default. One slow source never holds the whole analysis hostage
      (doc 37 Task 5).
    - ``min_precision``: coarsest geocode precision this provider can
      honestly work with (task A-05). The runner skips the provider with
      a visible reason when the context is coarser — a 1 km-radius count
      around a municipality centroid would be *wrong*, not just vague,
      and missing information is acceptable while incorrect is not.
    """

    id: str = ""
    stage: Stage = Stage.PARALLEL
    trust_tier: TrustTier = TrustTier.DIRECTORY
    cache_ttl: timedelta | None = None
    deadline_s: float | None = None
    min_precision: GeocodePrecision | None = None

    @abstractmethod
    def collect(self, context: AddressContext) -> ProviderResult:
        """Collect findings for the given address context."""
