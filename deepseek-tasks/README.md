# DeepSeek task workflow

How this works, in short:

1. **Claude writes task files** into `pending/` — long, detailed, self-contained
   descriptions of one piece of work each (e.g. `001-decision-engine-tests.md`).
2. **You run one command** to work through all pending tasks:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "C:\Users\Karol\Documents\Claude\projects\real-estate\deepseek-tasks\run-tasks.ps1"
   ```

   The script runs each task through DeepSeek (via OpenCode), shows you what changed
   (`git diff --stat`) after each one, moves the finished task file into `completed/`,
   and pauses — press Enter to continue to the next task, or Ctrl+C to stop.

3. **Nothing gets committed automatically.** When you're done running tasks (or want to
   stop partway), tell Claude. Claude reviews the actual diff, runs the build/tests,
   fixes anything broken, and only then commits (with your go-ahead, as usual).

4. **Claude writes the next batch of tasks** for the next time you want to run this —
   just ask.

## Files

- `GROUND_RULES.md` — safety rules every task follows (scope, no secrets, no commits, no
  destructive git, must self-verify with a build before finishing). Referenced by every
  task instead of repeated in each one.
- `pending/` — queued tasks, run in filename order (numbered).
- `completed/` — finished tasks land here after the script runs them, for a paper trail.
- `run-tasks.ps1` — the runner script described above.

## If something looks wrong mid-run

Ctrl+C in the PowerShell window stops the loop before the next task starts (it won't
interrupt a task already in progress cleanly, so give it a moment). The already-changed
files stay on disk uncommitted — nothing is lost, and you can always `git checkout -- .`
to discard everything DeepSeek did in the current run if you want a clean slate (ask
Claude first if unsure what that'll discard).
