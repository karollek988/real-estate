"""Shared Overpass client plumbing (task O-01, provider P3 family).

"One Overpass client, several thin query modules" (doc 36 §4.1) — this
module holds the parts every Overpass-backed provider needs identically:
the endpoint, the polite rate limit, tag-filter matching, and coordinate
extraction (including way/relation `center`). Distance math itself lives
in `location_intelligence.proximity` (the shared proximity framework,
not Overpass-specific) and is re-exported here for backward compatibility.
`osm_poi.py` and `osm_construction.py` both build on this; neither
hand-rolls query execution or distance math again.
"""

from __future__ import annotations

import json
import urllib.parse

from location_intelligence.http_client import HttpClient, HttpError
from location_intelligence.proximity import haversine_m

__all__ = [
    "OVERPASS_BASE_URL",
    "OVERPASS_HOST",
    "OVERPASS_RATE_LIMITS",
    "element_coords",
    "haversine_m",
    "matches_filter",
    "run_overpass_query",
]

OVERPASS_BASE_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_HOST = "overpass-api.de"
#: Be a polite anonymous client of a shared public instance (doc 28 note).
OVERPASS_RATE_LIMITS = {OVERPASS_HOST: 2.0}


def run_overpass_query(client: HttpClient, query: str, timeout_s: float) -> object:
    """POST a query to the shared Overpass instance and parse the JSON body.

    Raises `HttpError` on transport failure or a non-JSON body — callers
    translate that into an honest `error` status themselves.
    """
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    text = client.post_text(
        OVERPASS_BASE_URL,
        body=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout_s=timeout_s,
    )
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise HttpError(f"Overpass returned non-JSON body: {exc}", url=OVERPASS_BASE_URL) from exc


def element_coords(element: dict[str, object]) -> tuple[float | None, float | None]:
    """Node coordinates, or a way/relation's `out center` centroid."""
    lat = element.get("lat")
    lon = element.get("lon")
    if lat is None or lon is None:
        center = element.get("center")
        if isinstance(center, dict):
            lat, lon = center.get("lat"), center.get("lon")
    if isinstance(lat, int | float) and isinstance(lon, int | float):
        return float(lat), float(lon)
    return None, None


def matches_filter(tags: dict[str, object], filt: str) -> bool:
    """Evaluate one Overpass-style filter string against an element's tags.

    `filt` looks like `["amenity"="restaurant"]`, a bare key-existence
    check `["construction"]`, or a chain of bracketed clauses ANDed
    together: `["a"="b"]["c"!="d"]`.
    """
    for clause in filt.replace("][", "]\x00[").split("\x00"):
        clause = clause.strip("[]")
        if "!=" in clause:
            key, _, value = clause.partition("!=")
            key, value = key.strip('"'), value.strip('"')
            if tags.get(key) == value:
                return False
        elif "=" in clause:
            key, _, value = clause.partition("=")
            key, value = key.strip('"'), value.strip('"')
            if tags.get(key) != value:
                return False
        else:
            # Bare key-existence filter, e.g. ["construction"].
            key = clause.strip('"')
            if key not in tags:
                return False
    return True
