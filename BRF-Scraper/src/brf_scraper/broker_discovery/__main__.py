"""Standalone CLI for manually validating broker-site document discovery
against real listings, before any FastAPI/Next.js wiring exists.

Usage:
    python -m brf_scraper.broker_discovery <hemnet_url> [--download]

Mirrors Scraping-test/scrape.py's CLI ergonomics (the proven PoC this
module replaces the ad-hoc Playwright-headless=False version of), but
routes through Camoufox first per the production fallback chain in
engine.py.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from brf_scraper.broker_discovery.broker_link import find_broker_link_in_html
from brf_scraper.broker_discovery.engine import BrokerDiscoveryEngine
from brf_scraper.broker_discovery.heuristics import safe_filename
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

DOWNLOAD_ROOT = Path("data/broker_discovery_downloads")


async def _fetch_hemnet_html(hemnet_url: str) -> str:
    """Same Camoufox headless=True fetch as api/server.py::_browser_fetch —
    duplicated locally (not imported) because api/server.py lives outside
    this package and this CLI needs to run standalone."""
    from camoufox.async_api import AsyncCamoufox

    async with AsyncCamoufox(headless=True) as browser:
        page = await browser.new_page()
        try:
            await page.goto(hemnet_url, wait_until="load", timeout=30000)
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            return await page.content()
        finally:
            await page.close()


async def main(hemnet_url: str, download: bool) -> int:
    print(f"Hämtar Hemnet-annons: {hemnet_url}")
    html = await _fetch_hemnet_html(hemnet_url)

    print("Letar efter mäklarlänk...")
    broker_url = find_broker_link_in_html(html, hemnet_url)
    if not broker_url:
        print("Kunde inte hitta mäklarlänken. Avbryter.")
        return 1
    print(f"Hittade mäklarlänk: {broker_url}")

    print("Söker dokument på mäklarens sida...")
    result = await BrokerDiscoveryEngine().discover_documents(hemnet_url, broker_url)

    print(f"\nProvider som lyckades: {result.provider_used or '(ingen)'}")
    if result.errors:
        print("Fel/försök under vägen:")
        for err in result.errors:
            print(f"  - {err}")

    if not result.documents:
        print("\nInga dokument hittades.")
        return 0

    print(f"\nHittade {len(result.documents)} dokument:")
    for doc in result.documents:
        print(f"  [{doc.doc_type.value}] {doc.link_text[:60]!r} -> {doc.url}")

    if download:
        from brf_scraper.downloader.downloader import Downloader
        from brf_scraper.downloader.models import DownloadRequest

        slug = safe_filename(hemnet_url.rstrip("/").split("/")[-1] or "bostad")
        out_dir = DOWNLOAD_ROOT / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        downloader = Downloader()
        await downloader.initialize()
        try:
            for doc in result.documents:
                req = DownloadRequest(
                    source_url=broker_url,
                    document_url=doc.url,
                    filename=doc.guessed_filename,
                )
                dl_result = await downloader.download(req)
                if dl_result.is_success and dl_result.document:
                    path = out_dir / safe_filename(doc.guessed_filename)
                    # download() doesn't write to disk itself (see
                    # downloader.py) — it hands back checksummed bytes via
                    # the Document model's caller-supplied metadata path in
                    # production; for this CLI we re-fetch is unnecessary,
                    # httpx already has the bytes in-memory during download(),
                    # so just re-request via download_bytes for simplicity.
                    content = await downloader.download_bytes(doc.url)
                    path.write_bytes(content)
                    print(f"    OK: sparad som {path}")
                else:
                    print(f"    MISSLYCKADES: {doc.url} ({dl_result.error})")
        finally:
            await downloader.close()

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hemnet_url")
    parser.add_argument("--download", action="store_true", help="Ladda ner hittade dokument")
    args = parser.parse_args()

    sys.exit(asyncio.run(main(args.hemnet_url, args.download)))
