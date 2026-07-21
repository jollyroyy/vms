# learnings.md — Self-Learning Project Reference

> **Purpose**: One read = understand the entire project + all past mistakes + scaffolding for future projects.
> **How to use**: Any agent (or human) starting work reads this file first. Future projects copy the structure.
> **Sibling files**: [`memory.md`](memory.md) (searchable error patterns, tagged) · [`goal.md`](goal.md) (charter) · [`progress.md`](progress.md) (live state) · [`PRD.md`](PRD.md) (requirements)

---

## 1. IDENTITY & STACK

**SecureGate** — Visitor & Material Gate Pass Management System for mall management offices.
- **Stack**: React 19 + Vite 5 + Tailwind 3 + TypeScript (strict) · Supabase (Postgres + Auth + Realtime + Storage)
- **Roles**: Guard, HOD, Staff, Admin, Super Admin
- **Phase**: 1 (MVP, Milestone A = customer demo)
- **Testing**: Vitest (unit + component + security) · Playwright (E2E, deferred)

---

## 2. PROJECT ARCHITECTURE MAP

```
vms/
├── src/
│   ├── lib/              PURE LOGIC — zero React, zero Vite globals
│   │   ├── refNumber.ts, visitLifecycle.ts, gatePassStatus.ts     # State machines
│   │   ├── blacklist.ts, rgpDueDate.ts, escalation.ts             # Business rules
│   │   ├── photoCapture.ts, hostNames.ts, exportUtils.ts          # Utilities
│   │   ├── roleRoutes.ts, formatDate.ts, i18n.ts, errors.ts       # Cross-cutting
│   │   ├── rateLimiter.ts                                         # Login brute-force protection
│   │   └── supabaseClient.ts                                      # Anon client only
│   ├── components/       REUSABLE UI — no page-specific imports
│   │   ├── Badge.tsx, Navbar.tsx, PhotoCapture.tsx
│   │   ├── VisitorDetails.tsx, DocumentSign.tsx
│   │   ├── NotificationBell.tsx, SessionTimeout.tsx
│   ├── pages/
│   │   ├── Login.tsx              # Rate-limited, branded "SecureGate"
│   │   ├── NotFound.tsx
│   │   ├── Guard/                Console.tsx, VisitorForm.tsx     # Gate operations
│   │   ├── HOD/                  Approvals.tsx, PreApproveForm.tsx
│   │   ├── Shared/               WhosInside.tsx, Reports.tsx, Analytics.tsx
│   │   │   └── GatePassList/     Form.tsx, GatePassForm.tsx
│   │   └── Admin/                AdminPanel.tsx, Analytics.tsx
│   └── types/index.ts            Database types (supabase-to-typescript generated)
├── supabase/migrations/    001–020 SQL (schema → RLS → RPCs → triggers → retention → rate limit)
├── tests/
│   ├── unit/               Pure logic tests (lib/), runs offline
│   ├── unit/pages/         Component/page tests, needs jsdom
│   ├── unit/components/    UI component tests, needs jsdom
│   ├── security/           routeProtection.test.ts, rls.test.ts (needs live Supabase)
│   └── e2e/                Playwright specs (deferred to Milestone B)
├── scripts/seed.ts         Demo data seeder (uses service_role key — never import in src/)
├── .githooks/pre-commit    Auto-runs checker.ts — blocks on red
├── CLAUDE.md               Agent config: skills, conventions, project context
├── checker.ts              Multi-step gate: tsc → unit → route protection
├── verify.py               Milestone goal verifier
└── vitest.config.ts        Excludes tests listed in tests/pending.list
```

**Key architectural decisions:**

| Decision | Rationale |
|----------|-----------|
| Security-definer RPCs for mutations | Avoids RLS recursion; simpler than complex policies |
| `app_metadata` ONLY for JWT role | `user_metadata` is forgeable via `auth.updateUser()` |
| Server-side ref numbers & timestamps | Postgres triggers — client can't tamper |
| Base64 photos stored inline | Display never depends on cloud storage availability |
| Two tsconfigs: root (`src/lib/`) + app (`src/`) | Root avoids React/JSX/Vite types; app tsconfig covers full build |
| `ROLE_ROUTES` as single source of truth | Route protection, nav links, and tests import same file |
| `(supabase as any).rpc()` for custom RPCs | Database types don't include all function signatures; cast is intentional |
| Rate limiter: localStorage client + DB server | Defense-in-depth; client prevents UX frustration, server prevents bypass |

