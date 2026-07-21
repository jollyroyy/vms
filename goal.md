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
- `SEC-7` **Frontend route protection.** Navigating to a URL that belongs to a different role (e.g., a guard typing `/admin`, a staff typing `/approvals`) must immediately sign the user out. No redirects, no "access denied" page — the session is terminated. This prevents URL-manipulation probing of unauthorized screens. Must be tested with automated assertions (`tests/security/routeProtection.test.ts`).
  - **Implementation rule:** `ProtectedRoute` must look up permissions from `ROLE_ROUTES` in `src/lib/roleRoutes.ts` (single source of truth). It must NOT accept a per-route `allowedRoutes` prop — that pattern always passes because the URL matches by definition. Every authenticated route must be wrapped; no exceptions for "shared" routes. When the user's role is not yet loaded (`null`), render nothing.
  - **Test rule:** `routeProtection.test.ts` must import `isForbidden` and `ROLE_ROUTES` from `src/lib/roleRoutes.ts` — never define a local copy. A local copy in the test silently drifts from the implementation and gives false confidence.

- `SEC-8` **No user_metadata trust.** Role and `department_id` must be read from `auth.jwt() -> 'app_metadata'` only. The `user_metadata` path in JWT claims is forgeable by end users via `auth.updateUser()` and must never appear as a fallback in any RPC, trigger, or policy function (migrations 015 fixes all instances).
- `SEC-9` **Department-scoped mutations.** Any RPC that modifies multi-department data (e.g., `clear_pre_approved`) must scope the operation to the caller's department via `auth.jwt() -> 'app_metadata' ->> 'department_id'`. Only `admin`/`super_admin` may operate across departments.
- `SEC-10` **Least-privilege SELECT policies.**
- `SEC-11` **Content Security Policy.** `index.html` must include a `Content-Security-Policy` meta tag restricting script sources to `'self'`, disallowing inline scripts, and restricting `connect-src` to the Supabase project origin. This prevents XSS amplification even if a script injection vector is discovered.
- `SEC-12` **No secrets in `.env.example`.** The `.env.example` file must contain placeholder values only (never live API keys, service role keys, or URLs with real project IDs). The actual `.env` file must be gitignored (SEC-4).
- `SEC-13` **MIME validation on uploads.** File upload paths must validate that the uploaded file's MIME type starts with `image/` or the expected type. Reject non-matching files at the handler level, not just the UI `accept` attribute.
- `SEC-14` **Error message safety.** `safeErrorMessage()` must never return `JSON.stringify(err)` or `String(err)` for unknown error types — always return a generic fallback. Raw error objects may contain stack traces, schema details, or internal state.
- `SEC-15` **RPC calls must be try/catch wrapped.** Every `await supabase.rpc(...)` call in client code must be wrapped in a `try/catch` block to handle network errors and unexpected exceptions, not just the Supabase error response path.
- `SEC-16` **Git history secrets scanning.** Every commit must be scanned for credential-like patterns (`eyJ` base64 JWTs, `supabase.co` URLs with non-placeholder project IDs, `sk-`/`pk-` key prefixes) before push. The `.env.example` file must never contain live keys at any point in git history. If a secret is detected in the diff, the commit/push must be blocked with a remediation message. This prevents the most common credential leak vector — secrets committed in a file that is not `.gitignore`-aware (like `.env.example`).

- `SEC-17` **Duplicate active visit prevention.** A visitor (identified by normalized phone) may only have one active visit at a time. Active statuses: `pending_approval`, `approved`, `walkin_approved`, `checked_in`. Server-side trigger blocks insert if an active visit exists; client-side check warns before submission. Admin/super_admin may override.
- `SEC-18` **QR code on badge is functional.** The badge QR code encodes the visit `ref_number` and must be scannable. The QR encodes `vms://visit/REF_NUMBER` URI scheme for future scanner integration.
- `SEC-19` **Data retention and privacy.** The system must auto-purge visit records older than a configurable retention period (default 365 days). A scheduled Supabase function (`retention_cleanup`) runs daily and deletes records exceeding the threshold. This prevents indefinite PII accumulation.
- `SEC-20` **Overstay detection.** A server-side function must flag visits exceeding 9 hours as `overstay = true` in a `visit_flags` JSONB column. The flag triggers a UI warning (red badge) and optionally a notification.
- `SEC-21` **Digital document signing.** NDAs, safety waivers, and policy acknowledgments must be captured digitally at check-in with a signature pad component. Signed documents are stored as base64 alongside the visit record and are immutable after signing.
- `SEC-22` **Multi-language interface.** The UI must support English and Hindi at minimum. Language selection is persisted in localStorage and applied immediately without page reload. All user-facing strings must use the i18n lookup, not hardcoded text.
- `SEC-23` **Compliance data export.** Any filtered visitor list must be exportable as CSV and JSON with a single click. Exports include all visible fields plus timestamps. The export button must be available on Guard Console, WhosInside, and Reports pages.
- `SEC-24` **Analytics and visitor trends.** A dedicated Analytics page must show visitor volume trends (daily/weekly/monthly), peak hours, department-wise distribution, and average visit duration. Data is aggregated from the `visits` table with no PII exposure in aggregate views.

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

