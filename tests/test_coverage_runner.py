"""Test runner for coverage analysis.

Processes all 30 Hemnet listings through the profile engine,
collects coverage reports, and generates a summary.

Usage:
    python test_coverage_runner.py [--limit N] [--output coverage_results.json]
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# Add paths
_scraper_src = Path(__file__).resolve().parent.parent / "BRF-Scraper" / "src"
if str(_scraper_src) not in sys.path:
    sys.path.insert(0, str(_scraper_src))

_api_dir = Path(__file__).resolve().parent.parent / "api"
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from test_coverage_listings import HEMNET_LISTINGS
from brf_scraper.profile.engine import ProfileEngine
from brf_scraper.profile.coverage import generate_coverage_report, PropertyCoverage


async def _browser_fetch(url: str) -> str:
    """Fetch a URL using Camoufox."""
    from camoufox.async_api import AsyncCamoufox

    async with AsyncCamoufox(headless=True) as browser:
        page = await browser.new_page()
        try:
            await page.goto(url, wait_until="load", timeout=30000)
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass
            return await page.content()
        finally:
            await page.close()


async def process_listing(
    hemnet_url: str,
    municipality: str,
    description: str,
    index: int,
    total: int,
) -> dict:
    """Process a single listing and return results."""
    print(f"[{index+1}/{total}] {description} ({municipality})")
    start = time.time()

    try:
        engine = ProfileEngine(browser_fetch=_browser_fetch)
        profile = await engine.build(hemnet_url=hemnet_url)
        coverage = generate_coverage_report(profile, hemnet_url=hemnet_url)
        elapsed = time.time() - start

        print(f"  -> Coverage: {coverage.overall_coverage:.0%}, "
              f"Confidence: {coverage.overall_confidence:.0%}, "
              f"Time: {elapsed:.1f}s")

        return {
            "hemnet_url": hemnet_url,
            "municipality": municipality,
            "description": description,
            "success": True,
            "elapsed_seconds": round(elapsed, 1),
            "coverage": json.loads(coverage.model_dump_json()),
        }
    except Exception as e:
        elapsed = time.time() - start
        print(f"  -> ERROR: {type(e).__name__}: {e}")
        return {
            "hemnet_url": hemnet_url,
            "municipality": municipality,
            "description": description,
            "success": False,
            "error": str(e),
            "elapsed_seconds": round(elapsed, 1),
        }


def generate_summary(results: list[dict]) -> dict:
    """Generate a coverage summary from all results."""
    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    if not successful:
        return {"error": "No successful results"}

    # Aggregate field coverage
    field_stats: dict[str, dict] = {}
    for r in successful:
        cov = r["coverage"]
        for field in cov.get("fields", []):
            key = field["field"]
            if key not in field_stats:
                field_stats[key] = {
                    "field": key,
                    "category": field["category"],
                    "populated_count": 0,
                    "total_count": 0,
                    "sources": {},
                }
            field_stats[key]["total_count"] += 1
            if field["populated"]:
                field_stats[key]["populated_count"] += 1
                src = field.get("source", "unknown")
                field_stats[key]["sources"][src] = (
                    field_stats[key]["sources"].get(src, 0) + 1
                )

    # Calculate coverage percentages
    for stats in field_stats.values():
        stats["coverage_pct"] = (
            stats["populated_count"] / stats["total_count"]
            if stats["total_count"] > 0 else 0
        )

    # Sort by coverage (lowest first to identify gaps)
    sorted_fields = sorted(field_stats.values(), key=lambda x: x["coverage_pct"])

    # Source availability
    source_stats = {
        "hemnet": sum(1 for r in successful if r["coverage"].get("hemnet_found")),
        "booli": sum(1 for r in successful if r["coverage"].get("booli_matched")),
        "allabrf": sum(1 for r in successful if r["coverage"].get("allabrf_matched")),
        "official_website": sum(1 for r in successful if r["coverage"].get("official_website_found")),
    }

    # Document stats
    doc_stats = {
        "annual_reports": sum(r["coverage"].get("annual_reports_found", 0) for r in successful),
        "statutes": sum(r["coverage"].get("statutes_found", 0) for r in successful),
        "maintenance_info": sum(1 for r in successful if r["coverage"].get("maintenance_info_found")),
    }

    # Average scores
    avg_coverage = sum(r["coverage"].get("overall_coverage", 0) for r in successful) / len(successful)
    avg_confidence = sum(r["coverage"].get("overall_confidence", 0) for r in successful) / len(successful)

    # Missing fields by category
    missing_by_category: dict[str, list[str]] = {}
    for r in successful:
        for cat, fields in r["coverage"].get("missing_fields", {}).items():
            if cat not in missing_by_category:
                missing_by_category[cat] = []
            for f in fields:
                if f not in missing_by_category[cat]:
                    missing_by_category[cat].append(f)

    # Top priority fixes (fields with lowest coverage that appear in most listings)
    priority_fixes = [
        {
            "field": s["field"],
            "category": s["category"],
            "coverage_pct": round(s["coverage_pct"] * 100, 1),
            "missing_count": s["total_count"] - s["populated_count"],
            "total_listings": s["total_count"],
            "primary_source": max(s["sources"].items(), key=lambda x: x[1])[0] if s["sources"] else "none",
        }
        for s in sorted_fields[:15]  # Top 15 gaps
    ]

    return {
        "total_listings": len(results),
        "successful": len(successful),
        "failed": len(failed),
        "average_coverage": round(avg_coverage * 100, 1),
        "average_confidence": round(avg_confidence * 100, 1),
        "source_availability": {
            k: {"count": v, "pct": round(v / len(successful) * 100, 1)}
            for k, v in source_stats.items()
        },
        "document_stats": doc_stats,
        "field_coverage": [
            {
                "field": s["field"],
                "category": s["category"],
                "coverage_pct": round(s["coverage_pct"] * 100, 1),
                "populated": s["populated_count"],
                "total": s["total_count"],
            }
            for s in sorted_fields
        ],
        "missing_by_category": missing_by_category,
        "priority_fixes": priority_fixes,
        "failed_listings": [
            {"url": r["hemnet_url"], "error": r.get("error", "unknown")}
            for r in failed
        ],
    }


async def main():
    """Run the coverage test suite."""
    import argparse

    parser = argparse.ArgumentParser(description="Run coverage analysis")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of listings")
    parser.add_argument("--output", type=str, default="coverage_results.json", help="Output file")
    args = parser.parse_args()

    listings = HEMNET_LISTINGS[:args.limit] if args.limit else HEMNET_LISTINGS
    total = len(listings)

    print(f"Running coverage analysis on {total} listings...")
    print(f"{'='*60}")

    results = []
    for i, (url, muni, desc) in enumerate(listings):
        result = await process_listing(url, muni, desc, i, total)
        results.append(result)

    print(f"{'='*60}")
    print(f"Processing complete. Generating summary...")

    summary = generate_summary(results)

    # Save results
    output_path = Path(__file__).resolve().parent / args.output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "results": results,
            "summary": summary,
        }, f, indent=2, ensure_ascii=False)

    # Print summary
    print(f"\n{'='*60}")
    print("COVERAGE SUMMARY")
    print(f"{'='*60}")
    print(f"Listings: {summary['successful']}/{summary['total_listings']} successful")
    print(f"Average Coverage: {summary['average_coverage']}%")
    print(f"Average Confidence: {summary['average_confidence']}%")

    print(f"\nSource Availability:")
    for src, stats in summary["source_availability"].items():
        print(f"  {src}: {stats['count']}/{summary['successful']} ({stats['pct']}%)")

    print(f"\nDocument Stats:")
    print(f"  Annual Reports: {summary['document_stats']['annual_reports']}")
    print(f"  Statutes: {summary['document_stats']['statutes']}")
    print(f"  Maintenance Info: {summary['document_stats']['maintenance_info']}")

    print(f"\nTop Priority Fixes (fields with lowest coverage):")
    for fix in summary["priority_fixes"][:10]:
        print(f"  {fix['field']}: {fix['coverage_pct']}% "
              f"(missing {fix['missing_count']}/{fix['total_listings']})")

    print(f"\nFull results saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
