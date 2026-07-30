# VMS - Visitor Management System

## Stack
- React 18 + TypeScript + Vite
- Supabase (auth, DB, real-time, RLS)
- Tailwind CSS (custom design system: `brand-*`, `navy-*`, `accent-*`, `surface-*`)
- Vitest + React Testing Library

## Roles
`guard | hod | staff | admin` (defined in `src/types/index.ts`)

## Key Architecture
- **Route access**: `src/lib/roleRoutes.ts` is the single source of truth. `isForbidden()` enforces in `App.tsx`.
- **Real-time**: Supabase channels with `postgres_changes`. Use `silent` param in `load()` to avoid KPI flash on live refreshes.
- **Auth**: JWT `app_metadata.role` + `department_id`. Fallback to `profiles` table.

### Admin scope
- Admin navigation is **Reports, Analytics and Settings only**. Admins have **no route to
  visitor records** — `/visitors`, `/whos-inside` and `/kiosk` are all forbidden for the
  role. Do not re-add them to `ROLE_ROUTES.admin` or to the `/visitors` entry in
  `ALL_LINKS`.
- The Admin Panel (`/admin`) manages **departments and their heads of department** only.
  It has no Users tab and no Blacklist tab.
- HODs are added by **name + email**. `addHod()` promotes an existing profile if that
  email is already known, otherwise it invites a new account via `supabase.auth.signUp`
  and upserts the profile. Writing `profiles.role` is enough — the
  `sync_profile_role_to_auth` trigger (migration 010) mirrors it into JWT `app_metadata`.

### Live shared data
- `src/lib/useDepartments.ts` and `src/lib/useHods.ts` fetch **and** subscribe to
  `postgres_changes`. Every screen with a department picker uses `useDepartments()` —
  never re-add a one-shot `supabase.from('departments')` fetch in a component, or admin
  edits will stop propagating to guards/HODs/staff/kiosk.
- Both tables are in the `supabase_realtime` publication with `replica identity full`.
  Declared by `039_realtime_departments_profiles.sql`, but 039 was never applied to
  the live project — it was actually landed by
  `054_drift_realtime_departments_profiles.sql`. Realtime still honours RLS.

### Migration drift
- This project has always been migrated by hand, so
  `supabase_migrations.schema_migrations` is **not** authoritative and the 3-digit
  filename prefixes are not CLI-recognisable versions. `supabase db push` is not the
  workflow here.
- Migrations `046`-`055` reconciled a live-vs-disk audit (2026-07-30): eight files
  had never been applied and two only partially. `055_drift_policy_convergence.sql`
  holds the full audit ledger, including the files that are deliberately **not**
  replayed and the bugs that were fixed while reconciling.
- Before trusting a migration file as a description of live state, verify against the
  live project. Two things the files got wrong on purpose-of-record: 021's
  `pre_approve_visitor` is superseded by 026/029, and 022's
  `visits: hod updates own department` must stay unapplied — every HOD write to a
  visit goes through a security-definer RPC (`approve_visit`, `reject_visit`,
  `cancel_visit`), so a direct UPDATE grant is attack surface with no feature behind it.

## Hard Rules
- **Max 300 lines per file. FORBIDDEN to exceed. No exceptions.**
  This applies to **every** file in the repo — `src/` components, hooks, libs, `tests/`
  test files, CSS, and SQL. There is no "it's just a test file" or "it's just styles"
  exemption. If a file would cross 300 lines, split it *before* committing:
  - Components → extract sub-components / presentational children into sibling files.
  - Hooks & libs → split by concern, one exported concern per file.
  - Tests → split by the behaviour under test (e.g. `Foo.test.tsx` +
    `FooEditing.test.tsx`), each with its own mock harness.
  - CSS → split into layer files and `@import` them.
  Check before every commit:
  `find src tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) -exec wc -l {} + | awk '$1 > 300'`
  must print nothing.
- **No fuzzy string matching for known enums.** Use a direct lookup map (`Record<string, T>`) instead of `includes()` chains.
- **No duplicate renders.** Never render the same data value twice in a single card/widget.
- **Every new page needs a test file.** No page ships without at least: heading render, empty state, data render, and edge case tests.
- **One concern per file.** Data-fetching widgets, layout components, and business logic belong in separate files.

## Directory Layout
```
src/
  pages/Guard/       # Console (shell) + GuardConsoleModeTabs, GuardConsoleModeContent,
                     # GuardConsoleInsideCard, GuardConsoleVisitorRow;
                     # CheckInPanel + CheckInMatchList, CheckInPhotoStep;
                     # VisitorForm + VisitorFormFields, VisitorFormAlerts,
                     # VisitorFormPreApproved; Dashboard, DailyStaff, WalkInRequest
  pages/HOD/         # Approvals, ApprovalsPendingList, ApprovalsVisitList, HODOverview,
                     # OverviewStatCards, OverviewUpcoming, OverviewNotifications, PreApproveForm
  pages/Shared/      # Analytics (shell) + AnalyticsKPICards, AnalyticsCharts,
                     # AnalyticsGatePassSummary; WhosInside + WhosInsideVisitorCard;
                     # Reports, VisitorsDashboard
  pages/Admin/       # AdminPanel (shell), DepartmentsManager (state), DepartmentCard,
                     # DepartmentForm, HodList, HodForm, AdminStats, AdminAlerts,
                     # ConfirmDialog, AdminConfirmDialogs, Activity;
                     # click-to-drill overview: adminOverviewView (view keys),
                     # AdminOverviewPrompt (collapsed), DepartmentList,
                     # HodDirectory, UnassignedDepartments
  pages/Kiosk/       # Kiosk (state machine) + KioskIdleScreen, KioskPhoneScreen,
                     # KioskFormScreen, KioskBadgeScreen, KioskAuroraBackdrop
  components/layout/ # AppShell, Sidebar, SidebarAnalytics, SidebarProfile
  lib/               # roleRoutes, theme, errors, mfa,
                     # adminDepartments, adminHods (admin CRUD + validation),
                     # useDepartments, useHods (live, realtime-subscribed)
  styles/            # tokens, base, components-forms, components-surfaces,
                     # components-feedback, aurora, animations
                     # — all @imported by index.css (see CSS note below)
  types/             # index.ts (all DB types)
supabase/migrations/ # Numbered SQL migrations (001-031+)
tests/
  unit/              # Component + logic tests
  security/          # RLS + route protection tests
```

## Testing
- `npx vitest run` — all tests
- `npx vitest run tests/unit` — unit only
- `npx vitest run tests/security` — security only
- Mock pattern: `vi.mock('../../src/supabaseClient', ...)` with chainable `.on()` for channels
- Channel mock: use `const ch: any = {}; ch.on = () => ch;` to avoid TDZ errors

## Conventions
- **CSS `@import` must come before `@tailwind`** in `src/index.css`. CSS spec requires
  `@import` to precede all other statements; putting the `src/styles/*.css` imports after
  the `@tailwind` directives makes Vite drop them silently (the bundle shrinks from
  ~94 kB to ~69 kB with no error, only a build warning). Tailwind still collects
  `@layer` blocks from the whole resolved file, so import order is safe.
- Silent refresh: `load(silent=true)` skips `setLoading` to avoid UI flash during real-time updates
- Sidebar nav: `ALL_LINKS` array in `Sidebar.tsx`, each link has `roles: UserRole[]`
- Status badges: `status-badge`, `tab-active`/`tab-inactive`, `card-hover`, `card-premium`
- Form inputs: `className="input"`, labels: `className="label"`