---

## 3. SECURITY BLUEPRINT

### 3.1 Security Rules (SEC-1 through SEC-24)

| Rule | What | Implementation |
|------|------|---------------|
| SEC-1 | RLS on from first table | Every migration enables RLS immediately; verified by rls.test.ts |
| SEC-2 | Photos in private bucket | `visitor-photos` = Private; signed URLs only; never public |
| SEC-3 | Server-authoritative data | Ref numbers, timestamps generated server-side; client cannot override |
| SEC-4 | Secrets hygiene | `.env` gitignored; `.env.example` has placeholders only |
| SEC-5 | Role separation | Backend-enforced via RLS + RPCs; verified by rls.test.ts |
| SEC-6 | Security check every iteration | `npm run test:security` after schema changes |
| SEC-7 | Frontend route protection | URL manipulation to forbidden role → immediate sign out |
| SEC-8 | No user_metadata trust | `app_metadata` only; `user_metadata` is forgeable |
| SEC-9 | Department-scoped mutations | RPCs filter by `department_id` from JWT |
| SEC-10 | Least-privilege SELECT | No `USING (true)` on PII-containing tables |
| SEC-11 | Content Security Policy | Meta tag in index.html; restricts scripts + connect-src |
| SEC-12 | No secrets in .env.example | Placeholders only; pipeline scans for live keys |
| SEC-13 | MIME validation on uploads | `file.type.startsWith('image/')` check on every upload |
| SEC-14 | Error message safety | `safeErrorMessage()` never leaks stack/schema; generic fallback only |
| SEC-15 | try/catch on every rpc() | Every `await supabase.rpc(...)` wrapped in try/catch |
| SEC-16 | Git history secrets scanning | Pre-commit hook scans for `eyJ` JWTs, `sk-`/`pk-` keys |
| SEC-17 | Duplicate visit prevention | Server trigger + client check before registration |
| SEC-18 | QR on badge is functional | `vms://visit/{ref_number}` URI; scannable canvas via qrcode lib |
| SEC-19 | Data retention auto-purge | `retention_cleanup()` deletes visits > 365 days |
| SEC-20 | Overstay detection | `visit_flags -> 'overstay'` set for visits > 9h checked-in |
| SEC-21 | Digital document signing | Signature pad component; base64 stored immutable |
| SEC-22 | Multi-language (EN/HI) | `useTranslation()` hook; persisted in localStorage |
| SEC-23 | CSV/JSON export | All filtered views exportable with one click |
| SEC-24 | Analytics dashboard | Volume trends, peak hours, department distribution (no PII) |

### 3.2 Security Anti-Patterns (what NOT to do)

| Anti-pattern | Why it's dangerous | Correct approach |
|---|---|---|
| Read role from `user_metadata` | End user forges it via `auth.updateUser()` → privilege escalation | Use `app_metadata` only (SEC-8) |
| Fallback to `user_metadata` in RPC coalesce | Same as above — makes app_metadata check useless | Remove the user_metadata path entirely |
| `USING (true)` on PII table SELECT | Every auth user sees everything — no data isolation | Scope by role + department (SEC-10) |
| Direct `supabase.from('profiles')` in RLS | Infinite recursion (PG15+) | Use `auth.jwt()` subquery instead |
| Leaving any route unwrapped | URL manipulation → unauthorized page access | Every route must go through ProtectedRoute |
| Passing `allowedRoutes` as prop | Always passes (current URL always matches) | Look up from single `ROLE_ROUTES` registry |
| `JSON.stringify(err)` in error messages | Leaks stack traces, schema, internal state | Use `safeErrorMessage` with generic fallback |
| Live keys in `.env.example` | Committed to git, visible in repo history | Placeholders only + pre-commit scan |
| "We'll add RLS later" mentality | Data exposed from day one; migration painful | RLS on from first create table statement |
| Public storage bucket for photos | Any URL works; no access control possible | Private bucket + signed URLs |
| Client-generated timestamps/ref numbers | Tamperable; defeats audit trail | Server triggers always; client omits these fields |
| Single tsconfig for all src/ files | React/Vite types conflict with lib-only builds | Two tsconfigs: lib-only (root) + app-level |
| Using `npm` instead of `pnpm` | `npm` may not exist on other dev machines | Check actual package manager used; use `pnpm` if that's what's there |
| `CREATE POLICY IF NOT EXISTS` | Syntax not supported in Supabase PG | `DROP POLICY IF EXISTS` + `CREATE POLICY` |

