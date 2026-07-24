"""Tests for JobRunner orchestration and the Discovery stage."""

from __future__ import annotations

from typing import Any

import pytest

from brf_scraper.config import AppSettings
from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import DiscoveredBRF, DiscoveryResult, DiscoverySource
from brf_scraper.discovery.registry import SqliteVerifiedWebsiteRegistry
from brf_scraper.exceptions import BRFScraperError
from brf_scraper.jobs.models import Job, JobStatus
from brf_scraper.jobs.repository import SqliteJobRepository
from brf_scraper.jobs.runner import DiscoveryStage, JobContext, JobRunner, JobStage


class MockDiscoveryProvider(BaseDiscoveryProvider):
    """Mock discovery provider returning a fixed candidate list."""

    def __init__(self, brfs_to_return: list[dict[str, Any]] | None = None) -> None:
        self._brfs_to_return = brfs_to_return or []

    @property
    def name(self) -> str:
        return "mock"

    @property
    def is_available(self) -> bool:
        return True

    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
        for data in self._brfs_to_return:
            result.add_brf(
                DiscoveredBRF(
                    name=data.get("name", "Test BRF"),
                    website_url=data.get("url", "https://test.se"),
                    source=data.get("source", DiscoverySource.SEARCH_ENGINE),
                    organization_number=data.get("organization_number"),
                )
            )
        return result

    async def initialize(self) -> None:
        pass

    async def close(self) -> None:
        pass


class FakeStage(JobStage):
    """A stage whose behavior is controlled directly by the test."""

    def __init__(self, status: JobStatus, should_fail: bool = False) -> None:
        self.status = status
        self._should_fail = should_fail
        self.ran = False

    async def run(self, job: Job, context: JobContext) -> None:
        self.ran = True
        if self._should_fail:
            raise BRFScraperError(message=f"{self.status.value} stage failed")
        job.result.pages_crawled += 1


@pytest.fixture
async def repository(tmp_path):
    """A fresh SQLite-backed job repository for each test."""
    repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
    await repo.initialize()
    yield repo
    await repo.close()


@pytest.fixture
def settings(tmp_path) -> AppSettings:
    """Application settings pointed at a temp database."""
    settings = AppSettings()
    settings.database.url = f"sqlite+aiosqlite:///{tmp_path / 'app.db'}"
    return settings


class TestJobRunnerOrchestration:
    """Tests for JobRunner's stage sequencing, independent of real stages."""

    @pytest.mark.asyncio
    async def test_all_stages_succeed_completes_job(self, repository, settings) -> None:
        """A job with all-successful stages ends COMPLETED."""
        stages = [FakeStage(JobStatus.DISCOVERING), FakeStage(JobStatus.CRAWLING)]
        runner = JobRunner(repository=repository, settings=settings, stages=stages)
        job = Job(brf_name="BRF Solgläntan")
        await repository.save(job)

        result = await runner.run(job)

        assert result.status == JobStatus.COMPLETED
        assert result.error is None
        assert result.started_at is not None
        assert result.completed_at is not None
        assert all(stage.ran for stage in stages)
        assert result.result.pages_crawled == len(stages)

    @pytest.mark.asyncio
    async def test_failing_stage_marks_job_failed_with_stage_name(
        self, repository, settings
    ) -> None:
        """A failing stage records its own status as the error's stage, not FAILED."""
        stages = [
            FakeStage(JobStatus.DISCOVERING),
            FakeStage(JobStatus.CRAWLING, should_fail=True),
            FakeStage(JobStatus.DOWNLOADING),
        ]
        runner = JobRunner(repository=repository, settings=settings, stages=stages)
        job = Job(brf_name="BRF Solgläntan")
        await repository.save(job)

        result = await runner.run(job)

        assert result.status == JobStatus.FAILED
        assert result.error is not None
        assert result.error.stage == JobStatus.CRAWLING.value
        assert "crawling stage failed" in result.error.message
        assert stages[0].ran is True
        assert stages[1].ran is True
        assert stages[2].ran is False

    @pytest.mark.asyncio
    async def test_progress_is_persisted_after_each_stage(self, repository, settings) -> None:
        """A concurrent reader can observe intermediate stage status via the repository."""
        seen_statuses: list[JobStatus] = []

        class ObservingStage(JobStage):
            def __init__(self, status: JobStatus) -> None:
                self.status = status

            async def run(self, job: Job, context: JobContext) -> None:
                persisted = await repository.get(job.id)
                assert persisted is not None
                seen_statuses.append(persisted.status)

        stages = [ObservingStage(JobStatus.DISCOVERING), ObservingStage(JobStatus.CRAWLING)]
        runner = JobRunner(repository=repository, settings=settings, stages=stages)
        job = Job(brf_name="BRF Solgläntan")
        await repository.save(job)

        await runner.run(job)

        assert seen_statuses == [JobStatus.DISCOVERING, JobStatus.CRAWLING]

    @pytest.mark.asyncio
    async def test_final_state_is_persisted(self, repository, settings) -> None:
        """The job's final COMPLETED state is saved to the repository."""
        runner = JobRunner(
            repository=repository, settings=settings, stages=[FakeStage(JobStatus.DISCOVERING)]
        )
        job = Job(brf_name="BRF Solgläntan")
        await repository.save(job)

        await runner.run(job)

        persisted = await repository.get(job.id)
        assert persisted is not None
        assert persisted.status == JobStatus.COMPLETED


