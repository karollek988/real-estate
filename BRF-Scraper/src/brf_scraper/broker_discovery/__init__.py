"""Broker-site document discovery.

Given a Hemnet listing, finds the broker's own website (the "Läs mer hos
mäklaren" link) and discovers documents published there — annual reports,
bylaws, energy declarations, inspection protocols. Distinct from
discovery/, which resolves *which BRF* a listing belongs to; this package
answers *what documents exist on one specific broker page*.
"""

from __future__ import annotations

from brf_scraper.broker_discovery.engine import BrokerDiscoveryEngine
from brf_scraper.broker_discovery.models import (
    BrokerDiscoveryResult,
    BrokerDocumentType,
    DiscoveredDocument,
)

__all__ = [
    "BrokerDiscoveryEngine",
    "BrokerDiscoveryResult",
    "BrokerDocumentType",
    "DiscoveredDocument",
]
