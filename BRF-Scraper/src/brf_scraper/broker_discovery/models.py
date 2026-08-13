"""Pydantic models for broker-site document discovery."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class BrokerDocumentType(StrEnum):
    """Kind of document found on a broker's listing page.

    Mirrors the doc_type check constraint on public.broker_documents
    (supabase/migrations/20260723000500_broker_documents.sql) — keep these
    in sync.
    """

    ANNUAL_REPORT = "annual_report"
    INSPECTION_REPORT = "inspection_report"
    ENERGY_DECLARATION = "energy_declaration"
    BYLAWS = "bylaws"
    FLOOR_PLAN = "floor_plan"
    OTHER = "other"


class DiscoveredDocument(BaseModel):
    """A single document link found on a broker's page, not yet downloaded."""

    url: str
    link_text: str
    doc_type: BrokerDocumentType
    guessed_filename: str


class BrokerDiscoveryResult(BaseModel):
    """Result of one broker-site discovery run for a single Hemnet listing."""

    hemnet_url: str
    broker_url: str | None = None
    documents: list[DiscoveredDocument] = Field(default_factory=list)
    # Which browser strategy actually produced this result — "camoufox",
    # "camoufox_headed", or "playwright_headed" (see engine.py's fallback
    # chain). None if broker_url resolution itself failed before any
    # browser session was needed.
    provider_used: str | None = None
    errors: list[str] = Field(default_factory=list)
    completed_at: datetime = Field(default_factory=datetime.now)

    @property
    def is_success(self) -> bool:
        """True if a broker page was reached, even with zero documents found —
        a broker publishing nothing is a normal outcome, not a failure."""
        return self.broker_url is not None
