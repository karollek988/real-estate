# 47. Business-model alignment with the pitch deck — HANDOFF (2026-10-02, unfinished)

Template: `Kopanalys_Fororten_2026_Pitch_Deck_v7_MALL.pdf` (Downloads). The session
ran out of usage before finishing. **Nothing from this session is pushed or merged;
`main` and production are untouched.** Branch: `feature/trygghetspaket-business-model`.

## Git state

| Commit / ref | What | State |
|---|---|---|
| `743986a` | Packages (99 / 499 / 999 kr) instead of Premium; credits, area scope, redaction (the 8th session's work, previously uncommitted) | done, `tsc` + verify scripts were green on it |
| next commit | Automated BRF acquisition removed (Python + TS provider) | done and verified (see below) |
| WIP commit (last) | Scoring removal + new Boendekalkyl + report-builder rewrite | **does NOT compile** — unfinished |
| tag `archive/brf-automation-2026-10-02` (local, not pushed) | Last commit that still has the scraper/profile/discovery code | restore with `git checkout archive/brf-automation-2026-10-02 -- BRF-Scraper api/server.py` |

Do not push `main` until `npx tsc --noEmit`, every `*.verify.mjs` (run with `npx tsx`) and
`npm run build` are green. A push to `main` auto-deploys Vercel **and** Railway.

## Done and verified

- **Automated BRF fetching removed.** Gone: `/api/resolve`, `/api/analyze`, `/api/brf-annual-report`
  and the demo page in `api/server.py`; BRF-Scraper `browser/ crawler/ discovery/ downloader/ jobs/
  pipeline/ profile/ storage/ interfaces/ models/` and the CLI; the TS `brfAcquisition` provider; the
  `brf_register` placeholder; root `tests/coverage_*`. Kept: `extractor/` (upload extraction + OCR),
  `analysis_engine`, location/market engines, `/api/browser-fetch` (Hemnet escalation, see flags).
  Historical reports moved to `docs/archive/brf-automation/`. `api/requirements.txt` pruned.
- Verified: `api/tests` 25 pass (incl. "removed endpoints stay 404"), BRF-Scraper 16 pass + 5 OCR skips
  (no Tesseract on this Windows host), `analysis_engine` 79 pass. **Production Docker image built with the
  pruned requirements and smoke-tested**: `GET /` 200, removed endpoints 404, no secret 401, a real
  annual report through `/api/brf-annual-report/upload` -> `/api/brf-financials` works.
- Verified rules for the new cost calculation (checked 2026-10-02): lagfart 1.5 % + 825 kr and pantbrev
  2 % + 375 kr (Lantmäteriet); **from 1 April 2026 the loan cap is 90 % and the income-based extra
  amortization is gone**; amortization 2 % above 70 % LTV, 1 % at 50-70 % (Ekonomifakta/FI). The deck's
  "60 825 kr lagfart på 4 Mkr" = 1.5 % x 4 000 000 + 825.

## In progress (WIP commit, does not compile)

Scoring ("Decision Score", verdict, confidence, insights, per-factor score/weight) is being removed
from the data model; the price chapter is replaced by a real **Boendekalkyl**.

Already written: `lib/analysis/types.ts` (`ReportFactor`, no scores), `lib/analysis/legacyReport.ts`
(normalizes old stored reports on read), `store.ts` (no `decision_score`), `redact.ts`,
`engine/collectFactors.ts`, rewritten analyzers (`area`, `market`, `futureDevelopment`, `risk`,
`housingAssociation` with `reportState: verified|unusable|none`), deleted `price/negotiation/confidence/
decisionEngine`, `buildAnalysis.ts` (engine `0.6.0`), `lib/report/{format,tenure,housingCost}.ts`,
and in `build.ts` the new executive summary, BRF chapter and risk categories (no severity).

## Remaining work, in order

1. `lib/report/build.ts`: replace `buildFinalRecommendation` (+ `negotiationSv`, `negotiationArgumentsSv`) with
   `lib/report/questions.ts` -> `buildInspectionQuestions(report, attributes)` = broker questions, BRF
   questions (not for freehold), limits. Neutral interrogatives only: `build.objectivity.verify.mjs` bans
   "be mäklaren", "bör kontrolleras", "rekommenderar", `x/100` etc. Then `npx tsc --noEmit`.
2. `app/report/page.tsx`: drop price verdict/meters/negotiation (`PriceComparisonBar`, `SegmentedMeter`,
   `ComparableSalesTable` become unused), build the Boendekalkyl UI from `buildHousingCost` (cards, 3-column
   interest table, purchase-cost rows, assumptions, "ingår inte"), BRF upload prompt by `reportState`, hide the
   BRF/liquidity parts for freehold (`tenureOf`), final chapter "Frågor inför visningen", dynamic page numbers,
   `ChapterSources` with static names (Lantmäteriet, loan rules), remove `"brf_acquisition"` id, cover lead.
3. Score leaks outside the report: `api/inspections/[propertyId]/route.ts` (returns `summary` +
   `decisionFactors`) and `dashboard/inspection/page.tsx` "Kända risker" (lists factors with score < 60 using
   English labels/statuses like "Price Level: Above market") -> replace with BRF weaknesses from the report.
   Rename `DecisionAnalysisCard` -> `AnalysisCard`, drop its unused `growthPct` ("vs marknad").
4. **Fix the dashboard BRF upload (broken):** `dashboard/page.tsx` posts multipart to
   `/api/properties/[id]/brf-report`, which now needs the two-step JSON contract. Extract the 3 steps from
   `components/report/SectionDocumentUpload.tsx` into one shared function and use it in the dashboard card
   (`accept=".pdf,.docx,image/*"`, then go to `/analyzing?id=`).
5. Rewrite the verify scripts that assert scores: `analyzers/{area,futureDevelopment,housingAssociation,market,
   risk}.verify.mjs`, `report/build.verify.mjs`, `report/build.objectivity.verify.mjs`, `redact.verify.mjs`,
   `engineVersion.verify.mjs`; add a `housingCost` verify (4 000 000 kr -> lagfart 60 825, 90 % loan = 3 600 000,
   2 % amortization = 6 000 kr/month).
6. **Landing page / copy (the jury-facing part, not started):** hero from the deck ("Köpa bostad? Vi visar vad du
   faktiskt köper." / "En oberoende granskning ...; föreningens ekonomi, området och alla kostnader"); pills
   Boendekalkyl, Områdesanalys, BRF-analys, Möjliga risker (drop "Investeringsprognos"); a pricing section
   (99 / 499 "Huvudpaket" / 999 = 333 kr per bostad, "En husbesiktning kostar runt 10 000 kr", source Anticimex
   villa 2026, incl. moms) fed from one shared `lib/packages.ts` that `/buy` also uses; "Hitta -> Analysera ->
   Inspektera -> Besluta" with the map marked "kommer"; rewrite `InfoSection`, `lib/faq.ts`, the chat prompt in
   `api/chat/route.ts`, `OnboardingModal`, `layout.tsx` description; footer "Priser" link -> `/#priser`.
   (`app/page.tsx`'s pill already says "Boendekalkyl" on this branch, but nothing is deployed yet.)
7. Verify end to end on the local stack (Supabase is up; run `api/server.py` with `PYTHON_ENGINE_API_SECRET`):
   area analysis, full analysis (manual entry), BRF upload with a real PDF, report page + PDF, landing/buy on
   desktop and mobile; `npm run build`.
8. Docs: `PROJECT_STATE.md` ninth-session section + new G-items, status banner on `docs/44` (B3/B4 BRF part
   resolved, B8 obsolete), "superseded" banners on `docs/17, 25, 27, 33, 34, 35, unified-brf-profile-design`,
   update memory (`pricing-packages-model`, `cpp-backend-migration`).

## Flags — do not let these slide

1. **BRF extraction quality is the biggest product risk.** Real 2024 reports (`validation_reports/`, 9 files):
   0/9 give strengths/weaknesses, 0-1 metrics each; the gate discards ~75 % of extracted fields (digits of
   neighbouring table columns are glued into numbers like 4.8e17). Older scanned Allabrf reports through the
   production image (with Tesseract): 1-3 metrics, 1-2 signals, 0-1 findings (9 of ~30 measured before the
   container was stopped). With buyer uploads the BRF chapter will often say "inga verifierade nyckeltal".
   Options: column-aware parsing using word x-positions, LLM extraction behind the existing validation gate
   (OpenAI is already used), or the deck's "en människa granskar" step. The new `reportState` messaging is honest
   but does not fix this.
2. **The landing page's example-report image (`public/example-report.png`) shows a "72 av 100 Sammanvägt betyg"
   score ring** — the scoring the product no longer has. The InfoSection card image `images/analyze-before-bid.png`
   contains "VÄRDERING" / "BUDSTRATEGI". Both must be replaced (plan: a static React preview with clearly
   labelled fictional data).
3. **Fake social proof on the landing page:** "Betrodd av fastighetsinvesterare över hela Sverige — 4.8/5 baserat
   på 256 omdömen" is not backed by anything. Remove. Also "Efterfrågan: Hög/Låg" in the market panel is derived
   from the price index and is not a demand measure.
4. Stale claims: "fair value", "oberoende värdering", "Endast länkar från Hemnet stöds" (the UI uses screenshots /
   manual entry), "varje faktor viktas" (no weighting exists), AI reading "mäklarens dokument".
5. Deck claims the product does not implement: "En människa granskar resultatet innan du får det" (no review
   step in code — do not put it on the site until the process exists); the free map (not integrated, per the user:
   no preparations yet).
6. **Production before the jury sees it:** the two migrations (`20261002000000_credits_and_analysis_scopes.sql`,
   `20261002000100_remove_first100_campaign.sql`) are applied only to the local Supabase; Stripe Prices for the
   three packages do not exist (`STRIPE_PRICE_OMRADESANALYS / TRYGGHETSPAKET / TRE_BOSTADER`, also
   `STRIPE_COUPON_ANALYSIS_50OFF`); the local `.env.local` uses Stripe **test** keys; the Supabase CLI is linked to a
   remote project (`supabase/.temp`) but was not used. Deploying the new frontend before the migrations breaks the
   account/analysis pages for logged-in users. These steps touch the user's Supabase/Stripe and need their OK.
7. New signups get **0 credits**: a juror cannot run an analysis without paying. Decide how jurors try the product
   (demo account with credits, a discount code, or Stripe test mode).
8. Hemnet page scraping is still reachable (`POST /api/analyses` accepts a Hemnet `url`; `hemnetPage.ts` +
   `/api/browser-fetch` + Camoufox + the daily restart workflow remain) — docs/44 B3/B4 (ToS) is still open. The UI
   no longer submits URLs, so this is likely removable.
9. Legacy Python text-report path is unused by the product (`analysis_engine/report.py`, `narrator/`,
   `compare_narration.py`, `run.py`, `compute_verdict`) — candidates for removal.
10. Cost-rule constants in `lib/report/housingCost.ts` (loan cap, amortization, lagfart, pantbrev) are hard-coded
    and dated `COST_RULES_AS_OF`; review each January and on rule changes.
11. The C++ migration plan (`feature/cpp-backend-migration`) assumed porting the scraping chain (decision D1);
    that scope is gone on this branch — update the plan and the memory note.
12. Hygiene: `frontend/tsconfig.tsbuildinfo` is tracked (should be untracked + gitignored);
    `docs/kopanalys-engine-map.pdf` is an untracked leftover; `*.verify.mjs` headers still say
    `node --experimental-strip-types` but run with `npx tsx`.