### 3.3 Rate Limiting Pattern (new addition)

| Layer | Mechanism | Threshold | Lockout |
|-------|-----------|-----------|---------|
| Client | localStorage counter + timer | 5 failed attempts | 60s (doubles up to 30min max) |
| Server | `login_attempts` table + RPC | Per-email + per-IP | Emails rate-limited; RPC returns block boolean |

**Rationale**: DDoS/brute-force mitigation. Client prevents UX frustration; server prevents bypass via API calls.

---

## 4. UI/UX PATTERNS & ANTI-PATTERNS

### 4.1 Patterns that work

| Pattern | Where applied | Why it works |
|---------|--------------|--------------|
| Stat cards toggle inline filter + switch tab | WhosInside.tsx | Direct feedback on main list; Clear All always reachable |
| Live countdown for rate-limit lockout | Login.tsx | User sees exactly when they can retry; reduces frustration |
| Inline validation in click handler, not disabled prop | Approvals.tsx | Button never permanently stuck; validation shown as inline errors |
| Single `ROLE_ROUTES` for nav + protection + tests | roleRoutes.ts | One source of truth; no drift between routes and permissions |
| RPC try/catch with state reset | Every page with RPC calls | No stuck loading states; user gets error message |
| Base64 as primary, storage as secondary | PhotoCapture | Badge never depends on cloud storage availability |

### 4.2 Anti-patterns (things that break)

| Anti-pattern | What broke | Fix |
|---|---|---|
| Conditional Clear All on `tab` only | Button disappeared when stat was clicked from Checked In tab | Check both `tab` and `activeFilter` |
| `disabled` prop with inline validation | Button permanently stuck disabled | Valid in handler, not in disabled prop |
| User-facing error with `JSON.stringify` | Internal schema leaked to user | `safeErrorMessage` with generic fallback |
| `crossOrigin` on getUserMedia video | Canvas tainted by cross-origin data | Remove `crossOrigin` from local streams |
| Protocol guard (`https:`) in camera code | Camera blocked on localhost dev | Remove guard; browsers allow localhost HTTP |
| Camera denied catch with no state update | Red banner never appears; user thinks camera is working | Set error flag in catch; render banner |
| All visitors treated same (pre-approved vs walk-in) | Walk-ins hidden from WhosInside pre-approved tab | `walkin_approved` status + stat cards filter by `visit_type` |
| Branding in multiple places missed one | Reports print header still showed old brand | grep for old brand name across ALL files after rename |
| `CREATE POLICY IF NOT EXISTS` syntax | Migration failed to apply | Drop + Create pattern instead |

---

## 5. ERROR PATTERN CATALOG

> Each pattern has full details in [`memory.md`](memory.md) (tagged, searchable, with Cause → Fix → Prevention).
> This section is a **one-glance summary** organized by problem area.

### TypeScript (`#typescript` → memory.md TS-01/02/03, SB-09)

| Pattern | Quick fix |
|---------|-----------|
| `arr[idx]` is `T | undefined` after `!== -1` guard | Use `!` assertion: `arr[idx]!` |
| `supabase.rpc()` type error "not assignable to undefined" | Cast: `(supabase as any).rpc(...)` |
| `import.meta.env` in `src/lib/` file | Move file out of lib/ or cast env access |
| Build fails but tests pass | Always run `npm run build` before commit; pre-existing TS errors must be fixed first |

### Supabase (`#supabase` → memory.md SB-01 through SB-13)

