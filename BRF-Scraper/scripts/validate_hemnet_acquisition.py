"""End-to-end validation: a Hemnet listing URL to downloaded annual reports.

    Hemnet URL -> address/municipality/BRF name -> BRF (allabrf.se)
        -> official website -> annual reports -> downloaded PDFs

Usage:
    .venv/Scripts/python.exe scripts/validate_hemnet_acquisition.py <hemnet_url> [more urls...]
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from brf_scraper.discovery.acquisition_pipeline import acquire_from_hemnet_url

DOWNLOAD_DIR = Path("data/hemnet_validation/pdfs")
RESULTS_FILE = Path("data/hemnet_validation/results.jsonl")


async def main(urls: list[str]) -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    any_success = False
    with RESULTS_FILE.open("w", encoding="utf-8") as out:
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}", flush=True)
            report = await acquire_from_hemnet_url(url, DOWNLOAD_DIR)
            out.write(report.model_dump_json() + "\n")
            for line in report.summary_lines():
                print(line, flush=True)
            print(f"  stage_reached={report.stage_reached} success={report.success}", flush=True)
            any_success = any_success or report.success

    print("\n" + "=" * 70)
    print(f"Results: {RESULTS_FILE}")
    print(f"PDFs:    {DOWNLOAD_DIR}")
    print(f"At least one listing completed the full pipeline: {any_success}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print("Usage: validate_hemnet_acquisition.py <hemnet_url> [more urls...]")
        sys.exit(1)
    asyncio.run(main(sys.argv[1:]))
