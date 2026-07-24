# Real Estate — valuation & investment analysis

A platform for property valuation, underpriced-listing detection,
negotiation estimates and future-value analysis (initial market: Sweden /
Stockholm). **Status: architecture skeleton only.** No features are
implemented yet; the go/no-go for implementation is the data-ecosystem
research in [`docs/data-sources.md`](docs/data-sources.md).

## How this project relates to the rest of the repository

- `shared/probability-engine` — supplies all probabilistic modeling
  (model interface, softmax/random-forest families, proper scoring rules,
  significance tests, persistence). **Never** reimplement these here.
- `projects/betting` — the sibling project the engine was extracted from.
  Its layering (data → features → models → services → api) is the
  template this skeleton mirrors, because 56 sprints proved that shape.

## Layout

```
src/real_estate/     Python package (src layout, same as the other projects)
  data/              acquisition clients for external sources (Booli, SCB, ...)
  features/          listing-time feature engineering
  valuation/         valuation targets + mispricing detection (uses probability_engine)
  services/          product layer: reports, explanations, DTOs
  config/            typed configuration
api/                 future FastAPI wrapper (mirror of the betting api/ layout)
frontend/            future web UI
data/                local raw data & artifacts (gitignored except README)
docs/                architecture + data-source research
notebooks/           exploratory analysis (never production logic)
tests/               pytest suite; `integration` marker = real network calls
```

Deviation from the original sketch ("backend/", "models/"): the Python
package uses the same src-layout as the sibling projects instead of a
`backend/` folder, and there is no `models/` folder because models come
from the shared engine — `valuation/` holds only the domain-specific
composition of those models.

## Development

The monorepo root `.venv` already has this package's dependencies wired
(shared engine via `.pth`). Standalone: `poetry install` in this folder.

Run tests: `python -m pytest` from this directory.

## Moving this project to its own repository

Designed to be a cheap operation:

1. Copy `projects/real-estate/` to the new repo root.
2. Bring the engine: either copy `shared/probability-engine/` alongside it
   and keep a path dependency, or publish `probability-engine` to a private
   index / reference it as a git dependency, and update one line in
   `pyproject.toml`.
3. `poetry install`. Nothing in this project may import `sports_data_engine`
   or reach outside its own folder except for the `probability-engine`
   dependency — that invariant is what keeps the move one step.
