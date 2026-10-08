---
paths:
  - "frontend/src/lib/report/**"
  - "frontend/src/lib/brf/**"
  - "frontend/src/lib/analysis/**"
  - "frontend/src/components/report/**"
  - "frontend/src/app/*/report/**"
  - "frontend/src/i18n/messages/**"
  - "analysis_engine/**"
---

# Report objectivity and data honesty

Köpanalys informs the buyer; it never decides for them. This applies to the TypeScript report, the BRF interpretation,
the analysis pipeline, the Python reasoning engine and every report text in the message files.

- **No advice:** no sentence tells the reader to buy, avoid, bid, negotiate, wait or "think carefully"; no "vi
  rekommenderar", "du bör", "bra köp", "överpris", "fynd".
- **No scores:** no score, grade, verdict, "x av 100", stars, traffic-light overall rating or price meter, and no
  price prediction. Readings of a single figure ("lågt", "högt", "värt att fråga om") are allowed only when they come
  from a named benchmark (`frontend/src/lib/brf/interpret.ts`, sources in `brf.sources`).
- **Facts with sources:** state the figure, where it comes from and, when one exists, what it is compared with.
- **Missing is missing:** a source without data reports `not_connected`/`no_data` and the report says the information is
  missing ("Uppgift saknas"). Never fill a gap with an estimate presented as a fact.
- **BRF figures** reach a customer only from a **published** review (`brf_reviews`); figures extracted from an annual
  report are a reviewer's prefill, never shown directly.
- **Area analysis access** is an allowlist in `frontend/src/lib/analysis/redact.ts`. A new field in the area chapter
  must be added there; run `npm run verify -- redact`.

After changing anything here, run in `frontend/`: `npm run verify -- report`, `npm run verify -- brf` and
`npm run verify -- analysis`, and read a sample report:
`npx tsx src/lib/report/build.objectivity.verify.mjs --dump <file>` (reading it is part of the check — the regex scan
alone has missed real problems before). Python: `pytest analysis_engine/tests/test_reasoning.py`.
