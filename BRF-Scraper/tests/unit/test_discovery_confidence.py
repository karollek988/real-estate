"""Tests for confidence scoring of discovery candidates."""

from __future__ import annotations

from pydantic import HttpUrl

from brf_scraper.discovery.confidence import ConfidenceBand, score_candidates
from brf_scraper.discovery.models import DiscoveredBRF, DiscoverySource
from brf_scraper.models.brf import BRF


def _target(**overrides: object) -> BRF:
    defaults: dict[str, object] = {"name": "BRF Solgläntan", "organization_number": "7691234567"}
    defaults.update(overrides)
    return BRF(**defaults)  # type: ignore[arg-type]


def _candidate(**overrides: object) -> DiscoveredBRF:
    defaults: dict[str, object] = {
        "name": "BRF Solgläntan",
        "website_url": HttpUrl("https://brfsolglantan.se"),
        "source": DiscoverySource.SEARCH_ENGINE,
    }
    defaults.update(overrides)
    return DiscoveredBRF(**defaults)  # type: ignore[arg-type]


class TestScoreCandidates:
    """Tests for score_candidates."""

    def test_empty_candidates_returns_empty(self) -> None:
        """No candidates yields no scored results."""
        assert score_candidates(_target(), []) == []

    def test_exact_org_number_match_is_high_confidence(self) -> None:
        """A confirmed organization number match dominates the score."""
        target = _target(organization_number="7691234567")
        candidate = _candidate(organization_number="7691234567", source=DiscoverySource.DIRECTORY)

        [scored] = score_candidates(target, [candidate])

        assert scored.band == ConfidenceBand.HIGH
        assert scored.confidence >= 0.85
        assert any("Organization number matches" in s.rationale for s in scored.positive_signals)

    def test_org_number_mismatch_is_strongly_negative(self) -> None:
        """A different org number is a strong negative signal even with a name match."""
        target = _target(organization_number="7691234567")
        candidate = _candidate(organization_number="1112223334")

        [scored] = score_candidates(target, [candidate])

        assert any(
            "Organization number mismatch" in s.rationale for s in scored.negative_signals
        )

    def test_seed_url_source_scores_higher_than_search_engine(self) -> None:
        """Seed URLs are a trusted source and should outscore a bare search hit."""
        target = _target(organization_number=None, name="BRF Ekhagen")
        seed_candidate = _candidate(
            name="BRF Ekhagen",
            organization_number=None,
            source=DiscoverySource.SEED_URL,
            website_url=HttpUrl("https://ekhagen.se"),
        )
        search_candidate = _candidate(
            name="BRF Ekhagen",
            organization_number=None,
            source=DiscoverySource.SEARCH_ENGINE,
            website_url=HttpUrl("https://other-ekhagen.se"),
        )

        scored = score_candidates(target, [search_candidate, seed_candidate])

        assert scored[0].candidate.source == DiscoverySource.SEED_URL

    def test_no_candidates_matching_returns_low_band(self) -> None:
        """A candidate with a completely different name/location scores LOW."""
        target = _target(
            name="BRF Solgläntan",
            organization_number=None,
            city="Stockholm",
        )
        candidate = _candidate(
            name="BRF Something Else Entirely",
            organization_number=None,
            city="Malmö",
            source=DiscoverySource.SEARCH_ENGINE,
        )

        [scored] = score_candidates(target, [candidate])

        assert scored.band == ConfidenceBand.LOW

    def test_close_runner_up_discounts_top_confidence(self) -> None:
        """Two near-tied candidates should not be reported as clearly HIGH."""
        target = _target(name="BRF Björken", organization_number=None, city="Uppsala")
        candidate_a = _candidate(
            name="BRF Björken",
            organization_number=None,
            city="Uppsala",
            source=DiscoverySource.SEARCH_ENGINE,
            website_url=HttpUrl("https://brf-bjorken-a.se"),
        )
        candidate_b = _candidate(
            name="BRF Björken",
            organization_number=None,
            city="Uppsala",
            source=DiscoverySource.SEARCH_ENGINE,
            website_url=HttpUrl("https://brf-bjorken-b.se"),
        )

        scored = score_candidates(target, [candidate_a, candidate_b])
        top = scored[0]
        no_ambiguity = score_candidates(target, [candidate_a])[0]

        assert top.confidence < no_ambiguity.confidence

    def test_multi_source_agreement_increases_score(self) -> None:
        """A candidate found by multiple providers should score higher than one found by one."""
        target = _target(name="BRF Ekhagen", organization_number=None)
        agreed = _candidate(
            name="BRF Ekhagen",
            organization_number=None,
            source=DiscoverySource.SEARCH_ENGINE,
            metadata={"source_agreement_count": 3},
        )
        solo = _candidate(
            name="BRF Ekhagen",
            organization_number=None,
            source=DiscoverySource.SEARCH_ENGINE,
            metadata={"source_agreement_count": 1},
        )

        [agreed_scored] = score_candidates(target, [agreed])
        [solo_scored] = score_candidates(target, [solo])

        assert agreed_scored.score > solo_scored.score

    def test_results_sorted_by_confidence_descending(self) -> None:
        """score_candidates returns candidates best-first."""
        target = _target(organization_number="7691234567")
        strong = _candidate(organization_number="7691234567")
        weak = _candidate(
            name="Completely Different BRF",
            organization_number=None,
            website_url=HttpUrl("https://unrelated.se"),
        )

        scored = score_candidates(target, [weak, strong])

        assert scored[0].candidate.organization_number == "7691234567"
        assert scored[0].confidence >= scored[1].confidence

    def test_explanation_mentions_band_and_signals(self) -> None:
        """The explanation string surfaces the band and at least one signal."""
        target = _target(organization_number="7691234567")
        candidate = _candidate(organization_number="7691234567")

        [scored] = score_candidates(target, [candidate])

        assert "HIGH" in scored.explanation
        assert "Organization number" in scored.explanation
