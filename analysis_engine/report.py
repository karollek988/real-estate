"""Report generator for Köpanalys.

Converts reasoning results into a customer-facing report.
Every statement contains references to the JSON fields it originated from.
"""

from __future__ import annotations

from calculator import CalculatedField, CalculatedMetrics
from reasoning import (
    Finding,
    Observation,
    ReasoningResult,
    Recommendation,
    Severity,
    Signal,
    SignalStrength,
    compute_verdict,
)


def _fmt(value: float | None, unit: str) -> str:
    """Format a value for display."""
    if value is None:
        return "Saknas"
    if unit == "x":
        return f"{value:.2f}x"
    if unit == "m²":
        return f"{value:,.0f} m²".replace(",", " ")
    if unit == "ratio":
        return f"{value:.1%}"
    if unit == "%":
        return f"{value:.1f}%"
    if "SEK" in unit and "month" in unit:
        return f"{value:,.0f} kr/mån".replace(",", " ")
    if "SEK" in unit and "apartment" in unit:
        return f"{value:,.0f} kr/lgh".replace(",", " ")
    if "SEK" in unit and "m" in unit:
        return f"{value:,.0f} kr/m²".replace(",", " ")
    if "SEK" in unit:
        return f"{value:,.0f} kr".replace(",", " ")
    if unit == "months":
        return f"{value:.1f} månader"
    if unit == "count":
        return str(int(value))
    return str(value)


def _signal_emoji(strength: SignalStrength) -> str:
    """Map signal strength to a visual indicator."""
    mapping = {
        SignalStrength.STRONG_POSITIVE: "+++",
        SignalStrength.POSITIVE: "++",
        SignalStrength.WEAK_POSITIVE: "+",
        SignalStrength.NEUTRAL: "~",
        SignalStrength.WEAK_NEGATIVE: "-",
        SignalStrength.NEGATIVE: "--",
        SignalStrength.STRONG_NEGATIVE: "---",
        SignalStrength.UNKNOWN: "?",
    }
    return mapping.get(strength, "?")


def _severity_text(severity: Severity | None) -> str:
    if severity is None:
        return ""
    mapping = {
        Severity.MINOR: "Liten",
        Severity.MODERATE: "Måttlig",
        Severity.SIGNIFICANT: "Väsentlig",
        Severity.CRITICAL: "Kritisk",
    }
    return mapping.get(severity, "")