#### 2.2A — PRD Feature Detail Map (Milestone A granular — mirrors PRD §3–§7)

> Each line below maps directly to one `FR-*` / `NFR-*` / `SLA-*` tag from the PRD.
> A checkbox is ticked when that specific behaviour is observable in the running app.

- [ ] 🎯 **FR-VIS-03 — Repeat-visitor recall**: typing a known phone number auto-fills name, company, and shows the previous-visit photo — guard review in seconds, no re-typing.
- [ ] 🎯 **FR-VIS-05 — Badge page**: rendered badge shows visitor photo, ref number, department, host name, validity, and a QR code; `window.print()` produces a badge-sized slip suitable for thermal printers.
- [ ] 🎯 **FR-VIS-06 — Visit history search**: guard / admin can search visits by name, phone, department, HOD, date range; results paginated.
- [ ] 🎯 **FR-CAM-05 — Webcam UI**: live preview with a face-position oval overlay; single **Capture** button freezes the frame; unlimited **Retake** until saved; no page reload between retakes.
- [ ] 🎯 **FR-CAM-06 — Camera-denied banner**: if `getUserMedia` is denied or no camera is detected, a persistent red banner with fix instructions appears — the registration form is still usable (file-input fallback, `FR-CAM-10`).
- [ ] 🎯 **FR-GP-04 — Printable gate pass**: rendered gate pass page has a QR code, full item list, approver details, and carrier info; `window.print()` produces a pass suitable for the guard's printer.
- [ ] 🎯 **FR-GP-05 — Mismatch handling**: guard can record a quantity or item discrepancy at the gate return with a note; the approving HOD is notified in-app.
- [ ] 🎯 **FR-NOT-03 — Checked-in notification**: when the guard logs entry (check-in), the host/HOD receives an in-app "visitor on the way" notification in real time.
- [ ] 🎯 **NFR-01 — Responsive layout**: guard console renders correctly at 1280 px desktop width; HOD approval page renders correctly at 375 px (iPhone) — all interactive elements are tap-friendly.
- [ ] 🎯 **Admin module — Departments & users**: Admin can create / edit departments, assign HODs and delegates, create/deactivate user accounts, assign roles; blacklist entries (phone + reason) can be added or removed.
- [x] 🎯 **SEC-7 — Frontend route protection**: URL manipulation to another role's page signs the user out immediately (see `tests/security/routeProtection.test.ts`).
- [x] 🎯 **SLA-W1 — Escalation logic unit-tested**: the pure function `getEscalationTarget(pendingAt, now, roles)` returns `'hod' | 'delegate' | 'admin'` correctly at t<5 min, t∈[5,10) min, t≥10 min (see `tests/unit/escalation.test.ts`).
- [x] 🎯 **S14a — DEMO-SCRIPT.md exists** with the exact guard-console → HOD-phone → who's-inside click-path, the list of browser tabs to pre-open, and a one-command reset (`npm run seed`).

**Milestone A is DONE when all 🎯 boxes are checked** → update `progress.md` status to `DEMO-READY`, stop, and wait for human review. Milestone B resumes after the demo feedback is folded in.

### 2.3 Quality bar
- **Milestone A:** each 🎯 criterion counts when the flow was driven end-to-end in a browser off freshly seeded data, twice in a row without a hiccup (demos fail on the second run, not the first).
- **Milestone B:** each criterion must survive a fresh `npm install && npm run build`, the seed script, and a re-run of the E2E tests.

---

## 3. THE LOOP PROTOCOL — built around the GOAL, not the code

