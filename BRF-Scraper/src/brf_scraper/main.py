"""CLI entrypoint for BRF Scraper."""

from __future__ import annotations

import asyncio
from uuid import UUID

import typer
from rich.console import Console
from rich.table import Table

from brf_scraper import __version__
from brf_scraper.config import AppSettings
from brf_scraper.jobs.models import Job
from brf_scraper.utils.logging import get_logger, setup_logging

# Create CLI app
app = typer.Typer(
    name="brf-scraper",
    help="BRF (Bostadsrättsförening) annual report scraper",
    add_completion=False,
)
job_app = typer.Typer(name="job", help="Create and inspect BRF analysis jobs.")
app.add_typer(job_app)
console = Console()
logger = get_logger(__name__)


@app.callback(invoke_without_command=True)
def main(
    version: bool | None = typer.Option(
        None,
        "--version",
        "-v",
        help="Show version and exit.",
    ),
    debug: bool = typer.Option(
        False,
        "--debug",
        help="Enable debug mode.",
    ),
    config_file: str | None = typer.Option(
        None,
        "--config",
        "-c",
        help="Path to configuration file.",
    ),
) -> None:
    """BRF Scraper - Production-ready BRF annual report scraper."""
    if version:
        console.print(f"[bold green]brf-scraper[/] version [cyan]{__version__}[/]")
        raise typer.Exit()

    # Setup logging
    settings = AppSettings()
    if debug:
        settings.debug = True
        settings.logging.level = "DEBUG"

    setup_logging(
        level=settings.logging.level,
        format_type=settings.logging.format,
    )


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Host to bind to."),
    port: int = typer.Option(8000, help="Port to bind to."),
    workers: int = typer.Option(1, help="Number of workers."),
) -> None:
    """Start the API server."""
    console.print(f"[bold green]Starting BRF Scraper server on {host}:{port}[/]")

    # TODO: Implement server startup
    console.print("[yellow]Server implementation pending[/]")


@app.command()
def crawl(
    brf_name: str = typer.Argument(..., help="BRF name to crawl (e.g. 'BRF Solgläntan')."),
    depth: int = typer.Option(2, help="Crawl depth."),
    max_pages: int = typer.Option(20, help="Maximum pages to crawl."),
) -> None:
    """Crawl a BRF end-to-end: discover its website, crawl it, download
    PDFs, verify checksums, and store metadata.

    This is the primary manual verification tool for the pipeline.
    """
    from brf_scraper.pipeline.crawl_pipeline import CrawlPipeline, format_crawl_report

    console.print(f"[bold green]Crawling BRF: {brf_name}[/]")

    pipeline = CrawlPipeline(brf_name=brf_name, max_depth=depth, max_pages=max_pages)
    report = asyncio.run(pipeline.run())

    console.print(format_crawl_report(report))

    raise typer.Exit(code=0 if report.passed else 1)


def _parse_job_id(value: str) -> UUID:
    """Parse a job id argument, raising a clean CLI error if invalid."""
    try:
        return UUID(value)
    except ValueError as e:
        raise typer.BadParameter(f"'{value}' is not a valid job id") from e


def _format_job_summary(job: Job) -> str:
    """One-line status summary for a Job."""
    return f"{job.id}  [{job.status.value.upper()}]  {job.brf_name}"


