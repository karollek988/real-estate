"""Confidence scoring for discovered BRF website candidates.

Turns a flat list of DiscoveredBRF candidates into ranked, explained
scores so a caller can decide whether to trust a result automatically,
ask the user to confirm it, or refuse to guess. See docs/29 for the
full design rationale behind the signal set and band thresholds.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from brf_scraper.discovery.matching import name_similarity
from brf_scraper.discovery.models import DiscoveredBRF, DiscoverySource
from brf_scraper.models.brf import BRF

# Confidence band thresholds. Starting priors, not tuned on data yet -
# revisit once outcomes accumulate in the verified-website registry.
HIGH_CONFIDENCE_THRESHOLD = 0.80
MEDIUM_CONFIDENCE_THRESHOLD = 0.45

# How much a close runner-up discounts the top candidate's confidence.
# A gap at or above this is treated as "clearly separated".
_GAP_NORM = 0.15

# Prior trustworthiness of each discovery source, before content signals.
_SOURCE_PRIOR: dict[DiscoverySource, float] = {
    DiscoverySource.SEED_URL: 1.0,
    DiscoverySource.MANUAL: 1.0,
    DiscoverySource.DIRECTORY: 0.6,
    DiscoverySource.SEARCH_ENGINE: 0.4,
    DiscoverySource.UNKNOWN: 0.2,
}

# Signal weights. Must sum to 1.0.
_WEIGHT_ORG_NUMBER = 0.35
_WEIGHT_NAME_SIMILARITY = 0.25
_WEIGHT_LOCATION = 0.15
_WEIGHT_SOURCE_PRIOR = 0.15
_WEIGHT_AGREEMENT = 0.10


class ConfidenceBand(StrEnum):
    """Action band for a scored discovery candidate."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Signal(BaseModel):
    """One scoring signal computed for a candidate."""

    name: str
    value: float = Field(ge=0.0, le=1.0)
    weight: float
    rationale: str

    @property
    def contribution(self) -> float:
        """Weighted contribution of this signal to the total score."""
        return self.value * self.weight


class ScoredCandidate(BaseModel):
    """A discovery candidate with an explained confidence score."""

    candidate: DiscoveredBRF
    score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    band: ConfidenceBand
    signals: list[Signal] = Field(default_factory=list)

    @property
    def positive_signals(self) -> list[Signal]:
        """Signals whose own value leans supportive (>= 0.5)."""
        return sorted(
            (s for s in self.signals if s.value >= 0.5),
            key=lambda s: s.contribution,
            reverse=True,
        )

    @property
    def negative_signals(self) -> list[Signal]:
        """Signals whose own value leans unsupportive (< 0.5)."""
        return sorted((s for s in self.signals if s.value < 0.5), key=lambda s: s.contribution)

    @property
    def explanation(self) -> str:
        """Human-readable summary of why this candidate got this score."""
        parts = [f"{self.band.value.upper()} confidence ({self.confidence:.2f})."]
        if self.positive_signals:
            parts.append("Supporting: " + "; ".join(s.rationale for s in self.positive_signals))
        if self.negative_signals:
            parts.append("Weak/missing: " + "; ".join(s.rationale for s in self.negative_signals))
        return " ".join(parts)


