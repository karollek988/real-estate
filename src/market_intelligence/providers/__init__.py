"""Provider contract and registry.

``default_registry()`` is the engine's production provider set.
"""

from __future__ import annotations

from market_intelligence.config import EngineConfig
from market_intelligence.http_client import HttpClient
from market_intelligence.providers.base import Provider, Stage
from market_intelligence.providers.registry import ProviderRegistry

__all__ = ["Provider", "ProviderRegistry", "Stage", "default_registry"]


def default_registry(client: HttpClient | None = None) -> ProviderRegistry:
    """Build the production provider set.

    ``client`` is injectable for tests.
    """
    from market_intelligence.providers.boverket_construction import (
        SCB_CONSTRUCTION_RATE_LIMITS,
        BoverketConstructionProvider,
    )
    from market_intelligence.providers.energy_prices import (
        SCB_RATE_LIMITS as SCB_ENERGY_RATE_LIMITS,
    )
    from market_intelligence.providers.energy_prices import (
        EnergyPriceProvider,
    )
    from market_intelligence.providers.eurostat_housing_price import (
        EUROSTAT_RATE_LIMITS,
        EurostatHousingPriceProvider,
    )
    from market_intelligence.providers.mortgage_rates import (
        SCB_RATE_LIMITS as SCB_MORTGAGE_RATE_LIMITS,
    )
    from market_intelligence.providers.mortgage_rates import (
        MortgageRateProvider,
    )
    from market_intelligence.providers.municipal_economics import (
        SCB_RATE_LIMITS as SCB_MUNICIPAL_RATE_LIMITS,
    )
    from market_intelligence.providers.municipal_economics import (
        MunicipalEconomicsProvider,
    )
    from market_intelligence.providers.riksbank_interest_rate import (
        SCB_RATE_LIMITS as RIKSBANK_SCB_RATE_LIMITS,
    )
    from market_intelligence.providers.riksbank_interest_rate import (
        RiksbankInterestRateProvider,
    )
    from market_intelligence.providers.scb_housing_market import (
        SCB_RATE_LIMITS,
        ScbHousingMarketProvider,
    )
    from market_intelligence.providers.scb_macro_economy import (
        SCB_RATE_LIMITS as SCB_MACRO_RATE_LIMITS,
    )
    from market_intelligence.providers.scb_macro_economy import (
        ScbMacroEconomyProvider,
    )
    from market_intelligence.providers.scb_subnational import (
        SCB_RATE_LIMITS as SCB_SUBNATIONAL_RATE_LIMITS,
    )
    from market_intelligence.providers.scb_subnational import (
        ScbSubnationalProvider,
    )

    if client is None:
        merged_rates: dict[str, float] = {}
        merged_rates.update(RIKSBANK_SCB_RATE_LIMITS)
        merged_rates.update(SCB_MACRO_RATE_LIMITS)
        merged_rates.update(SCB_CONSTRUCTION_RATE_LIMITS)
        merged_rates.update(SCB_RATE_LIMITS)
        merged_rates.update(SCB_SUBNATIONAL_RATE_LIMITS)
        merged_rates.update(EUROSTAT_RATE_LIMITS)
        merged_rates.update(SCB_MORTGAGE_RATE_LIMITS)
        merged_rates.update(SCB_MUNICIPAL_RATE_LIMITS)
        merged_rates.update(SCB_ENERGY_RATE_LIMITS)

        client = HttpClient(
            EngineConfig.from_env(),
            rate_limits=merged_rates,
        )

    registry = ProviderRegistry()
    registry.register(RiksbankInterestRateProvider(client))
    registry.register(ScbMacroEconomyProvider(client))
    registry.register(BoverketConstructionProvider(client))
    registry.register(ScbHousingMarketProvider(client))
    registry.register(EurostatHousingPriceProvider(client))
    registry.register(ScbSubnationalProvider(client))
    registry.register(MortgageRateProvider(client))
    registry.register(MunicipalEconomicsProvider(client))
    registry.register(EnergyPriceProvider(client))
    return registry
