# progress.md — VMS Loop State

> Updated every iteration. Never delete sections — only append and move items.
> Tally at a glance: **Iterations completed: 9** | **🎯 criteria checked: 2/24** | **Blocked: 0** | **Security fixes applied in iter-09: 15 findings hardened**

---

## Status: IN PROGRESS — Milestone A

---

## ✅ Done

| Criterion | Proof / Notes | Iteration |
|-----------|---------------|-----------|
| **SLA-W1** — Escalation logic unit-tested | `getEscalationTarget` returns hod/delegate/admin at correct thresholds; 5 tests pass in `tests/unit/escalation.test.ts` | iter-03 |
| **RLS recursion on profiles** — Eliminated across all pages | Created `get_profile_names` RPC (005), `approve_visit`/`reject_visit` RPCs (007), fixed HOD policy to use JWT (006); all 4 pages now bypass profiles FK joins | iter-06/07/08 |
| **Photo capture** — Camera UI improved, base64 always stored | `PhotoCapture.tsx` enlarged, `VisitorForm.tsx` uploadPhoto always stores base64 | iter-06 |
| **Security audit — 15 findings hardened** | `.env.example` placeholders; `safeErrorMessage` no object leak; `PhotoCapture` MIME validation; `hostNames.ts` try/catch; `blacklist.ts` generic error; CSP meta tag in `index.html`; `ProtectedRoute` uses `useLocation()`; migrations 015 (app_metadata-only RPCs + dept-scoped clear_pre_approved) and 016 (scoped SELECT policies); 8 new SEC rules (SEC-8 through SEC-15) codified in `goal.md` | iter-09 |

---

## 🔄 In Progress / Infrastructure Complete — Awaiting Browser Verification

The following criteria have full implementation in `src/` and Supabase SQL, but per goal.md §3 Step 6 the checkboxes may only be ticked after end-to-end browser observation on a running Supabase project.

| Criterion | Implementation location | What to verify in browser |
|-----------|------------------------|--------------------------|
| **S1** — Walk-in flow E2E | `Guard/VisitorForm.tsx`, `HOD/Approvals.tsx`, `components/Badge.tsx`, `Guard/Console.tsx` | Register visitor → webcam → HOD approves → badge → exit |
| **S2a** — Rejection works | `HOD/Approvals.tsx` (rejection_reason field) | HOD rejects; guard console shows rejected status |
| **S3** — Server ref numbers | `001_schema.sql` triggers | Ref `VIS-YYYYMMDD-NNNN` appears on submit; no client can edit it |
| **S4** — All 4 gate pass types | `Shared/GatePassForm.tsx`, `Shared/GatePassList.tsx` | IN/OUT × RGP/NRGP; partial return flow |
| **S5** — RGP tracking | `lib/rgpDueDate.ts`, `Shared/GatePassList.tsx`, `Shared/Reports.tsx` | Overdue entries show red; due_soon shows yellow |
| **S6** — Who's-inside live | `Shared/WhosInside.tsx` (Realtime subscription) | Check-in → second screen updates without reload |
| **S7** — Blacklist + repeat recall | `Guard/VisitorForm.tsx`, `lib/blacklist.ts` | Known phone auto-fills; blacklisted phone blocked |
| **S9** — Roles enforced by backend | `002_rls.sql` | Staff user cannot approve; guard cannot change timestamps manually |
| **S10** — Photos private | `Guard/VisitorForm.tsx` (private bucket upload), `002_rls.sql` | Unauthenticated URL → 403 |
| **S12a** — Daily visitor register | `Shared/Reports.tsx` | Reports page shows table of today's visits |
| **S13a** — In-app notifications | `001_schema.sql` notification triggers, `HOD/Approvals.tsx`, `Guard/Console.tsx` | HOD gets alert; guard gets approval/rejection alert |
| **S14** — Seed & demo ready | `scripts/seed.ts`, `DEMO-SCRIPT.md` | `npm run seed` populates data; demo script validated |
| **FR-VIS-03** — Repeat-visitor recall | `Guard/VisitorForm.tsx` (phone onBlur → DB lookup) | Phone blur → name/company auto-fill |
| **FR-VIS-05** — Badge page | `components/Badge.tsx` | Badge renders photo, ref, QR; prints badge-sized |
| **FR-VIS-06** — Visit history search | `Guard/Console.tsx` (search bar in Exit Log tab) | Filter by name/phone/dept |
| **FR-CAM-05** — Webcam UI | `components/PhotoCapture.tsx` | Live preview + oval + Capture/Retake |
| **FR-CAM-06** — Camera-denied banner | `components/PhotoCapture.tsx` (catch on getUserMedia) | Deny camera → red banner + file-input fallback |
| **FR-GP-04** — Printable gate pass | `Shared/GatePassList.tsx` (print button) | Pass page QR + items; print produces clean slip |
| **FR-GP-05** — Mismatch handling | `Shared/GatePassForm.tsx` (discrepancy note field) | Guard records mismatch; HOD notified |
| **FR-NOT-03** — Checked-in notification | `Guard/Console.tsx` (check-in sends notification insert) | Guard checks in → host receives "visitor on way" |
| **NFR-01** — Responsive layout | `App.tsx` + all pages (Tailwind responsive classes) | 1280px guard, 375px HOD — all tappable |
| **Admin module** | `Admin/AdminPanel.tsx` | CRUD departments; role dropdown; blacklist add/remove |
| **S14a** — DEMO-SCRIPT.md exists | `DEMO-SCRIPT.md` (created this iteration) | File present; click-path validated once |

