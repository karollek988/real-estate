from __future__ import annotations

import json
from pathlib import Path

import pytest
from calculator import calculate_metrics
from narrator import NarrationError, NarrationPayload, generate_ai_report
from narrator.base import NarrationProvider
from narrator.openai_provider import OpenAINarrationProvider
from narrator.payload import build_payload
from reasoning import run_reasoning
from report import compute_verdict_from_reasoning, generate_report


@pytest.fixture
def extracted() -> dict:
    json_path = Path(__file__).resolve().parent.parent / "sample_annual_report.json"
    with open(json_path, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def metrics(extracted: dict):
    return calculate_metrics(extracted["annual_reports"][0])


@pytest.fixture
def reasoning(metrics):
    return run_reasoning(metrics)


class _FakeProvider(NarrationProvider):
    """Returns fixed text; records the payload it was called with."""

    def __init__(self, text: str = "Detta är en testnarration.") -> None:
        self.text = text
        self.received_payload: NarrationPayload | None = None

    def narrate(self, payload: NarrationPayload) -> str:
        self.received_payload = payload
        return self.text


class _FailingProvider(NarrationProvider):
    def narrate(self, payload: NarrationPayload) -> str:
        raise NarrationError("provider unavailable")


def test_fallback_on_provider_failure_returns_unmodified_template(extracted, metrics, reasoning):
    """A broken provider must never block or alter the report."""
    template = generate_report(extracted, metrics, reasoning)

    report_text, ai_used = generate_ai_report(extracted, metrics, reasoning, _FailingProvider())

    assert ai_used is False
    assert report_text == template


def test_ai_report_changes_only_the_nulage_block(extracted, metrics, reasoning):
    """Every section outside 'Nuläge' must be byte-identical to the template -
    the underlying analysis must remain identical, only the wording changes."""
    template = generate_report(extracted, metrics, reasoning)
    narrative = "En testmening om ekonomin."

    provider = _FakeProvider(narrative)
    report_text, ai_used = generate_ai_report(extracted, metrics, reasoning, provider)
    assert ai_used is True

    verdict = compute_verdict_from_reasoning(reasoning)
    old_lines = ["  Nuläge:"]
    for line in verdict["summary"].split("\n"):
        if line.strip():
            old_lines.append(f"    {line}")
    old_block = "\n".join(old_lines)
    new_block = f"  Nuläge (AI-sammanfattning):\n    {narrative}"

    assert old_block in template
    assert old_block not in report_text
    assert new_block in report_text

    # Swapping the new block back out for the old one must reproduce the
    # template byte-for-byte - proving nothing else in the report changed.
    reconstructed = report_text.replace(new_block, old_block, 1)
    assert reconstructed == template


def test_payload_contains_only_facts_already_in_reasoning(extracted, metrics, reasoning):
    """The narrator must never be handed more (or fewer) facts than the
    Aggregator already produced - no invented data, nothing dropped."""
    verdict = compute_verdict_from_reasoning(reasoning)
    payload = build_payload(extracted, metrics, reasoning, verdict)

    assert payload.verdict == verdict["verdict"]
    assert payload.confidence == reasoning.overall_confidence
    assert len(payload.signals) == len(reasoning.signals)
    assert len(payload.observations) == len(reasoning.observations)
    assert len(payload.findings) == len(reasoning.findings)
    assert len(payload.recommendations) == len(reasoning.recommendations)

    for signal, expected in zip(payload.signals, reasoning.signals, strict=True):
        assert signal["metric"] == expected.metric
        assert signal["value"] == expected.value


def test_fake_provider_receives_exactly_the_built_payload(extracted, metrics, reasoning):
    verdict = compute_verdict_from_reasoning(reasoning)
    expected_payload = build_payload(extracted, metrics, reasoning, verdict)

    provider = _FakeProvider()
    generate_ai_report(extracted, metrics, reasoning, provider)

    assert provider.received_payload == expected_payload


def test_openai_provider_raises_without_api_key(monkeypatch, reasoning, metrics, extracted):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    verdict = compute_verdict_from_reasoning(reasoning)
    payload = build_payload(extracted, metrics, reasoning, verdict)

    provider = OpenAINarrationProvider(api_key=None)
    with pytest.raises(NarrationError, match="OPENAI_API_KEY"):
        provider.narrate(payload)
