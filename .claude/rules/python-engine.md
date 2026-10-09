---
paths:
  - "api/**"
  - "analysis_engine/**"
  - "BRF-Scraper/**"
  - "src/**"
  - "tests/**"
  - "Dockerfile"
  - ".dockerignore"
  - "railway.json"
---

# Python engine (Railway)

Routes, local running and the translation model: `api/README.md`. Architecture: `docs/architecture/overview.md`.

- **Merging to `main` redeploys Railway when it changes the engine** (`watchPatterns` in `railway.json`: `api/`,
  `analysis_engine/`, `BRF-Scraper/`, `src/` and the build files; add a folder there if the engine starts reading it). The
  image is built from the root `Dockerfile`, which copies the whole repository; `api/server.py` imports `analysis_engine/`, `BRF-Scraper/src` and `src/` by adding them to `sys.path`.
  Don't move or rename those folders, and don't rely on files that `.dockerignore` excludes.
- Every route except `GET /` must stay behind `X-Internal-Secret` (`require_internal_secret` in `server.py`);
  `api/tests/test_internal_auth.py` checks this and that the removed BRF-acquisition routes stay gone.
- `BRF-Scraper/` only extracts figures from **uploaded** annual reports. Automatic BRF fetching was removed on purpose
  (tag `archive/brf-automation-2026-10-02`) — don't bring it back unasked.
- `/api/browser-fetch` (Camoufox) still fetches Hemnet pages; its legal status is open
  (`docs/legal-data-migration-plan.md`). Don't extend scraping without Karol's decision.
- Text produced by `analysis_engine/` must follow `.claude/rules/report-objectivity.md`.
- A new dependency goes into `api/requirements.txt` and makes the image bigger; Camoufox launches use ~0.9 GB, the
  translation model ~300 MB. Mention memory impact in the pull request.

Tests (from the repository root, interpreter `BRF-Scraper/.venv/Scripts/python.exe` on this machine):
`-m pytest api/tests` (in CI), `-m pytest analysis_engine/tests`, `-m pytest BRF-Scraper/tests` (not in CI; OCR tests
skip without Tesseract). Root `tests/` need the Poetry project's path dependency outside this repository and do not
run from a plain clone.
