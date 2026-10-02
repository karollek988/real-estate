# 48. Person-reviewed BRF analysis, report without scores, deck-aligned site — HANDOFF (2026-10-02)

Continues and **supersedes** `docs/47_business_model_handoff_2026-10-02.md` (its to-do items 1–7 are done; its
flags are carried over below). Template: `Kopanalys_Fororten_2026_Pitch_Deck_v7_MALL.pdf`.

**State:** branch `feature/trygghetspaket-business-model`, pushed to `origin` (see "Git state"). **Not merged;
`main` and production are untouched.** Everything compiles, every check is green except two pre-existing,
unrelated scripts (see "Verification").

## Decisions from the user (2026-10-02, second message)

1. **A person reviews the BRF analysis** before the customer sees it. The customer gets the report at once, but
   the BRF chapter says clearly that Köpanalys' experts review it and that it is ready **within 24 hours**.
   Everything else (area analysis etc.) is automatic and immediate — no "manual handling" wording there.
2. **Boendekalkyl** replaces the price analysis and will be built shortly; it must surface hidden costs. For now
   a professional, empty placeholder ("lanseras inom kort").
3. **The BRF report must be readable for the buyer**: what people look at in an annual report, which numbers
   are good and which are bad; the BRF data may feed other chapters.
4. The annual report is uploaded **manually by Köpanalys** (the customer may also upload it).
5. The fake social proof ("4.8/5 baserat på 256 omdömen") **stays for now**; it will be replaced next week.

## What exists now

### 1. The BRF review workflow (new)

Flow: purchase of a Trygghetspaket for a home with an association → `ensureBrfReview(property, "purchase")`
opens a review with `due_at = now + 24 h` and emails the team → the report's BRF chapter shows "granskas av våra
experter, klar senast <tid>" → the reviewer opens `/admin/brf`, gets/uploads the annual report, checks the
automatically read key figures, completes the form, writes a comment and publishes → every customer who owns the
full analysis sees the chapter at once and gets an email.

