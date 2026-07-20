# goal.md — Loop Engineering Charter
### VMS — Visitor & Material Gate Pass Management System

> **You (the agent) re-read this file at the start of EVERY iteration.**
> This file defines WHAT to build, WHAT success means, and HOW the loop improves itself.
> It is the constitution of the loop. Do not edit it unless a rule below explicitly permits it.

---

## 1. WHAT I AM BUILDING

A production-ready web application for a **mall management office** with two integrated modules:

1. **Visitor Management** — a security guard registers walk-in visitors at the gate (with live **webcam photo capture**), the department HOD **approves/rejects from their phone**, a badge is issued, and the guard logs the exit.
2. **Material Gate Pass** — every material movement (Inward/Outward × Returnable/Non-Returnable) gets a digital gate pass, approved by the department HOD, verified by the guard at the gate, with **returnable items tracked until they come back**.

- **The single source of truth for requirements is [`PRD.md`](PRD.md).** Every requirement has an ID tag (`FR-VIS-*`, `FR-CAM-*`, `FR-GP-*`, `FR-NOT-*`, `FR-RPT-*`, `NFR-*`). Build to the tags. If goal.md and PRD.md conflict, PRD.md wins for requirements; goal.md wins for loop process.
- **Current target: Phase 1 (MVP) only** — see PRD §9. Do NOT build Phase 2/3 features (QR pre-registration, WhatsApp, OTP, kiosks) even if tempting.
- **Stack (fixed, do not re-litigate):** React + Vite + Tailwind frontend · Supabase (Postgres + Auth + Realtime + Storage) backend · browser-print badges/passes. TypeScript throughout.

### Users the app must serve (PRD §2)
Security Guard (gate console, desktop/tablet) · HOD (mobile approval) · Department Staff · Admin · Super Admin.

---

## 2. WHAT SUCCESS MEANS (Definition of Done)

### 2.0 MILESTONES — current target: **MILESTONE A (Customer Demo)** 🎯

The loop optimizes for **speed to a great customer demo**. Success criteria are split into two milestones. Work ONLY on Milestone A items until every one is checked; then pause for human review before starting Milestone B.

| | Milestone A — **Demo** (NOW) | Milestone B — Production launch (LATER) |
|---|---|---|
| Goal | Impress the customer with a working, polished happy path — **secure from day one** | Harden operations for real daily use |
| Criteria | **S1, S2a, S3, S4, S5, S6, S7, S9, S10, S12a, S13a, S14** | S2b, S8, S11, S12b, S13b, S15 |
| Explicitly OUT | SLA machinery (PRD §10), Handover deliverables (PRD §11), escalation timers, email, exports, offline resilience, full E2E suite | — (everything comes in here) |

### 2.0.1 SECURITY BASELINE — always on, never deferred 🔒

Security is **not** an operational nicety that waits for Milestone B. A visitor system holds PII and photos; a demo that leaks them is worse than no demo. These rules apply from the **first line of code** and may never appear as "debt" in the deferred list:

- `SEC-1` **RLS on from the first table.** Every Supabase table gets Row Level Security enabled and a policy the moment it is created — never `service_role` from the browser, never "we'll add policies later."
- `SEC-2` **Photos private from the first photo.** Private bucket + signed URLs from the very first upload (`FR-CAM-13`). No public buckets, ever, including in the demo.
- `SEC-3` **Server-authoritative data.** Ref numbers, timestamps, status transitions, and approval decisions are generated/validated server-side (Postgres functions/triggers/RPC). The client renders; it never decides (`NFR-07`).
- `SEC-4` **Secrets hygiene.** `.env` git-ignored from iteration 0; `.env.example` committed; anon key only in the client; service key only in server-side scripts.
- `SEC-5` **Role separation is real.** Guard/HOD/Staff/Admin are backend-enforced roles (`NFR-04`) — different screens is UI, different *permissions* is security, and both are Milestone A.
- `SEC-6` **Every iteration's step 4 includes a security check**: run the security tests (see §7) and, when schema changed, Supabase advisors (`get_advisors`) for missing policies.

**Deferred-but-tracked rule:** nothing is deleted — PRD §10 (SLAs) and §11 (Handover) and all Milestone B criteria live in `progress.md` under a permanent **`Deferred → Milestone B`** section so they cannot be forgotten. Every iteration's step 5 must preserve that section. When a shortcut is taken to go faster (e.g., basic RLS instead of hardened policies), log it there as a named debt item.

**Demo quality bar (replaces §2.3 for Milestone A):** the happy path must be *flawless and beautiful* — seeded realistic data, smooth webcam capture, instant realtime updates, clean UI on both the guard's desktop and the HOD's phone. A narrow flow that shines beats broad coverage that stutters. Prepare a `DEMO-SCRIPT.md` (part of S14) with the exact click-path to run the demo.

