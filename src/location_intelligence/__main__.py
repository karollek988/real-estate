"""CLI entry point (task F-08).

    python -m location_intelligence "Dalagatan 30, Stockholm"
    python -m location_intelligence "59.343, 18.049" -v

Prints the Location Intelligence Package as JSON. With Wave 1's empty
default registry the package is valid and honest — and mostly empty.
"""

from __future__ import annotations

import argparse
import dataclasses
import logging
import sys
from pathlib import Path

from location_intelligence.builder import PackageBuilder
from location_intelligence.cache import ProviderCache
from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.providers import default_registry
from location_intelligence.runner import EngineRunner


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="location_intelligence",
        description="Collect a Location Intelligence Package for a Swedish property.",
    )
    parser.add_argument("input", help='address ("Dalagatan 30, Stockholm") or "lat,lon"')
    parser.add_argument("--cache-dir", type=Path, default=None, help="override cache directory")
    parser.add_argument("--no-cache", action="store_true", help="disable the provider cache")
    parser.add_argument("-v", "--verbose", action="store_true", help="debug logging to stderr")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        stream=sys.stderr,
        format="%(levelname)s %(name)s: %(message)s",
    )

    # The package is UTF-8 JSON; never let a legacy Windows console
    # codepage (cp1252) mangle it when stdout is redirected to a file.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    config = EngineConfig.from_env()
    if args.cache_dir is not None:
        config = dataclasses.replace(config, cache_dir=args.cache_dir)

    context = context_from_raw_input(args.input)
    cache = None if args.no_cache else ProviderCache(config.cache_dir)
    runner = EngineRunner(default_registry(), config, cache=cache)
    enriched_context, runs = runner.run(context)
    package = PackageBuilder().build(enriched_context, runs)
    print(package.to_json())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
