"""AI Narrator — rewrites the deterministic analysis into natural Swedish prose.

Sits between the Aggregator (reasoning.py's ReasoningResult) and the existing
Report Generator (report.py). It never calculates, invents, scores, or
overrides anything the rule-based pipeline already decided — see
service.py's module docstring for the exact contract.
"""

from .base import NarrationError, NarrationPayload, NarrationProvider
from .service import generate_ai_report

__all__ = [
    "NarrationError",
    "NarrationPayload",
    "NarrationProvider",
    "generate_ai_report",
]
