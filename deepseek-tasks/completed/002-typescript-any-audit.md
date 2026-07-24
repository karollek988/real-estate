# Task 002 — Reduce `any` usage in the analysis pipeline

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

TypeScript's `any` type disables type checking for that value, which defeats the point of
using TypeScript and hides bugs. The analysis pipeline (`frontend/src/lib/analysis/`) is
the core business logic of this product (it produces the numbers/verdicts users pay for),
so type safety there matters more than almost anywhere else in the codebase.

## Goal

1. Search `frontend/src/lib/analysis/` (recursively, all `.ts` files) for explicit `any`
   usage: `: any`, `as any`, `Array<any>`, `Record<string, any>` used loosely, function
   parameters typed `any`, etc.
2. For each occurrence, replace it with a proper, specific type:
   - If the shape is knowable from how the value is used (e.g. it's clearly a property
     object, or a provider response), define or reuse an existing interface/type from
     `frontend/src/lib/analysis/types.ts` or the relevant provider file.
   - If the value genuinely can be one of several shapes and you're not fully sure which,
     use a union type or `unknown` with a proper type guard/narrowing instead of `any` —
     `unknown` forces callers to check before use, which is safer than `any`.
   - Do NOT invent fields that don't exist just to make a type "work" — read how the value
     is actually constructed/consumed first.
3. After each change, run `npx tsc --noEmit` inside `frontend/` to confirm you haven't
   introduced new type errors. Fix any that appear before moving to the next occurrence.
4. Skip (don't touch) any `any` usage that's inside a third-party type definition file
   (`.d.ts`) or inside `node_modules` — out of scope.
5. If you find an `any` that would require a large, risky refactor to remove properly
   (e.g. it's threaded through 10+ call sites), leave it as-is and note it in your summary
   instead of doing a big invasive change.

## Definition of done

- Every "easy/medium" `any` in `frontend/src/lib/analysis/` is replaced with a real type,
  `unknown` + narrowing, or a union — whichever is correct for that specific value.
- `npx tsc --noEmit` passes cleanly in `frontend/` at the end.
- `npm run build` passes in `frontend/` at the end (per ground rules).
- Final summary: a list of every file changed, roughly how many `any` occurrences were
  fixed per file, and a list of any `any` occurrences you deliberately left alone with a
  one-line reason why.
