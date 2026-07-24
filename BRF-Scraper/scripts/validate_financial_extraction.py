"""Production-safety validation suite for financial_extractor.py.

Re-runs the same 9 annual reports EXTRACTION_VALIDATION.md was built from
(now in validation_reports/) through extract_annual_report(), and reports
not coverage (how much was found) but SAFETY (how much of what was found
is trustworthy enough to reach a paying customer).

Usage:
    .venv/Scripts/python.exe scripts/validate_financial_extraction.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_src = Path(__file__).resolve().parent.parent / "src"
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from brf_scraper.extractor.engine import extract_annual_report

VALIDATION_DIR = Path(__file__).resolve().parent.parent.parent / "validation_reports"


def classify(result) -> str:
    if not result.is_text_based:
        return "blocked_not_text_based"
    if not result.has_verified_financial_data:
        return "blocked_insufficient_verified_data"
    discarded = [v for v in result.verification.values() if not v.verified]
    if discarded:
        return "safe_with_omissions"
    return "safe"


def main() -> None:
    pdfs = sorted(VALIDATION_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {VALIDATION_DIR}")
        return

    per_file = []
    for pdf in pdfs:
        result = extract_annual_report(str(pdf))
        discarded = [v for v in result.verification.values() if not v.verified]
        verified_count = len(result.verification) - len(discarded)

        per_file.append({
            "filename": pdf.name,
            "fiscal_year": result.fiscal_year,
            "raw_fields_extracted": result.total_values_extracted,
            "verified_fields": verified_count,
            "discarded_fields": len(discarded),
            "average_raw_confidence": round(result.average_confidence, 3),
            "has_verified_financial_data": result.has_verified_financial_data,
            "status": classify(result),
            "discarded_detail": [
                {"field": v.field, "value": v.value, "confidence": round(v.confidence, 2),
                 "tier": v.tier.value, "reason": v.validation_reason}
                for v in discarded
            ],
        })

    n = len(per_file)
    safe = sum(1 for r in per_file if r["status"] == "safe")
    safe_with_omissions = sum(1 for r in per_file if r["status"] == "safe_with_omissions")
    blocked = sum(1 for r in per_file if r["status"].startswith("blocked"))

    summary = {
        "reports_processed": n,
        "safe_reports": safe,
        "reports_with_omitted_financial_analysis": safe_with_omissions,
        "reports_blocked_insufficient_verified_data": blocked,
        "total_raw_fields": sum(r["raw_fields_extracted"] for r in per_file),
        "total_verified_fields": sum(r["verified_fields"] for r in per_file),
        "total_discarded_fields": sum(r["discarded_fields"] for r in per_file),
    }

    out = {"summary": summary, "per_file": per_file}
    out_path = Path(__file__).resolve().parent.parent.parent / "validation_reports" / "financial_extraction_safety_report.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=" * 70)
    print("FINANCIAL EXTRACTION SAFETY VALIDATION")
    print("=" * 70)
    print(f"Reports processed:                          {n}")
    print(f"Safe (verified data, nothing discarded):    {safe}")
    print(f"Safe with omissions (some fields discarded): {safe_with_omissions}")
    print(f"Blocked (insufficient verified data):        {blocked}")
    print(f"Total raw fields extracted:                  {summary['total_raw_fields']}")
    print(f"Total verified (scoring-eligible) fields:    {summary['total_verified_fields']}")
    print(f"Total discarded fields:                       {summary['total_discarded_fields']}")
    print()
    for r in per_file:
        print(f"  {r['filename']:45s} {r['status']:32s} verified={r['verified_fields']:2d} discarded={r['discarded_fields']:2d}")
    print()
    print(f"Full report written to: {out_path}")


if __name__ == "__main__":
    main()
