"""Provider contract for the Market Intelligence Engine.

Every provider: one module, one responsibility, independent ``collect()``,
honest statuses, individually disableable, no knowledge of any other
provider. The runner isolates each call, so a provider may raise on
unexpected failure — but well-behaved providers degrade to an
``error``-status result themselves with a real detail.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import timedelta
from enum import StrEnum

from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.models import ProviderResult, TrustTier


class Stage(StrEnum):
    """PARALLEL providers run concurrently against the market context.

    All market data providers run in parallel — none enrich the context
    for subsequent providers (unlike the Location Intelligence engine
    which has a PRE stage for geocoding).
    """

    PARALLEL = "parallel"


class Provider(ABC):
    """Base class for all market intelligence providers.

    Class attributes declare the contract the runner and cache honor:

    - ``id``: unique, stable identifier (used in DISABLED_PROVIDERS,
      cache paths, and package output).
    - ``stage``: currently only PARALLEL.
    - ``trust_tier``: default tier for this provider's findings.
    - ``cache_ttl``: how long a result stays fresh; ``None`` disables
      caching. Match the source's real update cadence.
    - ``deadline_s``: per-run time budget; ``None`` uses the engine
      default. One slow source never holds the whole run hostage.
    - ``required_level``: coarsest geographic level this provider can
      work with. The runner skips providers when the context is too
      coarse.
    """

    id: str = ""
    stage: Stage = Stage.PARALLEL
    trust_tier: TrustTier = TrustTier.DIRECTORY
    cache_ttl: timedelta | None = None
    deadline_s: float | None = None
    required_level: GeographicLevel | None = None

    @abstractmethod
    def collect(self, context: MarketContext) -> ProviderResult:
        """Collect findings for the given market context."""
