# Task 006 — Shorten the free-tier report content

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/app/report/page.tsx` renders the full property report identically
regardless of whether the viewing user requested it as a "free" or "premium" analysis
(analyses are shared/cached per property — see `frontend/src/lib/analysis/ownership.ts`
docstring — but which quota bucket a specific user drew from is recorded per-request in
the `analysis_requests` table, not on the analysis itself).

Product decision: free analyses (users get 3 by default) should show a much shorter
report than premium. Free should show ONLY: basic property facts (address, size, price,
fee, etc. — whatever `buildPropertyOverview`/`IconFactGrid` already renders near the top)
and the price assessment (whether the asking price is low/high vs comparable
listings/sold prices — `buildPriceAnalysis`, `PriceComparisonBar`). Free must NOT show:
nearby amenities/restaurants (the `AmenityGrid` section, sourced from OSM via
`frontend/src/lib/analysis/providers/osm.ts`) or future development / planned
infrastructure projects (the `futureDevelopment` factor and its `ProjectCard` list).

## Goal

1. In `frontend/src/lib/analysis/ownership.ts`, add a new function:
   ```ts
   export async function getAnalysisRequestType(
     userId: string,
     analysisId: string
   ): Promise<AnalysisType | null>
   ```
   It should query `analysis_requests` for the most recent row matching
   `user_id = userId` and `analysis_id = analysisId`, returning its `analysis_type`, or
   `null` if the user never requested this specific analysis (edge case — decide a
   sensible fallback, e.g. treat as "premium"/full content, and note your reasoning in
   the summary, since blocking a legitimate viewer is worse than over-showing in an
   edge case that shouldn't normally happen).

2. In `frontend/src/app/report/page.tsx`:
   - Get the current user's id (there should already be a Supabase server client /
     `requireUser`-style pattern used elsewhere in this file or in similar server
     components — follow the existing convention, don't invent a new auth pattern).
   - Call `getAnalysisRequestType(userId, analysisId)` to get `"free" | "premium" | null`.
   - Wrap the `AmenityGrid` section (around where `AmenityGrid` is rendered, currently
     near line 678) so it only renders when the type is NOT `"free"`.
   - Wrap whatever section renders the future development factor/projects (uses
     `factorOf(p, "futureDevelopment")`, currently referenced near line 357, and the
     `ProjectCard` list it feeds) so it only renders when the type is NOT `"free"`.
   - Do NOT touch the property overview, price analysis/comparison, or any other section
     — those stay identical for both tiers.
   - If removing these sections leaves an odd layout gap (e.g. a two-column grid that
     assumed both side panels existed), make the minimal layout adjustment needed so the
     free report doesn't look broken — nothing more elaborate than that.

3. This must not change what premium users or the underlying analysis data model see —
   it is purely a presentational gate in the report page based on the viewing user's own
   request type.

## Definition of done

- Free-tier viewers see property basics + price assessment only.
- Premium-tier viewers (and any pre-existing behavior for users who don't have a request
  row for this analysis) see the report exactly as before, unchanged.
- `npm run build` passes in `frontend/`.
- Final summary: exact line ranges/JSX blocks you gated, and your reasoning for the
  `null`-case fallback in `getAnalysisRequestType`.
