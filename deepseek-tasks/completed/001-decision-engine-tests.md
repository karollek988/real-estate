# Task 001 — Unit tests for the decision engine analyzers

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/lib/analysis/engine/analyzers/` contains the analyzers that produce the
decision factors shown in the property report (area, price, market, risk, negotiation,
housingAssociation, futureDevelopment). These are pure functions that take property/report
data and return a score + verdict. As far as we know, none of them currently have unit
tests, which means regressions in scoring logic can slip through silently.

## Goal

Add unit tests for these analyzer files:
- `frontend/src/lib/analysis/engine/analyzers/area.ts`
- `frontend/src/lib/analysis/engine/analyzers/price.ts`
- `frontend/src/lib/analysis/engine/analyzers/market.ts`
- `frontend/src/lib/analysis/engine/analyzers/risk.ts`
- `frontend/src/lib/analysis/engine/analyzers/negotiation.ts`
- `frontend/src/lib/analysis/engine/analyzers/housingAssociation.ts`
- `frontend/src/lib/analysis/engine/analyzers/futureDevelopment.ts`

For each analyzer:
1. Read the file to understand its exported function(s), input shape, and output shape
   (score, verdict/status, any thresholds it uses to move between "good/ok/bad" style buckets).
2. Check if a test file already exists for it anywhere in the repo (search for
   `*.test.ts`, `*.spec.ts`, or `*.verify.mjs` patterns — this repo seems to use a
   `.verify.mjs` convention in some places, e.g. `frontend/src/lib/analysis/providers/booli.verify.mjs`.
   Follow whatever convention already exists in this codebase rather than introducing a new
   one — look at an existing `.verify.mjs` file first to see the pattern used (how it's
   invoked, what assertions look like) before writing new tests.
3. Write tests covering:
   - A "clearly good" input that should produce a high/positive score or verdict.
   - A "clearly bad" input that should produce a low/negative score or verdict.
   - At least one boundary/edge case (missing optional field, null, zero, or a value right
     at a threshold used in the analyzer's logic).
   - Any explicit branches you see in the code (e.g. if the analyzer has 3 verdict buckets,
     test all 3).
4. Do not change the analyzer implementation files themselves — this task is tests only.
   If while writing tests you find what looks like an actual bug in the logic, do NOT fix
   it — just note it clearly in your final summary instead, with the file and line number.

## Definition of done

- One test file per analyzer listed above (or the existing convention's equivalent),
  each with at least 4 test cases as described.
- All new tests pass when run.
- No changes to any analyzer implementation file.
- Final summary lists: which analyzers got tests, how many test cases each, and any
  suspected bugs you noticed but did not fix.
