"""JobService - the single entry point external callers should use.

A future FastAPI service only needs to call `JobService.create()` (and
`.get()` / `.list()` for polling); everything else - persistence, stage
orchestration, confidence gating - happens underneath it unchanged.
"""

from __future__ import annotations

from uuid import UUID

from brf_scraper.config import AppSettings
from brf_scraper.exceptions import BRFScraperError
from brf_scraper.jobs.models import Job, JobStatus
from brf_scraper.jobs.repository import JobRepository, SqliteJobRepository
from brf_scraper.jobs.runner import JobRunner


class JobService:
    """Facade over Job creation, execution, and lookup.

    Runs jobs inline within `create()` today (single process, no queue).
    A future background worker can call `create(..., run_immediately=False)`
    to only persist the QUEUED job, then `run(job_id)` from a worker loop -
    the same method `create()` already uses internally - without any
    change to this class or its callers.
    """

    def __init__(self, repository: JobRepository, runner: JobRunner) -> None:
        """Initialize the service.

        Args:
            repository: Job persistence.
            runner: Stage executor used to advance a Job to completion.
        """
        self._repository = repository
        self._runner = runner

    @classmethod
    def build(cls, settings: AppSettings | None = None) -> JobService:
        """Construct a JobService wired to SQLite persistence.

        Convenience factory for callers (CLI, future API) that don't need
        custom repository/runner implementations.

        Args:
            settings: Application settings; defaults to a fresh AppSettings().

        Returns:
            A JobService ready to `initialize()`.
        """
        settings = settings or AppSettings()
        repository = SqliteJobRepository(database_url=settings.database.url)
        runner = JobRunner(repository=repository, settings=settings)
        return cls(repository=repository, runner=runner)

    async def initialize(self) -> None:
        """Initialize underlying storage."""
        await self._repository.initialize()

    async def close(self) -> None:
        """Release underlying storage resources."""
        await self._repository.close()

    async def create(
        self,
        brf_name: str,
        organization_number: str | None = None,
        manual_website_url: str | None = None,
        run_immediately: bool = True,
    ) -> Job:
        """Create a Job for "analyse BRF X" and, by default, run it.

        The Job is persisted as QUEUED before anything else happens, so it
        exists and is visible via get()/list() even if execution then fails.

        Args:
            brf_name: Name of the BRF to analyse.
            organization_number: Known organization number, if any.
            manual_website_url: A website URL supplied by the caller,
                bypassing Discovery entirely for this job.
            run_immediately: Run the job inline before returning. Set False
                to only enqueue it, e.g. for a future background worker to
                pick up via run().

        Returns:
            The created Job (QUEUED if run_immediately is False, otherwise
            in its final COMPLETED/FAILED state).
        """
        job = Job(brf_name=brf_name, organization_number=organization_number)
        await self._repository.save(job)

        if run_immediately:
            job = await self._runner.run(job, manual_website_url=manual_website_url)

        return job

    async def run(self, job_id: UUID, manual_website_url: str | None = None) -> Job:
        """Run a previously created (e.g. QUEUED) Job to completion.

        This is what a future background worker loop would call after
        pulling a QUEUED job id from the repository.

        Args:
            job_id: The Job to run.
            manual_website_url: A website URL supplied by the caller,
                bypassing Discovery entirely for this run.

        Returns:
            The Job in its final state.

        Raises:
            BRFScraperError: If no Job with this id exists.
        """
        job = await self._repository.get(job_id)
        if job is None:
            raise BRFScraperError(message=f"Job not found: {job_id}")

        return await self._runner.run(job, manual_website_url=manual_website_url)

    async def get(self, job_id: UUID) -> Job | None:
        """Fetch a Job by id.

        Args:
            job_id: The Job's id.

        Returns:
            The Job, or None if it doesn't exist.
        """
        return await self._repository.get(job_id)

    async def list(
        self,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        """List Jobs, newest first.

        Args:
            status: Optional status filter.
            limit: Maximum number of results.
            offset: Result offset for pagination.

        Returns:
            Matching Jobs, ordered by creation time descending.
        """
        return await self._repository.list(status=status, limit=limit, offset=offset)

    async def __aenter__(self) -> JobService:
        await self.initialize()
        return self

    async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        await self.close()