| Pattern | Quick fix |
|---------|-----------|
| RLS infinite recursion on profiles | Never subquery profiles in RLS policies; use `auth.jwt()` |
| `rpc()` throws → button stuck loading | Always try/catch every `await supabase.rpc()` |
| Realtime subscription fires twice | Return `channel.unsubscribe()` in useEffect cleanup |
| Seed script gets RLS 403 | Use service_role client in scripts, not anon |
| Trigger doesn't fire on bulk insert | Single-insert → read-back → update |
| Photo null after upload | Compute base64 FIRST, then try storage |
| JWT role missing from app_metadata | Migration 010 must sync profiles; user must re-login |
| Drop + Create for policies | `CREATE POLICY IF NOT EXISTS` not supported; use `DROP POLICY IF EXISTS` + `CREATE POLICY` |

### Security (`#security` → memory.md SEC-01 through SEC-09)

| Pattern | Quick fix |
|---------|-----------|
| Route protection bypassed by URL manipulation | Wrap every route in ProtectedRoute with ROLE_ROUTES lookup |
| Privilege escalation via user_metadata | Remove user_metadata fallback; app_metadata only |
| Data isolation broken (cross-dept mutation) | Add department_id filter from JWT to EVERY mutation RPC |
| CSP allows inline scripts | Restrict `script-src 'self'`; use nonce if needed |
| unsafe error message leak | `safeErrorMessage` — generic fallback only; no JSON.stringify |
| git-committed secrets | Pre-commit grep for `eyJ`, `sk-`, `pk-`; rotate if compromised |

### React (`#react` → memory.md RE-01/02, SB-05/08)

| Pattern | Quick fix |
|---------|-----------|
| Button permanently disabled | Keep disabled simple; validate in handler |
| Canvas SecurityError with getUserMedia | Remove crossOrigin attribute from local video |
| Camera denied state never shown | Set error flag in catch; render fallback UI |

### Testing (`#vitest` → memory.md VT-01/02)

| Pattern | Quick fix |
|---------|-----------|
| Vitest exits 0 with 0 tests | Check test count in output; check pending.list |
| verify.py prints failure but exits 0 | Return False from check function; map to exit 1 |

---

## 6. SCAFFOLDING CHECKLIST (for new projects)

When starting a new project from this template, follow these steps:

### Phase 1: Foundation
- [ ] Set up React + Vite + Tailwind + TypeScript (strict mode)
- [ ] Configure two tsconfigs: root (`src/lib/`) + app (`src/`)
- [ ] Create `CLAUDE.md` with project conventions, available skills, and context
- [ ] Set up Supabase project (or replace with your backend)
- [ ] Install and configure test framework (Vitest + jsdom)
- [ ] Create checker / verify scripts (multi-step gate)
- [ ] Set up pre-commit hook that blocks red builds
- [ ] Secure `.env.example` with placeholders, gitignore `.env`

### Phase 2: Security Baseline (do BEFORE features)
- [ ] SEC-1: RLS on from first table
- [ ] SEC-3: Server-authoritative timestamps + ref numbers
- [ ] SEC-4: Secrets hygiene
- [ ] SEC-11: CSP meta tag
- [ ] SEC-16: Git history secrets scan in pre-commit
- [ ] Set up `ROLE_ROUTES` + ProtectedRoute + route protection tests
- [ ] Never read from `user_metadata` in JWT — `app_metadata` only

### Phase 3: Architecture
- [ ] `src/lib/` for pure logic only (no React, no Vite globals)
- [ ] `src/components/` for reusable UI
- [ ] `src/pages/` split by role (Guard/, HOD/, Shared/, Admin/)
- [ ] Security-definer RPCs for mutations (avoids RLS recursion)
- [ ] `(supabase as any).rpc()` pattern for custom functions
- [ ] Base64-first for display-critical data; cloud storage secondary

### Phase 4: TDD Loop
- [ ] Write test BEFORE feature (red → green)
- [ ] Use `tests/pending.list` to activate suites one at a time
- [ ] Maintain memory.md (error pattern registry) alongside learnings.md
- [ ] Run full suite before every commit; never use `--no-verify`

### Hard Rules Carried Over From This Project
- Two tsconfigs — never merge them
- `app_metadata` only for role — never `user_metadata` fallback
- No `USING (true)` on PII tables — scope by role + department
- Every route wrapped in ProtectedRoute — no exceptions
- Every `await supabase.rpc(...)` in try/catch — no exceptions
- Pre-commit hook runs full check — never skip it
- Never disable RLS "temporarily" — fix the policy
- `CREATE POLICY IF NOT EXISTS` is NOT supported — use Drop + Create
- Keep iter0 plan as one list in goal.md; never lose Deferred section

