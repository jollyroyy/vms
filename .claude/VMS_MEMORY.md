# VMS Project Memory
> Self-improving knowledge base. Update after each significant change. No bloat — every line earns its place.

## Stack
- **React 18** + **TypeScript** + **Vite** + **Tailwind CSS**
- **Supabase** (Postgres + Realtime + Auth + RLS)
- **React Router v6** (hash-free, `BrowserRouter`)
- **Vitest** + **@testing-library/react** for tests

## Architecture Decisions

### Role-Based Routing (SEC-7)
- `src/lib/roleRoutes.ts` is the **single source of truth** for role→route access
- `ROLE_ROUTES` is imported by both `App.tsx` (enforcement) and tests (verification)
- **Never** duplicate route lists anywhere else
- Current HOD routes: `/overview`, `/approvals`, `/whos-inside`, `/gate-passes`, `/reports`, `/analytics`
- HOD lands on `/overview` on login (first entry in array)

### Color / Design System
- Token names: `brand-*`, `accent-*`, `navy-*`, `surface-*`, `success-*`, `danger-*`, `warning-*`
- Dark mode via `dark:` Tailwind prefix — always add dark variants
- Stat cards pattern: left colored border (`w-[3px] bg-gradient-to-b`) + white card bg
- Skeleton loading: `<div className="skeleton h-N w-N" />`
- Premium feel: `font-display font-bold`, `tracking-tight`, generous whitespace, subtle shadows

### Supabase Realtime Pattern
```ts
const ch = supabase.channel('channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `department_id=eq.${deptId}` }, callback)
  .subscribe();
return () => { void supabase.removeChannel(ch); };
```
- Always clean up channels on unmount
- Filter at the DB level using `filter:` to avoid unnecessary re-renders

### HOD Profile + Department
- HOD's `department_id` is stored in `profiles` table
- Fetch with: `supabase.from('profiles').select('department_id').eq('id', userId).maybeSingle()`
- All HOD queries filter visits by `department_id`

### Notifications Table
- `type: 'visitor_checked_in'` = visitor arrived (green dot)
- `type: 'visit_pending_approval'` = needs HOD review (amber dot)
- `recipient_id` = HOD's user id
- `is_read: false` = unread (highlight with `bg-brand-50/40`)
- Mark read: `supabase.from('notifications').update({ is_read: true }).eq('id', id)`

### Host Names (RLS Workaround)
- `attachHostNames()` in `src/lib/hostNames.ts` calls `get_profile_names` RPC
- This bypasses RLS recursion on `profiles` table
- Always call after fetching visits that need host display names

### Test Strategy
- Security tests: `tests/security/routeProtection.test.tsx` — import `isForbidden` + `ROLE_ROUTES` directly
- Unit tests: `tests/unit/` — mock `supabase` via `vi.mock('../../src/supabaseClient', ...)`
- Run: `npx vitest run tests/unit tests/security`
- TypeScript: `npx tsc -p tsconfig.app.json --noEmit`

## Pages & Routes Map
| Route | Component | Roles |
|-------|-----------|-------|
| `/overview` | `HODOverview` | hod |
| `/approvals` | `HODApprovals` | hod |
| `/guard` | `GuardConsole` | guard |
| `/kiosk` | `KioskPage` | guard |
| `/whos-inside` | `WhosInside` | guard, hod, staff |
| `/gate-passes` | `GatePassList` | guard, hod, staff |
| `/reports` | `ReportsPage` | hod, staff, admin, super_admin |
| `/analytics` | `AnalyticsPage` | hod, admin, super_admin |
| `/admin` | `AdminPanel` | admin, super_admin |

## HOD Overview Dashboard (v1 — 2026-07-23)
**Features**: 3 stat cards + upcoming visits list + real-time notifications panel
**Inspired by**: VisitorPortal open-source screenshot (dark theme → adapted to light)
**Key stats**: Pending Approvals today · Next pre-approved visitor · This Week total
**Upcoming list**: status ∈ {pending_approval, approved}, ordered by created_at asc, limit 15
**Notifications**: fetched for `recipient_id = userId`, ordered desc, limit 10, with dismiss/mark-read

## Common Pitfalls Learned
1. `Dashboard.tsx` exists but is NOT routed — it was a planning artifact; ignore it
2. `Sidebar.tsx` `ALL_LINKS` order determines menu order — HOD Overview must come before Approvals
3. Supabase filter strings use template literals: `department_id=eq.${deptId}` (not objects)
4. `attachHostNames` must be called AFTER the initial Supabase query returns, not inside it
5. React Router v6 warnings about v7 flags are expected — non-blocking
6. Never use `git add -A` — stage specific files only
