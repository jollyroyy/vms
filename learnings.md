# learnings.md — VMS Loop Self-Improvement Log

> Append a dated entry whenever something surprised you or failed unexpectedly.
> Scan this BEFORE touching any file in a new iteration (goal.md §3 Step 2).
> When entries exceed ~30, consolidate duplicates and promote to CLAUDE.md.

---

## 2026-07-20 — iter-01

**Rule: tests/pending.list exclusion silently passes zero-test suites**
- Vitest counts "no matching tests" as a passing run (exit 0).
- Lesson: always check pending.list first; a green vitest with 0 tests is not a passing gate.
- Fix: count matched test files; fail if 0 when pending.list is non-empty for that pattern.

---

## 2026-07-20 — iter-02

**Rule: `tsc --noEmit` checks the wrong tsconfig if tsconfig.json includes the whole src/**
- When src/ includes React+Vite files, `tsc --noEmit` (which reads tsconfig.json by default) fails on `import.meta.env` and JSX — those need tsconfig.app.json.
- Fix: tsconfig.json narrowed to `src/lib/**/*.ts` only (pure logic). App type-checks go through tsconfig.app.json (`npm run build` uses this).
- The verify.py `tsc --noEmit` check deliberately only covers the lib/ layer.

---

## 2026-07-20 — iter-04

**Rule: verify.py must flag unmet goals as hard failures, not cosmetic warnings**
- The 4th check (Milestone A goals) was added with explicit hard-fail semantics.
- Lesson: a check that prints "goals not met" but exits 0 gives false confidence; always exit 1 on any unmet criterion.

**Rule: noUncheckedIndexedAccess with array[idx] after confirming idx !== -1**
- TypeScript strict mode: `arr[idx]` is `T | undefined` even after `idx !== -1`.
- Fix: use non-null assertion `arr[idx]!` (safe when the index guard is explicit).

---

## 2026-07-20 — iter-05

**Rule: Supabase `import.meta.env` vars must be cast to avoid TypeScript errors in non-Vite tsconfig**
- `(import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL` avoids needing `vite/client` in tsconfig.json (which would pull in DOM types that conflict with the lib-only check).
- Alternatively: keep supabaseClient.ts outside src/lib/ so tsconfig.json never sees it.

**Rule: Supabase Realtime subscription must be unsubscribed on component unmount**
- Always return a cleanup function from useEffect that calls `channel.unsubscribe()`.
- Forgetting this causes double-firing on React StrictMode double-mount.

**Rule: PhotoCapture webcam + canvas requires `crossOrigin` to be unset for local streams**
- `getUserMedia` streams are same-origin; no crossOrigin attribute needed.
- Setting crossOrigin on a video element fed by MediaStream causes taint issues in some browsers.

---

## 2026-07-20 — iter-06

**Rule: Supabase trigger sets ref_number and created_at; never include them in INSERT payload**
- The `generate_visit_ref` trigger fires BEFORE INSERT and overwrites both columns.
- If the client sends `ref_number` the trigger still overwrites it, but it's cleaner to omit it.
- The TypeScript Database type already excludes `ref_number` and `created_at` from `Insert` — trust the types.

**Rule: Seed script must use service-role client, never anon client**
- The anon client is subject to RLS; the seed script needs to bypass RLS to set up initial data.
- Keep SUPABASE_SERVICE_ROLE_KEY in .env only, never in client-side code.
- Pattern: service client in scripts/ only; anon client in src/ only.

**Rule: Insert one visit at a time in seed so trigger fires per row**
- Bulk insert in Supabase (client library) may coalesce requests; trigger fires per-row but status/timestamps need a follow-up UPDATE after getting the generated id.
- Pattern: insert → get id → update status/timestamps as separate step.

**Rule: RLS SELECT policies stack with OR semantics in Supabase**
- If two SELECT policies exist on the same table, a row is visible if EITHER policy matches.
- This means a broad `using (true)` policy makes all prior narrower policies redundant for SELECT.
- For Milestone A, this is intentional (all authenticated users can see all visits); tighten in Milestone B per-department.

**Rule: Camera code must work on localhost (HTTP) — no HTTPS required for development**
- `getUserMedia` is allowed on `localhost` without HTTPS.
- Do not write camera code that checks `location.protocol === 'https:'` and refuses to load on localhost.

---

## 2026-07-20 — post-iter-06 (security audit)

**Rule: ProtectedRoute must use ROLE_ROUTES from a shared lib — never a per-route `allowedRoutes` prop**
- Bug found: `<ProtectedRoute allowedRoutes={['/admin']} role={role}>` passes the wrong data. When the component renders at `/admin`, `pathname.startsWith('/admin')` is ALWAYS true → the check always passes → any logged-in user can see admin.
- Root cause: the route guard checked "is this path in the allowed list?" when it should check "is this path in the current user's role's allowed list?"
- Fix: `ProtectedRoute` takes only `role`; looks up `ROLE_ROUTES[role]` from `src/lib/roleRoutes.ts` internally. No per-route props.
- Fix: Every authenticated route must be wrapped in `ProtectedRoute` — shared routes included.
- Fix: When `role === null`, render `null` (not children); prevents flash of forbidden content while role loads.
- Fix: Tests must import the same `ROLE_ROUTES` from the lib — local copies in tests silently drift from implementation.
- Pattern recorded in memory.md as SEC-01.
