"""Provider contract and registry.

`default_registry()` is the engine's production provider set. Wave 2:
Address Resolver (SCB register normalization) and Nominatim Geocoder —
the pre-stage that every later radius-based provider depends on.
"""

from __future__ import annotations

from location_intelligence.config import EngineConfig
from location_intelligence.http_client import HttpClient
from location_intelligence.providers.base import Provider, Stage
from location_intelligence.providers.registry import ProviderRegistry

__all__ = ["Provider", "ProviderRegistry", "Stage", "default_registry"]


def default_registry(client: HttpClient | None = None) -> ProviderRegistry:
    """Build the production provider set.

    ``client`` is injectable for tests (conformance runs against a
    failing transport to prove graceful degradation without touching the
    network). The default client carries the Nominatim rate limit.
    """
    from location_intelligence.providers.address_resolver import AddressResolver
    from location_intelligence.providers.bolagsverket_companies import (
        BOLAGSVERKET_RATE_LIMITS,
        BolagsverketCompaniesProvider,
    )
    from location_intelligence.providers.kolada import KoladaProvider
    from location_intelligence.providers.lantmateriet_detaljplan import (
        LANTMATERIET_RATE_LIMITS,
        LantmaterietDetaljplanProvider,
    )
    from location_intelligence.providers.nominatim_geocoder import (
        NOMINATIM_RATE_LIMITS,
        NominatimGeocoder,
    )
    from location_intelligence.providers.osm_construction import OsmConstructionProvider
    from location_intelligence.providers.osm_poi import OsmPoiProvider
    from location_intelligence.providers.overpass_client import OVERPASS_RATE_LIMITS
    from location_intelligence.providers.polisen_crime import (
        POLISEN_RATE_LIMITS,
        PolisenCrimeProvider,
    )
    from location_intelligence.providers.scb_municipality import ScbMunicipalityProvider
    from location_intelligence.providers.skolverket_schools import (
        SKOLVERKET_RATE_LIMITS,
        SkolverketSchoolsProvider,
    )
    from location_intelligence.providers.svt_local_news import SVT_RATE_LIMITS, SvtLocalNewsProvider
    from location_intelligence.providers.trafikverket_infrastructure import (
        TRAFIKVERKET_RATE_LIMITS,
        TrafikverketInfrastructureProvider,
    )

    if client is None:
        client = HttpClient(
            EngineConfig.from_env(),
            rate_limits={
                **NOMINATIM_RATE_LIMITS,
                **OVERPASS_RATE_LIMITS,
                **TRAFIKVERKET_RATE_LIMITS,
                **SKOLVERKET_RATE_LIMITS,
                **SVT_RATE_LIMITS,
                **POLISEN_RATE_LIMITS,
                **BOLAGSVERKET_RATE_LIMITS,
                **LANTMATERIET_RATE_LIMITS,
            },
        )

    registry = ProviderRegistry()
    # PRE-stage order matters: the resolver's kommun identity lets the
    # geocoder skip its own municipality lookup when already resolved.
    registry.register(AddressResolver())
    registry.register(NominatimGeocoder(client))
    # PARALLEL stage: proven ports (Wave 3), national coverage, no keys required.
    registry.register(OsmPoiProvider(client))
    registry.register(ScbMunicipalityProvider(client))
    registry.register(KoladaProvider(client))
    # PARALLEL stage: future-value signals (Wave 4), no keys required.
    registry.register(OsmConstructionProvider(client))
    # PARALLEL stage: official infrastructure projects — requires a free key
    # (TRAFIKVERKET_API_KEY); honestly `not_connected` without one.
    registry.register(TrafikverketInfrastructureProvider(client))
    registry.register(SkolverketSchoolsProvider(client))
    registry.register(SvtLocalNewsProvider(client))
    registry.register(PolisenCrimeProvider(client))
    registry.register(BolagsverketCompaniesProvider(client))
    # PARALLEL stage: future-development intelligence — requires an OAuth2
    # client-credentials pair (LANTMATERIET_CLIENT_ID/_SECRET); honestly
    # `not_connected` without one.
    registry.register(LantmaterietDetaljplanProvider(client))
    return registry
