"""End-to-end validation of AllabrfProvider against real BRFs.

Runs the full name -> BRF -> metadata -> documents -> download pipeline
for a fixed list of real Swedish BRF names and writes per-BRF JSON
results plus a summary table.

Usage:
    .venv/Scripts/python.exe scripts/validate_allabrf.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from brf_scraper.discovery.allabrf_provider import AllabrfProvider

# (name, city hint or None) - mix of specific known BRFs (incl. the ones
# used in earlier live validations) and common/ambiguous names.
TEST_BRFS: list[tuple[str, str | None]] = [
    ("S K F:s Anställdas Brf nr 2", "Göteborg"),
    ("Brf Vasastaden", None),
    ("Brf L 21 Ekholmen", None),
    ("Brf Ringen", "Stockholm"),
    ("Brf Gulddragaren", "Stockholm"),
    ("HSB BRF Tranan nr 259 i Stockholm", "Stockholm"),
    ("Bostadsrättsföreningen Tranan", "Gävle"),
    ("Brf Tranan i Herrljunga", "Herrljunga"),
    ("Brf Masthugget", "Göteborg"),
    ("HSB Brf Ida", "Malmö"),
    ("Brf Kungsklippan", "Stockholm"),
    ("Brf Solhem", None),
    ("Brf Björken", None),
    ("Brf Eken", None),
    ("Brf Linden", None),
    ("Brf Rosen", None),
    ("Brf Syrenen", None),
    ("Brf Kastanjen", None),
    ("Brf Näckrosen", None),
    ("Brf Vitsippan", None),
    ("Brf Blåklockan", None),
    ("Brf Domaren", None),
    ("Brf Utkiken", None),
    ("Brf Sjöstaden", None),
    ("Brf Sockerbruket", None),
]

DOWNLOAD_DIR = Path("data/allabrf_validation/pdfs")
RESULTS_FILE = Path("data/allabrf_validation/results.jsonl")


async def main() -> None:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    async with AllabrfProvider(delay_between_requests=0.7) as provider:
        with RESULTS_FILE.open("w", encoding="utf-8") as out:
            for i, (name, city) in enumerate(TEST_BRFS, 1):
                print(f"[{i:02d}/{len(TEST_BRFS)}] {name} ...", flush=True)
                try:
                    acq = await provider.acquire(name, DOWNLOAD_DIR, city=city)
                except Exception as e:  # noqa: BLE001 - keep the run going
                    print(f"    CRASH: {e}", flush=True)
                    rows.append((name, "CRASH", 0, 0, 0, str(e)))
                    out.write(json.dumps({"query": name, "crash": str(e)}) + "\n")
                    continue

                out.write(acq.model_dump_json() + "\n")

                ars = acq.annual_reports
                public_ars = [d for d in ars if d.is_downloadable]
                downloaded = acq.downloaded_ok
                status = "OK" if acq.resolved else "FAIL"
                detail = ""
                if acq.resolved and acq.candidate:
                    detail = (
                        f"{acq.candidate.name} ({acq.candidate.org_number}, "
                        f"{acq.candidate.county}, score={acq.candidate.match_score})"
                    )
                else:
                    detail = "; ".join(acq.errors)
                rows.append((name, status, len(ars), len(public_ars), len(downloaded), detail))
                print(
                    f"    {status}: AR found={len(ars)} public={len(public_ars)} "
                    f"downloaded={len(downloaded)} | {detail}",
                    flush=True,
                )

    # Summary
    resolved = sum(1 for r in rows if r[1] == "OK")
    total_ars = sum(r[2] for r in rows)
    total_public = sum(r[3] for r in rows)
    total_downloaded = sum(r[4] for r in rows)
    print("\n" + "=" * 70)
    print(f"Resolved:            {resolved}/{len(rows)}")
    print(f"Annual reports found (incl. login-gated): {total_ars}")
    print(f"Annual reports public:                    {total_public}")
    print(f"Annual reports downloaded:                {total_downloaded}")
    print(f"Results: {RESULTS_FILE}")
    print(f"PDFs:    {DOWNLOAD_DIR}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
