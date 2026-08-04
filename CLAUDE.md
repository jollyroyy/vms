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
- **"Awaiting an HOD" stays filtered while you act on it.** The tile drills into
  `UnassignedDepartments`, which lists only departments with no HOD, and each card's
  "Assign HOD" opens `HodForm` **inline on that card**. It used to also
  `setView('departments')`, which replaced the filtered gap list with every department
  in the org — the exact opposite of what clicking the tile asked for. Do not reintroduce
  a view switch in `startAssignFromGap`.
- **No gate-pass anything in the admin surface.** `gate_passes` / `gate_pass_items` are a
  material-movement module (RGP/NRGP) whose pages and routes were deleted from the app
  long ago; the only things still reading the table were an Analytics "Gate Pass Summary"
  card, a "Gate Passes" tile in the admin `SidebarAnalytics` widget and an unrouted
  `pages/Dashboard.tsx`. All three are gone, along with the `gate_passes` realtime
  subscriptions that fed them. The **types and the DB table stay** (`types/index.ts` still
  mirrors the live schema, and the RLS/realtime security tests still assert on it) — do
  not "finish the job" by deleting those, and do not re-add a pass widget to any admin
  screen.
- **Reports (`/reports`) is the admin's visitor record.** It already carries `Approved`,
  `Check-in` and `Check-out` columns with the exact date *and* time, on screen and in the
  CSV. Approval time is resolved through `lib/visitApproval.ts` → `approvalTimestamp()`,
  not read off the row: there is no `visits.approved_at` column, so it comes from the
  `visit_approved` audit-log row (`lib/visitActors.ts`) and falls back to the visit's own
  `created_at` only for statuses that prove a prior approval. Admin is exempt from the
  department filter in `Reports.tsx` and can read `audit_logs` (migration 041), so admins
  see every visit's real approval instant.
- HODs are added by **name + email**. `addHod()` promotes an existing profile if that
  email is already known, otherwise it invites a new account via `supabase.auth.signUp`
  and upserts the profile. Writing `profiles.role` is enough — the
  `sync_profile_role_to_auth` trigger (migration 010) mirrors it into JWT `app_metadata`.

### Guard console (visitor-only deployment)
- The guard **sidebar is four items** — Dashboard, Walk-in Visitors, Pre-Approvals,
  Watchlist & Alerts. Defined in `src/components/layout/navLinks.tsx` (extracted out of
  `Sidebar.tsx`). `Walk-in Visitors` carries **no sub-nav children**. The `/visitors`
  entry is declared **twice** on purpose — guards see "Walk-in Visitors", staff see
  "Visitors" — because the two roles land on different components at that route.
- **The two arrival routes are two destinations.** A visitor either was booked in
  advance or was not, and a guard is doing one or the other:
  - `/guard/pre-approvals` is the **pre-booked** desk. `CheckInPanel` (QR gate,
    pre-approved match search, ID scan, photo, Check In) renders there. Everything it
    resolves is a visitor who was booked ahead, which is exactly the population that
    page already lists. It shows **today only** — the Upcoming and All filters were
    removed, because a guard can only check in someone due today and a future booking
    reads too easily as an arrival that is due now. `usePreApprovals` still accepts
    the other filters for callers that need history.
  - `/visitors` is the **walk-in** lane, titled "Walk-in Visitors". `Mode` is
    `'walkins' | 'walkinApproved' | 'inside'`, defaulting to `walkins` — the three
    stages of a walk-in's life at the gate, in order.
- **`walkinApproved` is a required tab, not a nicety.** `CheckInPanel` searches
  pre-approvals only, so once it moved off `/visitors` an approved walk-in had no
  route into `checked_in` at all. `GuardWalkInApproved.tsx` is that route: it captures
  the photo at the gate (WalkInRequest deliberately inserts `photo_path`/`photo_data`
  as null, since at registration nobody knows yet whether the visitor is coming in)
  and `Console.checkInWalkIn` writes the update, handling the migration-060 conflict
  via `isAlreadyInsideError`.
- **Open visits are never date-bounded.** `Console.loadVisits`, `useGateStats` and
  `useTodayVisits` all used a bare `created_at >= today` window, which silently dropped
  unfinished work at midnight: a walk-in registered at 23:50 and approved at 00:05 was
  approved into an empty list, a visitor still inside from the previous evening could
  not be checked out, and a pre-approval booked last week for today never appeared.
  The console now ORs in `status.in.(pending_approval,walkin_approved,checked_in)`, and
  the two dashboard hooks OR in `scheduled_for` within today. Keep the hooks in step —
  the count and the drill-down list must come from the same window.
