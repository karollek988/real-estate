"""Stage-based execution of a Job.

The runner advances a Job through an ordered list of stages
(Discovery -> Crawl -> Download today; OCR -> AI Extraction later),
persisting the Job's status and results after every transition so it
can be polled mid-run and survives a process restart. Each stage is a
small, independent unit - adding a new one later means writing one
class and appending it to the list, not touching this file's control
flow.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import ClassVar

from brf_scraper.config import AppSettings
from brf_scraper.crawler.engine import CrawlerEngine
from brf_scraper.crawler.models import CrawlConfig, DocumentReference
from brf_scraper.discovery.allabrf_provider import AllabrfProvider
from brf_scraper.discovery.confidence import ConfidenceBand
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import DiscoverySource
from brf_scraper.discovery.pipeline import DiscoveryPipeline
from brf_scraper.discovery.registry import SqliteVerifiedWebsiteRegistry, VerifiedWebsiteRegistry
from brf_scraper.discovery.search_engine import SearchEngineDiscovery
from brf_scraper.downloader.downloader import Downloader
from brf_scraper.downloader.manager import DownloadManager
from brf_scraper.downloader.models import DownloadRequest, DownloadStatus
from brf_scraper.downloader.sqlite_metadata import SqliteMetadataRepository
from brf_scraper.exceptions import BRFScraperError
from brf_scraper.jobs.models import Job, JobError, JobStatus
from brf_scraper.jobs.repository import JobRepository
from brf_scraper.models.brf import BRF
from brf_scraper.smoke_test import is_likely_annual_report
from brf_scraper.storage.local import LocalStorage
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class JobContext:
    """Resources and stage-to-stage state for one JobRunner.run() call.

    Fields here are working state, not part of the Job's persisted
    result - each stage copies what's worth keeping into `job.result`
    itself before returning.
    """

    settings: AppSettings
    manual_website_url: str | None = None
    website_url: str | None = None

    discovery_engine: DiscoveryEngine | None = None
    verified_registry: VerifiedWebsiteRegistry | None = None
    crawler: CrawlerEngine | None = None
    download_manager: DownloadManager | None = None
    allabrf_satisfied: bool = False

    pdf_documents: list[DocumentReference] = field(default_factory=list)
    docs_to_download: list[DocumentReference] = field(default_factory=list)

    async def close(self) -> None:
        """Release any resources opened while running stages."""
        if self.download_manager is not None:
            await self.download_manager.close()
        if self.crawler is not None:
            await self.crawler.close()
        if self.discovery_engine is not None:
            await self.discovery_engine.close()
        if self.verified_registry is not None:
            await self.verified_registry.close()


class JobStage(ABC):
    """One step in a Job's lifecycle."""

    status: ClassVar[JobStatus]

    @abstractmethod
    async def run(self, job: Job, context: JobContext) -> None:
        """Execute this stage, mutating `job.result` and `context` in place.

        Args:
            job: The Job being advanced. Only `job.result` should be
                mutated here - status/timestamps are managed by JobRunner.
            context: Shared resources and state carried between stages.

        Raises:
            BRFScraperError: If the stage cannot produce a usable result.
                JobRunner catches this and marks the Job FAILED.
        """


