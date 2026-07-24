"""Refresh the bundled kommun/län register from SCB (task A-01).

    python -m location_intelligence.tools.refresh_kommun_register

Derives every kommun (4-digit code) and län (2-digit code) from the SCB
PxWeb BefolkningNy table's own Region metadata — the same authoritative
source the docs/28 SCB provider resolves municipality codes from. Never
hand-maintained: codes typed from memory are exactly the "incorrect
information" this project forbids.

Writes ``location_intelligence/data/kommun_register.json``.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path

from location_intelligence.config import EngineConfig
from location_intelligence.http_client import HttpClient

logger = logging.getLogger(__name__)

SCB_TABLE_METADATA_URL = "https://api.scb.se/OV0104/v1/doris/sv/ssd/BE/BE0101/BE0101A/BefolkningNy"

_KOMMUN_CODE = re.compile(r"^\d{4}$")
_LAN_CODE = re.compile(r"^\d{2}$")


def build_register(client: HttpClient) -> dict[str, object]:
    metadata = client.get_json(SCB_TABLE_METADATA_URL)
    if not isinstance(metadata, dict):
        raise ValueError("unexpected SCB metadata shape (not an object)")
    variables = metadata.get("variables")
    if not isinstance(variables, list):
        raise ValueError("unexpected SCB metadata shape (no variables list)")

    region = next((v for v in variables if isinstance(v, dict) and v.get("code") == "Region"), None)
    if region is None:
        raise ValueError("SCB metadata has no Region variable")
    values = region["values"]
    texts = region["valueTexts"]
    if len(values) != len(texts):
        raise ValueError("SCB Region values/valueTexts length mismatch")

    municipalities: dict[str, str] = {}
    counties: dict[str, str] = {}
    for code, name in zip(values, texts, strict=True):
        if _KOMMUN_CODE.match(code):
            municipalities[code] = name
        elif _LAN_CODE.match(code) and code != "00":
            counties[code] = name

    if len(municipalities) != 290:
        raise ValueError(
            f"expected 290 municipalities, got {len(municipalities)} — refusing to write "
            "a register that disagrees with the known Swedish municipality count"
        )
    if len(counties) != 21:
        raise ValueError(f"expected 21 counties, got {len(counties)}")

    return {
        "source": SCB_TABLE_METADATA_URL,
        "municipalities": dict(sorted(municipalities.items())),
        "counties": dict(sorted(counties.items())),
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    register = build_register(HttpClient(EngineConfig.from_env()))
    target = Path(__file__).resolve().parent.parent / "data" / "kommun_register.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(register, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    municipalities = register["municipalities"]
    assert isinstance(municipalities, dict)
    logger.info("wrote %d municipalities to %s", len(municipalities), target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
