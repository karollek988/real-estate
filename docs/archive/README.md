# Archive

> **STATUS: ARCHIVE INDEX.** Nothing in this folder describes the current system. Each file has a `STATUS: ARCHIVED`
> banner with the reason. Current documentation starts at [`docs/README.md`](../README.md).

Documents are kept because they explain earlier decisions, carry research that may be reused, or help debugging. Paths
mentioned *inside* them refer to where files were when they were written — use the table below to find a file that
moved on 2026-10-08.

## Where files moved on 2026-10-08

| Old path | New path |
|---|---|
| `PROJECT_STATE.md` (full history) | `docs/archive/project-state-history-2026-10-08.md` (a new, short `PROJECT_STATE.md` replaced it) |
| `BLUEPRINT.md` | `docs/archive/BLUEPRINT.md` |
| `notion-project-plan-prompt.md` | `docs/archive/notion-project-plan-prompt.md` |
| `docs/11_…` – `docs/19_…`, `docs/23_…`, `docs/24_…`, `docs/26_…`, `docs/27_…`, `docs/29_…`, `docs/31_…`, `docs/32_…`, `docs/42_…`, `docs/43_…`, `docs/45_…`, `docs/47_…` | `docs/archive/` (same file names) |
| `docs/EXTRACTION_VALIDATION.md`, `docs/MANUAL_INPUT_COVERAGE.md`, `docs/analysis-engine-architecture.md`, `docs/brf-knowledge-base.md`, `docs/design-system.md`, `docs/kopanalys-report-design.md`, `docs/market_intelligence_audit_sprint5.md`, `docs/reasoning-engine-knowledge-model.md`, `docs/report-pdf-layout-blueprint.md` | `docs/archive/` (same file names) |
| `docs/33_…`, `docs/35_…`, `docs/unified-brf-profile-design.md` | `docs/archive/brf-automation/` |
| `docs/10_…`, `docs/20_…`, `docs/21_…`, `docs/30_…`, `docs/46_…` | `docs/research/` |
| `BRF-Scraper/*_REPORT.md` (moved 2026-10-02) | `docs/archive/brf-automation/` |

Not moved (code comments link to them): the documents listed in [`docs/README.md`](../README.md) under "Documents still
in this folder's root".

## What is here

| File | Why it is archived |
|---|---|
| `project-state-history-2026-10-08.md` | Session-by-session history (sessions 1–17 and 2026-10-08): what was built, verified and decided |
| `BLUEPRINT.md`, `32_blueprint_alignment.md` | The July 2026 pipeline with a Buy/Avoid decision engine — superseded 2026-10-02 |
| `11`–`16`, `18`, `19`, `23`, `24` | Product definition from July 2026 (partly under the old name Bostadsradar), before the October pivot |
| `17_scoring_framework.md`, `27_decision_engine.md`, `kopanalys-report-design.md`, `report-pdf-layout-blueprint.md`, `42`, `43` | Report and contracts with scores and verdicts — scores removed 2026-10-02 |
| `reasoning-engine-knowledge-model.md`, `analysis-engine-architecture.md`, `brf-knowledge-base.md` | Large design documents that never matched what was built |
| `26_property_extraction.md`, `29_discovery_ranking_engine.md` | Extraction layer as designed in July; a ranking engine that was never built |
| `31`, `45`, `market_intelligence_audit_sprint5.md`, `EXTRACTION_VALIDATION.md`, `MANUAL_INPUT_COVERAGE.md` | Point-in-time audits and validation reports |
| `47_business_model_handoff_2026-10-02.md` | Handoff superseded the same day by `docs/48_…` |
| `design-system.md` | The old Bostadsradar palette; colours now come from `frontend/src/styles/_variables.scss` |
| `notion-project-plan-prompt.md` | Broker (B2B) launch plan — no longer the strategy |
| `brf-automation/` | Research, design and validation of the automatic BRF acquisition removed on 2026-10-02 (code: git tag `archive/brf-automation-2026-10-02`) |
| `claude-context-migration-2026-10-08.md` | Report of the Claude Code context and documentation refactor |
