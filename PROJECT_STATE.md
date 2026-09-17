# Köpanalys — Project State

> Concise, factual snapshot for picking this project back up after a cleared
> Claude conversation. Update this file when something in it changes;
> otherwise leave it alone. Detailed research/product docs live in `docs/`;
> this file is the "what's actually true right now" summary.

Last updated: 2026-09-17 (branch `test/ocr-security-verification`, off `main`,
continued in a second session on the same branch — Railway/FastAPI
authentication added).

## 1. Architecture

- **Frontend**: Next.js App Router (`frontend/`), deployed on Vercel. Supabase
  (Postgres + Auth + Storage) for data/auth. Stripe for payments/subscriptions.
- **Analysis engine**: Python FastAPI (`api/server.py`), deployed via the root
  `Dockerfile` — almost certainly Railway (`railway.json`, "railway logs" in
  code comments). Wraps `analysis_engine/` (BRF financial calculator +
  reasoning + report text), `BRF-Scraper/` (Hemnet/Booli/Allabrf profile
  acquisition, PDF/DOCX/image extraction, broker-document discovery), and the
  standalone `location_intelligence`/`market_intelligence` packages under `src/`.
- The two deployments talk over plain HTTP: Next.js reads `PYTHON_ENGINE_API_URL`
  and calls the FastAPI service directly, authenticated by a shared secret
  (`PYTHON_ENGINE_API_SECRET`, §3c) — every call site attaches it via
  `frontend/src/lib/pythonEngine.ts`.

## 2. Current feature: screenshot upload replacing Hemnet URL scraping

Automated Hemnet scraping became unreliable (Cloudflare). The primary property
entry flow is now:

```
screenshot(s) → OCR (Tesseract, deterministic) → regex field extraction
             → ManualEntryForm (user reviews/corrects) → existing analysis pipeline
```

- `ScreenshotUploadForm.tsx` → `POST /api/listing-screenshots/extract`
  (`frontend/src/app/api/listing-screenshots/extract/route.ts`) → Python
  `/api/ocr/extract-text` (`brf_scraper.extractor.ocr.ocr_image`, Tesseract
  `swe+eng`) → `screenshotExtract.ts` (pure regex, no AI vision) → pre-fills
  `ManualEntryForm`. **Nothing is persisted**: images are base64-relayed
  in-memory and never written to disk/storage (server-verified, not just
  client-claimed — the route has no storage bucket reference at all).
- Manual entry is a fully real fallback now (`page.tsx`'s `MANUAL_ENTRY_ENABLED`
  flag), not a disabled placeholder. Required-field validation exists **both**
  client-side (`ManualEntryForm.tsx`) and server-side
  (`pipeline.ts:missingEssentialFields`, called from `api/analyses/route.ts`
  before quota is touched) — address, asking price, living area always;
  monthly fee only for apartment tenures (`requiresMonthlyFee`).