- **A photo is mandatory on every check-in path.** `CheckInPanel` gates it structurally
  (the confirm step does not render until a photo exists), `GuardWalkInApproved`
  disables Confirm without one, and `VisitorForm.checkInPreApproved` — which used to
  flip status to `checked_in` with no photo at all — now refuses and uploads one. The
  photo is the record of who actually walked in; an approval only says who was expected.
- **The guard dashboard has no Recent Activity feed.** Every row it listed was already
  one click away inside the tile that counts it. `DashboardActivity.tsx` and
  `lib/useRecentActivity.ts` were deleted, and `GuardDashboard.test.tsx` asserts the
  feed never comes back.
- **Global search lives at `/search`**, allowed for all four roles (last in each
  `ROLE_ROUTES` list). The top bar navigates there with **`?q=`** — it used to send
  `/visitors?search=`, a route that is not a search surface and a param nothing read,
  which is why search silently did nothing. `lib/visitorSearch.ts` classifies the query
  as phone / ref / name; results are cards that open `VisitorDetails` for the approval
  time and timeline. The pre-approved match search in `checkInMatches.ts` also matches
  `ref_number` and compares phones digits-only.
- **The top bar has no scanner button.** Scanning is a step inside `CheckInPanel`,
  where the scanned pass resolves straight to the visitor being checked in. A global
  icon that jumped to a bare scanner was a shortcut to nowhere. Do not re-add it.
  `CheckInPanel` used to render unconditionally on `/visitors`; it no longer renders
  there at all, and `GuardConsole.test.tsx` asserts its absence. Do not move it back,
  and do not put it into `GuardConsoleModeContent` — that component serves lists only,
  which has its own test.
- **The Inside tab lists EVERY checked-in visitor, pre-approved ones included.** Only
  the Walk-ins tab is walk-in-only. Inside is the exit lane, and it is the sole place
  in the guard surface that checks a visitor out (`/guard/dashboard` reads, it does not
  act) — filtering pre-approved arrivals out of it would mean they could never leave.
- **Daily Staff, the Kiosk and Search were removed from the NAV but are still ROUTABLE.**
  `/guard/daily-staff`, `/kiosk` and `/guard/search` remain in `ROLE_ROUTES.guard` on
  purpose — the kiosk runs on its own device. They left the sidebar because neither is
  visitor check-in (Search duplicated lookups the Visitors tabs already cover), not
  because access was revoked. Do not "tidy up" `ROLE_ROUTES` by deleting them.
- **Dashboard reads, Console acts.** `/guard/dashboard` is situational awareness only;
  everything that changes a visit's state lives in `/visitors`. These two used to
  duplicate each other (both rendered an inside-list, both held their own realtime
  subscription) and a guard could not tell which was authoritative. Keep the split.
- **Every dashboard KPI tile drills down IN PLACE.** Clicking a count expands the
  matching cards directly below the summary; clicking it again collapses it; clicking a
  different tile swaps the panel. **No tile is a `<Link>`** — they used to navigate to
  `/visitors?tab=…` (including at audit tabs the console no longer has), which cost the
  guard the board they were reading. The pieces: `lib/dashboardDrill.ts` (the `DrillKey`
  union, `DRILL_FILTER` predicates and `DRILL_COPY`), `lib/useTodayVisits.ts` (fetches
  the whole day once, so five tiles share one subscription and the count can never
  disagree with the list) and `pages/Guard/DashboardDrilldown.tsx`. `DRILL_FILTER` keys
  must stay in lockstep with `GateStats` fields — the tile shows `stats[key]`, the panel
  shows `visits.filter(DRILL_FILTER[key])`. This superseded `lib/useInsideNow.ts` and
  `pages/Guard/GuardInsideNow.tsx`, both deleted.
- **`entered` is NOT `inside`.** `visits.status` holds one value, so a visitor who came
  and left is `checked_out`, not `checked_in`. Counting `status === 'checked_in'` answers
  "who is still here", never "how many came through today". `useGateStats` derives
  `entered` from `checked_in_at IS NOT NULL` and holds the invariant
  `entered === inside + checkedOut`. `tests/unit/lib/useGateStats.test.ts` guards this —
  it is the bug the dashboard rebuild fixed and it must not silently return.
- The `Declined` tile is `status === 'rejected'`, which means **an HOD declined the
  request**, usually before the visitor ever reached the gate. It is not the guard turning
  someone away — do not relabel it "Denied Entry".
- **Watchlist is blacklist-only, on purpose.** `visitors.is_blacklisted` +
  `blacklist_reason` are the only columns backing it. There is no VIP flag, no ID-expiry
  column and no duplicate-identity detection in the schema. Do not add placeholder
  sections for them; add the columns first or leave it alone.
- **No badge/QR anywhere in the guard surface.** A guard must never be able to mint an
  entry pass (see `lib/passVisibility.ts` and the comment at the top of `Console.tsx`).
  This is why there is no "Badge Printing" queue on the dashboard despite the wireframe
  asking for one. `VisitorCard` and `GuardConsole` both have tests asserting the absence.
