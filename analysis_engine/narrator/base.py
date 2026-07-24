"""Provider-agnostic narration interface.

NarrationPayload is the *entire* set of facts a narration provider is
allowed to know. It is built once from reasoning.py's already-computed
ReasoningResult (see payload.py) — a provider implementation must never
be given, and must never need, anything beyond it.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class NarrationPayload:
    """Structured Aggregator facts, already decided by the rule-based pipeline."""

    brf_name: str
    fiscal_year: int
    verdict: str
    confidence: float
    signals: list[dict] = field(default_factory=list)
    observations: list[dict] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)
    recommendations: list[dict] = field(default_factory=list)


class NarrationError(RuntimeError):
    """A provider failed to produce narration.

    Callers must treat this as non-fatal and fall back to the deterministic
    template report — a broken or unreachable AI provider must never block
    a report from being generated (same convention this codebase already
    uses for every external data provider).
    """


class NarrationProvider(ABC):
    """One vendor's implementation of "turn payload into Swedish prose"."""

    @abstractmethod
    def narrate(self, payload: NarrationPayload) -> str:
        """Return a natural-language Swedish narration of payload.

        Must raise NarrationError on any failure (missing key, network
        error, empty response) rather than returning partial or fabricated
        text.
        """
        raise NotImplementedError