def _print_job_detail(job: Job) -> None:
    """Print a full, readable report for a Job."""
    console.print(f"[bold]Job:[/] {job.id}")
    console.print(f"[bold]BRF:[/] {job.brf_name}")
    if job.organization_number:
        console.print(f"[bold]Organization number:[/] {job.organization_number}")
    console.print(f"[bold]Status:[/] {job.status.value.upper()}")
    console.print(f"[bold]Created:[/] {job.created_at}")
    console.print(f"[bold]Updated:[/] {job.updated_at}")
    if job.completed_at:
        console.print(f"[bold]Completed:[/] {job.completed_at}")

    result = job.result
    console.print("")
    console.print(f"Website: {result.website_url or 'Not found'}")
    if result.confidence_band:
        console.print(
            f"Discovery confidence: {result.confidence_band.upper()} "
            f"({result.confidence_score:.2f})"
        )
        if result.confidence_explanation:
            console.print(f"  {result.confidence_explanation}")
    if result.needs_confirmation:
        console.print("[yellow]ACTION REQUIRED: best-guess website needs user confirmation.[/]")

    console.print(f"Pages crawled: {result.pages_crawled}")
    console.print(f"PDFs found: {result.pdfs_found}")
    console.print(f"Annual reports detected: {result.annual_reports_detected}")
    console.print(f"Downloaded: {len(result.downloaded_documents)}")
    console.print(f"Duplicates: {result.duplicate_documents}")
    console.print(f"Download errors: {result.download_errors}")

    if result.downloaded_documents:
        console.print("")
        console.print("Downloaded files:")
        for filename in result.downloaded_documents:
            console.print(f"- {filename}")

    if job.error:
        console.print("")
        console.print(f"[bold red]Failed at stage:[/] {job.error.stage}")
        console.print(f"[bold red]Error:[/] {job.error.message}")


@job_app.command(name="create")
def job_create(
    brf_name: str = typer.Argument(..., help="BRF name to analyse (e.g. 'BRF Solgläntan')."),
    organization_number: str | None = typer.Option(
        None, "--organization-number", "--org", help="Known organization number, if any."
    ),
    website_url: str | None = typer.Option(
        None,
        "--website-url",
        "--url",
        help="Official website URL, if already known. Skips Discovery entirely.",
    ),
    no_run: bool = typer.Option(
        False, "--no-run", help="Only create the job (QUEUED); don't run it now."
    ),
) -> None:
    """Create a job to analyse a BRF: discover its website, crawl it, and
    download its annual reports.
    """
    from brf_scraper.jobs.service import JobService

    async def _run() -> None:
        async with JobService.build() as service:
            job = await service.create(
                brf_name=brf_name,
                organization_number=organization_number,
                manual_website_url=website_url,
                run_immediately=not no_run,
            )
            console.print(f"[bold green]Created job {job.id}[/]")
            if no_run:
                console.print("Status: QUEUED (not run)")
            else:
                _print_job_detail(job)

    asyncio.run(_run())


@job_app.command(name="status")
def job_status(job_id: str = typer.Argument(..., help="Job id.")) -> None:
    """Show a job's current status."""
    from brf_scraper.jobs.service import JobService

    parsed_id = _parse_job_id(job_id)

    async def _run() -> None:
        async with JobService.build() as service:
            job = await service.get(parsed_id)
            if job is None:
                console.print(f"[bold red]No such job: {job_id}[/]")
                raise typer.Exit(code=1)
            console.print(_format_job_summary(job))

    asyncio.run(_run())


@job_app.command(name="show")
def job_show(job_id: str = typer.Argument(..., help="Job id.")) -> None:
    """Show full details for a job, including discovery, crawl, and download results."""
    from brf_scraper.jobs.service import JobService

    parsed_id = _parse_job_id(job_id)

    async def _run() -> None:
        async with JobService.build() as service:
            job = await service.get(parsed_id)
            if job is None:
                console.print(f"[bold red]No such job: {job_id}[/]")
                raise typer.Exit(code=1)
            _print_job_detail(job)

    asyncio.run(_run())


