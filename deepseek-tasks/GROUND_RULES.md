# Ground rules — read this before every task

You are working inside the `real-estate` monorepo. Follow these rules on every task, no exceptions:

1. **Scope.** Only touch files inside this project directory. Never touch `../` or anything outside it.
2. **Never touch secrets or generated files:**
   - Any `.env*` file except `.env.example`
   - `Stripe_API-keys/`
   - `frontend/node_modules/`, `frontend/.next/`
   - `BRF-Scraper/.venv/`
   - `supabase/.branches/`, `supabase/.temp/`
   - Anything listed in `.gitignore`
3. **Never run git commit, git push, git reset, or any destructive git command.** Leave all changes uncommitted in the working tree — a human reviews and commits them.
4. **Never delete a file unless the task explicitly says to.**
5. **Stay scoped.** Only change what the task describes. Don't refactor, rename, or "clean up" unrelated code you happen to notice — write those ideas in your final summary instead, don't act on them.
6. **Verify your own work before finishing:**
   - If you changed anything under `frontend/`, run `npm run build` inside `frontend/` and make sure it passes. If it fails, fix it before finishing.
   - If you changed Python code, make sure it still imports/parses cleanly (e.g. `python -m py_compile <file>` at minimum).
7. **End every task with a short plain-text summary**: what you changed, which files, why, and the result of your verification step (build/test pass or fail). This is the only part a human will read carefully, so make it accurate and honest — if something didn't work, say so.
8. **If the task is ambiguous or you get blocked**, stop, do the parts you're confident about, and explain the blocker in your summary rather than guessing wildly or leaving things half-broken.
