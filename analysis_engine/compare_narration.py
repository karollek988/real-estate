"""Compare the template report against the AI-narrated report.

Runs the exact same Aggregator input (sample_annual_report.json) through
both generate_report() (template) and generate_ai_report() (AI narrator),
then diffs them. The two outputs should differ *only* inside the "Nuläge"
block - every number, table, verdict word, and traceability line must be
byte-identical, since both paths call the same, unmodified report.py
functions for everything else.

Usage:
  python compare_narration.py     # needs OPENAI_API_KEY
"""

from __future__ import annotations

import difflib
import json
import sys
from pathlib import Path

from calculator import calculate_metrics
from narrator import generate_ai_report
from narrator.openai_provider import OpenAINarrationProvider
from reasoning import run_reasoning
from report import generate_report


def main() -> None:
    json_path = Path(__file__).parent / "sample_annual_report.json"
    with open(json_path, encoding="utf-8") as f:
        extracted = json.load(f)

    report_data = extracted["annual_reports"][0]
    metrics = calculate_metrics(report_data)
    reasoning = run_reasoning(metrics)

    template_report = generate_report(extracted, metrics, reasoning)
    ai_report, ai_used = generate_ai_report(
        extracted, metrics, reasoning, OpenAINarrationProvider()
    )

    if not ai_used:
        print("AI narration failed (see log above) - nothing to compare against the "
              "template; check OPENAI_API_KEY.")
        sys.exit(1)

    diff = list(
        difflib.unified_diff(
            template_report.splitlines(keepends=True),
            ai_report.splitlines(keepends=True),
            fromfile="template_report.txt",
            tofile="ai_report.txt",
        )
    )

    print("=" * 72)
    print("  DIFF: template vs. AI-narrated report")
    print("=" * 72)
    print("".join(diff) if diff else "(no textual difference)")
    print()

    # The underlying analysis must be identical: every line outside the
    # Nuläge block must appear, unchanged, in both reports.
    template_lines = set(template_report.splitlines())
    ai_lines = set(ai_report.splitlines())
    only_in_template = template_lines - ai_lines
    only_in_ai = ai_lines - template_lines

    unexpected_template_only = {
        line for line in only_in_template
        if line.strip() and line.strip() != "Nuläge:"
    }
    print(f"Lines only in template report: {len(only_in_template)}")
    print(f"Lines only in AI report:       {len(only_in_ai)}")
    if unexpected_template_only:
        print()
        print("WARNING: lines present in the template but missing from the AI "
              "report outside the expected Nuläge swap - the underlying "
              "analysis may not be identical:")
        for line in sorted(unexpected_template_only):
            print(f"  - {line!r}")

    (Path(__file__).parent / "output_template.txt").write_text(template_report, encoding="utf-8")
    (Path(__file__).parent / "output_ai.txt").write_text(ai_report, encoding="utf-8")
    print()
    print("Full reports written to output_template.txt and output_ai.txt")


if __name__ == "__main__":
    main()
