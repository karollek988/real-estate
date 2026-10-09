---
paths:
  - "frontend/**"
---

# Frontend (Next.js on Vercel)

The conventions themselves are in `CONTRIBUTING.md` ("What CI checks") and `frontend/src/i18n/README.md`. The ones
that are easy to get wrong:

- **Colours and other tokens** come only from `frontend/src/styles/_variables.scss`: `ka-*` Tailwind classes or Sass
  `$variables`, never hex values or Tailwind's own palette (`bg-green-600`). A new colour goes into that file first;
  `npm run colours` lists violations. Keep `@import "tailwindcss/index.css"` in `app/globals.scss` as it is (a bare
  `"tailwindcss"` makes Sass inline it and breaks Tailwind).
- **Visible text** goes into `frontend/src/i18n/messages/sv/<area>.ts` **and** `…/en/<area>.ts`, never into a
  component. Pages under `src/app/[locale]/` wrap client components in `<ClientMessages areas={[…]}>`. Report and
  e-mail code gets its words from a text kit, not from literals.
- **Two admin areas:** `src/app/admin/**` (BRF review, content editor; Supabase login + `KOPANALYS_ADMIN_EMAILS`) and
  `src/pages/admin-portal/` (`admin.kopanalys.se`; own password login, strict CSP). Don't mix their auth.
  The Swedish-only `src/app/admin/` has no language provider except the one in its `layout.tsx`: a client component that
  calls `useTranslations` there needs its message area in that provider (or its own provider), or the page goes blank with an
  empty `Uncaught Error` in production. `npm run verify -- adminProvider` checks it.
- **A full report is shown to a customer only after a reviewer has released it** (`analyses.released_at`, decision
  2026-10-09). Read analyses for a customer through `getReportForViewer` (`lib/analysis/access.ts`); anything that reads
  `analyses` directly and hands report content on must use `latestCompleteAnalysis(..., { releasedOnly: true })`.
- **Tests are `*.verify.mjs` files** next to the code they check; a new one is picked up by `npm run verify` by its name.
- **A design reference image is the spec** (layout, spacing, type, colours), not inspiration. References live in
  `docs/design/`; check the result at several viewport widths.
- Copy, prices, legal texts and social-proof claims are product decisions: don't change them unasked; flag doubtful
  claims as **REQUIRES REVIEW** instead.
- Product rules for report and analysis code: `.claude/rules/report-objectivity.md`.

Before calling a frontend change done (in `frontend/`): `npm run typecheck`, `npm run i18n:check`, `npm run verify`,
and for UI changes look at it in the browser at phone and desktop width (`.claude/launch.json` → "frontend-dev",
port 3001). See the `verify` skill.
