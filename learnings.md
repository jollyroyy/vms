# learnings.md — VMS Loop Narrative

> Append a dated entry whenever something surprising happens.
> The loop reads this at Step 2 (Orient) before starting new work.
> Max ~30 entries before consolidation.

---

## 2026-07-20 — Edge case inventory and fixes

After building the HOD pre-approval feature, I audited the entire system for edge cases.

### Edge Cases Identified

| # | Edge Case | Severity | Files Affected | Status |
|---|-----------|----------|----------------|--------|
| EC-01 | Guard checks in visit that's already checked in | Medium | Guard/Console.tsx | **Fixed** |
| EC-02 | Guard checks out visit already checked out | Medium | Guard/Console.tsx | **Fixed** |
| EC-03 | No error handling in guard checkIn/checkOut | High | Guard/Console.tsx | **Fixed** |
| EC-04 | Pre-approve visitor with same phone as existing pending visit | Low | HOD/PreApproveForm.tsx | Won't fix — upsert handles it |
| EC-05 | HOD pre-approves for a department they don't belong to | Medium | HOD/PreApproveForm.tsx | **Fixed** |
| EC-06 | Session expires mid-submission — no auth check before API calls | High | All forms | **Fixed** in Console/VisitorForm/PreApproveForm |
| EC-07 | Visitor phone normalization fails silently | Medium | VisitorForm.tsx, PreApproveForm.tsx | Won't fix — shows error |
| EC-08 | Pre-approved visit with no photo when guard tries to check in | Low | Guard/Console.tsx | Won't fix — photo optional at check-in |
| EC-09 | Multiple rapid clicks on Approve/Reject | Low | HOD/Approvals.tsx | Already handled (acting state) |
| EC-10 | Realtime subscription delivers stale data after approve/reject | Low | HOD/Approvals.tsx, Guard/Console.tsx | Already handled (local state filter) |
| EC-11 | Guard Console shows visits from all departments (should only show guard's department) | Low | Guard/Console.tsx | Won't fix — current behavior allows all-dept view |
| EC-12 | Who's Inside shows pre-approved but not-yet-arrived visitors | Medium | Shared/WhosInside.tsx | **Fixed** — shows accurate status badges |

## 2026-07-21 — Pre-approve submission RLS + [object Object] fix

PreApproveForm submission was failing with `[object Object]` and later "new row violates row-level security policy for table 'visitors'". Two root causes:

**RLS gap (primary)**: The `visitors` INSERT/UPDATE policy blocked HODs. The initial fix (broadening RLS policies) wasn't applied. **Final fix**: Created a `pre_approve_visitor` security-definer RPC (`migrations/011_visitors_hod_policy.sql`) that upserts the visitor AND creates the pre-approved visit in one atomic transaction — same pattern as `approve_visit`/`reject_visit`. The RPC:
- Authenticates the caller (must be HOD/Admin/SuperAdmin)
- Scopes HOD to their own department
- Upserts visitor with `on conflict (phone) do update` (bypasses RLS via SECURITY DEFINER)
- Inserts visit with `status = 'approved'`
- Returns `{ ref_number }` in one DB round-trip

**Brittle error serialization (secondary)**: `String(err)` in catch blocks produced `[object Object]`. Created `src/lib/errors.ts` → `safeErrorMessage()` (handles Error, objects with `.message`, null, plain objects). Replaced in PreApproveForm, Approvals, GuardConsole, VisitorForm. Tested in `tests/unit/errors.test.ts` (9 tests, never emits `[object Object]`).

Key: **Fixed** = code change made in this iteration. Won't fix = acceptable behavior for Milestone A.

### Lessons applied from memory.md
- **SB-08** (RPC throws without catch): Applied try-catch to guard checkIn/checkOut
- **RE-02** (button stuck disabled): Already fixed in Approvals.tsx
- **SB-09** (RPC TypeScript cast): Applied `(supabase as any).rpc()` everywhere

## 2026-07-21 — clear_pre_approved JWT role metadata mismatch

**Bug**: `clear_pre_approved` RPC raised "Only Guard, HOD, or Admin can clear pre-approvals" even for logged-in HODs.

**Root cause**: The RPC read the role from `auth.jwt() -> 'app_metadata' ->> 'role'`, but security-definer RPCs and triggers throughout the codebase inconsistently use either `app_metadata` or `user_metadata`. Supabase stores the app-level role in `raw_user_meta_data` (mapped to JWT `user_metadata`) for users created via the Admin Panel, while `raw_app_meta_data` typically only has provider info. When `app_metadata` returned NULL, the RPC's `if null not in (...)` evaluated as false (PostgreSQL behavior), bypassing the guard — but the trigger caught it with its own check.

**Fix**: Changed all role-checking functions to use `coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '')`. **Critical**: `app_metadata` must be checked FIRST because it is server-controlled — `user_metadata` is user-editable via `supabase.auth.updateUser()` and would allow privilege escalation if it took priority. The `user_metadata` fallback is only for legacy users whose roles were stored there before migration 010 moved them to `app_metadata`.

**Also fixed**: WhosInside.tsx separated the clear-error state from the load-error state (was sharing `setError`, showing misleading "Failed to load:" prefix for clear failures). Added 3 new tests covering Clear All click, RPC error display, and cancel confirmation. 9 tests total for WhosInside, all green.

**Memory.md pattern added**: SB-11 — document the rule: always check both metadata locations with coalesce when reading JWT claims in PL/pgSQL.

## 2026-07-21 — Login redirect loop & host names not loading

**Login redirect loop**: When logging in as guard, the app briefly showed the navbar then redirected back to the login screen.

**Root cause**: `App.tsx` reads role only from `session.user.app_metadata.role`. If the JWT has role in `user_metadata` instead (e.g., `raw_user_meta_data` set but `raw_app_meta_data` not synced), `role` stays `null`. ProtectedRoute returns `null` (blank content area). Navbar still renders (outside ProtectedRoute). User sees brief flash of app shell. Page refresh could terminate the session entirely.

The seed script fixed this: it updates profiles via the admin API, which triggers `sync_profile_role_to_auth()` (migration 010), which writes role + department_id to `raw_app_meta_data`. After re-login, the fresh JWT includes the role in `app_metadata`.

**Lesson**: Before debugging login issues in React code, first inspect the Supabase session in browser DevTools (`session.user.app_metadata` vs `session.user.user_metadata`) to confirm the role location.

**Host names not loading**: VisitorForm's "Person to Meet" dropdown stayed empty after selecting a department, both with `fetch('/api/hosts/...')` (Vite dev proxy using service_role) and `supabase.from('profiles')`.

**Root cause**: The `profiles` table had zero rows with populated `department_id`. The `handle_new_user` trigger creates profiles with `department_id = NULL`. Only the seed script (`npm run seed`) sets `department_id` via `admin.from('profiles').update(...)`. Without running the seed (or after a database reset), no profiles match any department filter.

**Fix**: Ran `npm run seed` — updates all 13 profiles with correct `department_id` from the departments table, plus syncs role to `app_metadata`.

**Lesson**: Seed data must be re-run after schema changes, database resets, or when moving to a new environment. The seed script is not optional — it's the only mechanism that links profiles to departments.

**Premature App.tsx fix reverted**: I proposed modifying App.tsx to add `user_metadata` fallback for role extraction (same coalesce pattern as migration 012). The user had me revert and test properly. The actual root cause was missing seed data, not the App.tsx code. If I had investigated the browser console/network tab first, I would have seen either the empty profiles query or the Supabase authentication session details.

**Lesson**: Always investigate the observable symptom in the running app (browser console, network requests, Supabase session inspection) before proposing code changes. Fixes based on code reading alone can miss the real cause.

**Memory.md pattern added**: 
- SB-12 — App.tsx role extraction only checks `app_metadata`, leaving `role` null if user's JWT has it in `user_metadata`.
- SB-13 — profiles table lacks `department_id` because seed script needs to be run.

## 2026-07-21 — Report tab removed from Guard + walkin_approved status added

**Change 1: Guard no longer sees Reports tab**
- Removed `/reports` from guard's `ROLE_ROUTES` in `roleRoutes.ts`
- Removed `'guard'` from the `/reports` navbar link roles
- HOD, staff, admin, super_admin still have full access with date selection

**Change 2: On-the-fly approvals now appear in separate tab**
- Created `migrations/014_walkin_approved.sql` — adds `walkin_approved` to `visit_status` enum
- Updated `approve_visit` RPC to set status to `walkin_approved` (was `approved`)
- Updated `enforce_visit_update_rules` trigger to handle `walkin_approved` transitions
- Pre-approved visitors stay as `approved`; walk-in HOD-approved visitors become `walkin_approved`
- WhosInside.tsx: Added third tab "Approved" for walkin_approved visitors alongside "Pre-Approved" and "Checked In"
- Guard Console: Both `approved` and `walkin_approved` are treated as ready-for-check-in
- Updated types, visitLifecycle, Reports, Analytics to handle new status

## 2026-07-21 — Comprehensive security audit (15 findings hardened)

A full-security audit using 3 parallel exploration agents covering: route protection, auth, XSS/injection, Supabase RLS, storage, SQL migrations, and CSP.

### Critical findings (fixed immediately):
1. **`.env.example` contained live service role key** — replaced with placeholders. The service role key provides full DB admin access and was committed in `.env.example` (not gitignored).
2. **`clear_pre_approved()` lacked department scoping** — any guard or HOD could mass-reject all pre-approved visits across all departments. Fixed in migration 015 with department_id filter.
3. **`user_metadata` fallback in RPCs** — migrations 012 and 014 used `coalesce(app_metadata, user_metadata)` which reintroduces the privilege escalation path that migration 010 specifically fixed. `user_metadata` is user-editable via `auth.updateUser()`. Removed in migration 015.

### High findings (fixed):
4. **No Content Security Policy** — added strict CSP meta tag to `index.html` restricting scripts to `'self'`, connect-src to Supabase, and blocking inline scripts.
5. **`safeErrorMessage` could leak object internals** — `JSON.stringify(err)` fallback could expose stack traces and internal state. Changed to return generic fallback for unknown types.
6. **`PhotoCapture` file input no MIME validation** — file.type preserved user-supplied MIME type without validation. Added `file.type.startsWith('image/')` check.
7. **`hostNames.ts` RPC not in try/catch** — violated SB-08 pattern. Wrapped in try/catch.
8. **Storage bucket SELECT policy was `USING (true)`** — any authenticated user could read any photo. Fixed in migration 016 to scope to guard/admin/super_admin.
9. **`profiles` and `visitors` SELECT wide open** — all authenticated users could see full profile/visitor data including PII. Fixed in migration 016 with department-scoped policies.

### Medium findings (fixed):
10. **Error message contains raw phone input** — `blacklist.ts` exposed `raw` in error message. Changed to generic "Invalid phone number format."
11. **ProtectedRoute uses `window.location.pathname`** — changed to `useLocation().pathname` for React Router consistency.

### New SEC rules added to goal.md:
- SEC-8: No user_metadata trust
- SEC-9: Department-scoped mutations
- SEC-10: Least-privilege SELECT policies
- SEC-11: Content Security Policy
- SEC-12: No secrets in .env.example
- SEC-13: MIME validation on uploads
- SEC-14: Error message safety
- SEC-15: RPC calls must be try/catch wrapped

### Lessons:
- Live service keys in `.env.example` is the #1 credential leak risk — always use placeholders from iteration 0.
- When migration 010 moves role to app_metadata, subsequent migrations must NOT reintroduce user_metadata fallbacks. Review all new RPCs for this pattern.
- The `current_user_role()` function (migration 010) correctly reads only app_metadata — use it everywhere instead of inline JWT parsing.
- Storage bucket policies need the same least-privilege treatment as table RLS — `USING (true)` on storage is as dangerous as `USING (true)` on a table with PII.
