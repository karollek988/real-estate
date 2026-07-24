"""Domain model for scraping jobs.

A Job is the durable unit of work behind "analyse BRF X": created
immediately on request, then advanced through Discovery -> Crawl ->
Download (and, in the future, OCR -> AI Extraction) while its status
and results are persisted after every stage transition, so it survives
a process restart mid-run and can be polled at any time.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    """Lifecycle status of a Job."""

    QUEUED = "queued"
    DISCOVERING = "discovering"
    CRAWLING = "crawling"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"

    @property
    def is_terminal(self) -> bool:
        """Whether this status is an end state (no further stages will run)."""
        return self in (JobStatus.COMPLETED, JobStatus.FAILED)


class JobError(BaseModel):
    """Error that terminated a Job."""

    stage: str
    message: str
    occurred_at: datetime = Field(default_factory=datetime.now)


class JobResult(BaseModel):
    """Accumulated output of a Job's stages, filled in as they complete."""

    website_url: str | None = None
    discovery_source: str | None = None
    confidence_band: str | None = None
    confidence_score: float | None = None
    confidence_explanation: str | None = None
    needs_confirmation: bool = False

    pages_crawled: int = 0
    internal_links: int = 0
    external_links: int = 0

    pdfs_found: int = 0
    annual_reports_detected: int = 0
    downloaded_documents: list[str] = Field(default_factory=list)
    duplicate_documents: int = 0
    download_errors: int = 0


class Job(BaseModel):
    """A single "analyse BRF X" request, its progress, and its results."""

    id: UUID = Field(default_factory=uuid4)
    brf_name: str
    organization_number: str | None = None
    status: JobStatus = JobStatus.QUEUED
    result: JobResult = Field(default_factory=JobResult)
    error: JobError | None = None

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    started_at: datetime | None = None
    completed_at: datetime | None = None

    def touch(self) -> None:
        """Update the modification timestamp."""
        self.updated_at = datetime.now()