class TestDiscoveryStage:
    """Tests for DiscoveryStage's integration into the job pipeline."""

    @pytest.mark.asyncio
    async def test_high_confidence_sets_website_url(self, settings) -> None:
        """A HIGH-confidence discovery result populates job.result and context."""
        provider = MockDiscoveryProvider(
            brfs_to_return=[
                {
                    "name": "BRF Solgläntan",
                    "url": "https://brfsolglantan.se",
                    "source": DiscoverySource.SEED_URL,
                    "organization_number": "7691234567",
                }
            ]
        )
        job = Job(brf_name="BRF Solgläntan", organization_number="7691234567")
        context = JobContext(
            settings=settings,
            discovery_engine=DiscoveryEngine(providers=[provider]),
        )
        registry = SqliteVerifiedWebsiteRegistry(database_url=settings.database.url)
        await registry.initialize()
        context.verified_registry = registry

        try:
            await DiscoveryStage().run(job, context)
        finally:
            await registry.close()

        assert job.result.website_url == "https://brfsolglantan.se/"
        assert job.result.confidence_band == "high"
        assert context.website_url == "https://brfsolglantan.se/"

    @pytest.mark.asyncio
    async def test_low_confidence_raises_and_sets_no_url(self, settings) -> None:
        """A LOW-confidence result raises and never sets a website_url."""
        provider = MockDiscoveryProvider(
            brfs_to_return=[
                {
                    "name": "Completely Unrelated Association",
                    "url": "https://unrelated.se",
                    "source": DiscoverySource.SEARCH_ENGINE,
                }
            ]
        )
        job = Job(brf_name="BRF Solgläntan", organization_number="7691234567")
        context = JobContext(settings=settings, discovery_engine=DiscoveryEngine(providers=[provider]))

        with pytest.raises(BRFScraperError):
            await DiscoveryStage().run(job, context)

        assert job.result.website_url is None
        assert job.result.confidence_band == "low"

        if context.verified_registry is not None:
            await context.verified_registry.close()

    @pytest.mark.asyncio
    async def test_medium_confidence_sets_needs_confirmation_and_raises(self, settings) -> None:
        """A MEDIUM-confidence result exposes a best guess but still halts the pipeline.

        A single seed-url candidate with a matching name but no organization
        number or location data to corroborate it lands in the MEDIUM band:
        plausible, but not enough to trust automatically.
        """
        provider = MockDiscoveryProvider(
            brfs_to_return=[
                {
                    "name": "BRF Björken",
                    "url": "https://brf-bjorken.se",
                    "source": DiscoverySource.SEED_URL,
                }
            ]
        )
        job = Job(brf_name="BRF Björken")
        context = JobContext(settings=settings, discovery_engine=DiscoveryEngine(providers=[provider]))

        with pytest.raises(BRFScraperError):
            await DiscoveryStage().run(job, context)

        assert job.result.confidence_band == "medium"
        assert job.result.needs_confirmation is True
        assert job.result.website_url is not None

        if context.verified_registry is not None:
            await context.verified_registry.close()