> The loop does not ask "what should I build next?"
> It asks "which goal is not yet met, and what would prove it is?"
> Code is just the means. The goal criterion is the north star.

One iteration = one pass through these steps, always in this order:

### Step 1 — LOOK AT THE GOAL
Open `goal.md` §2.2. Find the **first unchecked 🎯 criterion** in order.
That criterion IS the iteration. Do not read the codebase first.
Read the criterion's text and every `FR-*`/`SEC-*` tag it references.
Ask one question: **"What observable behaviour, visible in a running app, would prove this criterion is met?"**
That answer defines the work — not the other way round.

### Step 2 — ORIENT
Read `progress.md`, then `learnings.md`, then `memory.md`.
Confirm the criterion is not already partially done.
In `memory.md`, identify the tags for the current task area (e.g., `#typescript`, `#supabase`, `#react`, `#camera`, `#rls`, `#seed`) and read every matching entry.
A pattern match in `memory.md` means: apply the Fix directly — **do not retry the same mistake**.

### Step 3 — CHECK (run the checker first, before writing a line of code)
```
npm run verify
```
`checker.ts` runs all active tests and reports each one: **PASSED** or **NOT PASSED**.
It never stops early — every result is reported.

Read the results:
- If every test for this criterion is already **PASSED** → go directly to Step 6 (verify in the running app).
- If any test is **NOT PASSED** → that is the gap to close. Go to Step 4.
- If no test exists yet for this criterion → go to Step 4 (derive first).

### Step 4 — RED (derive + activate one test suite)
Invoke the `/tdd-loop` skill:
- DERIVE tests from the criterion text (the loop's own duty — not a human's).
- ACTIVATE by removing the file's line from `tests/pending.list`.
- Run `npm run verify` → confirm the suite is **NOT PASSED**. If it passes without implementation the tests are wrong; fix them.
A criterion without a failing test first may not proceed to Step 5.

### Step 5 — GREEN (implement, then fix until all PASSED)
Write the minimum implementation in `src/` that makes the criterion's tests pass.
After each implementation attempt, run `npm run verify` and read every result:
- **PASSED** → step is done.
- **NOT PASSED** → before writing a single line of fix code:
  1. Identify the error's category tags (e.g., `#typescript`, `#supabase`, `#react`).
  2. Search `memory.md` Quick Index for those tags; read every matching entry.
  3. If a pattern matches the error → apply the listed **Fix** exactly. Do not invent an alternative.
  4. If no pattern matches → apply a fix, run verify, then **immediately record the new pattern in `memory.md`** (even on the first failure — do not wait for Step 7).
  5. Do **not** move to the next criterion with a failing test.
  If the same test fails 3 times with different approaches → add a `learnings.md` entry,
  decompose into smaller pieces in `progress.md`, and try the smaller piece.
  If truly blocked → mark `progress.md → Blocked (needs human)`, then pick the next unblocked criterion.

The pre-commit hook calls `checker.ts` automatically on every commit.
A commit is only possible when `checker.ts` ends with **ALL TESTS PASSED**.
Never use `--no-verify`.

### Step 6 — VERIFY IN THE RUNNING APP
Tests passing proves the logic is correct. This step proves the goal is met.
Start the dev server, drive the criterion's flow end-to-end in a real browser.
Observe exactly what the criterion says ("HOD sees the photo", "badge QR renders", "who's-inside updates live").
If the observed behaviour matches → the criterion is done.
If not → the tests were insufficient. Go back to Step 4 and add the missing test.

### Step 7 — RECORD
- Tick the §2.2 checkbox in `goal.md`.
- Update `progress.md`: move criterion to *Done* with a one-line proof of observed behaviour.
- Update `tests/TRACEABILITY.md`: status → 🟢.
- If anything surprised you → append a dated entry to `learnings.md` **and** add a structured pattern to `memory.md` (use the New Entry Template at the bottom of that file; update the Quick Index).

### Step 8 — COMMIT
```
git commit -m "iter-NN: <criterion name> met [FR-tags]"
```
The hook runs `checker.ts` automatically. You will see **ALL TESTS PASSED** or the commit is blocked.

### Step 9 — LOOP
Go back to Step 1 with the next unchecked 🎯 criterion.
If all 🎯 boxes are checked → write `progress.md` status = `DEMO-READY` and stop.

## 4. HOW THE LOOP IMPROVES ITSELF

