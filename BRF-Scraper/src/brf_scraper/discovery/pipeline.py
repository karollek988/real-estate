"""Confidence-gated discovery pipeline.

Wires the Verified Website Registry, an optional manual override, and
Discovery + confidence scoring into a single decision: continue
automatically, ask the user to confirm a best guess, or refuse to guess
at all. Discovery itself is only one (skippable) stage in that decision -
the goal is 100% correct data, not 100% automatic discovery.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from brf_scraper.discovery.confidence import ConfidenceBand, ScoredCandidate, score_candidates
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import DiscoverySource
from brf_scraper.discovery.registry import (
    VerificationMethod,
    VerifiedWebsite,
    VerifiedWebsiteRegistry,
)
from brf_scraper.models.brf import BRF
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class DiscoveryDecision(BaseModel):
    """Outcome of the confidence-gated discovery pipeline.

    `website_url` is only populated for HIGH and MEDIUM bands. At LOW
    confidence it is always None - a low-confidence guess is never
    surfaced as if it were a result, only as an explanation of why
    there isn't one yet.
    """

    band: ConfidenceBand
    website_url: str | None = None
    confidence: float = 0.0
    explanation: str = ""
    positive_signals: list[str] = Field(default_factory=list)
    negative_signals: list[str] = Field(default_factory=list)
    source: str | None = None
    from_registry: bool = False
    candidates_considered: int = 0

    @property
    def should_continue_automatically(self) -> bool:
        """Whether the caller may proceed (e.g. crawl) without user input."""
        return self.band == ConfidenceBand.HIGH and self.website_url is not None

    @property
    def needs_user_confirmation(self) -> bool:
        """Whether the frontend should present this as a best guess to confirm."""
        return self.band == ConfidenceBand.MEDIUM and self.website_url is not None


def _decision_from_scored(scored: ScoredCandidate, candidates_considered: int) -> DiscoveryDecision:
    website_url = None if scored.band == ConfidenceBand.LOW else str(scored.candidate.website_url)
    return DiscoveryDecision(
        band=scored.band,
        website_url=website_url,
        confidence=scored.confidence,
        explanation=scored.explanation,
        positive_signals=[s.rationale for s in scored.positive_signals],
        negative_signals=[s.rationale for s in scored.negative_signals],
        source=scored.candidate.source.value,
        candidates_considered=candidates_considered,
    )


class DiscoveryPipeline:
    """Resolves a BRF's official website with confidence gating.

    Resolution order:
      1. Verified Website Registry (highest confidence; skips Discovery).
      2. Manual override supplied by the caller (e.g. a frontend-submitted URL).
      3. Discovery + confidence scoring.

    A result is only usable automatically (`should_continue_automatically`)
    at HIGH confidence. MEDIUM surfaces a best guess for confirmation.
    LOW returns no URL at all - callers must not proceed past a LOW result.
    """

    def __init__(
        self,
        discovery_engine: DiscoveryEngine,
        registry: VerifiedWebsiteRegistry | None = None,
    ) -> None:
        """Initialize the pipeline.

        Args:
            discovery_engine: Engine used to generate candidates when the
                registry has no answer and no manual URL was supplied.
            registry: Verified website registry, checked before Discovery
                runs and written to after a HIGH-confidence result. Discovery
                runs unconditionally if omitted, and results are not persisted.
        """
        self._discovery = discovery_engine
        self._registry = registry

    async def resolve(
        self,
        target: BRF,
        queries: list[str] | None = None,
        manual_website_url: str | None = None,
    ) -> DiscoveryDecision:
        """Resolve the official website for `target`.

        Args:
            target: The BRF to resolve a website for.
            queries: Search queries passed to Discovery providers, if Discovery runs.
            manual_website_url: A URL supplied directly by the caller (e.g. pasted
                by a user in the frontend). When present, Discovery is skipped
                entirely and this URL is treated as HIGH confidence and
                persisted as user-confirmed.

        Returns:
            A DiscoveryDecision describing what was found and why it can
            (or cannot) be trusted.
        """
        if manual_website_url:
            return await self._resolve_manual(target, manual_website_url)

        if self._registry is not None:
            registry_hit = await self._resolve_from_registry(target)
            if registry_hit is not None:
                return registry_hit

        return await self._resolve_via_discovery(target, queries)

    async def confirm(
        self, target: BRF, website_url: str, confidence: float = 1.0
    ) -> DiscoveryDecision:
        """Record a user's confirmation of a MEDIUM-confidence candidate.

        Call this when the frontend presented a best guess and the user
        accepted it (rather than pasting a different URL). Promotes the
        candidate to HIGH confidence and stores it in the registry.

        Args:
            target: The BRF the confirmation is for.
            website_url: The URL the user confirmed as correct.
            confidence: Confidence to record; defaults to 1.0 since a
                human confirmation is ground truth.

        Returns:
            A HIGH-confidence DiscoveryDecision for the confirmed URL.
        """
        await self._persist_verification(
            target, website_url, VerificationMethod.USER_CONFIRMED, confidence
        )
        return DiscoveryDecision(
            band=ConfidenceBand.HIGH,
            website_url=website_url,
            confidence=confidence,
            explanation="User confirmed this website.",
            source=DiscoverySource.MANUAL.value,
        )

    async def _resolve_manual(self, target: BRF, website_url: str) -> DiscoveryDecision:
        decision = DiscoveryDecision(
            band=ConfidenceBand.HIGH,
            website_url=website_url,
            confidence=1.0,
            explanation="Website supplied directly by the caller; Discovery was skipped.",
            source=DiscoverySource.MANUAL.value,
        )
        await self._persist_verification(
            target, website_url, VerificationMethod.USER_CONFIRMED, decision.confidence
        )
        return decision

    async def _resolve_from_registry(self, target: BRF) -> DiscoveryDecision | None:
        assert self._registry is not None
        existing = await self._registry.get(target.name, target.organization_number)
        if existing is None:
            return None

        logger.info(
            "discovery_registry_hit",
            brf_name=target.name,
            website_url=existing.website_url,
            method=existing.verification_method.value,
        )
        return DiscoveryDecision(
            band=ConfidenceBand.HIGH,
            website_url=existing.website_url,
            confidence=existing.confidence,
            explanation=(
                f"Previously verified ({existing.verification_method.value}) "
                f"on {existing.verified_at:%Y-%m-%d}."
            ),
            positive_signals=["Website already verified in the registry"],
            source="registry",
            from_registry=True,
        )

    async def _resolve_via_discovery(
        self, target: BRF, queries: list[str] | None
    ) -> DiscoveryDecision:
        result = await self._discovery.discover(queries=queries or [f"BRF {target.name}"])
        scored = score_candidates(target, result.brfs)

        if not scored:
            return DiscoveryDecision(
                band=ConfidenceBand.LOW,
                explanation="No candidate websites were found for this BRF.",
                negative_signals=["Zero discovery candidates returned"],
            )

        best = scored[0]
        decision = _decision_from_scored(best, candidates_considered=len(scored))

        if decision.should_continue_automatically:
            await self._persist_verification(
                target, decision.website_url, VerificationMethod.AUTOMATIC, decision.confidence
            )

        return decision

    async def _persist_verification(
        self,
        target: BRF,
        website_url: str | None,
        method: VerificationMethod,
        confidence: float,
    ) -> None:
        if self._registry is None or website_url is None:
            return
        await self._registry.save(
            VerifiedWebsite(
                brf_name=target.name,
                organization_number=target.organization_number,
                website_url=website_url,
                verification_method=method,
                confidence=confidence,
            )
        )
