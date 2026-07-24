"""acquire() must never silently choose between two plausible BRFs.

Covers Launch Blocker #1 from the End-to-End Truth Audit: a wrong BRF match
silently attributes a different association's annual report to a property.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from brf_scraper.discovery.allabrf_provider import AllabrfCandidate, AllabrfProvider


def _candidate(name, score, org_number=None) -> AllabrfCandidate:
    return AllabrfCandidate(name=name, org_number=org_number, slug=name.lower(), match_score=score)


@pytest.fixture
def provider() -> AllabrfProvider:
    return AllabrfProvider()


async def _acquire_with_candidates(provider: AllabrfProvider, candidates: list[AllabrfCandidate], **kwargs):
    provider.search = AsyncMock(return_value=candidates)
    provider.initialize = AsyncMock()
    return await provider.acquire(brf_name="Brf Test", download_dir=Path("."), **kwargs)


class TestAmbiguousMatch:
    async def test_two_close_candidates_are_not_auto_resolved(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.90), _candidate("Brf Solbacken 2", 0.85)]
        acq = await _acquire_with_candidates(provider, candidates)

        assert acq.resolved is False
        assert acq.status == "ambiguous_match"
        assert acq.candidate is None
        assert any(e.startswith("ambiguous_match") for e in acq.errors)

    async def test_clearly_separated_top_candidate_is_resolved(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.95), _candidate("Brf Other", 0.30)]
        acq = await _acquire_with_candidates(provider, candidates)

        assert acq.resolved is True
        assert acq.status == "resolved"
        assert acq.candidate.name == "Brf Solbacken"

    async def test_single_candidate_is_resolved_without_ambiguity_check(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.90)]
        acq = await _acquire_with_candidates(provider, candidates)

        assert acq.resolved is True
        assert acq.status == "resolved"

    async def test_below_floor_is_low_match_score_not_ambiguous(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.35), _candidate("Brf Other", 0.34)]
        acq = await _acquire_with_candidates(provider, candidates)

        assert acq.resolved is False
        assert acq.status == "low_match_score"


class TestOrganizationNumberPreference:
    async def test_org_number_match_bypasses_ambiguity(self, provider):
        # Same ambiguous name-similarity scores as the ambiguous case above,
        # but the org number identifies exactly one of them.
        candidates = [
            _candidate("Brf Solbacken", 0.90, org_number="769600-1234"),
            _candidate("Brf Solbacken 2", 0.85, org_number="769600-9999"),
        ]
        acq = await _acquire_with_candidates(provider, candidates, org_number="769600-1234")

        assert acq.resolved is True
        assert acq.status == "resolved"
        assert acq.candidate.org_number == "769600-1234"

    async def test_org_number_formatting_is_normalized(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.90, org_number="7696001234")]
        acq = await _acquire_with_candidates(provider, candidates, org_number="769600-1234")

        assert acq.resolved is True
        assert acq.candidate.name == "Brf Solbacken"

    async def test_org_number_with_no_match_falls_back_to_name_scoring(self, provider):
        candidates = [_candidate("Brf Solbacken", 0.95, org_number="769600-0000")]
        acq = await _acquire_with_candidates(provider, candidates, org_number="769600-1234")

        assert acq.resolved is True
        assert acq.candidate.name == "Brf Solbacken"
