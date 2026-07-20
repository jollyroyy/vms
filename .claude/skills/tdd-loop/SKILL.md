---
name: tdd-loop
description: TDD discipline for the VMS loop — derive tests from goal.md success criteria, activate one red suite per iteration via tests/pending.list, implement to green, keep TRACEABILITY.md in sync. Invoke at the start of every loop iteration's build step.
---

# TDD Loop Skill — VMS

You are executing one loop iteration (goal.md §3). This skill governs steps 3 (Red) and 4 (Green). **It is YOUR duty to figure out the tests from the goal** — tests are derived from `goal.md` §2.2 criteria, never invented from implementation convenience.

## The cycle

### 1. DERIVE (when needed)
A criterion with no traced tests in `tests/TRACEABILITY.md` is untestable work — derive its tests FIRST:
- Read the criterion's text and its `FR-*`/`SEC-*` tags in `PRD.md`.
- Extract every observable behavior claim ("resets daily", "stays open until returned", "returns 403") — each claim becomes at least one test case, including the failure/denial direction (over-return rejected, wrong role denied, malformed input throws).
- Choose the layer: pure logic → `tests/unit/`; permission/privacy → `tests/security/`; user-visible flow → `tests/e2e/` (Playwright, `*.e2e.ts`).
- New unit/security file? Add it to `tests/pending.list` and a row to `tests/TRACEABILITY.md` in the same commit.
- If you cannot write a test for a criterion, the criterion is too vague — amend goal.md via the Goal Amendment Protocol (§4) to make it testable. Never skip; never fake.

### 2. RED (activate)
- Remove exactly ONE file from `tests/pending.list` (the one matching this iteration's task).
- Run `npm test` — the suite MUST fail. If it passes without implementation, the tests are wrong (they test nothing); fix them before proceeding.
- Security suites: converting `it.todo` → real test IS the activation. The iteration that creates a table converts that table's RLS todos in the same commit (SEC-1).
- E2E: converting `test.fixme` → real test is the activation, done in the iteration that builds the flow.

### 3. GREEN (implement)
- Write the minimum implementation in `src/` that makes the active tests pass.
- FORBIDDEN ways to reach green: editing assertions to match buggy output, deleting/skipping tests, re-adding files to pending.list, `--no-verify`, hardcoding expected values.
- Run `npm run check` (typecheck + all active tests). All green before moving on.

### 4. SYNC
- Update `tests/TRACEABILITY.md`: status ⏸ → 🟢 (or 🔴 if genuinely still red — then you are not done).
- Update `progress.md` with proof ("activated refNumber.test.ts, 7 tests red → green").
- Tick a goal.md §2.2 checkbox ONLY when ALL its traced tests are green AND behavior was observed in the running app.

## Automation contract (do not weaken)
- `npm run check` = `tsc --noEmit && vitest run` — active unit + security tests.
- The **git pre-commit hook** (`.githooks/pre-commit`, wired via `core.hooksPath`) runs `npm run check` on every commit and blocks red. This is the enforcement backstop; never bypass it.
- `tests/pending.list` is the activation queue. Lines are only ever REMOVED (activation) or ADDED (newly derived suites). A removed line never returns.
- When goal.md §2.2 changes (amendment), re-derive: diff criteria against TRACEABILITY.md the same iteration and add/adjust tests so no criterion is untraced.

## Test-writing standards
- Test names state the behavior claim, not the function name ("sequence resets to 1 on a new day").
- Every boundary in the domain gets a case: date rollover (day/month/year), zero/empty, over-limits, wrong role, malformed input.
- Unit tests: no network, no Supabase, milliseconds. Security tests: real Supabase client per role, assert DENIAL. E2E: seeded data, fake webcam flag (`--use-fake-device-for-media-stream`), assert what the demo audience would see.
