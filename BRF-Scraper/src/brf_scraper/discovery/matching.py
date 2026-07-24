"""Matching a target BRF name against discovery results."""

from __future__ import annotations

from brf_scraper.discovery.models import DiscoveredBRF


def name_similarity(a: str, b: str) -> float:
    """Token-overlap similarity in [0, 1] between two BRF names.

    Used both by the legacy first-match heuristic below and by the
    confidence scoring model, so the two stay consistent.

    Args:
        a: First name.
        b: Second name.

    Returns:
        1.0 for an exact match, 0.85 for a substring match, otherwise
        the fraction of shared words relative to the longer name.
    """
    a_norm = a.lower().strip()
    b_norm = b.lower().strip()
    if not a_norm or not b_norm:
        return 0.0
    if a_norm == b_norm:
        return 1.0
    if a_norm in b_norm or b_norm in a_norm:
        return 0.85

    a_words = set(a_norm.split())
    b_words = set(b_norm.split())
    overlap = len(a_words & b_words)
    return overlap / max(len(a_words), len(b_words))


def match_brf_by_name(brf_name: str, brfs: list[DiscoveredBRF]) -> DiscoveredBRF | None:
    """Find the discovery result that best matches a target BRF name.

    Tries, in order: exact name match, substring match, word overlap,
    then falls back to the first discovered result.

    Args:
        brf_name: Target BRF name to match against.
        brfs: List of discovered BRFs.

    Returns:
        Best matching DiscoveredBRF or None if no BRFs were discovered.
    """
    target = brf_name.lower().strip()

    # Exact name match
    for brf in brfs:
        if brf.name.lower().strip() == target:
            return brf

    # Substring match (target in result name or vice versa)
    for brf in brfs:
        name_lower = brf.name.lower().strip()
        if target in name_lower or name_lower in target:
            return brf

    # Word overlap match
    target_words = set(target.split())
    best_score = 0.0
    best_brf: DiscoveredBRF | None = None
    for brf in brfs:
        brf_words = set(brf.name.lower().strip().split())
        overlap = len(target_words & brf_words)
        if overlap > best_score:
            best_score = overlap
            best_brf = brf

    if best_score > 0:
        return best_brf

    # Fallback: return first result
    return brfs[0] if brfs else None
