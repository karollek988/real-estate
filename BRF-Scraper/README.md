# BRF annual report extractor (`brf_scraper`)

Reads **one BRF annual report that the buyer has uploaded** — a PDF, a Word
document or a photo — and returns the verified financial figures the analysis
engine (`analysis_engine/`) turns into the "Bostadsrättsförening" chapter of
the report.

> **There is no automatic retrieval of BRF reports.** Until 2026-10-02 this
> package was a crawler/discovery platform that looked a BRF up through Hemnet,
> Booli, Allabrf and the association's own website and downloaded its report.
> That system was removed: the buyer uploads the report instead (the
> "Ladda upp årsredovisning" button in the report). The last commit that has the
> old code is tagged `archive/brf-automation-2026-10-02`; historical validation
> reports are in `docs/archive/brf-automation/`.

## What is here

```
src/brf_scraper/
  extractor/
    engine.py              extract_annual_report(path, file_kind) -> ExtractionResult
    pdf_reader.py          pdfplumber text; per-page OCR fallback for scanned pages
    docx_reader.py         Word documents
    image_reader.py        a photo of a page (OCR)
    ocr.py                 Tesseract (swe+eng) wrapper — also used for listing screenshots
    financial_extractor.py income statement, balance sheet, loans, apartment mix
    property_extractor.py  building year, area, number of apartments, ...
    validation.py          cross-checks; only HIGH-confidence verified fields leave the extractor
    models.py              ExtractionResult / ExtractedValue / Evidence / tiers
    text_normalize.py
  utils/logging.py         structlog setup
```

`api/server.py` exposes this as `POST /api/brf-annual-report/upload` and
`POST /api/ocr/extract-text`; the Next.js app calls them (with the shared
`PYTHON_ENGINE_API_SECRET`) from `frontend/src/app/api/properties/[id]/brf-report`
and `frontend/src/app/api/listing-screenshots/extract`.

## Tests

```bash
cd BRF-Scraper
.venv/Scripts/python.exe -m pytest        # extraction validation + OCR
```

The OCR tests need the `tesseract` binary on `PATH` (with the `swe` language
pack); without it they skip themselves. `scripts/validate_financial_extraction.py`
re-runs the nine real annual reports in `../validation_reports/` through the
extractor and reports how much of what was found is trustworthy.
`data/allabrf_validation/pdfs`, `data/production_validation/pdfs` and
`data/allabrf_smoke` hold real annual reports used as extraction fixtures.