---

The loop (for the **full product**) is finished when every checkbox below is TRUE and verified by actually running the app — not by reading the code. Tags: 🎯 = Milestone A (demo), 🏭 = Milestone B (production).

### 2.1 Hard gates (must pass every iteration, not just at the end)
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` and `tsc --noEmit` pass
- [ ] All existing tests pass (`npm test`)
- [ ] The dev server starts and every implemented page renders without console errors

### 2.2 Functional success criteria (end state — each maps to PRD tags)
- [ ] 🎯 **S1 — Walk-in flow works end-to-end** (PRD §3.2): guard registers a visitor → webcam photo captured with preview/retake (`FR-CAM-05`) → HOD sees pending approval with the photo → approves → badge view renders with photo, ref no., QR → guard logs exit → record closed. Verified by driving the real UI in a browser. **This is the demo centerpiece.**
- [ ] 🎯 **S2a — Rejection works**: HOD rejects with a reason; guard console shows it live.
- [ ] 🏭 **S2b — Escalation works**: approval timeout escalates HOD → delegate → Admin (`FR-VIS-07`, `SLA-W1` timings configurable).
- [ ] 🎯 **S3 — Auto ref numbers & server timestamps**: `VIS-YYYYMMDD-NNNN` / `GP-IN|OUT-YYYYMMDD-NNNN`, generated server-side, never editable from any UI (`NFR-07`).
- [ ] 🎯 **S4 — All 4 gate pass types work** (PRD §4): Inward/Outward × RGP/NRGP, itemized lines, HOD approval, guard gate verification, status machine `Draft → … → Closed` including **partial returns** (`FR-GP-06`) and visitor-linked passes (`FR-GP-07`). (For demo, partial returns may be data-seeded rather than UI-polished.)
- [ ] 🎯 **S5 — RGP tracking**: open-returnables dashboard with overdue color coding (`FR-GP-01`); due/overdue state computed correctly across date boundaries.
- [ ] 🎯 **S6 — Who's-inside / evacuation view** live-updates on check-in/check-out (`FR-VIS-01`, Supabase Realtime). **Big demo wow-moment — show it on a second screen while checking someone in.**
- [ ] 🎯 **S7 — Blacklist** flags on registration attempt (`FR-VIS-02`); repeat-visitor recall by phone number auto-fills (`FR-VIS-03`). **Both are cheap to build and demo brilliantly.**
- [ ] 🏭 **S8 — Auto-checkout at day close** with "not verified" flag (`FR-VIS-08`).
- [ ] 🎯 **S9 — Roles enforced by the backend**, not just the UI: Supabase RLS policies prevent a Staff user from approving, a Guard from editing timestamps, anyone from reading another department's pending approvals (`NFR-04`, `SEC-1`, `SEC-5`). **Security baseline — in the demo milestone by design.**
- [ ] 🎯 **S10 — Photos are private**: private bucket, signed-URL-only access; an unauthenticated URL fetch returns 403 (`FR-CAM-13`, `SEC-2`).
- [ ] 🏭 **S11 — Webcam resilience**: camera-denied red banner (`FR-CAM-06`); file-input fallback (`FR-CAM-10`); ≤200 KB client-side compression (`FR-CAM-08`). *Demo needs the happy path + compression only — test the demo machine's webcam beforehand.*
- [ ] 🎯 **S12a — Daily visitor register report** renders on screen (`FR-RPT-01`) — shows the customer their paper book is replaced.
- [ ] 🏭 **S12b — Exports (PDF/Excel), gate pass register filters, per-record audit trail UI** (`FR-RPT-05`, `FR-RPT-08`).
- [ ] 🎯 **S13a — In-app notifications** for approval request → HOD and decision → guard (the realtime loop that powers S1/S2a).
- [ ] 🏭 **S13b — Email notifications** + stubbed WhatsApp/SMS interface for the full PRD §5 matrix.
- [ ] 🎯 **S14 — Seed & demo ready**: `npm run seed` creates 3 departments, HODs + delegates, a guard, an admin, sample visits and gate passes in every status; **plus `DEMO-SCRIPT.md`** — the exact click-path, which browser windows to pre-open (guard console + HOD phone view + who's-inside board), and a reset command to restore pristine demo data between runs.
- [ ] 🏭 **S15 — Test coverage where it matters**: unit tests for ref-number generation, status machines, RGP due-date logic, escalation timing; Playwright E2E for S1 and S4.

**Milestone A is DONE when all 🎯 boxes are checked** → update `progress.md` status to `DEMO-READY`, stop, and wait for human review. Milestone B resumes after the demo feedback is folded in.

### 2.3 Quality bar
- **Milestone A:** each 🎯 criterion counts when the flow was driven end-to-end in a browser off freshly seeded data, twice in a row without a hiccup (demos fail on the second run, not the first).
- **Milestone B:** each criterion must survive a fresh `npm install && npm run build`, the seed script, and a re-run of the E2E tests.

---

## 3. THE LOOP PROTOCOL (one iteration = one pass through this list)

1. **Orient** — read `goal.md`, then `progress.md`, then `learnings.md`. Never rely on memory of a previous iteration; the files are the memory.
2. **Pick ONE task** — the topmost unblocked item in `progress.md` → *Next Up*. One coherent slice per iteration (one screen, one flow, one policy set). Never start two.
3. **Red (TDD)** — invoke the **`/tdd-loop` skill** (`.claude/skills/tdd-loop/SKILL.md`) and follow it: DERIVE tests from the S-criterion if none are traced yet (deriving tests from this goal is the loop's own duty, not a human's), then ACTIVATE exactly one suite by removing its line from `tests/pending.list`, and confirm it FAILS. A task with no failing test first is not allowed to start.
4. **Green, then verify ruthlessly** — implement until the tests pass, then run the hard gates (§2.1) **plus the security tests (`SEC-*`)**. For UI work, additionally drive the actual browser (dev server + click through). A task is not done because the code compiles; it is done when its tests pass AND the behavior was observed. The **pre-commit hook** (`.githooks/pre-commit`) re-runs `npm run check` automatically and blocks the commit if anything active is red — never bypass it with `--no-verify`.
5. **Record** — update `progress.md`: move the task to *Done* with a one-line proof ("verified: registered visitor, photo saved 142 KB, HOD approved on mobile viewport"). Add newly discovered tasks to *Next Up* in priority order.
6. **Learn** — if anything surprised you (a bug, a dead end, a Supabase gotcha, a flaky test), append a dated entry to `learnings.md`: what happened → root cause → the rule that prevents it next time.
7. **Commit** — one git commit per iteration, message: `iter-NN: <task> [FR-tags touched]`.
8. **Stop or continue** — if all §2.2 boxes are checked, write `progress.md` → status `COMPLETE` and stop. Otherwise the loop re-enters at step 1.

## 4. HOW THE LOOP IMPROVES ITSELF

The loop gets smarter through its files, not through wishful thinking:

- **`learnings.md` is the self-improvement organ.** Before building anything (step 3), scan it for rules that apply to the current task. A mistake made twice is a loop failure — the first occurrence should have produced a rule that prevented the second.
- **Prune and promote.** When `learnings.md` exceeds ~30 entries, consolidate: merge duplicates, delete obsolete ones, and promote ever-recurring rules into `CLAUDE.md` (project conventions) so they load automatically. This is the ONLY self-editing the loop performs on its own charter ecosystem.
- **Escalate honestly.** If the same task fails 3 iterations in a row: stop retrying the same approach, write a `learnings.md` entry analyzing why, and either (a) decompose the task into smaller pieces in `progress.md`, or (b) flag it in `progress.md` → *Blocked (needs human)* with exactly what decision/credential/access is missing — then move to the next unblocked task.
- **Shrink the slices when quality drops.** If hard gates start failing at commit time, the iterations are too big. The correction is smaller tasks, not skipped verification.
- **Measure the loop itself.** Keep a running tally at the top of `progress.md`: iterations completed, criteria checked off (n/15), tasks blocked. If 5 iterations pass without a new §2.2 checkbox, the plan is wrong — re-plan *Next Up* from scratch against the unchecked criteria.
- **Goal Amendment Protocol — the loop may improve this charter itself.** When an iteration reveals that goal.md is wrong, ambiguous, or missing something (a criterion untestable as written, a contradiction with PRD.md, a discovered risk), the agent **may edit goal.md directly**, under these rules:
  1. Amendments may **clarify, strengthen, decompose, or add** — they may **never weaken or delete** a success criterion, a `SEC-*` rule, or a §5 guardrail. Weakening requires a human: flag it in `progress.md → Blocked (needs human)` instead.
  2. Every amendment appends a row to the **Amendment Log** (§8): date, iteration, what changed, why.
  3. If goal.md changes, the corresponding tests in `tests/` must change in the same iteration — charter and checks never drift apart.

## 5. GUARDRAILS (never violate)

- **Never** mark a §2.2 criterion done without having observed the behavior in a running app.
- **Never** edit `PRD.md` scope, weaken a success criterion, or delete a failing test to go green. If a requirement seems wrong, flag it under *Blocked (needs human)*.
- **Never** commit secrets (Supabase service keys, SMTP creds) — use `.env` + `.env.example`.
- **Never** disable RLS "temporarily" to make a feature work. Fix the policy.
- **Never** build Phase 2/3 features before all §2.2 boxes are checked.
- **Milestone discipline**: while Milestone A is active, do not gold-plate 🏭 items — build the minimum the demo path needs, and log every shortcut in `progress.md → Deferred → Milestone B` as a named debt item. Speed to demo wins ties.
- **But never fake the demo**: no hardcoded screens pretending to be live data, no mocked approvals. Everything shown must be the real system on seeded data — the customer will ask "can I try?" and the answer must be yes.
- **Timestamps and reference numbers are generated server-side, always.** No client-supplied times, ever (`NFR-07`).
- HTTPS-only assumptions for camera code: develop against `localhost` (allowed by browsers), and never write code that requires insecure origins.

## 6. FILE MANIFEST (the loop's memory)

| File | Role | Written by |
|---|---|---|
| `goal.md` | This charter — what/success/process | Human + Agent (via Goal Amendment Protocol, §4) |
| `PRD.md` | Requirements source of truth | Human |
| `progress.md` | Live state: Done / In Progress / Next Up / Blocked + tally | Agent, every iteration |
| `learnings.md` | Dated mistakes → rules; the self-improvement log | Agent, when surprised |
| `CLAUDE.md` | Promoted permanent conventions for this repo | Agent (via promotion rule §4) |
| `tests/` | The CHECK phase — executable form of §2's success criteria | Agent (red-first, per §3 step 3) |
| `tests/TRACEABILITY.md` | Map: S-criterion → FR tags → test file → status | Agent, whenever tests change |

## 7. THE CHECK HARNESS (TDD)

The loop runs **goal → build → CHECK → adjust**, and the CHECK phase is executable, not judgment:

- Every §2.2 criterion has tests in `tests/`, written **before** the feature (red), traced in `tests/TRACEABILITY.md`.
- Layers: **unit** (`tests/unit/` — pure logic: ref numbers, status machines, due dates; runs in ms, every iteration), **security** (`tests/security/` — RLS denial cases, photo-privacy 403s; every iteration once the schema exists), **acceptance/E2E** (`tests/e2e/` — Playwright driving the S1/S4 demo flows; before every demo dry-run and at milestone close).
- `npm run check` = typecheck + unit + security tests. This IS hard gate §2.1 — a red check means the iteration cannot commit.
- **Automation, not discipline:** the check runs itself. `.githooks/pre-commit` (wired via `git config core.hooksPath .githooks`) executes `npm run check` on **every** commit and blocks red ones — the loop cannot forget to test.
- **Activation queue:** `tests/pending.list` holds derived-but-not-yet-started suites (excluded from the run by `vitest.config.ts`). The Red step removes one line to activate a suite; lines are only ever removed (activation) or added (newly derived) — a removed line never returns, and deleting a test file to get green is forbidden.
- **Derivation is the loop's duty:** whenever §2.2 changes or a criterion lacks traced tests, the loop derives new tests from the criterion text per the `/tdd-loop` skill — behavior claims become test cases, including denial/failure directions.
- Tests are the anti-drift anchor: a §2.2 checkbox may only be ticked when its traced tests pass. If a test is impossible to write, the criterion is too vague — amend it (Goal Amendment Protocol) into something testable.

## 8. AMENDMENT LOG

| Date | Iter | Change | Why |
|---|---|---|---|
| 2026-07-20 | pre-0 | v1.0 charter created | Initial |
| 2026-07-20 | pre-0 | v1.1: split milestones A/B (demo-first); deferred SLA/handover | Launch ASAP for customer demo |
| 2026-07-20 | pre-0 | v1.2: added Security Baseline §2.0.1 (always-on, never deferred); moved S9/S10 into Milestone A; loop protocol made TDD (red→green); added Goal Amendment Protocol + §7 check harness | Security at the forefront even pre-production; make CHECK executable; let the loop improve its own charter |
| 2026-07-20 | pre-0 | v1.3: check automated — `/tdd-loop` skill installed (test derivation is the loop's duty), `tests/pending.list` activation queue + vitest exclusion, git pre-commit hook blocks red commits; dedicated git repo initialized | Tests must run automatically via the loop's own machinery, not agent memory |

**Bootstrap (iteration 0):** if `progress.md` / `learnings.md` don't exist, create them. `progress.md` must contain the permanent `Deferred → Milestone B` section from day one (pre-populated with all 🏭 criteria + PRD §10 SLAs + PRD §11 Handover). Seed *Next Up* by decomposing the **🎯 Milestone A** criteria into ordered tasks along the demo path:
`project scaffold → Supabase schema + basic roles → guard console + webcam capture → HOD mobile approval (realtime) → badge + exit flow → who's-inside live board → blacklist + repeat recall → gate passes (4 types) → RGP dashboard → visitor register report → seed script + DEMO-SCRIPT.md → full demo dry-run ×2`.