- BRF annual reports now support PDF (incl. scanned/OCR'd), DOCX, and images,
  all funneled into the same `PDFDocument` shape so every downstream extractor
  (financial/property/loan parsing, validation) is unchanged
  (`BRF-Scraper/src/brf_scraper/extractor/{pdf_reader,docx_reader,image_reader,engine}.py`).
  BRF reports **are** legitimately stored (Supabase Storage, dedup'd by
  content hash) — this is intentionally different from listing screenshots.
- OCR engine choice: Tesseract via `pytesseract`, replacing a previously
  planned PaddleOCR integration — deterministic, no AI vision API, matches the
  product's evidence-based/traceable design principle (`BLUEPRINT.md`).

## 3. Security fixes this session

### 3a. Profile quota fields (`free_analyses_remaining` etc.) — already fixed, verified sound

`supabase/migrations/20260917000000_fix_profiles_update_policy.sql` (present
before this session started) drops the old owner-UPDATE RLS policy on
`profiles` and revokes base UPDATE from `authenticated`/`anon`. Reviewed the
whole quota/entitlement call chain end-to-end
(`ownership.ts`/`access.ts`/`requireUser.ts`/`analyses/route.ts`/webhook
handlers) — every write to `profiles`, `analyses`, `properties`, and
`analysis_requests` goes through the service-role client from a server-side
route; none of these tables grant `anon`/`authenticated` anything. This part
of the system is sound.

### 3b. NEW finding (critical) — quota/campaign RPCs were callable directly, bypassing the app entirely

`consume_analysis_quota`, `refund_analysis_quota`, and the First 100 campaign
functions (`redeem_discount_code`, `attach_discount_code_session`,
`release_discount_code`, `finalize_discount_code`, `mark_campaign_popup_shown`,
`generate_discount_code`) are `SECURITY DEFINER` and were only ever `GRANT`ed
to `service_role` — but Postgres auto-grants `EXECUTE` on every new function
to `PUBLIC` by default (unlike tables, which grant nothing by default), and no
migration ever revoked it. `anon`/`authenticated` are members of `PUBLIC`, so
both were reachable directly via `POST /rest/v1/rpc/<fn>` — the same class of
bug §3a already fixed for the `profiles` table, one layer deeper.

Worst case: `refund_analysis_quota(p_user_id, p_type)` takes a caller-supplied
user id with **no ownership check** (by design — it's meant to run only as
service_role) and unconditionally `+1`s that bucket. Any signed-in user could
have called it directly, repeatedly, with their own `auth.uid()` to mint
unlimited Free/Premium analyses, or with any other user's id to grief their
quota.

**Fix**: `supabase/migrations/20260917010000_revoke_public_execute_on_security_definer_rpcs.sql`
— revokes `EXECUTE` from `public`/`anon`/`authenticated` on all of the above,
plus `alter default privileges ... revoke execute on functions from public`
so a future migration that adds a new RPC and forgets this doesn't reopen the
same gap.

**Verification status**: confirmed by static analysis (grep across every
migration's `grant`/`revoke` statements — no revoke existed for any of these
functions) and by the well-documented, version-stable Postgres default-grant
behavior (official Postgres `GRANT` docs: "the right to execute a function
... is granted to PUBLIC by default when the function is created"; Supabase's
own docs warn about this exact footgun for RPC functions). **Not verified
live** — a throwaway Postgres container test was prepared
(`rpc_grant_test.sql` in this session's scratchpad) to prove both the bug and
the fix by role-switching (`SET ROLE authenticated/anon/service_role`)
against the exact function bodies, but Docker Desktop never came up in this
environment (see §5) — BLOCKED, not PASS. High confidence in the finding
itself; the live reproduction is the one thing a future session with a
working Docker/Supabase local stack should still do before calling this
fully closed.

### 3c. Python engine had no authentication — FIXED this session

`api/server.py` had zero auth/API-key/CORS middleware on any endpoint
(verified: no `Depends`, `HTTPBearer`, `APIKeyHeader`, or CORS middleware
anywhere in the file). Every protection (login, rate limiting, essential-field
validation, quota) lived only in the Next.js layer. If the Railway URL was
discoverable, anyone could call `/api/ocr/extract-text`, `/api/browser-fetch`
(spins up a real Firefox/Camoufox instance per call), `/api/analyze`, etc.
directly — unlimited, free, bypassing Next.js entirely. This didn't let an
attacker forge *their own* premium analyses inside the app's database (the
quota bookkeeping lives in Supabase, untouched by this path), but it was a
real cost-abuse / infrastructure-DoS vector.

**Fix**: `require_internal_secret`, an `@app.middleware("http")` hook in
`api/server.py`, rejects every request except `GET /` (the static demo page,
which also doubles as Railway's health check — never gated) unless it carries
a header (`X-Internal-Secret`) matching the `PYTHON_ENGINE_API_SECRET` env
var, compared with `hmac.compare_digest` (timing-safe). Fails closed: if the
env var itself is unset on the Python side, every protected request gets 500,
never silently passed through. Implemented as middleware rather than a
per-route dependency so a future endpoint is protected the moment it's added.

On the Next.js side, `frontend/src/lib/pythonEngine.ts` (`pythonEngineHeaders()`)
is the one place that reads `PYTHON_ENGINE_API_SECRET` and attaches the
header — a server-only env var (never `NEXT_PUBLIC_`), guarded by the same
`typeof window !== "undefined"` check `lib/supabase/admin.ts` already uses for
the Supabase service-role key. All 8 call sites that reach
`PYTHON_ENGINE_API_URL` were switched from a bare
`{ "Content-Type": "application/json" }` to this helper: the two API routes
(`api/listing-screenshots/extract`, `api/properties/[id]/brf-report`) and six
providers (`hemnetPage.ts`'s browser-bridge escalation, `brfAcquisition`,
`brfFinancials`, `brokerDocuments`, `locationIntelligence`,
`marketIntelligence`). If the secret isn't configured on the Next.js side, the
header is simply omitted — the Python engine then returns 401, which every
existing caller already handles the same way it handles any other backend
failure (degrading to that provider's `error`/`not_connected` status, never
crashing the pipeline).

**Verification**: `api/tests/test_internal_auth.py` — 33 tests against the
real `app` object via FastAPI's `TestClient`, parametrized over all 10
protected endpoints (`browser-fetch`, `resolve`, `analyze`,
`brf-annual-report`, `brf-annual-report/upload`, `ocr/extract-text`,
`broker-documents`, `brf-financials`, `location-intelligence`,
`market-intelligence`): missing header → 401, wrong header → 401, secret
unconfigured on the server → 500 (fail closed), correct header → reaches the
real handler, `/` stays public with no header at all, and a same-length wrong
secret is still rejected (guards against a future accidental swap of
`hmac.compare_digest` for `==`). **PASS — 33/33**, actually run (`pytest
api/tests/test_internal_auth.py`), not inferred from code review.

### 3d. NEW finding (low, fixed) — manual-entry numeric fields had no sanity bounds server-side

`missingEssentialFields` only checked "is this a finite number", not "is this
a plausible price/area/fee" — the frontend's `min="0"` is a UI-only
constraint, trivially skipped by posting directly to `/api/analyses`.
Tightened to require positive, plausible-range values (same bounds
`screenshotExtract.ts` already used: price ≤ 200M SEK, area ≤ 2000 m², fee ≤
100k SEK/month) in `frontend/src/lib/analysis/pipeline.ts`.

### 3e. `SEND_EMAIL_HOOK_SECRET` — investigated, no exposure found in this repo

Searched full git history (`git log --all -S"whsec_"`, `git grep` across
every commit) and the current tree: the real secret value exists only in the
gitignored, untracked `frontend/.env.local` (confirmed never committed, no
history for that path at all). The only tracked references to the secret's
*name*/format are `.env.example` (empty placeholder) and
`verifyWebhookSignature.ts` (HMAC verification code, no hardcoded value, no
logging of the secret). **Could not find or rule out** an exposure through a
channel outside this repo (this session has no record of the earlier report
that prompted the investigation). Recommend rotating it anyway — cheap,
low-risk, and this class of secret (Supabase Auth Hook signing key) being
briefly exposed lets an attacker forge the `send-email` webhook and trigger
arbitrary "confirmation" emails to arbitrary addresses with an
attacker-chosen `token_hash`/`redirect_to`.

### 3f. Admin/debug surface — checked, no issues

`isDevAdmin()` (`lib/auth/devAdmin.ts`) is hard-gated on
`NODE_ENV === "development"`, never true in a Vercel production build. No
other admin/debug HTTP routes exist. Stripe webhook verifies signatures
correctly (`stripe.webhooks.constructEvent`). No `.update`/`.upsert` on
`profiles` anywhere outside the service-role admin client.

## 4. Known gaps / next steps

- **G1** (RESOLVED, second session): Python engine had no auth — fixed, see
  §3c. Remaining action item: **set `PYTHON_ENGINE_API_SECRET` to the same
  value on both the Vercel and Railway projects before deploying this
  branch** — until both sides have it, every Python-engine call will 401
  (Next.js side unset) or every request will 500 (Railway side unset).
  Generate it with e.g. `openssl rand -hex 32`; there's no default and none
  is committed anywhere.
- **G2**: `SEND_EMAIL_HOOK_SECRET` rotation (§3e) — recommended precaution,
  needs the value changed in Supabase Auth Hooks config *and* the app's env
  vars simultaneously (rotating one without the other breaks signup emails).
- **G3**: Rate limiting (`lib/rateLimit.ts`) is in-memory per serverless
  instance, not distributed — documented as an accepted trade-off in the file
  itself; upgrade to Vercel KV/Upstash if abuse is observed.
- **G4**: Frontend has no working ESLint config (`eslint.config.js` missing;
  `eslint.config.*` — pre-existing on `main`, not introduced this session;
  `npm run lint` fails immediately with a config-not-found error).
- **G5**: `frontend/src/lib/analysis/listing/hemnetPage.verify.mjs` has one
  pre-existing failing check ("fireplace"/unmapped-amenity feature dedup) —
  present on `main` before this session, unrelated to the OCR/security work.
- **G6**: Docker Desktop would not start in the first session (the
  `docker-desktop` WSL2 VM stayed "Stopped" through two clean relaunches, a
  `wsl --shutdown` reset, and 15+ minutes of waiting) and reportedly now shows
  a warning/error popup on startup — per instruction, **not** re-attempted or
  guessed at in this second session; the user will supply a screenshot of the
  actual error next time so it can be diagnosed from evidence rather than
  speculation. Two things this task asked for remain unverified: Tesseract +
  Swedish OCR actually running inside the production container, and a live
  reproduction of the RPC-grant fix (§3b) against a real Postgres role
  system. **Repo-side readiness re-checked this session (no Docker
  required)** — confirmed still correct and unchanged:
  - `Dockerfile` installs `tesseract-ocr`, `tesseract-ocr-swe`,
    `tesseract-ocr-eng`, and `fonts-dejavu-core` (the last one so
    `test_ocr_extraction.py` has a real TrueType font to render against).
  - `api/requirements.txt` has `pytesseract`, `pillow`, `python-docx`.
  - The new internal-auth middleware adds no new dependency (`hmac` is
    stdlib) and doesn't change the Docker build steps.
  - **New consideration for the next Docker session**: `PYTHON_ENGINE_API_SECRET`
    must now be set (`docker run -e PYTHON_ENGINE_API_SECRET=...`) for any
    `curl`/manual POST test against the container's OCR endpoint to work —
    it will otherwise correctly return 401, which is the new intended
    behavior, not a bug. Running `pytest api/tests/test_internal_auth.py` or
    `pytest BRF-Scraper/tests/unit/test_ocr_extraction.py` directly inside
    the container doesn't need this (tests set/unset the env var themselves).
  - The prepared `rpc_grant_test.sql` script for the RPC-grant reproduction
    (§3b) is in the first session's scratchpad, not committed — recreate
    from the migration file/comments if the scratchpad is gone.

## 5. Tests / verification status

PASS = actually run and green. FAIL = actually run and red. BLOCKED = not run.

| Area | Result | Notes |
|---|---|---|
| Python unit tests (`BRF-Scraper`, full suite) | **PASS** | 426 passed, 5 skipped — `pytest tests/` via the existing `.venv` |
| New OCR tests (`test_ocr_extraction.py`) natively on Windows | **BLOCKED** | Skips itself (no `tesseract` binary on this host's PATH) — by design |
| New OCR tests inside the production Docker image | **BLOCKED** | Docker unavailable both sessions (G6) — repo-side config re-verified without it |
| TypeScript (`tsc --noEmit`) | **PASS** | Exit 0, no errors, including after this session's edits |
| ESLint | **BLOCKED** | Pre-existing repo config gap (G4), unrelated to this branch |
| Screenshot field extraction (`screenshotExtract.verify.mjs`) | **PASS** | 20/20 checks |
| Analysis engine analyzers + report builder (7 analyzer + 2 report verify scripts) | **PASS** | All green under `npx tsx` |
| Hemnet extraction (`listing/hemnetPage.verify.mjs`) | **FAIL (pre-existing)** | 1/10 checks red on unmodified `main` code (G5) |
| RLS/RPC bypass — profiles quota fields | **PASS** | Verified via migration/grant audit; existing fix is sound |
| RLS/RPC bypass — quota RPCs (§3b) | **BLOCKED** | Needs Docker/local Postgres (G6); fix shipped and reasoned through, not live-tested |
| Railway/FastAPI internal-secret auth (§3c) | **PASS** | 33/33, `pytest api/tests/test_internal_auth.py` — valid/missing/invalid/unconfigured, all 10 protected endpoints + the public `/` |
| Docker: Tesseract + Swedish language pack in production image | **BLOCKED** | Not attempted this session per instruction (G6) |

## 6. Deployment requirements

- Env vars needed in production (Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SEND_EMAIL_HOOK_SECRET`, `STRIPE_*`, `RESEND_*`, `PYTHON_ENGINE_API_URL`
  (public Railway URL), `PYTHON_ENGINE_API_SECRET` (new, §3c — server-only,
  never `NEXT_PUBLIC_`), `OPENAI_API_KEY` (chat + inspection extraction).
- Env vars needed on Railway (the Python engine): `PYTHON_ENGINE_API_SECRET`
  — **must be the exact same value as Vercel's**, or every request from
  Next.js gets 401. Nothing generates or ships a default value.
- Supabase migrations must be applied in order up through
  `20260917010000_revoke_public_execute_on_security_definer_rpcs.sql` before
  deploying this branch's frontend changes — the two are independent
  (frontend doesn't depend on the new migration to function), but the new
  migration is the actual security fix and should not be deferred.
- Docker image (`Dockerfile`) now also installs `fonts-dejavu-core` (a few
  hundred KB) so the OCR test suite has a real TrueType font to render
  against inside the container — small, low-risk addition.
