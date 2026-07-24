"""real_estate: property valuation and investment-analysis engine.

Skeleton only - no features are implemented yet, by design. The data
research in `docs/data-sources.md` must confirm the data ecosystem
before any valuation code is written (the betting project learned this
the expensive way: model quality was capped by data access, not by
modeling - see Sprint 50 in the betting project's history).

Probabilistic modeling is NOT implemented here: it comes from the shared
`probability_engine` package (`shared/probability-engine`). This package
only adds real-estate domain concepts on top of it.

Intended layering (mirrors the betting project, which proved the shape):

    data/       - acquisition clients for external sources (Booli, SCB,
                  Lantmateriet, Trafiklab, ...), raw-data persistence
    features/   - pre-listing feature engineering (location, BRF health,
                  transit access, planned infrastructure, ...)
    valuation/  - valuation targets and mispricing detection built on
                  probability_engine models
    services/   - product layer: reports, explanations, API-ready DTOs
    config/     - typed configuration loading

The data-leakage principle carries over verbatim: features available at
listing time must never mix with information only known at/after sale.
"""

__version__ = "0.1.0"