class AllabrfAcquisitionStage(JobStage):
    """Resolve the BRF and download its annual reports directly via allabrf.se.

    This is the primary production path: AllabrfProvider already covers
    name -> BRF -> official website -> documents -> downloaded PDFs in
    one call, so when it succeeds there is nothing left for the
    generic search-engine-discovery + crawl + download stages to do.
    They remain as a fallback for BRFs allabrf.se doesn't carry.
    """

    status = JobStatus.DISCOVERING

    async def run(self, job: Job, context: JobContext) -> None:
        provider = AllabrfProvider()
        await provider.initialize()
        try:
            acq = await provider.acquire(
                brf_name=job.brf_name,
                download_dir=context.settings.storage.pdf_dir,
            )
        finally:
            await provider.close()

        job.result.discovery_source = DiscoverySource.DIRECTORY
        if not acq.resolved:
            logger.info("allabrf_stage_no_match", brf_name=job.brf_name, errors=acq.errors)
            return

        job.result.website_url = acq.official_website
        job.result.annual_reports_detected = len(acq.annual_reports)
        job.result.pdfs_found = len(acq.annual_reports)

        for download in acq.downloaded_ok:
            if download.document.title:
                job.result.downloaded_documents.append(download.document.title)
        job.result.download_errors += sum(
            1 for d in acq.downloads if d.status == "failed"
        )

        if acq.downloaded_ok:
            context.allabrf_satisfied = True
            context.website_url = acq.official_website
            logger.info(
                "allabrf_stage_satisfied",
                brf_name=job.brf_name,
                downloaded=len(acq.downloaded_ok),
            )


class DiscoveryStage(JobStage):
    """Resolve the BRF's official website with confidence gating."""

    status = JobStatus.DISCOVERING

    async def run(self, job: Job, context: JobContext) -> None:
        if context.allabrf_satisfied:
            # AllabrfAcquisitionStage already resolved the site and
            # downloaded annual reports directly from allabrf.se; the
            # generic search-engine + crawl path below is only a
            # fallback for BRFs allabrf.se doesn't carry.
            return

        if context.discovery_engine is None:
            context.discovery_engine = DiscoveryEngine(
                providers=[SearchEngineDiscovery()],
                strategy="sequential",
                deduplicate=True,
            )
            await context.discovery_engine.initialize()

        if context.verified_registry is None:
            context.verified_registry = SqliteVerifiedWebsiteRegistry(
                database_url=context.settings.database.url
            )
            await context.verified_registry.initialize()

        target = BRF(name=job.brf_name, organization_number=job.organization_number)
        resolver = DiscoveryPipeline(
            discovery_engine=context.discovery_engine,
            registry=context.verified_registry,
        )
        decision = await resolver.resolve(
            target=target,
            queries=[f"BRF {job.brf_name} årsredovisning"],
            manual_website_url=context.manual_website_url,
        )

        job.result.discovery_source = decision.source
        job.result.confidence_band = decision.band.value
        job.result.confidence_score = decision.confidence
        job.result.confidence_explanation = decision.explanation

        if decision.band == ConfidenceBand.LOW:
            raise BRFScraperError(
                message=(
                    f"Could not confidently identify a website for BRF "
                    f"'{job.brf_name}': {decision.explanation}"
                ),
            )

        if decision.band == ConfidenceBand.MEDIUM:
            job.result.website_url = decision.website_url
            job.result.needs_confirmation = True
            # Not a hard failure, but the pipeline must not proceed to crawl
            # a guess - raising stops here and JobRunner records it clearly.
            raise BRFScraperError(
                message="Best-guess website needs user confirmation before crawling.",
            )

        if decision.website_url is None:
            # HIGH always carries a URL; this only guards that invariant.
            raise BRFScraperError(
                message=f"Discovery reported HIGH confidence with no URL for '{job.brf_name}'",
            )

        job.result.website_url = decision.website_url
        context.website_url = decision.website_url


class CrawlStage(JobStage):
    """Crawl the discovered website and locate candidate PDF documents."""

    status = JobStatus.CRAWLING

    async def run(self, job: Job, context: JobContext) -> None:
        if context.allabrf_satisfied:
            return
        if context.website_url is None:
            raise BRFScraperError(message="Crawl stage requires a website_url from Discovery")

        config = CrawlConfig(
            max_depth=context.settings.crawler.default_depth,
            max_pages=100,
            max_concurrent=3,
            delay_between_requests=0.5,
            respect_robots_txt=context.settings.crawler.respect_robots_txt,
            timeout=context.settings.crawler.timeout,
        )
        context.crawler = CrawlerEngine(config=config)
        await context.crawler.initialize()

        metrics = await context.crawler.crawl(start_url=context.website_url, max_pages=config.max_pages)
        job.result.pages_crawled = metrics.pages_crawled
        job.result.internal_links = metrics.internal_links
        job.result.external_links = metrics.external_links

        context.pdf_documents = context.crawler.get_pdf_documents()
        job.result.pdfs_found = len(context.pdf_documents)

        annual_reports = [doc for doc in context.pdf_documents if is_likely_annual_report(doc)]
        job.result.annual_reports_detected = len(annual_reports)
        context.docs_to_download = annual_reports if annual_reports else context.pdf_documents


