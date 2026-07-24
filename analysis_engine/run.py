"""Köpanalys Pipeline — End-to-end BRF annual report analysis.

Pipeline:
  JSON (extracted data) → Calculations → Reasoning → Report [→ AI Narrator]

Usage:
  python run.py           # deterministic template report (default)
  python run.py --ai      # same report, with the "Nuläge" block rewritten
                           # by the OpenAI narrator (needs OPENAI_API_KEY)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from calculator import calculate_metrics
from reasoning import run_reasoning
from report import generate_report


def main() -> None:
    # Load the verified JSON (output of extraction stage)
    json_path = Path(__file__).parent / "sample_annual_report.json"
    if not json_path.exists():
        print(f"ERROR: {json_path} not found")
        sys.exit(1)

    with open(json_path, encoding="utf-8") as f:
        extracted = json.load(f)

    report_data = extracted["annual_reports"][0]
    year = report_data["fiscal_year"]
    brf_name = extracted["brf"]["name"]

    print(f"Analyserar {brf_name} — årsredovisning {year}")
    print()

    # Stage 2: Deterministic calculations
    print("Stage 2: Beräknar nyckeltal...")
    metrics = calculate_metrics(report_data)

    calculated_count = sum(
        1 for attr in [
            metrics.debt_per_apartment, metrics.equity_per_apartment,
            metrics.revenue_per_apartment, metrics.cost_per_apartment,
            metrics.equity_ratio, metrics.debt_ratio,
            metrics.operating_margin, metrics.interest_coverage,
            metrics.cost_per_sqm, metrics.fee_sustainability,
            metrics.total_debt, metrics.weighted_average_interest,
            metrics.short_term_debt_ratio, metrics.interest_cost_per_apartment,
            metrics.debt_to_equity, metrics.liquidity_months,
        ] if attr is not None and attr.computed
    )
    print(f"  {calculated_count} nyckeltal beräknade")
    print()

    # Stage 3: Reasoning engine
    print("Stage 3: Kör resonemanget...")
    reasoning = run_reasoning(metrics)
    print(f"  {len(reasoning.signals)} signaler")
    print(f"  {len(reasoning.observations)} observationer")
    print(f"  {len(reasoning.findings)} konklusioner")
    print(f"  {len(reasoning.recommendations)} rekommendationer")
    print(f"  Övergripande konfidens: {reasoning.overall_confidence:.0%}")
    print()

    # Stage 4: Generate report
    print("Stage 4: Genererar Köpanalys...")
    if "--ai" in sys.argv:
        from narrator import generate_ai_report
        from narrator.openai_provider import OpenAINarrationProvider

        report_text, ai_used = generate_ai_report(
            extracted, metrics, reasoning, OpenAINarrationProvider()
        )
        print("  AI-narration använd" if ai_used else "  AI-narration misslyckades, mall använd")
    else:
        report_text = generate_report(extracted, metrics, reasoning)

    # Output
    output_path = Path(__file__).parent / "output.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_text)

    print(f"  Rapport sparad till: {output_path}")
    print()
    print(report_text)


if __name__ == "__main__":
    main()
