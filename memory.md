# memory.md — VMS Loop Error Pattern Registry

> **MANDATORY READS:**
> - Before writing any code → scan the Quick Index for tags matching your current task area.
> - Before each fix attempt → find a pattern matching the error; if found, apply the Fix directly.
> - After any new error → record it here immediately (do not wait until Step 7).
>
> **Format per entry:** Pattern (what you see) → Cause (root) → Fix (exact steps) → Prevention (rule).
> **Mistake made twice = loop failure.** The first occurrence must produce a pattern that prevents the second.

---

## Quick Index (search by tag)

| Tag | Entries |
|-----|---------|
| `#typescript` | [TS-01](#ts-01), [TS-02](#ts-02), [TS-03](#ts-03), [SB-09](#sb-09) |
| `#vitest` | [VT-01](#vt-01), [VT-02](#vt-02) |
| `#supabase` | [SB-01](#sb-01), [SB-02](#sb-02), [SB-03](#sb-03), [SB-04](#sb-04), [SB-05](#sb-05), [SB-06](#sb-06), [SB-07](#sb-07), [SB-08](#sb-08), [SB-09](#sb-09), [SB-10](#sb-10), [SB-11](#sb-11), [SB-12](#sb-12), [SB-13](#sb-13) |
| `#react` | [RE-01](#re-01), [RE-02](#re-02), [SB-08](#sb-08) |
| `#camera` | [CA-01](#ca-01), [CA-02](#ca-02), [SB-10](#sb-10) |
| `#schema` | [SB-03](#sb-03), [SB-04](#sb-04) |
| `#rls` | [SB-02](#sb-02), [SB-05](#sb-05), [SB-06](#sb-06), [SB-07](#sb-07) |
| `#seed` | [SB-02](#sb-02), [SB-04](#sb-04), [SB-13](#sb-13) |
| `#build` | [TS-02](#ts-02), [TS-03](#ts-03) |
| `#loop` | [VT-01](#vt-01), [VT-02](#vt-02) |
| `#security` | [SEC-01](#sec-01), [SEC-02](#sec-02), [SEC-03](#sec-03), [SEC-04](#sec-04), [SEC-05](#sec-05), [SEC-06](#sec-06), [SEC-07](#sec-07), [SEC-08](#sec-08), [SEC-09](#sec-09) |
| `#routing` | [SEC-01](#sec-01) |
| `#postgres` | [SB-06](#sb-06) |
| `#auth` | [SB-12](#sb-12) |
| `#privelege-escalation` | [SEC-02](#sec-02) |
| `#data-isolation` | [SEC-03](#sec-03) |
| `#credentials` | [SEC-04](#sec-04) |
| `#secrets` | [SEC-04](#sec-04) |
| `#information-disclosure` | [SEC-05](#sec-05) |
| `#xss` | [SEC-06](#sec-06) |
| `#upload` | [SEC-06](#sec-06) |
| `#storage` | [SEC-07](#sec-07) |
| `#pii` | [SEC-08](#sec-08) |
| `#csp` | [SEC-09](#sec-09) |
| `#xss-mitigation` | [SEC-09](#sec-09) |

---

## Error Patterns

---

### VT-01

**Pattern:** Vitest exits 0 with zero test output; `npm run verify` shows green but nothing ran.
**Cause:** `tests/pending.list` excludes the suite file; vitest finds no matching files and exits 0 (counts as pass).
**Fix:**
1. Check `tests/pending.list` — if the suite is listed there, it is excluded from the run.
2. To activate: remove the suite's line from `tests/pending.list`.
3. Verify test count > 0 in vitest output before treating green as valid.
**Prevention:** A green vitest with 0 tests is NOT a passing gate. Always confirm the test count in the output.
**Tags:** `#vitest` `#loop`
**First seen:** iter-01, 2026-07-20

---

### SB-11

**Pattern:** `clear_pre_approved` RPC raises "Only Guard, HOD, or Admin can clear pre-approvals" even for logged-in HOD.
**Cause:** RPC reads role from `auth.jwt() -> 'app_metadata' ->> 'role'`, but Supabase JWT stores the app-level role in `user_metadata`, not `app_metadata`. The existing trigger `enforce_visit_update_rules` correctly uses `user_metadata`.
**Fix:** Change the RPC to use `coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '')`. `app_metadata` MUST come first because it is server-controlled — `user_metadata` is user-editable and would allow privilege escalation if it took priority.
**Prevention:** When reading JWT claims in PL/pgSQL, always match the metadata location used by existing trigger functions. In Supabase Auth, the application role lives in `user_metadata` (from `raw_user_meta_data`), while `app_metadata` (from `raw_app_meta_data`) typically only contains provider info.
**Tags:** `#supabase` `#rls` `#postgres`
**First seen:** 2026-07-21

---

### VT-02

**Pattern:** `verify.py` prints "goals not met" but exits 0; loop treats the run as passed.
**Cause:** Milestone check function printed the failure text but returned `True` / did not call `sys.exit(1)`.
**Fix:** Return `False` from any check function that detects a failure; `verify.py` maps `False → exit 1`.
**Prevention:** A check that prints failure but exits 0 gives false confidence — always propagate the failure through the return value.
**Tags:** `#vitest` `#loop`
**First seen:** iter-04, 2026-07-20

---

### TS-01

**Pattern:** TypeScript strict error: `arr[idx]` typed as `T | undefined` even after an explicit `idx !== -1` guard.
**Cause:** `noUncheckedIndexedAccess` is enabled in strict mode; TypeScript treats all index access as `T | undefined` regardless of the runtime guard.
**Fix:** Use non-null assertion: `arr[idx]!` — safe when the preceding guard is explicit and cannot be wrong.
**Prevention:** After any `indexOf`/`findIndex` guard (`!== -1`), always use `!` to assert the element exists. Do not use `?.` (optional chaining) — it silently swallows the value.
**Tags:** `#typescript`
**First seen:** iter-04, 2026-07-20

---

### TS-02

**Pattern:** `tsc --noEmit` fails on `import.meta.env`, JSX errors, or missing React types when run from the repo root.
**Cause:** `tsconfig.json` (root) covers `src/` which includes React + Vite files that need `vite/client` types and `"jsx": "react-jsx"`. The lib-only tsconfig must not include app files.
**Fix:**
1. Narrow `tsconfig.json` to `src/lib/**/*.ts` only (pure logic, no JSX, no Vite globals).
2. App-level type-checking goes through `tsconfig.app.json` (used by `npm run build`).
3. `verify.py` TypeScript check deliberately only covers `src/lib/` — this is intentional.
**Prevention:** Never add React/Vite app files to the root `tsconfig.json`. The two tsconfigs have separate domains; do not merge them.
**Tags:** `#typescript` `#build`
**First seen:** iter-02, 2026-07-20

---

### TS-03

**Pattern:** TypeScript error on `import.meta.env.VITE_*` in a file inside `src/lib/` (covered by root tsconfig).
**Cause:** Root tsconfig does not include `vite/client`; `import.meta.env` is untyped in that context.
**Fix (option A):** Move the file out of `src/lib/` into `src/` so root tsconfig never sees it.
**Fix (option B):** Cast: `(import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL`
**Prevention:** Files that use `import.meta.env` belong in `src/` (not `src/lib/`). `src/lib/` is for pure logic with zero Vite/browser globals.
**Tags:** `#typescript` `#supabase` `#build`
**First seen:** iter-05, 2026-07-20

---

### SB-01

**Pattern:** INSERT payload includes `ref_number` or `created_at`; TypeScript complains or the trigger overwrites them silently.
**Cause:** Postgres BEFORE INSERT trigger (`generate_visit_ref`) fires and overwrites both columns. The TypeScript `Insert` type correctly excludes them — trust the types.
**Fix:** Omit `ref_number` and `created_at` from every INSERT payload. Let the trigger set them.
**Prevention:** If a column is absent from the TypeScript `Insert` type, it is trigger-managed — never include it in a client INSERT.
**Tags:** `#supabase` `#schema`
**First seen:** iter-06, 2026-07-20

---

### SB-02

**Pattern:** Seed script throws RLS violation (403 / permission denied) when inserting rows.
**Cause:** Seed uses the anon client; the anon client is subject to RLS which blocks privileged writes.
**Fix:** Seed script must import and use the **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`), not the anon client.
**Prevention:**
- Service-role client → `scripts/` only. Never import in `src/`.
- Anon client → `src/` only. Never import in `scripts/`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` in `.env` only, never in `.env.example` or committed files.
**Tags:** `#supabase` `#seed` `#rls`
**First seen:** iter-06, 2026-07-20

---

### SB-03

**Pattern:** Trigger doesn't fire for some rows in a bulk insert; `ref_number` is null or missing after insert.
**Cause:** Bulk insert via Supabase client may coalesce requests; BEFORE INSERT trigger fires per row but the client-side `id` returned from a batch may not align.
**Fix:**
1. Insert one row at a time (not an array).
2. After insert, read back the generated `id`.
3. Run any follow-up `UPDATE` (status, timestamps) as a separate operation using that `id`.
**Prevention:** For any table with BEFORE INSERT triggers that set critical columns, always single-insert → read-back → update.
**Tags:** `#supabase` `#schema` `#seed`
**First seen:** iter-06, 2026-07-20

---

### SB-04

**Pattern:** A broad `USING (true)` SELECT policy makes all other SELECT policies on the same table useless.
**Cause:** RLS SELECT policies stack with OR semantics. If any policy matches, the row is visible. A broad `true` policy grants access to every authenticated user regardless of narrower policies.
**Fix (Milestone A):** Intentional — broad access for demo. Document in `progress.md → Deferred → Milestone B` that this must be tightened to per-department isolation.
**Fix (Milestone B):** Remove the broad `USING (true)` policy; keep only the narrowed per-role/per-department policies.
**Prevention:** Before adding a SELECT policy, list all existing SELECT policies on the table. A `USING (true)` policy makes all others irrelevant — add it only when broad access is the explicit intent.
**Tags:** `#supabase` `#rls` `#schema`
**First seen:** iter-06, 2026-07-20

---

### SB-05

**Pattern:** Realtime subscription fires twice on the same event; component receives duplicate updates.
**Cause:** React StrictMode double-mounts the component (mount → unmount → mount). The first `useEffect` sets up a subscription that is never torn down, then a second subscription is added on the second mount.
**Fix:** Always return a cleanup function from `useEffect`:
```ts
return () => { channel.unsubscribe(); };
```
**Prevention:** Every Supabase Realtime subscription inside a `useEffect` must have a paired `channel.unsubscribe()` in the cleanup. No exceptions.
**Tags:** `#supabase` `#react`
**First seen:** iter-05, 2026-07-20

---

### RE-01

**Pattern:** `canvas.getImageData()` throws `SecurityError: The canvas has been tainted by cross-origin data`.
**Cause:** `crossOrigin` attribute set on a `<video>` element that is fed by a `getUserMedia` MediaStream. Local streams are same-origin; adding `crossOrigin` taints the canvas.
**Fix:** Remove the `crossOrigin` attribute from any `<video>` element fed by `getUserMedia`.
**Prevention:** Never set `crossOrigin` on video elements using local `MediaStream`. Only set it on video elements loading external `src` URLs that require CORS.
**Tags:** `#camera` `#react`
**First seen:** iter-05, 2026-07-20

---

### CA-01

**Pattern:** Camera code throws or refuses to call `getUserMedia` because `location.protocol !== 'https:'`.
**Cause:** A protocol guard (`if (location.protocol !== 'https:') return`) was added, blocking localhost development.
**Fix:** Remove the protocol guard. `getUserMedia` is explicitly allowed on `localhost` (HTTP) by all major browsers.
**Prevention:** Never write `location.protocol` guards in camera code. Develop on `localhost`; deploy to HTTPS. The browser enforces this boundary — the code does not need to.
**Tags:** `#camera`
**First seen:** iter-06, 2026-07-20

---

### CA-02

**Pattern:** Camera-denied state is never shown; red banner does not appear when `getUserMedia` is blocked.
**Cause:** The `catch` block on `getUserMedia` does not set error state; the component renders as if camera is available.
**Fix:** In the `catch` block, set a React state flag (`cameraError: true`); render the red banner conditionally on that flag.
**Prevention:** `getUserMedia` has two failure modes: rejection (user denies) and error (no device). Both must set the error flag and trigger the fallback UI.
**Tags:** `#camera` `#react`
**First seen:** iter-06, 2026-07-20

---

---

### SEC-01

**Pattern:** A user logged in as Guard (or HOD/Staff) navigates to `/admin` by editing the URL and sees the admin panel content — role enforcement is bypassed.
**Cause:** `ProtectedRoute` received a per-route `allowedRoutes` prop (e.g., `allowedRoutes={['/admin']}`). The check was `pathname.startsWith('/admin')` — which is **always true** when the component renders at `/admin`. Any logged-in user passed the check. Additionally, shared routes (`/whos-inside`, `/gate-passes`, `/reports`) had no `ProtectedRoute` wrapper at all.
**Fix:**
1. Move `ROLE_ROUTES` to `src/lib/roleRoutes.ts` — single source of truth used by both App.tsx and tests.
2. Export `isForbidden(pathname, role)` from the same file.
3. `ProtectedRoute` takes only `role` (no `allowedRoutes` prop); looks up `ROLE_ROUTES[role]` internally.
4. Wrap **every** authenticated route with `ProtectedRoute role={role}` — including shared routes.
5. When `role === null` (loading), render `null` (nothing) — never render children while role is unknown.
6. Update tests to import `isForbidden` and `ROLE_ROUTES` from the lib file — not a local copy.
**Prevention:**
- NEVER pass role permissions as a prop to a route guard. The component must look them up from a single authoritative registry.
- NEVER leave any authenticated route unwrapped — every `<Route>` inside the authenticated section must go through `ProtectedRoute`.
- Route protection tests MUST import the same `ROLE_ROUTES` used by the component — local copies silently drift.
- When role is null/loading, render nothing; do not let children flash before the role is resolved.
**Tags:** `#security` `#routing` `#react`
**First seen:** post-iter-06, 2026-07-20

---

### SB-06

**Pattern:** `ERROR: infinite recursion detected in policy for relation "profiles"` on any query involving the `profiles` table (SELECT, FK join, or subquery).
**Cause:** PG15+ changed how `security definer` and RLS interact. The `current_user_role()` function reads from `auth.jwt()` but when called inside an RLS policy's `USING`/`WITH CHECK` clause on `visits` or `gate_passes` that subqueries `profiles`, the chain `profiles_policy → current_user_role() → auth.jwt() → ??? → profiles_policy` creates infinite recursion. Even a `USING (true)` SELECT policy on `profiles` doesn't prevent this when UPDATE policies call `current_user_role()`.
**Fix:**
1. **Never subquery `profiles` inside an RLS policy.** Instead, read `department_id`/`role` from `auth.jwt() -> 'user_metadata'`: `(auth.jwt() -> 'user_metadata' ->> 'department_id')::uuid`.
2. **For complex operations (approve/reject):** Drop the RLS policy entirely and create a `security definer` RPC function that validates access via `auth.jwt()` directly, then performs the operation bypassing RLS.
3. **For fetching host names:** Remove FK joins like `profiles!visits_host_id_fkey` from `.select()` calls. Use a `security definer` RPC function (`get_profile_names`) to fetch needed profile data after the main query.
**Prevention:**
- Before adding any RLS policy, grep for all existing policies that reference the same table — a subquery in a policy can cascade even with `USING (true)`.
- When you see "infinite recursion detected in policy for relation 'X'", the FIRST place to look is any RLS subquery that reads from `X` — not just the policies ON `X` but also policies ON OTHER TABLES that reference `X`.
- Whenever possible, use `auth.jwt()` instead of subquerying tables in RLS policies. JWT metadata is loaded once per request and never recurses.
- For mutation operations (UPDATE/DELETE) that need role/permission checks, prefer `security definer` RPCs over RLS policies — they are simpler to debug and never recurse.
**Tags:** `#rls` `#supabase` `#postgres`
**First seen:** iter-06/07/08, 2026-07-20

---

### SB-07

**Pattern:** After fixing the SELECT query (FK join), the UPDATE/INSERT through RLS policy still fails with recursion error.
**Cause:** Multiple RLS policies on different tables (`visits`, `gate_passes`) use the same recursive subquery pattern (`select department_id from public.profiles where id = auth.uid()`). Fixing only one table's policy leaves others still broken.
**Fix:** Grep ALL `*.sql` migration files for `select.*from.*profiles` to find every recursive subquery. Fix ALL of them in the same migration.
**Prevention:** When hunting a recursion error, search the ENTIRE codebase (all SQL files) for `select.*from.*<table_name>` in one grep, not just the file you're currently editing.
**Tags:** `#rls` `#supabase`
**First seen:** iter-08, 2026-07-20

---

### SB-08

**Pattern:** `supabase.rpc('function_name', {...})` call succeeds but the component stays in a loading/disabled state — buttons unclickable, spinner never stops.
**Cause:** The `rpc` call threw a JavaScript exception (not a Supabase error response with `.error`), so `setActing(null)` or `setLoading(false)` in the `.then()` / `if (err)` branch was never called.
**Fix:** Wrap every `await supabase.rpc(...)` call in a `try/catch` block. In the `catch`, reset all loading/disabled state flags and display the error message.
**Prevention:** `supabase.rpc()` can throw for reasons other than a Supabase error (network failure, function not found, timeout). The catch block is mandatory — not optional.
**Tags:** `#supabase` `#react`
**First seen:** iter-08, 2026-07-20

---

### RE-02

**Pattern:** Button is permanently disabled (`disabled={true}`) and the user cannot interact with it — stuck in loading state.
**Cause:** The `disabled` prop depends on a complex condition that can evaluate to `true` and never reset (e.g., `disabled={acting === v.id || !reason.trim()}`). If `acting` is set but never cleared (because an async call throws without a catch), the button stays disabled forever.
**Fix:**
1. Keep `disabled` logic simple — only disable when the action is in progress (`disabled={acting === v.id}`).
2. Move input validation into the click handler (`if (!reason) { setError('Required'); return; }`).
3. Always wrap async operations in try/catch to reset `acting` state.
**Prevention:** The `disabled` prop on action buttons should only depend on `acting` state (is this specific action running?). Do not mix input validation into disabled logic — validate in the handler and show errors inline.
**Tags:** `#react`
**First seen:** iter-09, 2026-07-20

---

### SB-09

**Pattern:** `supabase.rpc()` TypeScript error: `not assignable to parameter of type 'undefined'` when calling a user-defined function.
**Cause:** The `Database` type (passed to `createClient<Database>()`) does not include the custom function signature. The strict typing expects only known functions.
**Fix:** Cast to `any`: `(supabase as any).rpc('function_name', { args })`.
**Prevention:** For custom RPC functions not in the generated Database type, always use `(supabase as any).rpc(...)`. Do not try to extend the Database type for every ad-hoc function.
**Tags:** `#typescript` `#supabase`
**First seen:** iter-06, 2026-07-20

---

### SB-10

**Pattern:** Insert creates a visit but the photo (`photo_data`) is null or the photo doesn't display in any view.
**Cause:** `uploadPhoto()` function only converted to base64 when storage upload failed. If storage upload succeeded but `createSignedUrl()` failed, `photoData` was `null`.
**Fix:** Always convert the blob to base64 FIRST (for reliable storage), then try storage upload as a secondary step. Return the base64 as `photoData` regardless of storage outcome.
**Prevention:** Never make display-critical data dependent on an optional cloud storage step. Always compute the reliable fallback first.
**Tags:** `#supabase` `#camera`
**First seen:** iter-06, 2026-07-20

---

### SB-12

**Pattern:** User signs in successfully but sees a blank content area (or gets redirected to login on page refresh). App briefly shows Navbar then nothing.
**Cause:** `App.tsx` reads role only from `session.user.app_metadata.role`. If the user's JWT has the role in `user_metadata` instead (e.g., `raw_user_meta_data` was set but `raw_app_meta_data` wasn't synced), `role` state stays `null`. `ProtectedRoute` returns `null` (blank content). Navbar still renders because it's outside `ProtectedRoute`. On page refresh, the session may terminate entirely.
**Fix:** Either (a) ensure migration 010 has been applied and profiles are synced (the `sync_profile_role_to_auth` trigger must write to `raw_app_meta_data`), then log out and log in again to get a fresh JWT; or (b) add a fallback in `App.tsx` to also check `user_metadata.role` when `app_metadata.role` is absent (same coalesce pattern as SB-11).
**Prevention:** After applying migrations or updating profiles, existing JWT tokens are stale — users must log out and log in again. To inspect: open browser DevTools → Application → Local Storage → `sb-<ref>-auth-token` → parse the JWT to check `user.app_metadata.role` vs `user.user_metadata.role`.
**Tags:** `#supabase` `#auth`
**First seen:** 2026-07-21

---

### SB-13

**Pattern:** VisitorForm "Person to Meet" dropdown stays empty after selecting a department, both with direct `supabase.from('profiles')` query and with the `/api/hosts/:deptId` Vite proxy (service_role key).
**Cause:** The `profiles` table lacks `department_id` values. The `handle_new_user` trigger creates profiles with `department_id = NULL`. Only the seed script (`npm run seed`) updates profiles with the correct `department_id`. If the seed was never run (or the database was reset), no profiles match any department filter.
**Fix:** Run `npm run seed` — this updates all profiles with the correct `department_id` from the departments table via `admin.from('profiles').update(...)` using the service-role key.
**Prevention:** After creating the database schema, always run `npm run seed` to populate profile data including department assignments. Re-run after any database reset or when migrating to a new environment.
**Tags:** `#supabase` `#seed`
**First seen:** 2026-07-21

---

---

### SEC-02

**Pattern:** `user_metadata` fallback in RPCs re-introduces privilege escalation.
**Cause:** Migrations after 010 used `coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '')`. `user_metadata` is forgeable by end users via `auth.updateUser()`. A staff user could set their `user_metadata.role = 'admin'`.
**Fix:** Use only `auth.jwt() -> 'app_metadata' ->> 'role'`. Migration 010 already backfilled all existing users into `app_metadata`. Remove the `user_metadata` path entirely.
**Prevention:** Before merging any new RPC/trigger, grep for `user_metadata` in the function body. It should never appear.
**Tags:** `#security` `#supabase` `#rls` `#privilege-escalation`
**First seen:** iter-09, 2026-07-21

---

### SEC-03

**Pattern:** `clear_pre_approved()` RPC operates on all departments — guard/HOD can mass-reject pre-approvals across the whole organization.
**Cause:** The `WHERE status = 'approved'` clause has no `department_id` filter. Guard and HOD roles should only affect their own department.
**Fix:** Add `WHERE status = 'approved' AND (v_jwt_role IN ('admin','super_admin') OR department_id = v_dept_id)`.
**Prevention:** Every RPC that modifies data must ask: "should this be scoped to the caller's department?" If yes, add the department_id filter using `auth.jwt() -> 'app_metadata' ->> 'department_id'`.
**Tags:** `#security` `#supabase` `#rls` `#data-isolation`
**First seen:** iter-09, 2026-07-21

---

### SEC-04

**Pattern:** Live API keys in `.env.example` committed to git.
**Cause:** The `.env.example` contained real Supabase URL, anon key, and service role key. `.env.example` is not gitignored and gets committed to the repository.
**Fix:** Replace all values with placeholders (e.g., `your-supabase-url`, `your-anon-key-here`). Rotate the compromised service role key in the Supabase dashboard.
**Prevention:** Check `.env.example` for any credential-like values during CR. Use only `your-*-here` or `your-project-id` style placeholders.
**Tags:** `#security` `#secrets` `#credentials` `#git`
**First seen:** iter-09, 2026-07-21

---

### SEC-05

**Pattern:** `safeErrorMessage()` returns `JSON.stringify(err)` for objects without `.message`, leaking internal state.
**Cause:** The `JSON.stringify` and `String(err)` fallbacks could expose stack traces, schema details, or internal object structure to end users.
**Fix:** Return the generic `fallback` string for any error type that is not an `Error` instance, a string, or an object with a `.message` property.
**Prevention:** `safeErrorMessage` must never produce output longer than the fallback for unexpected error types. Test with `Symbol`, `42`, `[1,2,3]`, and nested objects.
**Tags:** `#security` `#information-disclosure` `#errors`
**First seen:** iter-09, 2026-07-21

---

### SEC-06

**Pattern:** File upload MIME type not validated before creating blob URL.
**Cause:** `handleFileInput` in `PhotoCapture.tsx` used `file.type` directly in `new Blob([file], { type: file.type })` without checking that it starts with `image/`. A manipulated file could create a `blob:` URL pointing to HTML.
**Fix:** Add `if (!file.type.startsWith('image/')) return;` before processing the file.
**Prevention:** Every file upload handler must validate MIME type server-side; client-side validation is defense-in-depth. Use `file.type.startsWith('expected-type/')`.
**Tags:** `#security` `#xss` `#upload` `#camera`
**First seen:** iter-09, 2026-07-21

---

### SEC-07

**Pattern:** Storage bucket SELECT policy is `USING (true)` for all authenticated users.
**Cause:** The `photos: authenticated can read` policy on `storage.objects` allowed any authenticated user (any role) to generate signed URLs and list all objects in `visitor-photos`.
**Fix:** Restrict to `public.current_user_role() in ('guard', 'admin', 'super_admin')`.
**Prevention:** Storage bucket policies need the same least-privilege rigor as table RLS. Never use `USING (true)` on storage buckets that contain PII/photos.
**Tags:** `#security` `#supabase` `#storage` `#rls` `#photos`
**First seen:** iter-09, 2026-07-21

---

### SEC-08

**Pattern:** `profiles`/`visitors` SELECT policies are `USING (true)` — all authenticated users see all rows.
**Cause:** Initial RLS policies used `USING (true)` for broad access. Profiles contain department/delegate chains; visitors contain phone numbers and PII.
**Fix:** Scope by role and department: non-admin roles see only their own department's profiles and their department's visitors. Guard retains cross-dept read for operational needs.
**Prevention:** Before setting `USING (true)` on a SELECT policy, enumerate every column and ask "does every authenticated user need to see this?" If not, scope by role/department.
**Tags:** `#security` `#supabase` `#rls` `#pii`
**First seen:** iter-09, 2026-07-21

---

### SEC-09

**Pattern:** CSP missing — any XSS vulnerability becomes trivially exploitable for full data exfiltration.
**Cause:** No `Content-Security-Policy` meta tag or HTTP header in `index.html` or server config.
**Fix:** Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self' blob:; font-src 'self' data:; frame-src 'none'; object-src 'none'">`.
**Prevention:** Every new project should set CSP at iteration 0. Verify with browser DevTools → Network → Response Headers.
**Tags:** `#security` `#csp` `#xss-mitigation`
**First seen:** iter-09, 2026-07-21

---

## New Entry Template

Copy this block when recording a new pattern:

```
---

### XX-NN

**Pattern:**
**Cause:**
**Fix:**
**Prevention:**
**Tags:** `#tag1` `#tag2`
**First seen:** iter-NN, YYYY-MM-DD

---
```

Update the Quick Index at the top when adding a new entry.