- `Console.tsx`'s `TAB_MODE_MAP` only maps to the two live modes (walkins / inside) —
  the audit views (`checked-out` / `rejected` / `all`) were removed from the guard
  surface entirely (they remain available in Reports), and `expected` stopped being a
  tab. Every legacy `?tab=` value (`expected`, `checkin`, `exit`, `checked-out`,
  `rejected`, `all`, `no-show`) degrades onto `inside` rather than 404-ing into a blank
  tab; the check-in flow those links were reaching for is on screen unconditionally, so
  the tab underneath is free. Default mode is `inside`. Tested in `GuardConsole.test.tsx`.
- Guard styling lives in `src/styles/components-guard.css` (`.gate-tile`, `.visitor-card`,
  `.rail-*`, `.gate-action`, `.gate-tab`, `.queue-row`). Every colour resolves to an
  existing token, so both themes and any rebrand follow automatically. Status is always
  carried by a colour rail **and** a text badge — never colour alone.

### HOD surface
- **`/approvals` is the pre-approval FORM only**, and the HOD nav calls it
  "Pre-Approvals". It has no tabs. The "Pending" tab
  that used to live there moved to `/overview`, because an HOD opens the Overview to
  see what needs them and making them navigate to a second page to act on it was a
  detour. Do not re-add a tab bar to `Approvals.tsx`.
- **Pending walk-in requests render as full detail cards on the Overview.**
  `OverviewPendingApprovals.tsx` sits above `OverviewOnSite`, owns its own
  `VisitorDetails` modal and reuses `ApprovalsPendingList` (Approve / Reject /
  Details). It returns `null` when nothing is pending, so a quiet day does not push
  the day's activity below the fold. `HODOverview`'s pending query is deliberately
  **not** day-bounded, unlike every other query on that page: a request raised at
  11pm is still someone waiting at the gate at 12:05am.
- `pending_approval` is only ever reached by a **walk-in** raised at the gate — a
  pre-approval is created already approved and never passes through that state. Hence
  the tile and both list headings read "Pending Walk-in Approvals".
- **`scheduled_for` is REQUIRED on a pre-approval**, enforced in
  `validatePreApproval` (`lib/visitLifecycle.ts`) as well as on the input. A
  pre-approval with no time is indistinguishable at the gate from one for next month:
  the guard cannot tell whether the visitor is early, expected or overdue, and the
  dashboard's `overdue` count can only be derived from a `scheduled_for` that exists.
- **The HOD never sees a visitor's ID proof.** `VisitorDetails` hides the ID Document
  row when `viewerRole === 'hod'` and passes `showIdProof={false}` down through
  `PreApprovalPass` to `PassIdentity`. An approver decides on who is visiting and why;
  matching a government ID to a face is the gate's job. `PassIdentity` defaults
  `showIdProof` to `true`, which is what preserves it for the guard's post-scan summary.

### My Profile (`/profile`)
- Every role can reach it, so it is listed **last** in all four `ROLE_ROUTES` entries —
  the first entry of each list is that role's landing page.
- The sidebar profile block is a `<Link to="/profile">`. It used to fire a bare file
  picker, which left no way to see your current photo, remove it, or read back your
  role and department. Avatar upload/removal now lives in `lib/avatarUpload.ts` and
  `pages/Shared/ProfilePhotoCard.tsx`.
- Storage path is a fixed `${userId}/avatar` with **no extension**, so an upsert
  replaces the previous photo instead of orphaning a `.png` beside a new `.jpg`, and
  removal knows the one key to delete. Bucket and RLS come from migration **053**.
- Only `full_name` and `avatar_url` are ever written. `role`, `department_id` and
  `delegate_id` are administered from the Admin Panel — `role` in particular syncs into
  the JWT via `sync_profile_role_to_auth` (migration 010) and must never be reachable
  from a self-service form.

### Visitor identity and check-in constraints
- **The visitor's organisation is `visitors.vendor_name`, never "company".** Renamed
  from `visitors.company` by migration **059** (which also renamed
  `recurring_visits.visitor_company` → `visitor_vendor_name` and the
  `pre_approve_visitor` / `pre_approve_visitor_v2` RPC argument `p_company` →
  `p_vendor_name`). Every label, table header and CSV key reads "Vendor Name" / "Vendor".
  **`gate_passes.company_name` was deliberately NOT renamed** — it belongs to the
  material-movement module and describes a carrier, not a visitor. The
  `notify-host` edge function reads `vendor_name`; keep it in sync, it is outside `src/`
  and no test covers it.
