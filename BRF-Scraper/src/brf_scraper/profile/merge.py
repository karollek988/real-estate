"""Priority-based merge logic for BRF profile fields.

Merges ``SourcedValue`` instances from multiple providers, preserving all
source attributions and resolving conflicts via configurable priority.
"""

from __future__ import annotations

from typing import Any

from brf_scraper.profile.models import (
    BRFApartments,
    BRFFinancials,
    BRFIdentity,
    BRFPersonnel,
    BRFProfile,
    BRFProperty,
    SourcedValue,
)

DEFAULT_SOURCE_PRIORITY: list[str] = ["hemnet", "booli", "allabrf", "official_website"]


def _pick_winner(
    values: list[tuple[str, Any, float, str | None]],
    priority: list[str],
) -> tuple[Any, list[str], float, list[dict[str, Any]]]:
    """Pick the winning value from (source, value, confidence, last_updated).

    Returns (winner_value, all_sources, max_confidence, conflicts).
    """
    # Deduplicate: same (normalized_value, source) → keep highest confidence
    deduped: dict[tuple[str, str], tuple[str, Any, float, str | None]] = {}
    for source, value, conf, updated in values:
        norm = str(value).strip().lower() if value is not None else "None"
        key = (norm, source)
        if key not in deduped or conf > deduped[key][2]:
            deduped[key] = (source, value, conf, updated)

    entries = list(deduped.values())

    # Find winner by priority
    winner_source = None
    winner_value = None
    winner_conf = 0.0
    winner_updated = None

    for p in priority:
        for source, value, conf, updated in entries:
            if source == p and value is not None:
                winner_source = source
                winner_value = value
                winner_conf = conf
                winner_updated = updated
                break
        if winner_source is not None:
            break

    # If no priority match, take the first non-None
    if winner_source is None:
        for source, value, conf, updated in entries:
            if value is not None:
                winner_value = value
                winner_source = source
                winner_conf = conf
                winner_updated = updated
                break

    all_sources = [e[0] for e in entries if e[1] is not None]
    max_conf = max((e[2] for e in entries if e[1] is not None), default=0.0)

    # Detect conflicts (different values from different sources)
    unique_values = set()
    for _, value, _, _ in entries:
        if value is not None:
            unique_values.add(str(value).strip().lower())

    conflicts = []
    if len(unique_values) > 1:
        conflicts = [
            {"source": s, "value": v}
            for s, v, _, _ in entries
            if v is not None
        ]

    return winner_value or None, all_sources, max(winner_conf, max_conf), conflicts


def _merge_sv(
    candidates: list[SourcedValue],
    priority: list[str],
) -> SourcedValue | None:
    """Merge multiple SourcedValue instances into one."""
    if not candidates:
        return None

    entries = []
    for sv in candidates:
        if sv is not None and sv.value is not None:
            entries.append((sv.sources[0] if sv.sources else "unknown", sv.value, sv.confidence, sv.last_updated))

    if not entries:
        return None

    value, sources, conf, _ = _pick_winner(entries, priority)
    if value is None:
        return None

    return SourcedValue(
        value=value,
        sources=list(set(sources)),
        confidence=conf,
    )


def _set_field(
    target: Any,
    field_name: str,
    candidates: list[SourcedValue],
    priority: list[str],
) -> None:
    """Set a SourcedValue field on target from merge candidates."""
    merged = _merge_sv([c for c in candidates if c is not None], priority)
    if merged is not None:
        setattr(target, field_name, merged)


def merge_identity(
    sources_data: dict[str, BRFIdentity],
    priority: list[str] | None = None,
) -> BRFIdentity:
    """Merge identity fields from multiple providers."""
    priority = priority or DEFAULT_SOURCE_PRIORITY
    result = BRFIdentity()

    field_names = [
        "name", "organization_number", "brf_type", "municipality",
        "county", "address", "postal_code", "website_url", "founding_year",
    ]

    for fn in field_names:
        candidates = [
            getattr(s, fn)
            for s in sources_data.values()
            if s is not None and getattr(s, fn, None) is not None and getattr(getattr(s, fn), "value", None) is not None
        ]
        _set_field(result, fn, candidates, priority)

    return result


