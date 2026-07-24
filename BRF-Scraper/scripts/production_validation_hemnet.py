"""Production validation: real Hemnet listings across many municipalities
through the full acquisition pipeline, end to end.

    Hemnet URL -> address -> BRF identification -> website discovery
        -> annual report discovery -> PDF download

No pipeline changes are made here - this script only collects real listing
URLs from Hemnet's public search and runs the existing
`acquire_from_hemnet_url` pipeline against each one, then reports where
each stage succeeded or failed.

Usage:
    .venv/Scripts/python.exe scripts/production_validation_hemnet.py [N]

N defaults to 20 (approximate - the actual count depends on how many
distinct municipalities have live apartment listings at run time).
"""

from __future__ import annotations

import asyncio
import csv
import re
import sys
from collections import Counter
from pathlib import Path

from brf_scraper.browser.camoufox_provider import CamoufoxProvider
from brf_scraper.browser.models import BrowserConfig
from brf_scraper.discovery.acquisition_pipeline import AcquisitionReport, acquire_from_hemnet_url
from bs4 import BeautifulSoup

HEMNET_SEARCH_URL = "https://www.hemnet.se/bostader?item_types%5B%5D=bostadsratt"
LISTING_LINK_RE = re.compile(r"/bostad/lagenhet-")
MUNICIPALITY_RE = re.compile(r"-([a-z\-]+kommun)-")

DOWNLOAD_DIR = Path("data/production_validation/pdfs")
CSV_FILE = Path("data/production_validation/results.csv")
SUMMARY_FILE = Path("data/production_validation/summary.md")


async def collect_listing_urls(target_count: int, search_pages: int = 5) -> list[tuple[str, str]]:
    """Collect (url, municipality) pairs spread across distinct municipalities.

    Pages through Hemnet's public apartment search and picks at most one
    listing per municipality, so the sample isn't dominated by whichever
    city happens to have the most fresh listings.
    """
    provider = CamoufoxProvider()
    by_municipality: dict[str, str] = {}

    for page in range(1, search_pages + 1):
        if len(by_municipality) >= target_count:
            break
        url = f"{HEMNET_SEARCH_URL}&page={page}"
        print(f"Collecting listings: page {page} ...", flush=True)
        result = await provider.fetch(url, config=BrowserConfig(timeout=45.0))
        if not result.is_success:
            print(f"  search page fetch failed: {result.error}", flush=True)
            continue

        soup = BeautifulSoup(result.html, "lxml")
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if not LISTING_LINK_RE.search(href):
                continue
            match = MUNICIPALITY_RE.search(href)
            if not match:
                continue
            municipality = match.group(1)
            if municipality in by_municipality:
                continue
            full_url = href.split("?")[0]
            if not full_url.startswith("http"):
                full_url = f"https://www.hemnet.se{full_url}"
            by_municipality[municipality] = full_url

    items = list(by_municipality.items())[:target_count]
    return [(url, muni) for muni, url in items]


def _stage_result(report: AcquisitionReport) -> dict[str, str]:
    listing = report.listing
    acq = report.acquisition

    brf_identified = bool(listing and listing.brf_name)
    website_found = bool(acq and acq.official_website)
    annual_report_found = bool(acq and acq.annual_reports)
    pdf_downloaded = bool(acq and acq.downloaded_ok)

    failure_reason = ""
    if not brf_identified:
        failure_reason = "brf_not_identified"
        if report.errors:
            failure_reason = report.errors[0]
    elif not (acq and acq.resolved):
        failure_reason = "; ".join(acq.errors) if acq and acq.errors else "brf_not_resolved_on_allabrf"
    elif not website_found:
        failure_reason = "official_website_not_found"
    elif not annual_report_found:
        failure_reason = "no_annual_reports_listed"
    elif not pdf_downloaded:
        failed = [d.error or "unknown" for d in acq.downloads if d.status == "failed"] if acq else []
        failure_reason = "; ".join(failed) if failed else "download_failed"

    return {
        "brf_identified": str(brf_identified),
        "website_found": str(website_found),
        "annual_report_found": str(annual_report_found),
        "pdf_downloaded": str(pdf_downloaded),
        "failure_reason": failure_reason,
    }


async def main(target_count: int) -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CSV_FILE.parent.mkdir(parents=True, exist_ok=True)

    listings = await collect_listing_urls(target_count)
    print(f"\nCollected {len(listings)} listings across {len(listings)} distinct municipalities.\n", flush=True)

    rows: list[dict[str, str]] = []
    for i, (url, municipality) in enumerate(listings, 1):
        print(f"[{i}/{len(listings)}] {municipality}: {url}", flush=True)
        report = await acquire_from_hemnet_url(url, DOWNLOAD_DIR)
        stage = _stage_result(report)

        row = {
            "municipality": municipality,
            "hemnet_url": url,
            "address": report.listing.address if report.listing else "",
            "brf_name": report.listing.brf_name if report.listing else "",
            **stage,
            "stage_reached": report.stage_reached,
            "pipeline_success": str(report.success),
        }
        rows.append(row)
        print(
            f"    brf={row['brf_identified']} website={row['website_found']} "
            f"annual_report={row['annual_report_found']} pdf={row['pdf_downloaded']} "
            f"| {row['failure_reason']}",
            flush=True,
        )

    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)

    def rate(field: str) -> tuple[int, float]:
        count = sum(1 for r in rows if r[field] == "True")
        return count, (count / total * 100) if total else 0.0

    brf_n, brf_pct = rate("brf_identified")
    web_n, web_pct = rate("website_found")
    ar_n, ar_pct = rate("annual_report_found")
    pdf_n, pdf_pct = rate("pdf_downloaded")

    failure_reasons = Counter(r["failure_reason"] for r in rows if r["failure_reason"])
    top_failures = failure_reasons.most_common(10)

    summary_lines = [
        "# Production Validation - Hemnet Acquisition Pipeline",
        "",
        f"Total listings tested: {total}",
        f"BRF identification success rate: {brf_n}/{total} ({brf_pct:.1f}%)",
        f"Website discovery success rate: {web_n}/{total} ({web_pct:.1f}%)",
        f"Annual report discovery success rate: {ar_n}/{total} ({ar_pct:.1f}%)",
        f"PDF download success rate: {pdf_n}/{total} ({pdf_pct:.1f}%)",
        "",
        "## Top failure reasons",
        "",
    ]
    if top_failures:
        for reason, count in top_failures:
            summary_lines.append(f"- {reason}: {count}")
    else:
        summary_lines.append("- none")

    summary_lines += [
        "",
        f"CSV: {CSV_FILE}",
        f"PDFs: {DOWNLOAD_DIR}",
    ]
    summary_text = "\n".join(summary_lines)
    SUMMARY_FILE.write_text(summary_text, encoding="utf-8")

    print("\n" + "=" * 70)
    print(summary_text)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    asyncio.run(main(n))