class DownloadStage(JobStage):
    """Download the identified PDF documents to persistent storage."""

    status = JobStatus.DOWNLOADING

    async def run(self, job: Job, context: JobContext) -> None:
        if not context.docs_to_download:
            return

        storage = LocalStorage(base_dir=context.settings.storage.pdf_dir)
        metadata_repo = SqliteMetadataRepository(database_url=context.settings.database.url)
        downloader = Downloader()

        context.download_manager = DownloadManager(
            downloader=downloader,
            storage=storage,
            metadata_repo=metadata_repo,
            max_concurrent=3,
        )
        await context.download_manager.initialize()

        requests: list[DownloadRequest] = []
        for doc in context.docs_to_download:
            try:
                requests.append(
                    DownloadRequest(
                        source_url=str(doc.source_url),
                        document_url=str(doc.document_url),
                        title=doc.title,
                        filename=doc.filename,
                    )
                )
            except Exception as e:
                logger.warning("job_skip_invalid_doc", url=str(doc.document_url), error=str(e))
                job.result.download_errors += 1

        if not requests:
            return

        results = await context.download_manager.download_many(requests)
        for result in results:
            if result.status == DownloadStatus.COMPLETED:
                if result.document and result.document.original_filename:
                    job.result.downloaded_documents.append(result.document.original_filename)
            elif result.status == DownloadStatus.DUPLICATE:
                job.result.duplicate_documents += 1
            elif result.status == DownloadStatus.FAILED:
                job.result.download_errors += 1


class JobRunner:
    """Advances a Job through its stages, persisting progress as it goes."""

    def __init__(
        self,
        repository: JobRepository,
        settings: AppSettings | None = None,
        stages: list[JobStage] | None = None,
    ) -> None:
        """Initialize the runner.

        Args:
            repository: Where the Job's status/results are persisted after
                every stage transition.
            settings: Application settings; defaults to a fresh AppSettings().
            stages: Ordered stages to execute. Defaults to
                [Discovery, Crawl, Download]. Extend this list (e.g. with
                OCR, AI Extraction stages) to grow the pipeline without
                changing this class.
        """
        self._repository = repository
        self._settings = settings or AppSettings()
        self._stages = stages or [
            AllabrfAcquisitionStage(),
            DiscoveryStage(),
            CrawlStage(),
            DownloadStage(),
        ]

    async def run(self, job: Job, manual_website_url: str | None = None) -> Job:
        """Run all stages for `job`, persisting status after each one.

        Args:
            job: The Job to run. Must already exist in the repository
                (JobService.create persists it before calling this).
            manual_website_url: A website URL supplied by the caller,
                bypassing Discovery entirely for this run.

        Returns:
            The Job in its final state (COMPLETED or FAILED).
        """
        context = JobContext(settings=self._settings, manual_website_url=manual_website_url)
        job.started_at = datetime.now()

        try:
            for stage in self._stages:
                job.status = stage.status
                job.touch()
                await self._repository.save(job)

                await stage.run(job, context)

            job.status = JobStatus.COMPLETED
        except Exception as e:
            failed_stage = job.status.value
            job.status = JobStatus.FAILED
            job.error = JobError(stage=failed_stage, message=str(e))
            logger.error("job_failed", job_id=str(job.id), stage=failed_stage, error=str(e))
        finally:
            job.completed_at = datetime.now()
            job.touch()
            await self._repository.save(job)
            await context.close()

        return job
