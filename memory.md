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
| `#typescript` | [TS-01](#ts-01), [TS-02](#ts-02), [TS-03](#ts-03) |
| `#vitest` | [VT-01](#vt-01), [VT-02](#vt-02) |
| `#supabase` | [SB-01](#sb-01), [SB-02](#sb-02), [SB-03](#sb-03), [SB-04](#sb-04), [SB-05](#sb-05) |
| `#react` | [RE-01](#re-01) |
| `#camera` | [CA-01](#ca-01), [CA-02](#ca-02) |
| `#schema` | [SB-03](#sb-03), [SB-04](#sb-04) |
| `#rls` | [SB-02](#sb-02), [SB-05](#sb-05) |
| `#seed` | [SB-02](#sb-02), [SB-04](#sb-04) |
| `#build` | [TS-02](#ts-02), [TS-03](#ts-03) |
| `#loop` | [VT-01](#vt-01), [VT-02](#vt-02) |
| `#security` | [SEC-01](#sec-01) |
| `#routing` | [SEC-01](#sec-01) |

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