- **A visitor who is inside cannot check in again.** Migration **060** puts a partial
  unique index on `visits (visitor_id) where status = 'checked_in'`. Because
  `visitors.phone` is unique, one visitor row *is* one mobile number, so this single
  index is the whole "same number cannot check in twice" rule — enforced in the DB
  because the console, the walk-in lane and the kiosk are three write paths on three
  devices and a component-level check can always be raced.
  `src/lib/activeVisit.ts` owns the human-facing half: `findActiveVisitByPhone`
  (strong), `findActiveVisitByIdProof` (weak — only `id_type` + `id_last4` are stored,
  so it can collide; warning only, never a DB constraint), `activeVisitMessage` (names
  the person) and `isAlreadyInsideError` (matches 23505 **by constraint name**, so an
  unrelated unique violation is not mislabelled). Wired into `CheckInPanel`,
  `VisitorForm.checkInPreApproved` and `Kiosk.checkInPreApproved`. `VisitorForm`'s
  registration path was already covered by the SEC-17 `get_active_visit_for_phone` RPC.
- **`carrying_material` is a tick box, not an inference.** It used to be derived from
  "did the guard type anything into remarks?", which made an empty box mean "carrying
  nothing" — indistinguishable from a guard who was interrupted mid-list. `CheckInPhotoStep`
  now has an explicit checkbox that *gates* the remarks textarea, and unticking discards
  the text so no orphaned description survives on a visit flagged as carrying nothing.
  Reports carries **two** columns — `Carrying` (Yes/No, scannable) and
  `Carrying Remarks` (the guard's words) — on screen and in the CSV. Never merge them back.

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
- Migrations `059` (vendor_name rename) and `060` (one open visit per visitor) were
  written **and applied to the live project** in the same session (2026-08-03), verified
  against live before and after. 059 had to DROP and CREATE both pre-approval RPCs —
  Postgres refuses to rename an input parameter via CREATE OR REPLACE — and re-grants
  their original ACLs explicitly, so check grants if you touch them again.
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
                     # GuardWalkIns;
                     # VisitorCard (the ONE shared visitor row — superseded the
                     #   deleted GuardConsoleVisitorRow / GuardConsoleInsideCard);
                     # Dashboard (composition) + DashboardSummary, DashboardActivity,
                     #   DashboardDrilldown (the in-page KPI expansion — superseded the
                     #   deleted GuardInsideNow);
                     # PreApprovals + PreApprovalRow; Search; Watchlist;
                     # CheckInPanel + CheckInMatchList, CheckInPhotoStep;
                     # VisitorForm + VisitorFormFields, VisitorFormAlerts,
                     # VisitorFormPreApproved; DailyStaff, WalkInRequest
  pages/HOD/         # Approvals, ApprovalsPendingList, ApprovalsVisitList, HODOverview,
                     # OverviewStatCards, OverviewUpcoming, OverviewNotifications, PreApproveForm
  pages/Shared/      # Analytics (shell) + AnalyticsKPICards, AnalyticsCharts;
                     # WhosInside + WhosInsideVisitorCard;
                     # Reports + ReportsToolbar, VisitorsDashboard
  pages/Admin/       # AdminPanel (shell), DepartmentsManager (state), DepartmentCard,
                     # DepartmentForm, HodList, HodForm, AdminStats, AdminAlerts,
                     # ConfirmDialog, AdminConfirmDialogs, Activity;
                     # click-to-drill overview: adminOverviewView (view keys),
                     # AdminOverviewPrompt (collapsed), DepartmentList,
                     # HodDirectory, UnassignedDepartments
  pages/Kiosk/       # Kiosk (state machine) + KioskIdleScreen, KioskPhoneScreen,
                     # KioskFormScreen, KioskBadgeScreen, KioskAuroraBackdrop,
                     # useKioskAutoReset (idle timeout + badge countdown)
  components/layout/ # AppShell, Sidebar, SidebarAnalytics, SidebarProfile
  lib/               # roleRoutes, theme, errors, mfa,
                     # useGateStats (guard KPIs — read the entered/inside note above),
                     # dashboardDrill (KPI → predicate + copy), useTodayVisits
                     #   (the whole day, one fetch, feeds every drill-down),
                     # activeVisit (already-inside checks + guard-readable message),
                     # useRecentActivity, usePreApprovals, useWatchlist,
                     # visitorSearch (pure query parsing), statusRail,
                     # adminDepartments, adminHods (admin CRUD + validation),
                     # useDepartments, useHods (live, realtime-subscribed)
  styles/            # tokens, base, components-forms, components-surfaces,
                     # components-feedback, components-guard, aurora, animations
                     # — all @imported by index.css (see CSS note below)
  types/             # index.ts (all DB types)
supabase/migrations/ # Numbered SQL migrations (001-060). Hand-applied — see Migration drift.
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