The loop gets smarter through its files, not through wishful thinking:

- **Two-tier self-improvement: `learnings.md` + `memory.md`.** They serve different purposes and both must stay current:
  - `learnings.md` — the **narrative** log. Append a dated entry when surprised. Human-readable. Tells the story of what went wrong and why.
  - `memory.md` — the **pattern-indexed lookup**. A machine-searchable registry: Pattern → Cause → Fix → Prevention, tagged by category. Searched at Step 2 (before coding) and Step 5 (before each fix attempt). A pattern match means applying the Fix directly — no experimentation.
  - **Whenever a new mistake is encountered:** record it in `memory.md` immediately (before continuing), then append the narrative to `learnings.md` at Step 7.
  - **A mistake made twice is a loop failure.** The first occurrence must produce a `memory.md` pattern that prevents the second.
- **Prune and promote.** When `learnings.md` exceeds ~30 entries, consolidate: merge duplicates, delete obsolete ones, and promote ever-recurring rules into `CLAUDE.md` (project conventions) so they load automatically. When `memory.md` entries are promoted to `CLAUDE.md`, mark them as `[promoted]` but keep the entry — it remains searchable. This is the ONLY self-editing the loop performs on its own charter ecosystem.
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
| `learnings.md` | Dated narrative log: mistake → lesson (human-readable) | Agent, when surprised |
| `memory.md` | Structured error-pattern registry: Pattern → Cause → Fix → Prevention, tagged + indexed; searched before every fix attempt | Agent, immediately when any new error is encountered |
| `CLAUDE.md` | Promoted permanent conventions for this repo | Agent (via promotion rule §4) |
| `tests/` | The CHECK phase — executable form of §2's success criteria | Agent (red-first, per §3 step 3) |
| `tests/TRACEABILITY.md` | Map: S-criterion → FR tags → test file → status | Agent, whenever tests change |

## 7. THE CHECK HARNESS (TDD)

The loop runs **goal → build → CHECK → adjust**, and the CHECK phase is executable, not judgment:

- Every §2.2 criterion has tests in `tests/`, written **before** the feature (red), traced in `tests/TRACEABILITY.md`.
- Layers: **unit** (`tests/unit/` — pure logic: ref numbers, status machines, due dates; runs in ms, every iteration), **security** (`tests/security/` — RLS denial cases, photo-privacy 403s; every iteration once the schema exists), **acceptance/E2E** (`tests/e2e/` — Playwright driving the S1/S4 demo flows; before every demo dry-run and at milestone close).
- `npm run check` = typecheck + unit + route-protection security tests (offline-safe). This IS hard gate §2.1 — a red check means the iteration cannot commit.
- `npm run test:security` = full security suite including live Supabase RLS tests (needs `.env` credentials + seeded data). Run this before demo dry-runs.
- **Automation, not discipline:** the check runs itself. `.githooks/pre-commit` (wired via `git config core.hooksPath .githooks`) executes `npm run check` on **every** commit and blocks red ones — the loop cannot forget to test.
- **Activation queue:** `tests/pending.list` holds derived-but-not-yet-started suites (excluded from the run by `vitest.config.ts`). The Red step removes one line to activate a suite; lines are only ever removed (activation) or added (newly derived) — a removed line never returns, and deleting a test file to get green is forbidden.
- **Derivation is the loop's duty:** whenever §2.2 changes or a criterion lacks traced tests, the loop derives new tests from the criterion text per the `/tdd-loop` skill — behavior claims become test cases, including denial/failure directions.
- Tests are the anti-drift anchor: a §2.2 checkbox may only be ticked when its traced tests pass. If a test is impossible to write, the criterion is too vague — amend it (Goal Amendment Protocol) into something testable.

## 8. MODULE MAP — Module-Specific Goals

> Each module has one simple, specific goal. Modules are ordered by dependency (core logic first, features later).
> A module is **DONE** when all its 🎯 criteria are checked AND all its traced tests pass.
> Tests are written BEFORE the feature (TDD: red → green). Each module's test suite must be activated by removing its line from `tests/pending.list`.

### M1 — MODULE: Reference Number Generation (PRD §3.4, §4.3)
- [ ] 🎯 **M1-REF**: `formatRefNumber()` produces `VIS-YYYYMMDD-NNNN` and `GP-IN|OUT-YYYYMMDD-NNNN` with zero-padded 4-digit sequences; `nextSequence()` resets daily or continues same-day; malformed refs throw errors.
- Traced by: `tests/unit/refNumber.test.ts` (7 tests, 🟢)

