# Working on Köpanalys

`main` is always production-quality code: it builds, its checks are green and it is safe to release. Nobody pushes to
it. Every change, small or large, reaches `main` the same way:

```
feature/markov-simulator
          ↓
     Pull Request   ← CI must pass
          ↓
        main
```

## Branches

Start every piece of work on a branch of its own, from an up-to-date `main`. The name says what kind of work it is:

| Prefix | Use it for | Example |
| --- | --- | --- |
| `feature/` | something new that users or the team can see or use | `feature/markov-simulator` |
| `fix/` | something that is broken and should work | `fix/brf-report-upload-size` |
| `refactor/` | changing how it is built without changing what it does (also tooling, docs and dependency work) | `refactor/analysis-engine-split` |

Write the rest of the name in lowercase, with hyphens: `feature/<short-name>`. Any other name is refused when the branch is
created, and a pull request from one fails the **Branch name** check.

## From idea to `main`

```bash
git switch main
git pull
git switch -c feature/markov-simulator
```

Work and commit as usual, then push the branch and open a pull request into `main`:

```bash
git push -u origin feature/markov-simulator
```

1. **Open the pull request** on GitHub. The template asks what changed, why, and how to try it. Give it a title that reads
   well on its own: it becomes the commit message on `main`.
2. **Wait for CI.** The check **CI passed** has to be green (see below). A red check blocks the merge: open the failing job,
   fix it, push again; the checks run again by themselves.
3. **Answer every comment and mark the conversation resolved.** No approval is required, so you can merge your own pull
   request once CI is green (GitHub does not let an author approve their own). A review is still welcome; a new push after an
   approval removes it, so the reviewer sees what they approved.
4. **Keep the branch up to date.** If `main` has moved on, press *Update branch* on the pull request (or merge `main` into
   your branch) and let CI run once more.
5. **Squash and merge.** All commits on the branch become one commit on `main`, so a whole feature can be reverted in one
   step. The branch is deleted on GitHub when you merge; remove your local copy with `git branch -d feature/markov-simulator`.

Keep pull requests small enough to review in one sitting. A large feature is easier to merge as a series of pull
requests, each one leaving `main` working, than as one big one at the end.

## What CI checks

The workflow is `.github/workflows/ci.yml`. Run the same checks before you push and you will rarely see a red mark:

```bash
cd frontend
npm run typecheck      # TypeScript, the whole app
npm run i18n:check     # Swedish and English texts: same keys, nothing missing
npm run verify         # every src/**/*.verify.mjs (the project's tests; see below)
```

```bash
python -m pytest api/tests     # the Python engine's API (install api/requirements.txt and pytest first)
```

- **Verify scripts.** The project has no test framework. Each `<name>.verify.mjs` next to the code it checks prints
  `PASS`/`FAIL` lines and exits non-zero on a failure. A new one is picked up by `npm run verify` from its name alone.
  Run one with `npx tsx src/lib/translate/translate.verify.mjs`, or the ones whose path contains a word with
  `npm run verify -- translate`.
- **Colours** come from the master variables in `frontend/src/styles/_variables.scss`: write `bg-ka-cream`, `text-ka-green-700`,
  `border-ka-line-strong` (the `ka-*` colours), or a `$variable` in a stylesheet - never `bg-green-600`, `text-neutral-500`,
  `bg-[#12271D]` or a hex value in a style. A new brand colour goes into that file first. `npm run colours` lists every
  place that breaks this (it is not part of CI yet; see `PROJECT_STATE.md`).
- **Visible text** is written once per language, never inside a component: add it to `frontend/src/i18n/messages/sv/` **and**
  `…/en/`. `npm run i18n:check` fails if the two differ. See `frontend/src/i18n/README.md`.
- **Not covered yet:** ESLint (it still reports errors from before CI existed), the root `tests/` folder and
  `BRF-Scraper/tests`. Fix them first if you want to make them mandatory: add a job to `ci.yml` and list it in the `needs`
  of the `ci-passed` job.

## Never commit

The repository is public and git never forgets: removing a file in a later commit does not remove it from history.

- `.env` files, passwords, API keys, tokens, private keys (only `.env.example` with placeholders is committed)
- invoices, receipts, bank or account details, and any document with a private person's data
- downloaded files you do not have the right to publish

If something sensitive was committed by mistake, **tell the team before pushing again**: the key has to be replaced
(a leaked key is compromised even after it is deleted) and the history cleaned. GitHub's secret scanning and push protection
are switched on to catch the common cases, not all of them.

## The rules behind this

`main` is protected by a GitHub ruleset: no direct pushes, no force pushes, a pull request (no approval required)
with every conversation resolved, the check **CI passed**, the branch up to date, squash merges only. Repository admins can
merge in an emergency without waiting for CI, but still from the pull request, never by pushing, and should say why in
the pull request. The rules are kept as importable files in `.github/rulesets/` (see the README there).