def _normalize_org_number(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.replace("-", "").replace(" ", "")
    return cleaned or None


def _org_number_signal(target: BRF, candidate: DiscoveredBRF) -> Signal:
    target_org = _normalize_org_number(target.organization_number)
    candidate_org = _normalize_org_number(candidate.organization_number)

    if target_org is None or candidate_org is None:
        return Signal(
            name="organization_number_match",
            value=0.5,
            weight=_WEIGHT_ORG_NUMBER,
            rationale="Organization number not available for one or both records",
        )
    if target_org == candidate_org:
        return Signal(
            name="organization_number_match",
            value=1.0,
            weight=_WEIGHT_ORG_NUMBER,
            rationale=f"Organization number matches exactly ({target_org})",
        )
    return Signal(
        name="organization_number_match",
        value=0.0,
        weight=_WEIGHT_ORG_NUMBER,
        rationale=f"Organization number mismatch ({candidate_org} vs expected {target_org})",
    )


def _name_signal(target: BRF, candidate: DiscoveredBRF) -> Signal:
    similarity = name_similarity(target.name, candidate.name)
    return Signal(
        name="name_similarity",
        value=similarity,
        weight=_WEIGHT_NAME_SIMILARITY,
        rationale=f"Name similarity {similarity:.2f} ('{candidate.name}' vs '{target.name}')",
    )


def _location_signal(target: BRF, candidate: DiscoveredBRF) -> Signal:
    target_location = (target.city or target.municipality or "").strip().lower()
    candidate_location = (candidate.city or candidate.municipality or "").strip().lower()

    if not target_location or not candidate_location:
        return Signal(
            name="location_match",
            value=0.5,
            weight=_WEIGHT_LOCATION,
            rationale="City/municipality not available for one or both records",
        )
    if target_location == candidate_location:
        return Signal(
            name="location_match",
            value=1.0,
            weight=_WEIGHT_LOCATION,
            rationale=f"City/municipality matches ({target_location})",
        )
    return Signal(
        name="location_match",
        value=0.0,
        weight=_WEIGHT_LOCATION,
        rationale=f"City/municipality mismatch ({candidate_location} vs expected {target_location})",
    )


def _source_signal(candidate: DiscoveredBRF) -> Signal:
    prior = _SOURCE_PRIOR.get(candidate.source, 0.2)
    return Signal(
        name="source_reliability",
        value=prior,
        weight=_WEIGHT_SOURCE_PRIOR,
        rationale=f"Discovered via {candidate.source.value} (source prior {prior:.2f})",
    )


def _agreement_signal(candidate: DiscoveredBRF) -> Signal:
    count = int(candidate.metadata.get("source_agreement_count", 1))
    value = min(1.0, (count - 1) / 2)
    rationale = (
        f"Found independently by {count} discovery sources"
        if count > 1
        else "Found by a single discovery source"
    )
    return Signal(name="multi_source_agreement", value=value, weight=_WEIGHT_AGREEMENT, rationale=rationale)


def _score_candidate(target: BRF, candidate: DiscoveredBRF) -> tuple[float, list[Signal]]:
    signals = [
        _org_number_signal(target, candidate),
        _name_signal(target, candidate),
        _location_signal(target, candidate),
        _source_signal(candidate),
        _agreement_signal(candidate),
    ]
    score = sum(s.contribution for s in signals)

    # A confirmed organization-number match is close to ground truth on
    # its own - a unique registry number matching is far stronger evidence
    # than any combination of the softer signals, so let it dominate
    # rather than being diluted by them.
    if signals[0].value == 1.0:
        score = max(score, 0.9)

    return min(1.0, score), signals


def _band_for(confidence: float) -> ConfidenceBand:
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return ConfidenceBand.HIGH
    if confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
        return ConfidenceBand.MEDIUM
    return ConfidenceBand.LOW


def score_candidates(target: BRF, candidates: list[DiscoveredBRF]) -> list[ScoredCandidate]:
    """Score and rank discovery candidates against a target BRF.

    Args:
        target: The BRF we're trying to find a website for.
        candidates: Candidate websites discovered for it.

    Returns:
        Candidates sorted by confidence, descending. The top candidate's
        confidence is discounted when a close runner-up exists, since an
        ambiguous top pick (e.g. two BRFs with the same name in
        different towns) is not trustworthy even if its own score looks
        high in isolation.
    """
    if not candidates:
        return []

    raw = [(*_score_candidate(target, c), c) for c in candidates]
    raw.sort(key=lambda item: item[0], reverse=True)

    results: list[ScoredCandidate] = []
    for i, (score, signals, candidate) in enumerate(raw):
        if i == 0 and len(raw) > 1:
            gap = score - raw[1][0]
            discount = max(0.5, min(1.0, gap / _GAP_NORM))
            confidence = min(1.0, score * discount)
        else:
            confidence = score

        results.append(
            ScoredCandidate(
                candidate=candidate,
                score=score,
                confidence=confidence,
                band=_band_for(confidence),
                signals=signals,
            )
        )

    return results