def merge_apartments(
    sources_data: dict[str, BRFApartments],
    priority: list[str] | None = None,
) -> BRFApartments:
    """Merge apartment data from multiple providers."""
    priority = priority or DEFAULT_SOURCE_PRIORITY
    result = BRFApartments()

    for fn in ["owner_occupied", "rental", "commercial", "avg_monthly_fee"]:
        candidates = [
            getattr(s, fn)
            for s in sources_data.values()
            if s is not None and getattr(s, fn, None) is not None
        ]
        _set_field(result, fn, candidates, priority)

    # Merge apartment lists (keep all, tagged by source)
    for s in sources_data.values():
        if s is not None:
            result.units.extend(s.units)

    return result


def merge_property(
    sources_data: dict[str, BRFProperty],
    priority: list[str] | None = None,
) -> BRFProperty:
    """Merge property data from multiple providers."""
    priority = priority or DEFAULT_SOURCE_PRIORITY
    result = BRFProperty()

    for fn in [
        "year_built", "building_area_sqm", "residential_area_sqm",
        "commercial_area_sqm", "land_ownership", "energy_class",
        "renovation_history",
    ]:
        candidates = [
            getattr(s, fn)
            for s in sources_data.values()
            if s is not None and getattr(s, fn, None) is not None
        ]
        _set_field(result, fn, candidates, priority)

    return result


def merge_personnel(
    sources_data: dict[str, BRFPersonnel],
    priority: list[str] | None = None,
) -> BRFPersonnel:
    """Merge personnel data from multiple providers."""
    priority = priority or DEFAULT_SOURCE_PRIORITY
    result = BRFPersonnel()

    for fn in [
        "property_manager", "technical_manager", "chairman",
        "vice_chairman", "treasurer", "secretary", "auditor", "auditor_firm",
    ]:
        candidates = [
            getattr(s, fn)
            for s in sources_data.values()
            if s is not None and getattr(s, fn, None) is not None
        ]
        _set_field(result, fn, candidates, priority)

    return result


def merge_profiles(
    profiles: dict[str, BRFProfile],
    priority: list[str] | None = None,
) -> BRFProfile:
    """Merge multiple partial BRFProfile instances into one unified profile.

    Args:
        profiles: Dict of source_name → BRFProfile (partial data from each provider).
        priority: Source priority order (first = highest priority).

    Returns:
        A single BRFProfile with the best value for each field.
    """
    priority = priority or DEFAULT_SOURCE_PRIORITY

    # Merge each section
    identity_data = {k: v.brf for k, v in profiles.items()}
    apt_data = {k: v.apartments for k, v in profiles.items()}
    prop_data = {k: v.property for k, v in profiles.items()}
    personnel_data = {k: v.personnel for k, v in profiles.items()}

    merged_brf = merge_identity(identity_data, priority)
    merged_apt = merge_apartments(apt_data, priority)
    merged_prop = merge_property(prop_data, priority)
    merged_personnel = merge_personnel(personnel_data, priority)

    # Financials: use the highest-priority source that has data
    financials = None
    for p_name in priority:
        for k, v in profiles.items():
            if k == p_name and v.financials.fiscal_year is not None:
                financials = v.financials
                break
        if financials is not None:
            break
    if financials is None:
        for v in profiles.values():
            if v.financials.fiscal_year is not None:
                financials = v.financials
                break

    # Documents: collect all
    all_docs = []
    for v in profiles.values():
        all_docs.extend(v.documents)

    # Build merged profile
    merged = BRFProfile(
        brf=merged_brf,
        apartments=merged_apt,
        property=merged_prop,
        personnel=merged_personnel,
        financials=financials or profiles[list(profiles.keys())[0]].financials if profiles else BRFFinancials(),
        documents=all_docs,
        meta={
            "sources_queried": list(profiles.keys()),
            "profile_confidence": _compute_profile_confidence(profiles),
            "built_at": __import__("datetime").datetime.now().isoformat(),
        },
    )

    return merged


def _compute_profile_confidence(profiles: dict[str, BRFProfile]) -> float:
    """Estimate overall profile confidence based on data completeness."""
    # Count how many key fields are populated
    key_fields = [
        ("brf", "name"),
        ("brf", "organization_number"),
        ("brf", "municipality"),
        ("brf", "address"),
        ("apartments", "owner_occupied"),
        ("apartments", "avg_monthly_fee"),
        ("property", "year_built"),
        ("financials", "fiscal_year"),
    ]

    filled = 0
    total = len(key_fields)

    for section_name, field_name in key_fields:
        for v in profiles.values():
            section = getattr(v, section_name, None)
            if section is None:
                continue
            field = getattr(section, field_name, None)
            if isinstance(field, SourcedValue) and field.value is not None:
                filled += 1
                break
            elif field is not None:
                filled += 1
                break

    return round(filled / total, 2) if total > 0 else 0.0