def generate_report(
    extracted: dict,
    metrics: CalculatedMetrics,
    reasoning: ReasoningResult,
) -> str:
    """Generate the complete Köpanalys report as a string."""
    brf = extracted["brf"]
    report = extracted["annual_reports"][0]
    year = report["fiscal_year"]
    inc = report.get("income_statement", {})
    bs = report.get("balance_sheet", {})
    apt = report.get("apartment_metrics", {})
    loans = report.get("loans", [])

    lines = []
    w = lines.append

    w("=" * 72)
    w(f"  KÖPANALYS — {brf['name']}")
    w(f"  Årsredovisning {year}")
    w(f"  Genererad: Deterministisk analys, ingen AI-gissning")
    w("=" * 72)
    w("")

    # ── SECTION 1: VERDICT ────────────────────────────────────────────────
    verdict = compute_verdict_from_reasoning(reasoning)
    w("§ 1. BESKED")
    w("-" * 72)
    w(f"  Bedömning:     {verdict['verdict']}")
    w(f"  Konfidens:     {verdict['confidence']:.0%}")
    w("")
    w("  Nuläge:")
    for line in verdict["summary"].split("\n"):
        if line.strip():
            w(f"    {line}")
    w("")

    # ── SECTION 2: PROPERTY ───────────────────────────────────────────────
    w("§ 2. OBJEKTET")
    w("-" * 72)
    w(f"  Förening:      {brf['name']}")
    w(f"  Org.nr:        {brf['organization_number']}")
    w(f"  Kommun:        {brf['municipality']}")
    w(f"  Lägenheter:    {brf['number_of_apartments']}")
    w(f"  Kommersiella:  {brf.get('number_of_commercial', 0)}")
    pi = report.get("property_info", {})
    yb = pi.get("year_built", {})
    if yb.get("value"):
        w(f"  Byggår:        {yb['value']}")
    ec = pi.get("energy_class", {})
    if ec.get("value"):
        w(f"  Energiklass:   {ec['value']}")
    ba = pi.get("building_area_sqm", {})
    if ba.get("value"):
        w(f"  Byggnadsarea:  {_fmt(ba['value'], 'm²')}")
    w("")

    # ── SECTION 3: FINANCIAL STATEMENTS ───────────────────────────────────
    w("§ 3. BRF:N — FINANSIELL OVERSIKT")
    w("-" * 72)
    w("")
    w("  Rörelseresultat:")
    w(f"    Intäkter:              {_fmt(_v(inc, 'revenue'), 'SEK')}")
    w(f"    Rörelsekostnader:      {_fmt(_v(inc, 'operating_costs'), 'SEK')}")
    w(f"    Rörelseresultat:       {_fmt(_v(inc, 'operating_profit'), 'SEK')}")
    w(f"    Finansintäkter:        {_fmt(_v(inc, 'financial_income'), 'SEK')}")
    w(f"    Finanskostnader:       {_fmt(_v(inc, 'financial_costs'), 'SEK')}")
    w(f"    Resultat efter skatt:  {_fmt(_v(inc, 'profit_after_tax'), 'SEK')}")
    w("")
    w("  Balansräkning:")
    w(f"    Summa tillgångar:      {_fmt(_v(bs, 'total_assets'), 'SEK')}")
    w(f"    Eget kapital:          {_fmt(_v(bs, 'total_equity'), 'SEK')}")
    w(f"    Skulder totalt:        {_fmt(_v(bs, 'total_liabilities'), 'SEK')}")
    w(f"    Skulder > 1 år:        {_fmt(_v(bs, 'long_term_debt'), 'SEK')}")
    w(f"    Skulder < 1 år:        {_fmt(_v(bs, 'short_term_debt'), 'SEK')}")
    w(f"    Kassa och bank:        {_fmt(_v(bs, 'cash_and_bank'), 'SEK')}")
    w("")

    # ── SECTION 4: CALCULATED METRICS ────────────────────────────────────
    w("§ 4. BERÄKNADE NYCKELTAL")
    w("-" * 72)
    w("")
    w("  Per lägenhet:")
    w(f"    Skuld per lägenhet:     {_fmt(_val(metrics.debt_per_apartment), 'SEK/apartment')}")
    w(f"    Eget kapital per lgh:   {_fmt(_val(metrics.equity_per_apartment), 'SEK/apartment')}")
    w(f"    Intäkter per lgh:      {_fmt(_val(metrics.revenue_per_apartment), 'SEK/apartment')}")
    w(f"    Kostnader per lgh:     {_fmt(_val(metrics.cost_per_apartment), 'SEK/apartment')}")
    w(f"    Räntekostnad per lgh:  {_fmt(_val(metrics.interest_cost_per_apartment), 'SEK/apartment')}")
    w("")
    w("  Nyckeltal:")
    w(f"    Egenkapitalandel:      {_fmt(_val(metrics.equity_ratio), 'ratio')}")
    w(f"    Skuldandel:            {_fmt(_val(metrics.debt_ratio), 'ratio')}")
    w(f"    Rörelsemarginal:       {_fmt(_val(metrics.operating_margin), 'ratio')}")
    w(f"    Räntetäckning:         {_fmt(_val(metrics.interest_coverage), 'x')}")
    w(f"    Skuld-egenkapital:     {_fmt(_val(metrics.debt_to_equity), 'ratio')}")
    w(f"    Kostnad per m²:        {_fmt(_val(metrics.cost_per_sqm), 'SEK/m²')}")
    w(f"    Avgiftstäckning:       {_fmt(_val(metrics.fee_sustainability), 'ratio')}")
    w(f"    Vägt ränteunderlag:    {_fmt(_val(metrics.weighted_average_interest), '%')}")
    w(f"    Andel kortfristig:     {_fmt(_val(metrics.short_term_debt_ratio), 'ratio')}")
    w(f"    Likviditet:            {_fmt(_val(metrics.liquidity_months), 'months')}")
    w("")

    # ── SECTION 5: LOAN PORTFOLIO ─────────────────────────────────────────
    if loans:
        w("§ 5. LÅNEPORTFÖLJ")
        w("-" * 72)
        w("")
        for loan in loans:
            lender = loan["lender"]
            remaining = loan.get("remaining_amount", {}).get("value")
            rate = loan.get("interest_rate_percent", {}).get("value")
            maturity = loan.get("maturity_date", "okänd")
            w(f"    {lender}")
            w(f"      Återstående:   {_fmt(remaining, 'SEK')}")
            w(f"      Ränta:         {_fmt(rate, '%')}")
            w(f"      Förfallodatum: {maturity}")
        w("")
        w(f"    Total skuld:     {_fmt(_val(metrics.total_debt), 'SEK')}")
        w(f"    Vägt genomsnitt: {_fmt(_val(metrics.weighted_average_interest), '%')}")
        w("")

    # ── SECTION 6: SIGNALS ────────────────────────────────────────────────
    w("§ 6. SIGNALER")
    w("-" * 72)
    w("")
    for signal in reasoning.signals:
        emoji = _signal_emoji(signal.strength)
        value_str = _fmt(signal.value, _signal_unit(signal.metric))
        w(f"    [{emoji}] {signal.metric:.<30s} {value_str:>15s}   ({signal.threshold_description})")
    w("")

    # ── SECTION 7: OBSERVATIONS ───────────────────────────────────────────
    w("§ 7. OBSERVATIONER")
    w("-" * 72)
    w("")
    for obs in reasoning.observations:
        tag = "FAKTUM" if obs.is_fact else "TOLKNING"
        w(f"    [{tag:8s}] {obs.statement}")
        refs = ", ".join(f"{s.metric}={_fmt(s.value, _signal_unit(s.metric))}" for s in obs.signals)
        w(f"             Stöds av: {refs}")
        w(f"             Konfidens: {obs.confidence:.0%}")
        w("")

    # ── SECTION 8: FINDINGS ───────────────────────────────────────────────
    w("§ 8. KONKLUSIONER")
    w("-" * 72)
    w("")
    for finding in reasoning.findings:
        sev = f" ({_severity_text(finding.severity)})" if finding.severity else ""
        w(f"    {finding.dimension.upper()}{sev}")
        w(f"    Klassificering: {finding.classification.value}")
        w(f"    {finding.summary}")
        w(f"    Konfidens: {finding.confidence:.0%}")
        w("")

    # ── SECTION 9: RECOMMENDATIONS ────────────────────────────────────────
    # reasoning.py's generate_recommendations() always returns [] (see its
    # docstring) - this section only renders if that ever changes, same
    # pattern as § 5's `if loans:`.
    if reasoning.recommendations:
        w("§ 9. REKOMMENDATIONER")
        w("-" * 72)
        w("")
        for i, rec in enumerate(reasoning.recommendations, 1):
            w(f"    {i}. [{rec.category.upper()}] {rec.text}")
            w(f"       Konfidens: {rec.confidence:.0%}")
        w("")

    # ── SECTION 10: TRACEABILITY ──────────────────────────────────────────
    w("§ 10. SPÅRBARHET")
    w("-" * 72)
    w("")
    w("  Varje nyckeltal i denna analys härstammar från:")
    w(f"  Källa: {report['pdf']['path']}")
    w(f"  Extraktionskonfidens: {report['extraction_confidence']:.0%}")
    w("")
    w("  Fältprecision:")
    for field_path, field_data in _all_extracted_fields(report):
        src = field_data.get("source", {})
        method = src.get("method", "unknown")
        conf = src.get("confidence", 0)
        page = src.get("page", "?")
        w(f"    {field_path:40s} sida {str(page):>2s}  ({method}, {conf:.0%})")
    w("")
    w("  Saknade fält:")
    for mf in report.get("missing_fields", []):
        w(f"    - {mf['field']}: {mf['reason']}")
    w("")

    # ── FOOTER ────────────────────────────────────────────────────────────
    w("=" * 72)
    w("  Denna analys är genererad av ett deterministiskt system.")
    w("  Inga värden har gissats eller uppskattats.")
    w("  Alla slutsatser kan spåras tillbaka till källskdocumentet.")
    w("  Systemet utgör inte finansiell rådgivning.")
    w("=" * 72)

    return "\n".join(lines)