@job_app.command(name="list")
def job_list(
    status: str | None = typer.Option(
        None, "--status", help="Filter by status (queued/discovering/crawling/downloading/completed/failed)."
    ),
    limit: int = typer.Option(50, help="Maximum number of jobs to show."),
) -> None:
    """List jobs, newest first."""
    from brf_scraper.jobs.models import JobStatus
    from brf_scraper.jobs.service import JobService

    status_filter: JobStatus | None = None
    if status is not None:
        try:
            status_filter = JobStatus(status.lower())
        except ValueError as e:
            raise typer.BadParameter(
                f"'{status}' is not a valid status. Choose from: "
                f"{', '.join(s.value for s in JobStatus)}"
            ) from e

    async def _run() -> None:
        async with JobService.build() as service:
            jobs = await service.list(status=status_filter, limit=limit)

            if not jobs:
                console.print("[yellow]No jobs found.[/]")
                return

            table = Table(title="BRF Analysis Jobs")
            table.add_column("Job ID", style="cyan")
            table.add_column("BRF", style="green")
            table.add_column("Status")
            table.add_column("Website")
            table.add_column("Created")
            for job in jobs:
                table.add_row(
                    str(job.id),
                    job.brf_name,
                    job.status.value.upper(),
                    job.result.website_url or "-",
                    job.created_at.strftime("%Y-%m-%d %H:%M"),
                )
            console.print(table)

    asyncio.run(_run())


@app.command()
def extract(
    pdf_path: str = typer.Argument(..., help="Path to PDF file."),
    output: str | None = typer.Option(
        None,
        "--output",
        "-o",
        help="Output JSON file.",
    ),
) -> None:
    """Extract data from a PDF annual report."""
    console.print(f"[bold green]Extracting: {pdf_path}[/]")

    # TODO: Implement extract command
    console.print("[yellow]Extract implementation pending[/]")


@app.command(name="smoke-test")
def smoke_test(
    brf_name: str = typer.Argument(..., help="BRF name to test (e.g. 'BRF Solgläntan')"),
) -> None:
    """Run an end-to-end smoke test for a BRF.

    Discovers the official website, crawls it, finds PDFs,
    identifies annual reports, downloads them, and verifies checksums.
    """
    from brf_scraper.smoke_test import SmokeTest, format_report

    console.print(f"[bold green]Running smoke test for: {brf_name}[/]")

    test = SmokeTest(brf_name=brf_name)
    report = asyncio.run(test.run())

    console.print(format_report(report))

    raise typer.Exit(code=0 if report.passed else 1)


db = app.command(name="db")


@app.command(name="db-init")
def db_init() -> None:
    """Initialize the database."""
    console.print("[bold green]Initializing database...[/]")

    # TODO: Implement database initialization
    console.print("[yellow]Database initialization pending[/]")


@app.command(name="db-migrate")
def db_migrate() -> None:
    """Run database migrations."""
    console.print("[bold green]Running migrations...[/]")

    # TODO: Implement database migrations
    console.print("[yellow]Migration implementation pending[/]")


@app.command(name="db-upgrade")
def db_upgrade() -> None:
    """Upgrade database to latest version."""
    console.print("[bold green]Upgrading database...[/]")

    # TODO: Implement database upgrade
    console.print("[yellow]Database upgrade pending[/]")


@app.command()
def schedule() -> None:
    """Start the scheduler for periodic crawls."""
    console.print("[bold green]Starting scheduler...[/]")

    # TODO: Implement scheduler
    console.print("[yellow]Scheduler implementation pending[/]")


@app.command()
def status() -> None:
    """Show application status."""
    settings = AppSettings()

    table = Table(title="BRF Scraper Status")
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Version", __version__)
    table.add_row("Environment", settings.env)
    table.add_row("Debug", str(settings.debug))
    table.add_row("Database URL", settings.database.url)
    table.add_row("Redis URL", settings.redis.url)
    table.add_row("PDF Directory", str(settings.storage.pdf_dir))
    table.add_row("Export Directory", str(settings.storage.export_dir))

    console.print(table)


@app.command()
def info() -> None:
    """Show application information."""
    console.print("[bold]BRF Scraper[/]")
    console.print(f"Version: {__version__}")
    console.print("Production-ready BRF annual report scraper")
    console.print("\n[bold]Commands:[/]")
    console.print("  serve       - Start the API server")
    console.print("  crawl       - Crawl a BRF website")
    console.print("  extract     - Extract data from PDF")
    console.print("  smoke-test  - Run end-to-end smoke test")
    console.print("  db          - Database management")
    console.print("  schedule    - Start scheduler")
    console.print("  status      - Show status")


if __name__ == "__main__":
    app()