---

## 7. LEARNING LOG (dated entries)

### 2026-07-21 — Rate Limiting + Migration Fixes + Build Hardening

**What happened**:
- Added client-side rate limiter (`src/lib/rateLimiter.ts`) with exponential backoff (5 failed → 60s lockout, doubles to 30min max)
- Integrated into Login.tsx: page load tracking, pre-submit check, lockout UI with countdown, disabled button
- Created server-side `020_rate_limit.sql`: `login_attempts` table + RPCs for checkpointing and recording attempts
- Created `019_apply_pending.sql` to apply migrations 014–018 (fixes `walkin_approved` enum error)
- First migration 019 run failed — `CREATE POLICY IF NOT EXISTS` syntax not supported in Supabase PG; fixed to `DROP POLICY IF EXISTS` + `CREATE POLICY`
- Build revealed pre-existing TS errors that were being ignored:
  - Missing `@types/qrcode` dependency (Badge.tsx)
  - `Object is possibly 'undefined'` in DocumentSign.tsx (touches[0])
  - `T | undefined` index access in exportUtils.ts
  - `supabase.rpc()` type cast needed in VisitorForm.tsx and PreApproveForm.tsx

**Lesson**: Tests can pass while TypeScript build fails. Always run BOTH `npm test` AND `npm run build` to verify completeness.

**Pattern added to memory.md**: Rate limiting patterns are documented inline in learnings.md §3.3. Build hardening pattern noted for CLAUDE.md.

### 2026-07-21 — Clear All Button Fix + Branding

**What happened**:
- Clear All button in WhosInside was hidden when stat cards clicked from Checked In tab
- Root cause: stat cards toggled `activeFilter` but didn't switch `tab`; Clear All gated on `tab === 'pre_approved'`
- Fix: stat cards now call `setTab()`; Clear All shows for `(tab === 'pre_approved' || activeFilter === 'pre_approved')`
- Branding: VMS → SecureGate across Login.tsx, Navbar.tsx, index.html, Reports.tsx
- Reports print header was nearly missed — grep for old brand name across ALL files after rename

**Pattern**: When a filter/tab combo hides a UI element, always check that the element's visibility condition matches ALL paths that can trigger the filter. Don't assume only one path exists.

### 2026-07-21 — Premium UI Revamp + Self-Learning Enforcement

**What happened**:
- Revamped 7 UI files with premium card designs, modal animations, badge improvements
- Fixed Approvals.tsx build errors: VisitStatus type narrowing with `as const`, nullish coalescing for STATUS_STYLES
- All 24 test suites pass (239 tests), only rls.test.ts fails (needs live Supabase)
- User reinforced: agent must ALWAYS read learnings.md + memory.md before any action — never repeat mistakes

**Lesson**: UI revamps must preserve all test-referenced text content exactly. Always run both `npm test` AND `npm run build` after visual changes. The self-learning loop (memory.md pattern lookup → apply fix → record new patterns) is mandatory, not optional.

**Pattern**: When doing visual-only changes, keep all text content, aria labels, and data attributes unchanged to avoid test breakage.

### 2026-07-21 — learnings.md Restructured (this entry)
- learnings.md rewritten from 139-line narrative to comprehensive self-learning document
- Now includes: architecture map, security blueprint (do + don't), UI/UX anti-patterns, error catalog, scaffolding checklist, learning log
- memory.md kept as searchable error pattern registry (tagged, detailed)
- The two files serve different purposes: learnings.md = overview + self-learning + scaffolding; memory.md = searchable fix lookup

---

## TEST COMMANDS

| Command | What it runs | When |
|---------|-------------|------|
| `npm test` | All unit tests (vitest) | Every iteration |
| `npm run build` | tsc + vite build | Before commit |
| `npm run check` | checker.ts: tsc + unit + routeProtection | Hard gate (pre-commit) |
| `npm run test:security` | Full security (needs live Supabase) | Before demo |
| `npm run test:e2e` | E2E Playwright tests | Before demo |
| `npm run seed` | Seed demo data | After DB reset / new env |