### M2 — MODULE: Visit Lifecycle (PRD §3.2, §3.5)
- [ ] 🎯 **M2-VISIT**: Visit state machine (`pending_approval → approved → checked_in → checked_out`) enforces valid transitions; rejection is terminal; auto-checkout at day close flags unverified exits; pre-approval validates required fields.
- Traced by: `tests/unit/visitLifecycle.test.ts` (10 tests, 🟢)

### M3 — MODULE: Gate Pass State Machine (PRD §4.4)
- [ ] 🎯 **M3-GP**: All 10 statuses (`draft → pending_approval → approved → dispatched → awaiting_return → partially_returned → returned → closed` + `rejected` + `cancelled`) enforce valid transitions; NRGP closes after dispatch; RGP requires return; partial returns tracked per-line; over-returning rejected.
- Traced by: `tests/unit/gatePassStatus.test.ts` (11 tests, 🟢)

### M4 — MODULE: RGP Due-Date Tracking (FR-GP-01, FR-GP-02, SLA-W4)
- [ ] 🎯 **M4-RGP**: `getRgpState()` returns correct state (`ok`, `due_soon`, `due_today`, `overdue`) across date/month/year boundaries; `isReminderDay()` fires at T-1, due date, and every 3rd day overdue.
- Traced by: `tests/unit/rgpDueDate.test.ts` (9 tests, 🟢)

### M5 — MODULE: Blacklist & Phone Normalization (FR-VIS-02, FR-VIS-03)
- [ ] 🎯 **M5-BLACK**: `normalizePhone()` strips formatting, normalizes country codes, rejects invalid numbers; `isBlacklisted()` matches regardless of phone formatting variant.
- Traced by: `tests/unit/blacklist.test.ts` (5 tests, 🟢)

### M6 — MODULE: Escalation Logic (SLA-W1, FR-VIS-07)
- [ ] 🎯 **M6-ESC**: `getEscalationTarget()` returns `hod` before 5 min, `delegate` at 5–9 min, `admin` at 10+ min; skips to admin if no delegate.
- Traced by: `tests/unit/escalation.test.ts` (5 tests, 🟢)

### M7 — MODULE: Photo Capture Math (FR-CAM-08)
- [ ] 🎯 **M7-PHOTO**: `computeCenterCrop()` centers a 3:4 portrait crop in any source frame; `PHOTO_CONSTRAINTS` target 480×640 at ≤200 KB; rejects zero/negative dimensions.
- Traced by: `tests/unit/photoCapture.test.ts` (5 tests, 🟢)

### M8 — MODULE: Host Names Service (PRD §3.2 display)
- [ ] 🎯 **M8-HOST**: `attachHostNames()` fetches host names via RPC, attaches them to rows by `host_id`; gracefully handles empty arrays, missing hosts, and RPC errors without throwing.
- Traced by: `tests/unit/hostNames.test.ts` (— tests TBD)

### M9 — MODULE: Role-Based Route Protection (SEC-7)
- [ ] 🎯 **M9-ROUTE**: `isForbidden()` correctly allows/denies routes per `ROLE_ROUTES` for guard, hod, staff, admin, super_admin, and null roles; shared routes available to all; `/admin` restricted to admin/super_admin only.
- Traced by: `tests/security/routeProtection.test.ts` (24 tests, 🟢)

### M10 — MODULE: RLS & Backend Security (SEC-1/2/3/5, S9, S10, NFR-04)
- [ ] 🎯 **M10-RLS**: Staff cannot approve visits or read cross-dept data; guard cannot edit timestamps or approve/reject; HOD restricted to own department; ref numbers and timestamps server-authoritative; bucket is private; unauthenticated access denied.
- Traced by: `tests/security/rls.test.ts` (18 tests, 🟢, 1 todo)

### M11 — MODULE: UI Components
- [ ] 🎯 **M11-BADGE**: Badge component renders visitor photo, ref number, department, host, date, status, and QR placeholder without crashing for any valid Visit input.
- [ ] 🎯 **M11-NAVBAR**: Navbar shows correct links for each role; highlights active link; shows user initials and role badge; mobile menu toggles open/close.
- [ ] 🎯 **M11-TIMEOUT**: SessionTimeout shows dialog after inactivity; countdown decrements; "Keep session" resets timer; "Sign out" calls supabase signOut.
- [ ] 🎯 **M11-PHOTO-UI**: PhotoCapture cycles through idle → streaming → frozen → denied/error states correctly; handles capture, retake, accept, file-input fallback.
- Traced by: `tests/unit/components/` suite (tests TBD)

