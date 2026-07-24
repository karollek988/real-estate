"""Address Resolver provider (task A-02, provider P1).

Pure normalization — no network. Parses the raw input, extracts what it
can confidently identify (postal code, kommun via the SCB register), and
records honest warnings for what it could not. A missing field is
acceptable; a guessed one is not, so every match path is conservative
(see `municipality.py`).

Assumptions (documented per Wave 2 instructions):
- Swedish addresses; comma-separated segments with the street first
  ("Dalagatan 30, 113 24 Stockholm").
- A 5-digit group formatted NNN NN or NNNNN is a postal code; street
  numbers never have 5 digits.
- Kommun names are matched against the bundled SCB register only —
  city-district names ("Vasastan") intentionally do not resolve.
"""

from __future__ import annotations

import re

from location_intelligence.context import AddressContext, InputMode
from location_intelligence.models import ProviderResult, ProviderStatus, TrustTier
from location_intelligence.municipality import KommunRegister, load_register
from location_intelligence.providers.base import Provider, Stage

_POSTAL_CODE = re.compile(r"\b(\d{3})\s?(\d{2})\b")
_STREET_NUMBER = re.compile(r"\b\d{1,4}\s?[A-Za-z]?\b")


class AddressResolver(Provider):
    id = "address_resolver"
    stage = Stage.PRE
    trust_tier = TrustTier.REGISTRY_AUTHORITY  # kommun identity comes from SCB data

    def __init__(self, register: KommunRegister | None = None) -> None:
        self._register = register if register is not None else load_register()

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.input_mode is InputMode.COORDINATES:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="coordinate input; nothing to parse — reverse geocoding fills identity",
            )

        raw = context.raw_input
        patch: dict[str, object] = {}
        warnings: list[str] = []

        postal_match = _POSTAL_CODE.search(raw)
        if postal_match:
            patch["postal_code"] = f"{postal_match.group(1)} {postal_match.group(2)}"

        segments = [s.strip() for s in raw.split(",") if s.strip()]
        street_segment = segments[0] if segments else ""
        if not _STREET_NUMBER.search(street_segment):
            warnings.append("no street number found; geocoding may be street-level only")

        code = self._find_municipality(segments, raw)
        if code is not None:
            patch["municipality"] = self._register.municipality_name(code)
            patch["municipality_code"] = code
            patch["county_code"] = self._register.county_code_for(code)
        else:
            warnings.append("municipality not recognized from address input")

        if warnings:
            patch["warnings"] = context.warnings + tuple(warnings)

        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            context_patch=patch,
        )

    def _find_municipality(self, segments: list[str], raw: str) -> str | None:
        # Segments after the street, most-specific-last convention: try
        # from the end ("..., 113 24 Stockholm" → "Stockholm").
        candidates: list[str] = []
        for segment in reversed(segments[1:]):
            candidates.append(_strip_digits(segment))
        # Comma-less inputs ("Dalagatan 30 Stockholm"): try the last words.
        words = _strip_digits(raw).split()
        if words:
            candidates.append(words[-1])
        if len(words) >= 2:
            candidates.append(" ".join(words[-2:]))

        for candidate in candidates:
            code = self._register.municipality_code(candidate)
            if code is not None:
                return code
        return None


def _strip_digits(text: str) -> str:
    return re.sub(r"\d+", " ", text).strip()