| Piece | Where |
|---|---|
| Table `brf_reviews` (one row per property; `pending` / `published` / `not_applicable`; `draft` + `published` jsonb; `requested_at`, `due_at`) and `brf_annual_reports.key_figures` | `supabase/migrations/20261002000200_brf_reviews.sql` |
| Data access: `ensureBrfReview`, `saveBrfReviewDraft`, `publishBrfReview`, `markBrfReviewNotApplicable`, `listBrfReviews` | `frontend/src/lib/brf/reviews.ts` |
| The figures a reviewer records (7 mandatory key figures + soliditet, loans, äkta/oäkta, tomträtt, underhållsplan, stambyte, decided fee change, revision remark, comment) with plausibility ranges | `frontend/src/lib/brf/figures.ts` |
| Readable interpretation: per figure a verdict + tone (good/neutral/watch/alert), plain-Swedish meaning, benchmark; "Vad det betyder för dig" in kronor; strengths/concerns; questions | `frontend/src/lib/brf/interpret.ts` |
| Chapter states (freehold / awaiting / overdue / published / update in progress / not applicable) | `frontend/src/lib/report/brfChapter.ts` |
| Chapter UI (used by the report AND the console's live preview) | `frontend/src/components/report/BrfAnalysis.tsx` |
| Review console (reviewers only): queue with deadlines, review page with the document link, prefilled form, "skiljer sig"-hints, live preview, publish / save draft / ej aktuell | `frontend/src/app/admin/**`, `frontend/src/components/admin/BrfReviewForm.tsx`, `frontend/src/app/api/admin/brf-reviews/[propertyId]/route.ts` |
| Who is a reviewer: `KOPANALYS_ADMIN_EMAILS` (comma-separated, confirmed email required); default `karollek98@gmail.com` | `frontend/src/lib/auth/admin.ts` |
| Emails: team on a new review round (`KOPANALYS_TEAM_EMAILS`, default `kopanalys@gmail.com`), customers on publish. Sent only in production (`BRF_REVIEW_EMAILS=on` in dev) | `frontend/src/lib/brf/notify.ts` |
| Upload (customer, dashboard, console share one client): file kept even if the engine can't read it; a new document after publication reopens the review with a new 24 h | `frontend/src/lib/brf/uploadClient.ts`, `app/api/properties/[id]/brf-report/*` |
| A report opened without a review (reports from before this change) opens one and notifies the team | `app/report/page.tsx` → `loadBrfState` |

**Reviewer runbook** (what the team does within 24 h):
1. Open `https://kopanalys.se/admin/brf` (signed in with a reviewer email). The queue is sorted by deadline;
   amber = ≤ 6 h left, red = late.
2. No annual report uploaded? Get the latest one (the broker or the listing, the association's website,
   allabrf.se, or Bolagsverket) and upload it on the review page. The engine reads the mandatory key figures;
   each prefilled field shows the source line and page.
3. Check every prefilled number against the "Flerårsöversikt" page. Fill in the loans (notes on "Skulder till
   kreditinstitut"), äkta/oäkta, tomträtt, underhållsplan, stambyte, planned maintenance and any decided fee
   change from the förvaltningsberättelse. A decided change whose date has passed is shown as already done.
4. Write a short comment in plain Swedish (shown to the customer as written). Check the preview, then
   **Publicera till kunden**. A house with no association: **Ingen förening (ej aktuell)**.

### 2. Reading the key figures automatically (Python)

`BRF-Scraper/src/brf_scraper/extractor/key_figures.py` reads the mandatory flerårsöversikt rows (årsavgift/kvm,
skuldsättning/kvm total and per BR-yta, sparande/kvm, räntekänslighet, energikostnad/kvm, årsavgifternas andel,
soliditet) plus plainly stated disclosures (äkta förening, tomträtt/äganderätt, underhållsplan, a decided fee
change with its date). It splits Swedish numbers whose thousands separator is the same space as the column
separator using the header's year count, the 3-digit-group rule, plausibility ranges and year-to-year
smoothness; the page with most key-figure rows wins. **On the 9 real 2024 annual reports in
`validation_reports/` every extracted key figure matched the report** (tests in
`BRF-Scraper/tests/unit/test_key_figures.py`, incl. 5 real-PDF cases). Pre-2023 reports don't contain these
figures; scanned PDFs depend on OCR (Tesseract is in the production image, not on the Windows dev host). It is
only ever a prefill — `api/server.py` returns it as `key_figures`, `brf_annual_reports.key_figures` stores it.

### 3. Benchmarks used in the BRF analysis (checked 2026-10-02)

| Key figure | Reading | Sources |
|---|---|---|
| Skuldsättning per kvm (BR-yta; total if that's all there is) | < 5 000 low · 5 000–9 999 normal · 10 000–14 999 high · ≥ 15 000 very high. Avg 7 117 (2023) | SBAB (<6 000 good, >10 000 watch), HSB (0–8 000 good, >15 000 se upp), Handelsbanken (>10 000 high, 15 000 very high), Avanza (<5 000 good); Nabo average |
| Sparande per kvm | < 0 alert · 0–129 low · 130–199 moderate · ≥ 200 good. Avg 123 (2023), ~20 % negative | HSB (>200 good, <120 se upp), Handelsbanken (200–300 good), SBAB (>250 good, <130 watch); Nabo |
| Räntekänslighet | < 5 % low · 5–9.9 normal · 10–14.9 high · ≥ 15 very high. Avg ~10 % | HSB (0–5 good, >10 se upp), SBAB (<6 good, >10 watch); Nabo |
| Årsavgift per kvm | < 500 low (neutral, check savings) · 500–849 normal · 850–999 high · ≥ 1 000 very high. Avg 690 | HSB (500–800 normal, >1 000 se upp), SBAB (<850 good, >1 000 watch), Avanza (500–700 normal); Nabo |
| Energikostnad per kvm | < 150 low · 150–249 normal · 250–299 high · ≥ 300 very high. Avg 203 (221 in flerbostadshus) | HSB (~200 normal), SBAB (<200 good, >250 watch), Handelsbanken (200–250); Nabo |
| Årsavgifternas andel av rörelseintäkter | ≥ 85 % mostly fee-financed · 60–84 % other income · < 60 % large dependence (watch). Avg 77 % | SBAB (>90 good, <85 watch); Nabo |
| Soliditet | < 10 % low (watch), else informational — misleading for BRFs on its own | HSB caveat |
| Äkta/oäkta | oäkta = alert: gain taxed 25 % instead of 22 %, limited uppskov | Skatteverket |
| Tomträtt | watch; alert if renegotiated within 5 years | Avanza, Fastighetsbyrån |
| Liten förening | < 10 apartments = watch | Avanza |
| Definitions | BFNAR 2023:1 (mandatory from fiscal years starting after 2022) | Bokföringsnämnden |

URLs: SBAB <https://www.sbab.se/1/brf/kunskap/bostadsrattsforeningarnas_nyckeltal.html> · HSB
<https://www.hsb.se/sodertorn/brf/pollux/ekonomi/arsredovisning/forklaringar-nyckeltal/> · Handelsbanken
<https://www.handelsbanken.se/sv/ekonomi-i-livet/fokus-foretag/branscher-och-verksamheter/brf/nyckeltal-som-styrelsen-bor-ha-koll-pa>
· Nabo (2 250 associations, FY2023)
<https://nabo.se/kunskap/hojda-arsavgifter-men-lagre-sparande-ny-analys-av-bostadsrattsforeningars-obligatoriska-nyckeltal/>
· BFN <https://www.bfn.se/wp-content/uploads/vl23-1-brf.pdf> · Skatteverket
<https://www.skatteverket.se/privat/fastigheterochbostad/beskattningavandelioaktabostadsforetag/raknautskattenvidforsaljning.4.361dc8c15312eff6fd22afc.html>
· Avanza <https://blogg.avanza.se/6-saker-att-granska-i-bostadsrattsforeningens-arsredovisning/> · Fastighetsbyrån
<https://www.fastighetsbyran.com/sv/sverige/artiklar/foreningens-ekonomi>.

"Vad det betyder för dig" (the hidden costs the BRF adds, per home): the buyer's share of the association's
debt ≈ skuldsättning/kvm × boarea (the exact share follows the andelstal); the fee after a 1-percentage-point
rate rise = månadsavgift × räntekänslighet; a decided, upcoming fee change in kronor; the home's own fee per
kvm vs the association's average. **The BRF review also feeds other chapters:** the executive summary, the
risk chapter (Föreningsrisk lists the concerns; the new **Avgiftsrisk** lists what could raise the fee;
Ränterisk adds the association's sensitivity; Byggnadsrisk adds the pipes), the questions chapter and the
viewing guide (`api/inspections/[propertyId]`).

### 4. The report (Trygghetspaket)

Cover → Sammanfattning → Fastighetsinformation → **Boendekalkyl (placeholder, "Lanseras inom kort")** →
**Bostadsrättsförening (reviewed)** (left out for a freehold house) → Områdesanalys → Möjliga risker →
**Framtidsutsikter** (was Investeringsutsikt) → **Frågor inför visningen** (broker questions from the listing's
gaps, association questions from the review, what the report does not cover). Page numbers follow the chapters
shown. No score, verdict, price meter or negotiation text anywhere; `build.objectivity.verify.mjs` bans the old
language. Swedish number formatting (decimal comma, "1,75 %"). The verified cost rules for the coming
Boendekalkyl are kept, unrendered, in `lib/report/housingCost.ts` (+ `housingCost.verify.mjs`: 4 000 000 kr →
lagfart 60 825 kr; loan 90 % = 3 600 000; amortization 2 % = 6 000 kr/month). Områdesanalys (99 kr) is
unchanged: cover + area chapter only, automatic, no review.

Other: dashboard cards show the BRF status ("granskas — klar senast …" / "klar") and the dashboard upload uses
the working 3-step flow (it was broken); `DecisionAnalysisCard` → `AnalysisCard` without the fake "vs
marknad"; the viewing guide's "Kända risker" (score-based) → "Föreningens ekonomi" from the review; reviewers
can open any report (`getReportForViewer(..., { isReviewer })`); tenure detection understands the manual form's
"Äganderätt"/"Arrende" (a house no longer gets a BRF chapter or review).

### 5. Landing page, /buy and copy (follow the deck)

Hero "Köpa bostad? Vi visar vad du faktiskt köper." + the deck's subtitle; pills Boendekalkyl (with "snart"),
Områdesanalys, BRF-analys, Möjliga risker; new sections **Det som inte står i annonsen** (the deck's 4 questions
+ "60 825 kr i lagfart för ett hus som kostar 4 miljoner"), **Så fungerar det** (Hitta [kommer snart] →
Analysera → Inspektera → Besluta; "Allt detta ingår i Trygghetspaketet, 499 kr"; the review promise),
**Exempelrapport** (the real BRF chapter component with a made-up association, labelled "Exempel · påhittade
siffror" — replaces the screenshot with "72 av 100"), **Priser** (`#priser`, 99 / 499 Huvudpaket / 999 = 333
kr per bostad, besiktning ~10 000 kr, Anticimex villa 2026, inkl. moms). One source of truth for the packages:
`frontend/src/lib/packages.ts` (also `/buy`; `HOUSING_COST_LIVE = false` adds the "lanseras snart" notes —
flip it when the Boendekalkyl ships). Market panel shows the policy rate instead of a made-up "Efterfrågan".
Value props, InfoSection (image with "VÄRDERING/BUDSTRATEGI" removed), FAQ (+ "Vem granskar BRF-analysen?",
"Hur vet ni vilka siffror som är bra eller dåliga?", "Vad är boendekalkylen?"), chat prompt, onboarding modal,
metadata, header ("Priser") and footer updated. `/buy`: the free map is "Gratis · kommer snart".

## Verification (2026-10-02)

- `npx tsc --noEmit` clean; `npm run build` green (incl. `/admin/*`).
- Frontend verify scripts (run with `npx tsx`): 18/20 green incl. the new `lib/brf/interpret.verify.mjs` and
  `lib/report/housingCost.verify.mjs` and the rewritten analyzer/report/redact scripts. The 2 red ones are
  pre-existing and unrelated: `hemnetPage.verify.mjs` (G5) and `parseBotCoverage.verify.ts` (see flags).
- Python: BRF-Scraper 31 passed + 5 OCR skips (16 old + 15 new key-figure tests incl. real PDFs);
  `api/tests` 25 passed; `analysis_engine` 79 passed.
- **End to end on the local stack** (local Supabase + migration applied locally, Python engine, dev server,
  two throw-away local accounts, since deleted): Trygghetspaket via manual entry → review opened at purchase
  (24 h) + team email logged → report: placeholder, "granskas … klar senast lördag 3 oktober kl. 19:55", risks,
  questions, no scores → uploaded the real HSB Hagaborg 2024 PDF from the report → stored, 12 values read →
  console prefilled with source lines → published → customer email logged → report shows the reviewed chapter;
  dashboard and viewing guide show the review; Områdesanalys → area-only report, no review, area credit used;
  villa (äganderätt) → no BRF chapter, pages 1–8. Landing and report checked at 1440 px and 375 px (no
  horizontal overflow).
- **Not verified:** the PDF download (Puppeteer + @sparticuz/chromium doesn't run on this Windows host —
  verify on a preview deployment); real emails (suppressed outside production); production data.
- The local DB keeps the 3 test properties and their analyses (analyses are append-only by design).

## Git state

| Commit | What |
|---|---|
| `743986a` | Packages instead of Premium (8th session) |
| `1478207` | Automated BRF acquisition removed |
| `0c187e6` | WIP from the 1st half of this session (did not compile on its own) |
| next commits | key-figure extraction (Python) · reviewed BRF analysis + report without scores · deck-aligned site · docs |
| tag `archive/brf-automation-2026-10-02` | the removed scraper code (pushed with the branch) |

## Production rollout — needs the user's OK (touches their Supabase, Stripe, Vercel, Railway)

In this order; pushing `main` deploys Vercel **and** Railway:
1. Apply the three migrations to the production Supabase: `20261002000000_credits_and_analysis_scopes.sql`,
   `20261002000100_remove_first100_campaign.sql`, `20261002000200_brf_reviews.sql` (back up first).
2. Stripe: create the three Prices and set `STRIPE_PRICE_OMRADESANALYS / _TRYGGHETSPAKET / _TRE_BOSTADER` on
   Vercel (`frontend/scripts/setup-stripe-products.ts`), check `STRIPE_COUPON_ANALYSIS_50OFF`.
3. Vercel env: `KOPANALYS_ADMIN_EMAILS` (reviewers), `KOPANALYS_TEAM_EMAILS` (who gets "review due"), confirm
   `RESEND_FROM_EMAIL`'s domain is verified, `PYTHON_ENGINE_API_SECRET` identical on Vercel and Railway.
4. Merge to `main` → both deploy. Then: sign in as a reviewer and open `/admin/brf`; buy one Trygghetspaket
   (or use a discount code), check the BRF chapter, upload a report, publish, check the email; download a PDF.

## Remaining work

1. Production rollout above (user decision).
2. **Jury access:** new accounts have 0 credits. Decide: a demo account with credits, a discount code, or
   Stripe test mode.
3. **Boendekalkyl** (the user builds it "inom kort"): start from `lib/report/housingCost.ts`; add the BRF
   hidden costs from `interpretBrf().forYou`, överlåtelse-/pantsättningsavgift, försäkring; then set
   `HOUSING_COST_LIVE = true` in `lib/packages.ts` and replace the placeholder in `app/report/page.tsx`.
4. Replace the fake social proof (user: next week).
5. The free map (admin.kopanalys.se demo) — later, no preparation done (as instructed).
6. Nice to have: reuse a published review for other apartments in the same association (match on
   organization number); reminder email when a review is about to be late; read the loan notes automatically.

## Flags — do not let these slide

1. **The 24-hour promise needs people.** Nothing escalates a late review except the console's red status. The
   chapter says "annars tar vi fram den själva" — the team must actually obtain annual reports. After deploy,
   every legacy customer who opens an old full report opens a review (`report_view`) → expect a burst of
   review emails.
2. **Production prerequisites** (3 migrations, Stripe Prices, env vars) — without the migrations the new
   frontend breaks account, report and review pages; without the Prices checkout returns 500.
3. **Fake social proof** "4.8/5 baserat på 256 omdömen" is still on the landing page (user decision: replace next
   week).
4. **Privacy policy** (`app/privacy/page.tsx`) says OpenAI interprets uploaded BRF annual reports — it doesn't
   (only the chat uses OpenAI) — and doesn't mention that Köpanalys staff read uploaded documents. Needs a
   legal read; not changed.
5. **The automatic BRF provider** (`brfFinancials` → Python `calculate_metrics`/`run_reasoning`) still runs in
   the pipeline when an extraction exists, but nothing customer-facing reads it any more (the BRF chapter is
   review-driven). Remove it, or surface it in the console as a second opinion.
6. **Benchmarks are dated** (FY2023 averages, levels checked 2026-10-02) — review yearly; they live in
   `lib/brf/interpret.ts` and the table above. Cost-rule constants in `housingCost.ts` likewise.
7. **Hero background image** (`public/hero-background.png`) has price tags baked in ("5 250 000 +8.6%"), which
   suggests price analysis; consider a new image.
8. **Local storage bucket config** (`supabase/config.toml`) allows only PDF although the app accepts Word and
   images — check the production bucket's allowed MIME types.
9. **Hemnet page scraping** is still reachable (`POST /api/analyses` with a Hemnet `url`, `/api/browser-fetch`,
   Camoufox) — docs/44 B3/B4 (ToS) is still open; the UI no longer submits URLs.
10. **Legacy Python text-report path** unused (`analysis_engine/report.py`, `narrator/`, `compare_narration.py`,
    `run.py`).
11. `parseBotCoverage.verify.ts` can't run any more (pipeline.ts uses `after()`, which needs a request scope);
    it only "passed" while the local DB was empty. `hemnetPage.verify.mjs` G5 still fails (pre-existing).
12. The dashboard's `StatusBadge` shows English "Ready" (pre-existing).
13. A review's "Vad det betyder för dig" uses the listing's boarea/avgift/byggår — wrong listing data gives
    wrong kronor; the reviewer can't edit those facts in the console.
14. The C++ migration plan (`feature/cpp-backend-migration`) assumed porting the scraping chain (D1) — that
    scope is gone; the new `key_figures.py` would need porting instead.
15. `docs/kopanalys-engine-map.pdf` is an untracked leftover (not committed on purpose).
