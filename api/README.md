# Python engine (`api/server.py`)

FastAPI service deployed on Railway (root `Dockerfile`, `railway.json`). The
Next.js app (Vercel) is its only client; every route except `GET /` requires the
shared secret in the `X-Internal-Secret` header (`PYTHON_ENGINE_API_SECRET`,
same value on Vercel and Railway — see `frontend/src/lib/pythonEngine.ts`).

| Route | What it does | Called from |
|---|---|---|
| `POST /api/brf-annual-report/upload` | A BRF annual report the buyer uploaded (PDF / Word / photo) → verified figures | `frontend/src/app/api/properties/[id]/brf-report` |
| `POST /api/brf-financials` | Verified figures → metrics + rule-based strengths/weaknesses (`analysis_engine`) | `frontend/src/lib/analysis/providers/brfFinancials.ts` |
| `POST /api/ocr/extract-text` | Listing screenshots → raw text (Tesseract `swe+eng`), nothing stored | `frontend/src/app/api/listing-screenshots/extract` |
| `POST /api/location-intelligence` | Area data for an address (`src/location_intelligence`) | `providers/locationIntelligence.ts` |
| `POST /api/market-intelligence` | Market data for a municipality (`src/market_intelligence`) | `providers/marketIntelligence.ts` |
| `POST /api/browser-fetch` | One page through a real browser (Camoufox) — Hemnet escalation only | `frontend/src/lib/analysis/listing/hemnetPage.ts` |
| `GET /` | Health check (Railway) | — |

**Nothing here finds or downloads a BRF annual report.** The buyer uploads it.
`/api/resolve`, `/api/analyze` and `/api/brf-annual-report` (the Hemnet URL →
BRF profile → report pipeline, with its own demo page) were removed on
2026-10-02; the last commit that has them is tagged
`archive/brf-automation-2026-10-02`. `api/tests/test_internal_auth.py` asserts
they stay gone.

## Running locally

```bash
cd api
PYTHON_ENGINE_API_SECRET=dev-secret ../BRF-Scraper/.venv/Scripts/python.exe -m uvicorn server:app --port 8000
# frontend/.env.local: PYTHON_ENGINE_API_URL=http://127.0.0.1:8000, PYTHON_ENGINE_API_SECRET=dev-secret
```

Tesseract (with the `swe` language pack) must be installed for OCR; the Docker
image has it. Tests: `BRF-Scraper/.venv/Scripts/python.exe -m pytest api/tests`.
