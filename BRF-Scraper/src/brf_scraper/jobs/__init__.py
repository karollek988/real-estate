"""Job pipeline: durable, pollable "analyse BRF X" requests.

`JobService` is the intended entry point for external callers (CLI today,
a future FastAPI service tomorrow). See docs/29 and the discovery module
for the confidence-gated Discovery stage this pipeline wraps.
"""

from __future__ import annotations

from brf_scraper.jobs.models import Job, JobError, JobResult, JobStatus
from brf_scraper.jobs.repository import JobRepository, SqliteJobRepository
from brf_scraper.jobs.runner import (
    CrawlStage,
    DiscoveryStage,
    DownloadStage,
    JobContext,
    JobRunner,
    JobStage,
)
from brf_scraper.jobs.service import JobService

__all__ = [
    "CrawlStage",
    "DiscoveryStage",
    "DownloadStage",
    "Job",
    "JobContext",
    "JobError",
    "JobRepository",
    "JobResult",
    "JobRunner",
    "JobService",
    "JobStage",
    "JobStatus",
    "SqliteJobRepository",
]
