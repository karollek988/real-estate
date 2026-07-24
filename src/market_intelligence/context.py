"""The market context every provider receives as input.

Unlike the Location Intelligence engine which centers on a single property
address, the Market Intelligence Engine operates on geographic scope:
country, region, county, municipality, or postal code. Market data is
inherently regional — interest rates are national, housing price indexes
may be regional, and days-on-market may be municipal.
"""

from __future__ import annotations

import dataclasses
import hashlib
import re
from dataclasses import dataclass
from enum import StrEnum


class GeographicLevel(StrEnum):
    """How specific the geographic scope is.

    Providers declare which level(s) they can serve; the runner skips
    providers whose requirements aren't met by the context.
    """

    COUNTRY = "country"
    REGION = "region"
    COUNTY = "county"
    MUNICIPALITY = "municipality"
    POSTAL_CODE = "postal_code"


_LEVEL_RANK: dict[GeographicLevel, int] = {
    GeographicLevel.COUNTRY: 0,
    GeographicLevel.REGION: 1,
    GeographicLevel.COUNTY: 2,
    GeographicLevel.MUNICIPALITY: 3,
    GeographicLevel.POSTAL_CODE: 4,
}


def level_at_least(actual: GeographicLevel | None, minimum: GeographicLevel) -> bool:
    """True when ``actual`` is at least as specific as ``minimum``."""
    if actual is None:
        return False
    return _LEVEL_RANK[actual] >= _LEVEL_RANK[minimum]


_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True, slots=True)
class MarketContext:
    """Geographic and temporal scope for market data collection.

    Immutable; providers read from it but never modify it. The most
    specific geographic level available is computed from whichever
    fields are populated.
    """

    country: str | None = None
    region: str | None = None
    county: str | None = None
    municipality: str | None = None
    postal_code: str | None = None
    as_of: str | None = None
    start_date: str | None = None
    end_date: str | None = None

    @property
    def geographic_level(self) -> GeographicLevel | None:
        """The most specific geographic level populated in this context."""
        if self.postal_code is not None:
            return GeographicLevel.POSTAL_CODE
        if self.municipality is not None:
            return GeographicLevel.MUNICIPALITY
        if self.county is not None:
            return GeographicLevel.COUNTY
        if self.region is not None:
            return GeographicLevel.REGION
        if self.country is not None:
            return GeographicLevel.COUNTRY
        return None

    def cache_key(self) -> str:
        """Stable cache identity for this context.

        Geographic fields are normalized to lowercase trimmed strings;
        temporal fields are included verbatim.
        """
        parts: list[str] = []
        for field_name in ("country", "region", "county", "municipality", "postal_code"):
            value = getattr(self, field_name)
            if value is not None:
                parts.append(f"{field_name}={value.strip().lower()}")
        for field_name in ("as_of", "start_date", "end_date"):
            value = getattr(self, field_name)
            if value is not None:
                parts.append(f"{field_name}={value}")
        if not parts:
            return "empty"
        raw = "|".join(parts)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    def to_dict(self) -> dict[str, object]:
        return {
            "country": self.country,
            "region": self.region,
            "county": self.county,
            "municipality": self.municipality,
            "postal_code": self.postal_code,
            "geographic_level": self.geographic_level.value if self.geographic_level else None,
            "as_of": self.as_of,
            "start_date": self.start_date,
            "end_date": self.end_date,
        }

    def patched(self, **updates: object) -> MarketContext:
        """Return a copy with the given fields replaced."""
        valid = {f.name for f in dataclasses.fields(self)}
        unknown = set(updates) - valid
        if unknown:
            raise ValueError(f"unknown MarketContext fields: {sorted(unknown)}")
        return dataclasses.replace(self, **updates)  # type: ignore[arg-type]
