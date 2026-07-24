"""CLI entry point.

    python -m market_intelligence --country SE
    python -m market_intelligence --country SE --municipality Stockholm -v

Prints the Market Intelligence Package as JSON.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from market_intelligence.builder import PackageBuilder
from market_intelligence.cache import ProviderCache
from market_intelligence.config import EngineConfig
from market_intelligence.context import MarketContext
from market_intelligence.providers import default_registry
from market_intelligence.runner import EngineRunner


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="market_intelligence",
        description="Collect a Market Intelligence Package for a geographic region.",
    )
    parser.add_argument("--country", default=None, help="country code (e.g. SE)")
    parser.add_argument("--region", default=None, help="region name")
    parser.add_argument("--county", default=None, help="county name")
    parser.add_argument("--municipality", default=None, help="municipality name")
    parser.add_argument("--postal-code", default=None, help="postal code")
    parser.add_argument("--as-of", default=None, help="date to query (ISO-8601)")
    parser.add_argument("--cache-dir", type=Path, default=None)
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        stream=sys.stderr,
        format="%(levelname)s %(name)s: %(message)s",
    )

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    config = EngineConfig.from_env()
    if args.cache_dir is not None:
        import dataclasses

        config = dataclasses.replace(config, cache_dir=args.cache_dir)

    context = MarketContext(
        country=args.country,
        region=args.region,
        county=args.county,
        municipality=args.municipality,
        postal_code=args.postal_code,
        as_of=args.as_of,
    )

    cache = None if args.no_cache else ProviderCache(config.cache_dir)
    runner = EngineRunner(default_registry(), config, cache=cache)
    runs = runner.run(context)
    package = PackageBuilder().build(context, runs)
    print(package.to_json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