def compute_verdict_from_reasoning(reasoning: ReasoningResult) -> dict:
    """Compute verdict from reasoning results.

    Thin wrapper - reasoning.py's compute_verdict() is the one place verdict
    labels are decided; kept here (rather than imported and used directly by
    every caller) because callers already import compute_verdict_from_reasoning
    by name from this module (narrator/service.py, tests).
    """
    return compute_verdict(reasoning.findings, reasoning.overall_confidence)


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _v(data: dict, key: str) -> float | None:
    obj = data.get(key, {})
    if isinstance(obj, dict):
        return obj.get("value")
    return obj


def _val(cf: CalculatedField | None) -> float | None:
    if cf is None:
        return None
    return cf.value


def _signal_unit(metric: str) -> str:
    mapping = {
        "equity_ratio": "ratio",
        "operating_margin": "ratio",
        "interest_coverage": "x",
        "debt_per_apartment": "SEK/apartment",
        "fee_sustainability": "ratio",
        "short_term_debt_ratio": "ratio",
        "liquidity_months": "months",
    }
    return mapping.get(metric, "")


def _all_extracted_fields(report: dict):
    """Yield (field_path, field_data) for all extracted fields."""
    for section_name in ["income_statement", "balance_sheet"]:
        section = report.get(section_name, {})
        for field_name, field_data in section.items():
            if isinstance(field_data, dict) and "value" in field_data:
                yield (f"{section_name}.{field_name}", field_data)

    apt = report.get("apartment_metrics", {})
    for field_name, field_data in apt.items():
        if isinstance(field_data, dict) and "value" in field_data:
            yield (f"apartment_metrics.{field_name}", field_data)

    for i, loan in enumerate(report.get("loans", [])):
        for key in ["remaining_amount", "interest_rate_percent"]:
            if key in loan and isinstance(loan[key], dict) and "value" in loan[key]:
                yield (f"loans[{i}].{key}", loan[key])

    pi = report.get("property_info", {})
    for field_name, field_data in pi.items():
        if isinstance(field_data, dict) and "value" in field_data:
            yield (f"property_info.{field_name}", field_data)
