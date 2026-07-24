"""Housing market provider base (P-04).

Defines the base class for housing market data providers — price indexes,
listing statistics, days on market, inventory, and transaction data.

Concrete implementations: Hemnet (listings), future Mäklarstatistik,
Booli, etc. Each provider declares which geographic level(s) it serves.
"""

from __future__ import annotations

from abc import abstractmethod
from datetime import timedelta

from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
    utcnow,
)
from market_intelligence.providers.base import Provider, Stage


class HousingMarketProvider(Provider):
    """Base for housing market data providers.

    Extends Provider with housing-market-specific contract attributes:
    - ``supported_levels``: the geographic levels this provider can serve.
      The runner checks ``required_level`` (inherited from Provider) for
      the minimum requirement, but a provider may support only certain
      levels (e.g., only municipalities, not postal codes).
    - ``data_category``: classifies the provider within the housing market
      domain — ``price_index``, ``listing``, ``transaction``, ``supply``.
    """

    stage: Stage = Stage.PARALLEL
    trust_tier: TrustTier = TrustTier.DIRECTORY
    data_category: str = ""
    supported_levels: frozenset[GeographicLevel] = frozenset()

    @abstractmethod
    def collect(self, context: MarketContext) -> ProviderResult:
        """Collect housing market findings for the given context."""


class HemnetListingsProvider(HousingMarketProvider):
    """Collects listing statistics from Hemnet.

    Hemnet is Sweden's dominant property listing platform. This provider
    collects aggregate listing statistics (count, price levels) by
    geographic scope.

    NOTE: Hemnet has no public API. This provider is structured to
    accept pre-fetched data via the constructor, making it suitable for:
    1. A scheduled scraper that writes JSON files
    2. Manual data entry
    3. Future API integration if Hemnet opens one

    When no pre-fetched data is available, returns NO_DATA honestly.
    """

    id = "hemnet_listings"
    cache_ttl = timedelta(hours=6)
    deadline_s = 10.0
    required_level = GeographicLevel.MUNICIPALITY
    data_category = "listing"
    supported_levels = frozenset({GeographicLevel.MUNICIPALITY, GeographicLevel.COUNTY})

    def __init__(
        self,
        clock=utcnow,
        listings_data: list[dict[str, object]] | None = None,
    ) -> None:
        self._clock = clock
        self._listings_data = listings_data or []

    def collect(self, context: MarketContext) -> ProviderResult:
        if not self._listings_data:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=(
                    "No pre-fetched Hemnet data available. "
                    "Use listings_data constructor parameter or a "
                    "scheduled scraper to provide data."
                ),
            )

        now = self._clock().isoformat()
        findings = []
        for entry in self._listings_data:
            key = entry.get("key", "listing_count")
            value = entry.get("value")
            if value is None:
                continue
            findings.append(
                Finding(
                    domain="housing_market",
                    key=str(key),
                    value=value,
                    unit=_as_str(entry.get("unit")),
                    source=Source(
                        name="Hemnet",
                        url="https://www.hemnet.se/",
                        license="proprietary",
                    ),
                    trust_tier=TrustTier.DIRECTORY,
                    fetched_at=now,
                    country=context.country,
                    municipality=context.municipality,
                    county=context.county,
                    coverage=_build_coverage(context),
                )
            )

        if not findings:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="Listings data contained no valid entries",
            )

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )


class MarketDataInterface:
    """Documentation-only interface describing the standard housing market
    data schema that all housing market providers should aim to fill.

    This is NOT enforced at the Provider ABC level because different
    providers naturally produce different subsets. Instead, this serves
    as the reference for the PackageBuilder and downstream consumers.

    Standard keys (domain="housing_market"):

    PRICE INDEX:
    - housing_price_index: float (index, 2020=100)
    - price_per_sqm: float (SEK/sqm)
    - monthly_price_change: float (percent)
    - yearly_price_change: float (percent)

    LISTING:
    - listing_count: int (number of active listings)
    - new_listing_count: int (new this month)
    - asking_price_median: float (SEK)
    - asking_price_per_sqm: float (SEK/sqm)

    TRANSACTION:
    - transaction_count: int (sold this period)
    - sold_above_ask: float (percent)
    - sale_to_ask_ratio: float (ratio)

    SUPPLY:
    - months_of_inventory: float (months)
    - days_on_market: int (median days)
    - price_reductions_pct: float (percent with reduction)

    SUPPLY REGIONAL:
    - absorption_rate: float (sales / new listings)
    - active_listing_delta: float (month-over-month change)
    """

    pass


def _build_coverage(context: MarketContext) -> str:
    """Build a human-readable coverage string from context."""
    parts: list[str] = []
    if context.municipality:
        parts.append(context.municipality)
    if context.county:
        parts.append(context.county)
    if context.region:
        parts.append(context.region)
    if context.country:
        parts.append(context.country)
    return ", ".join(parts) if parts else "unknown"


def _as_str(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)
