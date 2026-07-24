# Unified BRF Profile — Design Document

## 1. Goal

Build a single `BRFProfile` that merges information from four sources into one
canonical JSON document.  The analysis engine consumes **only** this profile —
never raw provider output.

---

## 2. Source priority (configurable)

```python
DEFAULT_SOURCE_PRIORITY = ["hemnet", "booli", "allabrf", "official_website"]
```

When two sources disagree on the same field the value from the higher-priority
source wins.  **Every** value is kept in a `sources` list so nothing is lost.

---

## 3. Profile schema

```jsonc
{
  "brf": {
    "name":            { "value": "BRF Solbacken", "sources": ["hemnet", "allabrf"] },
    "organization_number": { "value": "769600-1234", "sources": ["allabrf"] },
    "brf_type":        { "value": "bostadsrättsförening", "sources": ["allabrf"] },
    "municipality":    { "value": "Stockholm", "sources": ["hemnet"] },
    "county":          { "value": "Stockholm", "sources": ["allabrf"] },
    "address":         { "value": "Solbacken 1", "sources": ["hemnet"] },
    "postal_code":     { "value": "11234", "sources": ["booli"] },
    "website_url":     { "value": "https://brfsolbacken.se", "sources": ["allabrf"] },
    "founding_year":   { "value": 1987, "sources": ["allabrf"] }
  },

  "apartments": {
    "owner_occupied":  { "value": 32, "sources": ["allabrf", "hemnet"] },
    "rental":          { "value": 0, "sources": ["allabrf"] },
    "commercial":      { "value": 2, "sources": ["allabrf"] },
    "avg_monthly_fee": { "value": 4200, "unit": "SEK/month", "sources": ["hemnet"] },
    "list": [  // from Booli — every apartment in the BRF
      { "designation": "1001", "area_sqm": 72.0, "rooms": 3, "source": "booli" }
    ]
  },

  "property": {
    "year_built":          { "value": 1987, "sources": ["hemnet", "booli"] },
    "building_area_sqm":   { "value": 3800.0, "sources": ["allabrf"] },
    "residential_area_sqm":{ "value": 3200.0, "sources": ["allabrf"] },
    "commercial_area_sqm": { "value": 200.0, "sources": ["allabrf"] },
    "land_ownership":      { "value": "ägendom", "sources": ["official_website"] },
    "energy_class":        { "value": "D", "sources": ["booli"] },
    "renovation_history":  { "value": "Fasad 2019, tak 2021", "sources": ["official_website"] }
  },

  "personnel": {
    "property_manager":  { "value": "Fastighets AB Solbacken", "sources": ["official_website"] },
    "technical_manager": { "value": "Erik Lindqvist", "sources": ["official_website"] },
    "chairman":          { "value": "Anna Svensson", "sources": ["allabrf"] },
    "auditor":           { "value": "KPMG AB", "sources": ["allabrf"] }
  },

  "financials": {
    // Latest annual report figures — same structure as current analysis input
    "fiscal_year": 2025,
    "income_statement": { ... },
    "balance_sheet": { ... },
    "loans": [ ... ],
    "source": "allabrf",   // which provider supplied the financials
    "extraction_confidence": 0.9
  },

  "documents": [
    { "title": "Årsredovisning 2025", "type": "annual_report", "year": 2025,
      "url": "...", "downloadable": true, "source": "allabrf" }
  ],

  "meta": {
    "hemnet_url": "https://www.hemnet.se/...",
    "sources_queried": ["hemnet", "booli", "allabrf"],
    "profile_confidence": 0.88,
    "built_at": "2026-07-20T04:00:00Z"
  }
}
```

### Field wrapper

Every scalar field uses a consistent wrapper:

```python
class SourcedValue(BaseModel):
    value: Any
    unit: str | None = None
    sources: list[str] = []           # which providers supplied this value
    confidence: float = 1.0           # per-field confidence from the source
    last_updated: str | None = None   # ISO date if known
```

---

## 4. Merge strategy

```
For each field:
  1. Collect (value, source, confidence) tuples from all providers.
  2. Deduplicate by (normalized_value, source) — same value from same source = 1 entry.
  3. Pick winner = value from highest-priority source that provided a non-None value.
  4. Store winner in `value`, all contributors in `sources`.
  5. If sources disagree on the value: keep all in `sources`, add `conflicts` list.
```

Conflict resolution is **always transparent** — the profile never silently drops
a value.  The analysis engine can check `len(sources)` and `conflicts` to gauge
data quality.

---

## 5. Files to create / modify

| File | Action | Purpose |
|---|---|---|
| `BRF-Scraper/src/brf_scraper/profile/models.py` | **NEW** | `BRFProfile`, `SourcedValue`, all sub-models |
| `BRF-Scraper/src/brf_scraper/profile/merge.py` | **NEW** | `merge_profiles()` — priority-based field merger |
| `BRF-Scraper/src/brf_scraper/profile/engine.py` | **NEW** | `ProfileEngine` — orchestrates providers → profile |
| `BRF-Scraper/src/brf_scraper/discovery/booli_provider.py` | **NEW** | Booli listing + BRF page scraper |
| `analysis_engine/calculator.py` | **MODIFY** | Accept `BRFProfile` in addition to raw dict |
| `analysis_engine/report.py` | **MODIFY** | Source attribution from profile |
| `api/server.py` | **MODIFY** | Use `ProfileEngine` instead of manual wiring |

---

## 6. Provider extraction summary

| Provider | Extracts | Method |
|---|---|---|
| **Hemnet** | BRF name, address, municipality, monthly fee, apartment facts | `__NEXT_DATA__` + HTML fallback + Camoufox |
| **Booli** | BRF name, address, postal code, area, rooms, year built, energy class, valuation, apartment list, BRF economy link | JSON-LD (schema.org) + Camoufox |
| **Allabrf** | Org number, slug, county, registration year, apartment count, annual reports, documents, board info | REST API `/items/names` + profile page scrape |
| **Official website** | Board info, maintenance, statutes, contacts, property manager | HTML scrape of BRF website (discovered via Allabrf) |

---

## 7. ProfileEngine flow

```
ProfileEngine.build(hemnet_url, browser_fetch=None)
  │
  ├─ Stage 1: Hemnet
  │    HemnetProvider.fetch_listing(url) → HemnetListing
  │
  ├─ Stage 2: Booli
  │    BooliProvider.search(address, municipality) → BooliListing
  │    BooliProvider.fetch_brf_page(brf_id) → BooliBRF (if found)
  │
  ├─ Stage 3: Allabrf
  │    AllabrfProvider.acquire(name, city) → AllabrfAcquisition
  │    Includes: org number, metadata, documents, downloaded PDFs
  │
  ├─ Stage 4: Official website (if discovered)
  │    OfficialWebsiteScraper.scrape(url) → OfficialBRFData
  │
  ├─ Stage 5: Merge
  │    merge_profiles(hemnet, booli, allabrf, official) → BRFProfile
  │
  └─ Stage 6: Financial extraction (if PDFs available)
       Extract from downloaded annual reports → populate profile.financials
```

Each stage is **independent** — if Booli fails, the profile still builds from
the other three sources.  The `meta.sources_queried` list tells the analysis
engine what data is missing.
