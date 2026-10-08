# Branch rules for GitHub

GitHub keeps branch rules in its settings, not in the repository, so these two files are **importable copies**: they are
what the repository settings should contain. They do nothing until someone with admin rights imports them once
(**Settings → Rules → Rulesets → New ruleset → Import a ruleset**). If the settings are ever changed or lost, import
them again; if the rules are changed on purpose, update the file here in the same pull request.

| File | What it does |
| --- | --- |
| `protect-main.json` | **Protect main.** Nobody pushes to `main`, deletes it or rewrites its history. Changes arrive through a pull request that has 1 approval (a new push removes the approval), every conversation resolved, the branch up to date with `main`, the check **CI passed** green, and is merged with **squash** only. Repository admins can skip the approval and CI requirement in an emergency, but only from the pull request itself, never by pushing. |
| `branch-names.json` | **Branch names.** Only `feature/…`, `fix/…` and `refactor/…` (and `main`) can be created. Admins can create other names (for example a one-off `backup/…`). The same rule is checked on every pull request by the **Branch name** job in `.github/workflows/ci.yml`. |

## Importing

1. Open the repository on GitHub → **Settings** → **Rules** → **Rulesets**.
2. **New ruleset** → **Import a ruleset** → pick `protect-main.json`. Check the summary and press **Create**.
3. Do the same with `branch-names.json`.
4. **Settings → General → Pull Requests**: untick *Allow merge commits* and *Allow rebase merging* (squash is the only
   method the rule allows), and tick **Automatically delete head branches** so a merged branch disappears by itself.
5. **Settings → Code security**: switch on *Secret scanning* and *Push protection*.

The check name **CI passed** is the job `ci-passed` in `.github/workflows/ci.yml`. A required check that has never run
cannot be picked in the rule's web form, which is why the workflow is merged first and the rules are imported afterwards.

## Changing the rules

- *No approval needed* → set `required_approving_review_count` to `0` (the pull request itself is still required).
- *Don't force branches to be up to date with main before merging* → `strict_required_status_checks_policy: false`.
- *Another branch prefix* (for example `docs/`) → add it to `branch-names.json` (`exclude`) **and** to the pattern in the
  `branch-name` job in `ci.yml`, and to the table in `CONTRIBUTING.md`.
- *Another mandatory check* → add a job to `ci.yml` and list it in the `needs` of `ci-passed`. The rule itself stays as it is.