### M12 — MODULE: Page Flows
- [ ] 🎯 **M12-LOGIN**: LoginPage renders form, handles submit, shows error on failure, loading state while authenticating. All role types (guard, hod, staff, admin) sign in and land on their correct default route without redirect loop or blank content area. Role is correctly extracted from JWT session on sign-in. Verified by logging in as each role.
- [ ] 🎯 **M12-GUARD**: Guard console shows active visits, register form, exit log; handles check-in/check-out state. VisitorForm loads department contacts (profiles with matching department_id) when department is selected; shows full_name in the "Person to Meet" dropdown.
- [ ] 🎯 **M12-HOD**: HOD approvals shows pending visits; approve/reject flow works.
- [ ] 🎯 **M12-WHOSINSIDE**: Who's Inside board shows checked-in visitors.
- [ ] 🎯 **M12-REPORTS**: Reports page renders daily visitor register.
- [ ] 🎯 **M12-GATEPASS**: Gate pass list and form render and submit correctly.
- [ ] 🎯 **M12-ADMIN**: Admin panel manages departments, users, blacklist.
- [ ] 🎯 **M12-NOTFOUND**: 404 page renders.
- Traced by: `tests/pages/` suite (tests TBD)

### M13 — MODULE: Build & Infrastructure
- [ ] 🎯 **M13-TSC**: `tsc --noEmit` passes with zero type errors.
- [ ] 🎯 **M13-BUILD**: `npm run build` succeeds (tsc + vite build).

### M14 — MODULE: Functional QR Badge (SEC-18)
- [ ] 🎯 **M14-QR**: Badge QR code encodes `vms://visit/{ref_number}` URI. QR renders as a scannable canvas element using the `qrcode` library. The QR updates when visit data changes. QR is visually clean and print-friendly.
- Traced by: `tests/unit/components/Badge.test.tsx` (QR tests added)

### M15 — MODULE: Data Retention & Privacy (SEC-19)
- [ ] 🎯 **M15-RETENTION**: `retention_cleanup()` function deletes visits older than `retention_days` (default 365). Runs via `pg_cron` or manual invocation. Configurable via an RPC `set_retention_days()`.
- Traced by: `tests/unit/retention.test.ts`

### M16 — MODULE: Overstay Detection (SEC-20)
- [ ] 🎯 **M16-OVERSTAY**: `flag_overstays()` function sets `visit_flags -> 'overstay' = true` for visits where `checked_in_at` is > 9 hours ago and status is `checked_in`. UI shows red badge on overstay visits across GuardConsole, WhosInside, and HODApprovals.
- Traced by: `tests/unit/overstay.test.ts`

### M17 — MODULE: Digital Document Signing (SEC-21)
- [ ] 🎯 **M17-SIGN**: DocumentSign component renders a signature pad with clear/accept controls; NDA template renders above the pad; signed document stored as base64 in `visit_documents` table; documents immutable after signing; signing required before check-in for first-time visitors.
- Traced by: `tests/unit/components/DocumentSign.test.tsx`

### M18 — MODULE: Multi-Language Support (SEC-22)
- [ ] 🎯 **M18-I18N**: Language switcher in Navbar toggles English/Hindi; all user-facing strings use `useTranslation()` hook; selection persisted in localStorage; switch applies immediately. Minimum 80% string coverage for Hindi.
- Traced by: `tests/unit/i18n.test.ts`

### M19 — MODULE: Compliance Export (SEC-23)
- [ ] 🎯 **M19-EXPORT**: `exportToCsv()` and `exportToJson()` utilities accept typed arrays and produce downloadable files; export button on GuardConsole, WhosInside, Reports pages; exports include all visible fields + ref_number + timestamps.
- Traced by: `tests/unit/export.test.ts`

### M20 — MODULE: Analytics Dashboard (SEC-24)
- [ ] 🎯 **M20-ANALYTICS**: Analytics page shows daily/weekly/monthly visitor trend chart; peak hours bar chart; department-wise distribution; average visit duration. Aggregate queries only, no PII exposure. Accessible to admin/super_admin only.
- Traced by: `tests/unit/analytics.test.ts`