---

## 🚧 Blocked (needs human)

The loop has built all code-level deliverables. The remaining 22 🎯 criteria require:

1. **Supabase project setup** — create a project at supabase.com (free tier)
2. **Run migrations** in the Supabase SQL editor:
   - `supabase/migrations/001_schema.sql` (tables + triggers)
   - `supabase/migrations/002_rls.sql` (RLS policies)
3. **Create `visitor-photos` storage bucket** (set to Private)
4. **Configure `.env`** — copy `.env.example` → `.env`, fill in URL + anon key + service role key
5. **`npm run seed`** — seed demo data
6. **`npm run dev`** — start the app at http://localhost:5173
7. **Verify each criterion in the browser** per `DEMO-SCRIPT.md`
8. **Tick each checkbox in `goal.md §2.2`** after observing in the browser

Once all 22 are ticked → run `verify.py` → Milestone A: DEMO-READY.

---

## ⏭️ Next Up

1. **Configure Supabase project** — user must supply `VITE_SUPABASE_URL` + keys in `.env`
2. **Run migrations** — `001_schema.sql` then `002_rls.sql` in Supabase SQL editor
3. **Create `visitor-photos` storage bucket** (private)
4. **`npm run seed`** — populate demo data
5. **`npm run dev`** — start app
6. **Drive each criterion end-to-end in a browser** per DEMO-SCRIPT.md
7. **Tick each `goal.md §2.2` checkbox** after observed (goal.md §3 Step 6)
8. **Commit** when all 🎯 boxes are checked

---

## 🚫 Deferred → Milestone B

All 🏭 criteria and PRD §10 SLA / §11 Handover items:

| Item | PRD ref | Debt note |
|------|---------|-----------|
| S2b — Escalation timers (HOD → delegate → Admin automatic escalation) | FR-VIS-07, SLA-W1 | Logic unit-tested (SLA-W1 ✅); UI timer + automatic escalation deferred |
| S8 — Auto-checkout at day close (cron job / Edge Function) | FR-VIS-08 | `autoCloseAtDayEnd()` logic implemented; cron scheduling deferred |
| S11 — Webcam resilience (full camera-denied + file fallback tested on target device) | FR-CAM-06, FR-CAM-10 | Happy path + compression implemented; E2E webcam test deferred |
| S12b — PDF/Excel exports, per-record audit trail UI | FR-RPT-05, FR-RPT-08 | Deferred; daily register table done |
| S13b — Email + WhatsApp/SMS notifications | PRD §5 | Deferred; in-app only for Milestone A |
| S15 — Playwright E2E suite for S1 and S4 | — | Tests/e2e dir exists; actual specs deferred |
| SLA machinery (PRD §10) — configurable timers, breach reports | PRD §10 | Pure SLA config and reporting deferred |
| Handover deliverables (PRD §11) — training video, runbook, DR plan | PRD §11 | Post-Milestone B |
| Full RLS hardening — per-department data isolation audit | SEC-5 | Basic RLS done; fine-grained audit deferred |
| Offline resilience | NFR-09 | Not in Phase 1 scope |

---

## 📊 Iteration Log

| Iter | Description | Tests | Goals ticked |
|------|-------------|-------|-------------|
| iter-01 | S3 ref-number logic — `refNumber.ts` implemented; unit tests green | 7/7 | — |
| iter-02 | checker.ts — automated 3-step gate (TypeScript, unit, security) | all pass | — |
| iter-03 | Loop rebuilt around goal — checker reports all, never stops early | all pass | — |
| iter-04 | verify.py 4th check (Milestone A goals); goal.md §2.2A added; SLA-W1 escalation | 48/48 | SLA-W1 ✅ |
| iter-05 | Full React app scaffold — all pages, components, Supabase client, Tailwind | 48/48 | — |
| iter-06 | Database schema (001_schema.sql), RLS policies (002_rls.sql), seed script, DEMO-SCRIPT.md | 48/48 | S14a pending browser verify |
| iter-12 | Guard report tab removed + walkin_approved status for on-the-fly vs pre-approved distinction | 229/229 | Guard no longer sees reports; walk-in approvals appear in separate tab in WhosInside |
| iter-15 | Auto-approval for pre-approved visitors + counter alignment fix | 239/239 | VisitorForm shows "Check In Now" banner for pre-approved visitors; WhosInside date filter added + guard dept scoping removed to match Console counters |
