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
- **Gate passes**: RGP (returnable, IN/OUT), NRGP (non-returnable, OUT only).

## Hard Rules
- **Max 300 lines per file.** If a component or module exceeds 300 lines, extract sub-components or helpers into separate files. No exceptions.
- **No fuzzy string matching for known enums.** Use a direct lookup map (`Record<string, T>`) instead of `includes()` chains.
- **No duplicate renders.** Never render the same data value twice in a single card/widget.
- **Every new page needs a test file.** No page ships without at least: heading render, empty state, data render, and edge case tests.
- **One concern per file.** Data-fetching widgets, layout components, and business logic belong in separate files.

## Directory Layout
```
src/
  pages/Guard/       # Console, Dashboard, GatePassQueue, DailyStaff
  pages/HOD/         # Approvals, HODOverview, PreApproveForm
  pages/Shared/      # Analytics, Reports, WhosInside, GatePassList, GatePassForm, VisitorsDashboard
  pages/Admin/       # AdminPanel, Activity
  pages/Kiosk/       # Kiosk
  components/layout/ # AppShell, Sidebar, SidebarAnalytics
  lib/               # roleRoutes, theme, errors, mfa
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
- Silent refresh: `load(silent=true)` skips `setLoading` to avoid UI flash during real-time updates
- Sidebar nav: `ALL_LINKS` array in `Sidebar.tsx`, each link has `roles: UserRole[]`
- Status badges: `status-badge`, `tab-active`/`tab-inactive`, `card-hover`, `card-premium`
- Form inputs: `className="input"`, labels: `className="label"`