## 8. AMENDMENT LOG

| Date | Iter | Change | Why |
|---|---|---|---|
| 2026-07-20 | pre-0 | v1.0 charter created | Initial |
| 2026-07-20 | pre-0 | v1.1: split milestones A/B (demo-first); deferred SLA/handover | Launch ASAP for customer demo |
| 2026-07-20 | pre-0 | v1.2: added Security Baseline §2.0.1 (always-on, never deferred); moved S9/S10 into Milestone A; loop protocol made TDD (red→green); added Goal Amendment Protocol + §7 check harness | Security at the forefront even pre-production; make CHECK executable; let the loop improve its own charter |
| 2026-07-20 | pre-0 | v1.3: check automated — `/tdd-loop` skill installed (test derivation is the loop's duty), `tests/pending.list` activation queue + vitest exclusion, git pre-commit hook blocks red commits; dedicated git repo initialized | Tests must run automatically via the loop's own machinery, not agent memory |
| 2026-07-20 | pre-0 | v1.4: loop protocol rebuilt around the GOAL (§3 rewritten as 9 goal-first steps); checker.ts rewritten to run ALL tests and report each PASSED/NOT PASSED before summarising — never stops early; loop told to fix NOT PASSED before moving to next criterion, not skip | Loop must be driven by unmet goals, not by code; all test results visible even when some fail |
| 2026-07-20 | iter-04 | v1.5: §2.2A added — PRD Feature Detail Map; 12 granular 🎯 criteria (FR-VIS-03/05/06, FR-CAM-05/06, FR-GP-04/05, FR-NOT-03, NFR-01, Admin module, SLA-W1 escalation, S14a DEMO-SCRIPT); verify.py gained a 4th check (Milestone A goals) that hard-fails on any unchecked 🎯 criterion | PRD features were referenced but not individually trackable; goal.md now mirrors PRD §3–§7 at criterion granularity |
| 2026-07-20 | iter-06 | S14a ticked — DEMO-SCRIPT.md created with full click-path, browser-tabs list, and one-command reset; Database Relationships fix in types/index.ts (required by GenericTable); vite-env.d.ts added; 002_rls.sql, scripts/seed.ts, progress.md, learnings.md created; npm run build ✓ | All code-level deliverables complete; remaining 22 criteria blocked on Supabase credentials + browser run (needs human) |
| 2026-07-20 | post-06 | v1.6: memory.md created — structured error-pattern registry (Pattern/Cause/Fix/Prevention, tagged + indexed); §3 Steps 2/5/7 updated to search memory.md before each fix; §4 self-improvement upgraded to two-tier (narrative learnings.md + indexed memory.md); §6 File Manifest updated; verify.py failure message now prompts memory.md lookup; 12 existing patterns backfilled from learnings.md | A mistake made twice is a loop failure; memory.md makes the first occurrence prevent the second |
| 2026-07-21 | iter-08 | v1.7: Added §8 Module Map — 13 module-specific goals (M1–M13) | Goals needed to be module-specific for TDD iteration |
| 2026-07-21 | iter-09 | v1.8: Added SEC-8 through SEC-16; hardened 15 security findings; fixed merged SEC-10/SEC-15 text | Security audit: 9 new SEC rules, git history secrets finding codified |
| 2026-07-21 | iter-10 | v1.9: Added SEC-17 through SEC-24 (14 new security rules); added M14–M20 (7 new modules: QR Badge, Data Retention, Overstay, Document Signing, i18n, Export, Analytics) | Gap analysis vs commercial VMS: 30 missing features codified into modules; 14 implemented in code, rest scaffolded for external service integration |

**Bootstrap (iteration 0):** if `progress.md` / `learnings.md` / `memory.md` don't exist, create them. `progress.md` must contain the permanent `Deferred → Milestone B` section from day one (pre-populated with all 🏭 criteria + PRD §10 SLAs + PRD §11 Handover). Seed *Next Up* by decomposing the **🎯 Milestone A** criteria into ordered tasks along the demo path:
`project scaffold → Supabase schema + basic roles → guard console + webcam capture → HOD mobile approval (realtime) → badge + exit flow → who's-inside live board → blacklist + repeat recall → gate passes (4 types) → RGP dashboard → visitor register report → seed script + DEMO-SCRIPT.md → full demo dry-run ×2`.
