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
- **The admin console is NINE TABS and it READS visitor records** (client instruction,
  2026-08-17, from a set of reference screens). In order: Dashboard, Live Check-In,
  Pre-Registration, Visitors Log, Hosts, Badge Printing, Blacklist & Security, Reports,
  Settings. The order is the reference screens' order — a reader learns the rail by
  position — so a reshuffle is a behaviour change, not a tidy-up.
  - **This REVERSES the standing "admin has no route to visitor records" rule.** That
    rule's reasoning is preserved by the tabs being **READ-ONLY**, not by the routes
    being absent: no admin screen renders a control that writes to `visits` — no
    check-in, no check-out, no approve, no reject, no deny-entry, no badge minting, no
    undo. `lib/useAdminVisits.ts` exports no mutation at all, which is what makes that
    structural rather than a matter of which buttons a page happened to render. Every
    admin page test asserts the absence of `/check in|check out|approve|reject/i`.
  - **`/visitors`, `/whos-inside` and `/kiosk` STAY FORBIDDEN**, and that is not an
    oversight left over from the old rule. Those three are where a visit is actually
    mutated — the guard console admits and releases, `/whos-inside` owns the exit, the
    kiosk writes a self-service check-in. Reading a visit through a read-only tab and
    reaching the desk that changes it are different permissions. Guarded by
    `tests/security/routeProtectionAdmin.test.tsx`.
  - **The ONE write on the admin surface is the blacklist** (`AdminBlacklistForm` →
    `lib/adminBlacklist.ts`), which writes `visitors.is_blacklisted` and never `visits`.
    Blacklisting is security administration, not a visitor-record action, and the reason
    box is mandatory — the confirm stays disabled until one is typed, so the
    justification is the only route to the write.
- **There is NO `/analytics`. It was DELETED, not unlinked** (client instruction,
  2026-08-17). `pages/Shared/Analytics.tsx`, `AnalyticsCharts.tsx`, `AnalyticsKPICards.tsx`,
  the unrouted `pages/Admin/Analytics.tsx` and the sidebar's `SidebarAnalytics` widget are
  all gone, and the path is out of every `ROLE_ROUTES` entry so typing it fails rather than
  landing somewhere stale. Its charts moved onto the admin **Dashboard** (visitor flow,
  purpose donut) and **Reports** (`ReportsAnalytics.tsx`: visitors by day, check-in time
  trend, purpose split, entry-point utilization) — **derived from the rows those screens
  already load**, never a second query. Two screens answering "what happened this week"
  from separately written queries is the tile-vs-drilldown defect this project has already
  fixed once. The sidebar widget went for the same reason plus a second: its window was a
  UTC day, so between 00:00 and 05:30 IST it counted yesterday.
- **The Admin Panel is gone as a page; it is Settings → Roles & Users** (client
  instruction, 2026-08-17: keep the current user settings and integrate them into the new
  tabs). `SettingsRolesUsers.tsx` renders `DepartmentsManager` **unchanged** — departments,
  heads of department, the HOD invite path and the activity-log link. It was moved, not
  rebuilt: redrawing working CRUD to fit a new frame risks the one part of that screen that
  already worked. `/admin` redirects to `/admin/settings`, because it is the bookmark every
  admin already holds. It still has no Users tab beyond this and no separate Blacklist tab —
  the blacklist is its own console tab now.
- **`lib/settingsSections.ts` is the single source of truth for the Settings screen**, the
  same way `visitorSegments.ts` is for the Visitors surface: the left rail and the right
  panel are both derived from it, so a section cannot exist in one and not the other.
  - **EVERY FIELD DECLARES WHETHER THE APP HONOURS IT** (`enforced`). A settings screen
    where some switches govern behaviour and others merely store a preference, with nothing
    on screen distinguishing them, is a screen that lies about what it controls — the same
    class of error as the hardcoded "Gate Status: Operational" chip and the unconditional
    "Identity verified" line this project has already deleted, and worse, because an admin
    will act as though the rule is in force. An unenforced field still SAVES and stays
    editable; it renders "Recorded — not yet enforced" plus its `caveat`. It is not the
    app's place to refuse to record an administrator's intent, only to be honest about what
    happens next.
  - **Unsaved edits survive a section switch.** One Save button across six sections is only
    honest if moving between them does not quietly discard what was typed. `dirty` tracks
    which KEYS changed across the whole form and the save writes exactly those — an upsert
    of all twenty-six would stamp `updated_by`/`updated_at` on rows nobody touched and turn
    the one audit signal that table carries into noise.
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
- **Admin-entered text is allowlisted, in the browser AND in the database.**
  `src/lib/inputRules.ts` owns the rules; migration **062** (applied live
  2026-08-04) mirrors them as CHECK constraints, because client validation is a
  usability guard that any admin token can skip by calling PostgREST directly.
  Department name `^[A-Za-z0-9 &./'-]+$` (2-60), code `^[A-Z0-9&-]+$` (1-10),
  person name `^[A-Za-z .'-]+$` (2-80, **no digits**). It is an allowlist, not a
  blocklist of "bad" strings — do not add `<script>`/`DROP TABLE` pattern
  matching, that is a guessing game. Three live rows shaped these rules: a
  department coded `R&D` (hence `&` in codes), and two trailing-space values the
  migration trims. `profiles.full_name`'s constraints are **NOT VALID** on
  purpose — a legacy `Bugfix Test 2` row would have failed the digit rule, and
  rewriting history behind the admin's back is worse than grandfathering it.
  None of this is an SQL-injection fix: nothing in the app concatenates SQL, so
  injection is structurally unavailable. It buys data hygiene and depth.
- **`audit_logs` is trigger-only — no client can forge an entry.** The 041-era
  policy `audit_logs: triggers can insert` let **any authenticated user** POST an
  arbitrary audit row (actor/action/entity/timestamps of their choosing), which
  would have made `/admin/activity` a record someone could poison. Migration **063**
  (applied live 2026-08-08) drops that policy and revokes `INSERT` from
  `authenticated`. Let the `log_visit_approval` SECURITY DEFINER triggers be the
  only writers — they are owned by the table owner and never depended on the grant
  (this is why the policy's original rationale was wrong). Covered by
  `tests/security/auditLogsRls.test.ts`: a forged insert is refused and no forged
  row exists, while an approve still writes its audit line. If a feature ever needs
  a manual audit entry, it belongs inside a SECURITY DEFINER function, not a policy.
- HODs are added by **name + email**. `addHod()` promotes an existing profile if that
  email is already known, otherwise it invites a new account via `supabase.auth.signUp`
  and upserts the profile. Writing `profiles.role` is enough — the
  `sync_profile_role_to_auth` trigger (migration 010) mirrors it into JWT `app_metadata`.

### Guard console (visitor-only deployment)
- **The guard sidebar is five items — Dashboard, Entry & Exit, Pre-Registered,
  Scan Pass, and Visitors** as plain links (the reference-screen tabs since
  2026-08-14; the Watchlist tab was deleted 2026-08-15, see below). Defined in
  `src/components/layout/navLinks.tsx` (extracted out of
  `Sidebar.tsx`). The `/visitors` entry is declared **twice** — once for `guard`,
  once for `staff` — because the two roles land on different components at that
  route and the staff label carries no sub-nav either. There is **no group and no
  `SidebarNavGroup.tsx` since 2026-08-13**: the segments that used to expand
  under the guard's Visitors item now live on the page itself as KPI tiles
  (`VisitorKpiRail`), counted from the page's own data. The sidebar naming the
  segments was the old answer to "where can I go"; the page carrying the counts
  and the filters is the same answer one click closer.
- **`src/lib/visitorSegments.ts` is the single source of truth for the Visitors
  surface.** The sidebar children, the page content, the page copy and the live
  count badges are all derived from `VISITOR_SEGMENTS` / `SEGMENT_META` /
  `SEGMENT_FILTER` there, so a segment cannot exist in the nav without existing
  on the page, and "what Expected means" is defined once. Adding a segment is one
  edit in that file. The seven are: All Visitors, Expected, Inside, Pending
  Approval, Approved Walk-ins, Checked Out, Walk-in Register.
  - **There is no Overstayed segment** (removed 2026-08-13, client instruction).
    An overstay is not a stage of a visitor's life at the gate — it is a subset of
    Inside that needs chasing, and the **guard dashboard's Overstaying tile** is
    where that chasing happens. That tile stays: migration 067's sweep is installed
    but deliberately unscheduled, so it is still the only live mechanism for
    catching a check-out the gate forgot. `isOverstaying` in `lib/visitExpiry.ts`
    is live for it and must not be deleted. `/visitors/overstayed` degrades onto
    **Inside** (not `all`) — that is the list the old bookmark was reaching for, and
    the rows are all still in it. Guarded by `visitorSegments.test.ts` and
    `GuardConsoleRail.test.tsx`.
- **Each segment is a real URL** (`/visitors`, `/visitors/expected`,
  `/visitors/inside`, …), routed in `App.tsx` via `/visitors/:segment`. This
  replaced a three-tab bar buried inside the page: the tabs were invisible from
  the nav, unbookmarkable, and the back button did nothing between them. Every
  legacy `?tab=` value is mapped by `segmentFromSlug`, and an unknown slug
  degrades onto `all` rather than 404-ing into a blank page — those values live
  in old bookmarks. `GuardConsoleModeTabs.tsx` and `GuardConsoleModeContent.tsx`
  were deleted; `pages/Guard/VisitorSegmentContent.tsx` superseded them.
- **The grid card is the one visitor layout.** `VisitorStackList.tsx` renders
  `VisitorGridCard` — circular headshot, name, vendor, host, purpose, an always
  date-and-time stamp, and the status pill. It is the same face as
  `PreRegisteredCard`, so a guard moving between Pre-Registered and Visitors
  never re-learns where the name or the host sits. The older single-row
  `VisitorCard.tsx` **still exists** and is used by `GuardWalkIns` and
  `GuardWalkInApproved`; do not delete it. The three-column `VisitorStackCard`
  / `VisitorStackFacts` that preceded the grid card are **deleted** (2026-08-15,
  no importers remained). Styles are in `styles/components-visitor-stack.css`.
  - **It has NO leading colour rail, by instruction (2026-08-13).** The stacked
    card's `::before` rail was deleted, not made transparent, and nothing is left
    holding space for something that no longer draws. The rule this does not
    break: colour must never be the **only** carrier of status. It never was
    here; the text badge always said it, and still does. `VisitorStackList.test.tsx`
    fails on any `rail-` class. `.visitor-card` keeps its own rail —
    `lib/statusRail.ts` is still live for it, so do not delete that either.
  - **It has NO "Details" control either** (removed 2026-08-13, client instruction),
    on the Visitors list and on the dashboard drill-down alike. The card IS the
    record — name, vendor, host, department, purpose, phone, expected time, status,
    ID proof and card number are all on its face — so the sheet behind that button
    was a second place to read the same visit. What only the sheet held (the ID
    document image, the timeline, the pass) is still reached from `/guard/search`
    and `/whos-inside`, where looking a visitor *up* is the job; at the gate the job
    is the person standing there. The `onSelect` prop is **gone from
    `VisitorGridCard`, `VisitorStackList`, `VisitorSegmentContent` and
    the deleted `DashboardDrilldown`**, and `Console.tsx` no longer imports `VisitorDetails` at
    all — do not thread it back through. Consequence, and it is the point: a card
    with no action renders **no buttons at all**, so the Visitors surface is
    display-only end to end. `VisitorStackList.test.tsx` asserts there is no button
    at all (`DashboardDrilldown.test.tsx` went with that component).
  - **The dashboard drill-down uses this same card**, via `KpiDrilldownSheet.tsx`
    (which superseded the deleted `DashboardDrilldown.tsx` in the 2026-08-14 rebuild).
    It passes **`onSelect` only and never an `action`** — "Dashboard reads, Console
    acts", so a Check In / Check Out button there would let a situational-awareness
    panel change a visit's state. `WhosInsideVisitorCard` is untouched and still serves
    `/whos-inside`.
  - **The visitor TYPE appears only once the visitor is inside.** Third column,
    directly above the ID-proof line, because together they are "who this person is
    on paper" and a guard checks the two as one glance. Before check-in it would be
    the same fact twice — the status badge already reads "Pre-approved" or
    "Awaiting approval" — and CLAUDE.md forbids that. For a `checked_in` row the
    "Approved ✓" tick gives up its place to it, being tautological for someone who
    is already through the gate.
- **`lib/visitOrigin.ts` INFERS pre-approved vs walk-in; nothing records it.**
  `pending_approval` / `walkin_approved` prove a walk-in and `approved` proves a
  pre-approval, but all routes converge on `checked_in`, which is exactly when the
  card needs the answer. The fallback is `scheduled_for`: the walk-in path never
  sets it (the same fact migration 066 splits `no_show` from `expired` on) and
  `validatePreApproval` makes it mandatory on a pre-approval. **Known gap:** a
  pre-approval created before that validation landed has a null `scheduled_for` and
  reads as a walk-in. Acceptable because nothing branches on this — it is a label on
  an old row, never a permission or an action. If it ever must be exact, add a column
  to `visits` written at creation; do not write a cleverer guess.
- **An expected time is always DATE AND TIME, never a bare time** (client instruction,
  2026-08-13). Every list that prints `scheduled_for` can hold a booking for a day
  other than today — the open statuses are never date-bounded — so "03:30" says when
  but not whether that when is now, which is the exact confusion that made
  `VIS-20260811-0007` unreadable. `formatDateTime` at all six sites:
  `VisitorGridCard` (its date-and-time stamp), `VisitorCard.expectedTimeLabel`,
  `PreApprovalRow` (its slot column widened from `w-16` to `w-32` to fit),
  `CheckInMatchCard`, `CheckInVisitorSummary` and `OverviewFilteredView`'s ETA line.
  `CheckInMatchCard` used to switch on `dueToday` — bare time for today, full date
  otherwise; the not-due half of that was load-bearing and printing the date
  everywhere keeps the same guarantee without asking the guard to notice which
  format they got. A visit with no slot still reads **"Anytime"**, not a dash.

- **There is NO Expected segment on the Visitors surface either** (removed 2026-08-15,
  client instruction, immediately after Checked Out and for the mirror reason). A visitor
  booked for today who has not arrived is the **Pre-Registered** tab's entire subject — and
  that board can *act* on them, since it starts the check-in, where this display-only
  surface could only look. `/visitors/expected` and the legacy `?tab=checkin` both degrade
  onto `all`, which still contains those rows, and the `expected` tile is gone from
  `VISITOR_KPI_ORDER`. `isDueToday` lost its last user here; it is still live elsewhere,
  do not delete it. **The five remaining segments are: All Visitors, Inside, Pending
  Approval, Approved Walk-ins, Walk-in Register.**
- **There is NO Checked Out segment on the Visitors surface** (removed 2026-08-15,
  client instruction). A visitor who has left is the **Entry & Exit** tab's subject — that
  page holds their entry time, their exit time and their pass, beside the people still
  inside. Listing them here as well put one visitor on two surfaces with nothing saying
  which was authoritative. `/visitors/checked-out` **degrades onto `all`** rather than
  404-ing (that list still contains today's departures), and the `checkedOut` tile is gone
  from `VISITOR_KPI_ORDER`. The segment is deleted from `visitorSegments.ts` entirely —
  union, `VISITOR_SEGMENTS`, `SEGMENT_SLUG`, `SEGMENT_META` and `SEGMENT_FILTER` — so
  re-adding it is a deliberate act, not a silent one.
- **The Visitors surface is display-only — no card carries an action**
  (client instruction, 2026-08-14). The tab only shows which visitor falls under
  which category; Check In and Check Out are gone from every card on every
  segment. `actionFor` was deleted from `VisitorSegmentContent.tsx` along with
  the `action`/`actionFor` props on `VisitorGridCard` / `VisitorStackList`, and
  `Console.tsx` no longer holds any check-in/check-out machinery (no
  `checkingIn` flow, no `CardReturnConfirm`, no undo banner — its success toast
  now only ever reports a walk-in check-in). Entry is the Scan Pass and
  Pre-Approvals desks; exit is the Entry & Exit tab (`/guard/inside-now`), which
  owns the card-return gate and the undo banner. Do not thread a row action back
  into this surface — `VisitorStackList.test.tsx` asserts there is no button at
  all.
- **The walk-in desk ends a visit as well as starting one** (client instruction,
  2026-08-16). `/visitors/approved` is the one place on the Visitors surface that
  carries actions, and since migration 080 it carries them in **both** directions.
  A row still resting in `walkin_approved` gets **Check In**; a row the approver
  admitted (`checked_in`) gets **Check Out**; a `checked_out` row gets neither.
  The reason it was needed: 080 made the approver's click the admission, so a
  walk-in no longer passes through this desk on the way in at all — the guard who
  registered them was left watching a row they could not act on, having to know
  that a different tab lets people out. **The exit is a REQUEST, not a second
  implementation**: `Console.tsx` opens the same `CardReturnConfirm` and calls the
  same `lib/checkOutFlow.logVisitExit` the Entry & Exit tab uses, so "did a human
  witness this exit" and "did the card come back" keep one answer each. Do not
  write a second exit mutation here. `GuardWalkInApprovedExit.test.tsx` guards all
  four states, including that no exit button renders without a handler.
  - **CLOSED 2026-08-17 by migration 083.** The gap was: `WalkInRequest` never
    collects a `visitor_card_number`, so a walk-in admitted by the approver reached
    this exit with no card on record and the card-return control from 076 was inert
    on that route. It was closed the other way round from the way this note
    predicted — not by putting the field on the registration form, but by putting
    the ADMISSION back at the gate, so the card is recorded at the moment it is
    physically handed over. `GuardWalkInApproved`'s check-in already demanded one.
    Rows admitted during 080's single day still have a null card and still reach
    this exit; they now pass through `CardReturnConfirm`'s no-card branch, which
    since 2026-08-17 also requires a tick.
- **The walk-in register is untouched by all of this.** `/visitors/walk-in`
  renders `GuardWalkIns` exactly as before, with its own pending list, because
  registering an unannounced arrival is the one thing on this surface that
  *creates* a visit rather than advancing one, and registering then watching for
  the host's answer is one continuous job. `/visitors/approved` likewise still
  renders `GuardWalkInApproved` unchanged — it captures a photo before it can
  act, so it is a flow, not a row with a button.
- **The Visitors KPI board sits ON TOP of the list, full width, at the dashboard's
  size** (`VisitorKpiRail.tsx`, client instruction 2026-08-13). Same
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` as the dashboard board, same full-size
  `KpiTile`. It used to be a 300px right-hand column of square `compact` tiles — the
  same card in two sizes on two screens, which made a guard re-learn it on each. The
  rule that survives from the old layout: a filter must never render BELOW the content
  it filters, which is why the board is above the list and not beside it.
  - **There is no Currently Inside tile** (removed 2026-08-13, client instruction). Only
    the TILE went: `/visitors/inside` still routes, still lists, and is still the sole
    place in the guard surface that checks a visitor out — delete the segment and nobody
    can ever leave. `VisitorKpiSegment = Exclude<VisitorSegment, 'inside'>` in
    `visitorKpis.tsx` enforces it, so re-adding the tile is a compile error rather than a
    silent edit. The guard DASHBOARD keeps its own Currently Inside tile; that board is
    situational awareness and answers a different question.
  - **The All Visitors tile has NO icon.** `KpiTileSpec.icon` is optional and `KpiTile`
    drops the whole `.kpi-plate` when it is absent — not an empty tinted square. The glyph
    was a three-line list mark standing for "everything", which is what the label already
    says, and it read as a menu affordance the tile does not have. Every other tile keeps
    its plate: those glyphs distinguish one lane from another, and this one distinguished
    nothing. Guarded by `GuardConsoleRail.test.tsx`.
- **The guard dashboard's row 1 is FIVE tiles, not four** (client instruction,
  2026-08-17): Expected Today / Checked In / In Premises / **Checked Out Today** /
  Overstaying — the order a visit passes through the gate. The board could say how many
  came through and how many are still here and left the third number to be worked out as
  the difference; that is arithmetic a guard was doing in their head, and the Entry &
  Exit tab's Checked Out lane already stated it one click away. `xl:grid-cols-5` now, so
  row 1 and row 2 share a column rhythm.
  - **`TILE_FILTER.checkedOut` is keyed on `checked_out_at` against `istDayStart`, NOT
    on `status === 'checked_out'`**, and the two are different sets: a visitor who
    arrived at 21:00 yesterday and left at 09:00 today is today's departure, one who
    arrived and left yesterday is not, and the status alone cannot tell them apart. It is
    the SAME window `lib/useGateActivity.ts` gives the Entry & Exit Checked Out lane, so
    the tile and that lane cannot report different figures for one day. Compared as
    **instants, never as strings** — PostgREST renders a timestamptz as `…+00:00` while
    `toISOString()` ends in `Z`, and `'+' < 'Z'`.
  - **`useTodayVisits` was WIDENED for it**, not given a second query — the rule this
    file already set. A fourth OR clause, `checked_out_at >= istDayStart()`, because the
    midnight-crossing exit was created yesterday, scheduled yesterday and is in no open
    status, so every other clause missed it. That is also the row a guard is most often
    asked about.
- **The guard dashboard has no page heading.** `<h1>Dashboard</h1>` was removed
  2026-08-13 (client instruction) — the sidebar item the guard just clicked already
  says it, and the page restating its own name spent the widest line on screen on the
  one fact they cannot be in doubt about. The date, the **Live** pill and the clock all
  stay: those are things only the page can tell them. `GuardDashboard.test.tsx` asserts
  there is no level-1 heading and no "Dashboard" text.
- **The sidebar count badges must be computed from the page's own rules.**
  `lib/useVisitorCounts.ts` loads the SAME window (`visitorLoadFilter`) and
  slices it with the SAME predicates (`SEGMENT_FILTER`) the page uses. It is
  gated on `role === 'guard'` so no other role pays for the query or the extra
  realtime subscription. Never give a badge its own filter.
- **`approved` is in `OPEN_STATUSES` and that is load-bearing.** Without it the
  ordinary case — booked yesterday, arriving today — never loads at all. The
  Expected segment then narrows with `isDueToday`, so a booking for next month is
  fetched but never listed as an arrival due now.
- **The stacked list has NO TOOLBAR — no search box and no sort dropdown.** Nothing
  sits between the heading and the cards. `pages/Guard/VisitorStackToolbar.tsx` and
  `lib/visitorStackFilter.ts` (with `sortVisits`, `SORT_LABELS`, `SORT_OPTIONS` and
  `StackSort`) are **deleted**, as are `.stack-toolbar` / `.stack-sort` /
  `.stack-sort-select` in `components-visitor-stack.css`. The rows arrive in the order
  `SEGMENT_FILTER` produced them — newest activity first — and that is the only order
  there is. Both controls went for the same reason, a page-scoped widget answering a
  question the page had already answered:
  - The **search box** (backed by a `matchesQuery`) could only narrow the rows the
    current segment had loaded, so a visitor who had checked out was findable in the
    top bar's global search (`lib/searchVisits.ts`, every visit in any state) and not
    in this one. One search, one answer.
  - The **sort** followed on 2026-08-13 (client instruction). Its default option,
    "Latest activity", was never a sort at all — `sortVisits` treated it as the
    identity because the segment slicer had already ordered the rows that way, so it
    restated the order on screen. The two that did work re-ordered a list the guard
    had *already* narrowed by picking a segment, which is one more control to read
    before they can act on the person in front of them.

  `tests/unit/pages/VisitorStackList.test.tsx` fails on any `select`, `combobox`,
  `searchbox` or `/sort/i` text in the list. Do not re-add a toolbar here.
- **The department appears ONCE per card.** It used to trail the host's name in
  brackets *and* own an attribute row below it — the same value twice on one card,
  which the no-duplicate-renders rule forbids and which made the eye check whether the
  two agreed. `VisitorGridCard` shows the department once, and
  `tests/unit/pages/VisitorStackList.test.tsx` guards that, along with the vendor and host
  each appearing exactly once.
- **QR scanning is UNCONDITIONAL — there is no `qr` feature flag, and adding one back
  is forbidden.** `/guard/scan-pass` is the guard's dedicated scan desk: a visitor
  holds up their pass, it resolves straight to their record and the check-in completes
  on that page. It shipped in `7c2554b` gated behind `isFeatureEnabled('qr')` and was
  moved to its own page and nav item in `bf8172f`, still gated. That gate was a trap,
  not a safeguard: **Vite inlines `import.meta.env.*` at BUILD time and `.env` is
  git-ignored**, so no deployed build ever had `VITE_FEATURE_QR` defined and every
  guard on the live site saw a dead "QR scanning is unavailable on this deployment"
  card, unfixable from the running app. The flag was deleted from `FeatureFlag`
  entirely rather than defaulted to on, so it cannot be re-gated by accident. Both
  `ScanPass.tsx` and `CheckInScanGate.tsx` render their scanner with no flag check,
  and each has a test asserting the absence of an off-state. The same removal was
  applied to `ocr` (2026-08-13) — ID scanning is unconditional too — so the flags
  that remain (`faceVerify`, …) carry the same build-time caveat: an unset flag on
  Vercel is not "off pending a decision", it is off permanently.
- **The scanner accepts a PDF or an image of the pass, not just the live camera.**
  `lib/pdfQrPage.ts` renders page 1 of a PDF to a PNG via `pdfjs-dist` (its worker
  **must** stay a bundled same-origin asset — the app's CSP is `worker-src 'self'
  blob:`, so a CDN workerSrc silently kills every decode), and `decodeQrFile()` in
  `lib/decodeQrImage.ts` dispatches PDFs to it and images straight to `decodeQrImage`.
  This exists because HODs hand visitors the PDF pass that `lib/qrPassPdf.ts`
  generates; the old copy told the guard to screenshot it first, which is not a
  workflow. A PDF that fails to render reports as `engine`, never as `no_code` — the
  same rule the QR decoder already follows, so a guard is never sent chasing a better
  photo for a fault that is ours. The upload path is also the ONLY way in on a machine
  with no webcam or served over plain HTTP (`mediaDevices` is hidden on insecure
  origins), which is why it gets primary button styling whenever the camera is down.
- **THE SCAN PASS TAB DOES NOT OPEN THE CAMERA BY ITSELF** (client instruction,
  2026-08-17). `/guard/scan-pass` is a TAB, and it is also the search desk — the guard
  who lands on it to look someone up by mobile number is the common case, and they were
  getting the webcam light and a live picture of themselves for it. `GuardQRScan` now
  takes **`autoStart`** (default true) and `ScanPass` passes `false`: a dark placeholder
  the same shape as the video frame, and a primary **"Scan QR code"** button that arms
  it. Arming is one-way, so a refused code does not send the guard back to the button.
  `CheckInScanGate` keeps the default and must — it is a modal opened by pressing Scan,
  and asking for a second press would be a button behind a button.
  - **The gate is `useQrScanner`'s new `enabled`, NOT `paused`, and that distinction is
    the whole point.** `paused` acts on a scanner that has already started: the device is
    acquired and the light is on before anything is paused. `enabled: false` returns from
    the effect before the `hasCamera()` probe, so nothing is ever acquired. Same rule
    `WalkInIdentityStep`'s `armed` flag follows.
  - The page subtitle is the client's own line, verbatim: **"Scan the QR code of the
    visitor pass or search it."**
- **A SEARCH HIT THAT CANNOT BE CHECKED IN IS STILL FULLY LEGIBLE** (client instruction,
  2026-08-17: searching by mobile number "should not be grayed out, it should be properly
  showing all the details"). `CheckInMatchCard` carried `opacity-50 pointer-events-none`
  when `disabled`, and the dimming was the wrong tool: what is unavailable is the
  CHECK-IN, not the record, and this search deliberately spans every status precisely so
  a guard can find out what became of a pass — half-fading the answer hides the times,
  the phone number and the host exactly when they are all the row has to offer. The
  disabled state now drops the click AFFORDANCE (`CRISP_CARD` instead of
  `CRISP_CARD_INTERACTIVE`) and keeps full contrast. `pointer-events-none` went with the
  opacity: it also blocked selecting the phone number to copy it, on the one card built
  to show it. The row stays non-actionable by construction — no Check In button renders
  and `onSelect` is gated.
  - **The three instants are each on their own line and each named**: Approved at /
    Checked in at / Checked out at, every one a `formatDateTime` carrying its own date.
    Checked Out used to be an 11px sub-line hanging off Checked In, which made the fact a
    guard is actually asking about — has this person already left? — the smallest text on
    the card.
  - **"Approved at", not "Pre-approved at"**, though the client asked for the latter by
    name. Every one of these surfaces already prints the desk in a badge or a Type of
    Visitor field directly above, and the same word twice on one card is the
    duplicate-render rule `VisitorDetailsOrigin.test.tsx` actively enforces. The row's
    job is WHEN; the desk is already stated.
  - **`VisitorTimelineCard` shows a guard the APPROVAL instant now too.** It was behind
    `showAudit`, which is false for a guard, so the popup could say a visitor was approved
    without ever saying when — and a guard challenged on why somebody was let in needs the
    moment the clearance was given. What is left behind `showAudit` is **Duration**, and
    that is the right thing to leave there: it is not a fact about the visit, it is a
    running subtraction. Consequence: an approved visitor who has not arrived now gets a
    Timeline card holding that one stamp, where before a guard got none.
- **A REFUSED SCAN SHOWS THE RECORD, NOT A RED LINE** (client instruction,
  2026-08-17: *"as soon as he scans it, it should show up all the details about the
  visitor"* — name, phone, company, reason, check-in time, scheduled time, walk-in
  vs pre-approved, person to meet, department, status). A pass that resolved but
  failed its gate used to render a one-line banner plus the visitor's name and
  nothing else, so "This visitor is already checked in" was the start of a question
  the guard had no way to answer: checked in *when*, to see *whom*, and is the person
  in front of them even the right one.
  - `GuardQRScan` gained an **optional** `onBlocked(visit, reason)`. Optional
    matters: without a handler it keeps its inline banner, which is all
    `CheckInScanGate` (a modal with no room for a record) wants. `ScanPass` supplies
    one and swaps the scanner for the record.
  - **The gate decision did not move.** `evaluateQrVisit` still decides, and
    `onBlocked` is never reached for a pass that may proceed. Only the presentation
    of a refusal changed. The refused view has no photo step and no Check In button.
  - It renders the **same `CheckInVisitorSummary`** the accepted path renders, built
    by the **same `visitToMatchItem`** — so the record read off a refused scan is
    field-for-field the one read off an accepted scan. The refusal changes what the
    guard may DO, never what they are TOLD. Record first, refusal underneath: a guard
    holding a scanner identifies before adjudicating.
- **The fields the scan and the search were missing were a RENDERING gap, not a data
  gap.** `MatchItem` already carried `visitorPhone` and `status`; neither was ever
  drawn. Added 2026-08-17: `CheckInVisitorSummary` gains Phone, a Status pill (from
  `STATUS_STYLES`, so the word and colour match every list on the board) and
  conditional Checked in at / Checked out at rows; `CheckInMatchCard` gains the phone
  and the arrival stamps; `SearchResultCard` gains Type of Visitor (via
  `lib/visitOrigin.ts`, unconditional — the status pill only names the origin for
  `approved`) and splits its one **"Date & Time"** row, which fell back from
  `scheduled_for` to `created_at` and so meant *the booked slot* on a pre-approval
  and *when the request was raised* on a walk-in — two facts under one label, on the
  card whose job is telling one visitor from another. Now `Scheduled` (empty reads
  **"NA"**, matching `COLUMN.scheduled`), `Registered`, and conditional
  `Checked In` / `Checked Out`.
  - `MatchItem` gained `checkedInAt` / `checkedOutAt`, both null on the ordinary
    arrival — that is the point of the scan — and populated on the **re-scan**, which
    is the case the whole change exists for. Every construction site had to be fed:
    `qrMatchItem.ts` and both branches of `checkInMatches.ts` (the recurring branch
    gets nulls, having no visit row yet).
  - **The guard's search needed no work.** `/search` and `/guard/search` are one
    component and already opened `VisitorDetails`, which carries every requested
    field. **The HOD reaches the identical page** — `/search` is in `ROLE_ROUTES.hod`
    and is wired to the top bar in `AppShell` — so "the same for the HOD" was already
    true and only the timestamp gate below was in the way.
- **A guard now sees ARRIVAL times but still not AUDIT times** (client instruction,
  2026-08-17, partially reversing 2026-08-13). `VisitorTimelineCard`'s single
  `showTimestamps` prop is split into **`showArrival`** (Checked In / Checked Out —
  true for every role) and **`showAudit`** (Approved / Duration — still false for a
  guard). 2026-08-13's point survives: a guard is not auditing state changes. What it
  cannot survive is hiding when a visitor walked in, which is the question a guard is
  most often asked. The card renders nothing at all when this viewer may see no stamp
  and there is no rejection reason, so a guard's popup does not end on an empty box.
  The rejection reason is gated by neither, unchanged.
- **The two arrival routes are two destinations.** A visitor either was booked in
  advance or was not, and a guard is doing one or the other:
  - `/guard/pre-approvals` is the **pre-booked** desk. `CheckInPanel` (QR gate,
    pre-approved match search, ID scan, photo, Check In) renders there. Everything it
    resolves is a visitor who was booked ahead, which is exactly the population that
    page already lists. It **lists** today only — the Upcoming and All filters were
    removed, because a guard can only check in someone due today and a future booking
    reads too easily as an arrival that is due now. `usePreApprovals` still accepts
    the other filters for callers that need history.
  - **BROWSING is today-only; SEARCHING is not.** `CheckInPanel.loadData` used to
    `.filter(isDueToday)` on the fetch, which silently made "what is listed" and
    "what is findable" the same set. On 2026-08-11 all four open pre-approvals in the
    live database were booked for later days, so the candidate list was empty and
    **every** search returned "No match found" — then offered to raise a walk-in
    request for a visitor who was standing there holding a valid pass. The fetch is
    now unfiltered and `buildMatchItems` decides: empty query → due-today rows only;
    non-empty query → every open approval, with `dueToday: false` on the ones that
    are not due. Those come back **disabled, not hidden** — `CheckInMatchList`
    computes `disabled = isCheckedIn || expired || !m.dueToday`, and the card prints
    `formatDateTime` rather than `formatTime` for them, because a bare "03:30" on a
    hit for another day reads as an arrival due now. Seeing a pass and being allowed
    to honour it early are two different permissions. `buildMatchItems` takes an
    injectable `now` so this stays testable; `visitToMatchItem` computes `dueToday`
    the same way, so the scan path and the search path cannot disagree.
  - **Search spans EVERY status, because "does this pass exist?" is the question.**
    `buildMatchItems` can only filter rows already fetched, and that fetch is open
    statuses only — so a pass already used, rejected or swept closed was never in the
    browser to find. `lib/searchVisits.ts` (`searchAllVisits`) is the server-side half:
    on a typed query it matches `ref_number`, visitor name and visitor phone with
    ILIKE across **all nine statuses**, deduped, newest first, capped at
    `VISIT_SEARCH_LIMIT`. It deliberately does **not** route through
    `parseSearchQuery` — that requires a *complete* ref and a *valid* phone, so a
    partial `VIS-20260804` would be classed as a name and find nothing. `%` and `_`
    are escaped, or a guard typing `%` matches everything.
    `lib/useVisitHistorySearch.ts` debounces it, drops rows the panel already shows
    (one pass must never render twice) and guards the response race with a request
    id. Results are **non-actionable by construction**: `isCheckableStatus`
    (`lib/checkableStatus.ts`, a full `Record<VisitStatus, boolean>` so a new status
    forces a decision) gates `disabled` alongside `dueToday`. That second test is not
    redundant — a `rejected` visit scheduled for today has no `checked_in_at`, so
    `isDueToday` returns **true** for it. Finding a closed pass tells the guard what
    became of it; it never offers to reopen it.
- **A `datetime-local` value is IST and must be converted before it is written.**
  `lib/istDateTime.ts` — `istLocalToUtcIso` / `utcToIstLocalInput`. The input yields a
  bare wall-clock string with no timezone; `PreApproveForm` passed it straight to
  `pre_approve_visitor_v2`, where Postgres cast it in the session timezone (**UTC**,
  verified live). An HOD booking 10 PM stored `22:00Z` and every IST screen read back
  03:30 the *next* morning — every booking shifted **+5h30m**, which is why live rows
  `VIS-20260811-0007`/`-0009` sat on Aug 12. Convert before **validation too**, not
  just before the write, or `validatePreApproval` compares a different instant than
  the one stored. It must never use `new Date(localString)`: that reads the *browser's*
  timezone, and this deployment is IST regardless of where the laptop is. Parse with a
  regex + `Date.UTC`, then subtract `IST_OFFSET_MS` — now exported from
  `lib/visitExpiry.ts`, still **the one place** the offset is defined.
  - `/visitors` is the **walk-in** lane, titled "Walk-in Visitors". `Mode` is
    `'walkins' | 'walkinApproved' | 'inside'`, defaulting to `walkins` — the three
    stages of a walk-in's life at the gate, in order.
- **A walk-in registration REQUIRES an ID scan and a photo** (client instruction,
  2026-08-16). `WalkInRequest` used to insert `photo_path` / `photo_data` as null and
  treat the ID scan as an optional convenience button, on the reasoning that at
  registration nobody yet knows whether the host will say yes. That left the HOD deciding
  on a name the guard typed, with nothing tying the request to the person actually at
  reception. `WalkInIdentityStep.tsx` owns both captures; the submit button is disabled
  until `scan` and `photoBlob` both exist, and `handleSubmit` re-checks them so an
  Enter-key submit cannot skip the step. The photo uploads via `uploadPhoto` **before**
  the visit row is inserted, so a `pending_approval` row never reaches an approver
  without the face it is asking them to clear. **ONE CAMERA AT A TIME**: `PhotoCapture` is
  unmounted while `IdScanOverlay` is open, the same rule `CheckInPhotoStep` and
  `GuardWalkInApproved` follow. `GuardWalkInApproved` still captures its own photo at the
  moment of entry and that is not duplication — this one records who *asked*, that one
  records who *walked through*.
- **The walk-in form's camera is OFF until the guard asks for it** (client report,
  2026-08-16). `PhotoCapture` starts its stream on mount, and a submitted request
  remounts the identity step (`WalkInRequest` bumps `identityKey` to clear the previous
  visitor's frozen frame) — so on `/guard/walk-in`, where the form IS the page, the
  webcam light came straight back on and stayed lit at an empty form pointed at whoever
  was next in the queue. `WalkInIdentityStep` holds an `armed` flag: false on mount and
  after every accepted photo, so the remount cannot request the device, and attaching a
  photo unmounts `PhotoCapture`, which is what releases it. The control mirrors "Scan ID
  card" directly above it. ONE CAMERA AT A TIME still holds — `live = armed && !scanOpen`,
  so the scan overlay always wins.
- **`walkinApproved` is a required tab, not a nicety.** `CheckInPanel` searches
  pre-approvals only, so once it moved off `/visitors` an approved walk-in had no
  route into `checked_in` at all. `GuardWalkInApproved.tsx` is that route: it captures
  the photo at the gate (WalkInRequest deliberately inserts `photo_path`/`photo_data`
  as null, since at registration nobody knows yet whether the visitor is coming in)
  and `Console.checkInWalkIn` writes the update, handling the migration-060 conflict
  via `isAlreadyInsideError`.
- **No-shows are swept at end of day, by a job that actually runs.** Migration **061**
  (applied live 2026-08-04) changed `mark_no_shows()` from "grace_period_minutes past
  the slot" — which killed a visit while the visitor was still walking to the gate — to
  "its scheduled moment has passed, and it was never checked in". It also installed
  `pg_cron` and scheduled `sweep_no_shows_daily()` at **`30 18 * * *` = 18:30 UTC =
  00:00 IST**. `mark_no_shows()` had existed since 036 but pg_cron was never installed,
  so it had never executed once. The timezone decision lives in the cron schedule, not
  in the SQL, so it is adjustable in one place.
- **`sweep_no_shows_daily()` must set its own JWT claim.** A cron session has no JWT, so
  `auth.jwt()` is null, `is_service_role()` is false, and `enforce_visit_update_rules`
  rejects the status change outright. The function does
  `set_config('request.jwt.claims','{"role":"service_role"}', true)` — transaction-local,
  so it cannot leak. Remove that line and the nightly job fails silently on every row.
  It is `revoke`d from anon/authenticated: `mark_no_shows()` (role- and
  department-scoped) stays the human entry point.
- **`no_show` and `expired` are two outcomes, split on whether an appointment
  existed.** Migrations **065**–**066** (applied live 2026-08-11). 061's sweep had two
  holes that made it unreachable for most rows: `and scheduled_for is not null` skipped
  every walk-in (that path never sets `scheduled_for`), and `status = 'approved'` alone
  skipped `walkin_approved` entirely. Seven approvals were live and un-sweepable, the
  oldest from 2026-08-01, still offering themselves for check-in ten days later — three
  of them visible forever in the guard's "Approved, waiting to enter" list, because
  `Console.loadVisits` is deliberately unbounded for open statuses. **An open-ended list
  and a sweep that cannot close it are two halves of one design; never ship one alone.**
  The rule now:
  - `scheduled_for IS NOT NULL` and its day has ended → **`no_show`**. An appointment
    was missed. This is a fact about the visitor and the host who booked them, and it is
    the number a report should show.
  - `scheduled_for IS NULL` and its creation day has ended → **`expired`**. Nothing was
    missed; an approval lapsed unused. Every walk-in lands here, as do pre-approvals
    created before `validatePreApproval` made `scheduled_for` mandatory. Filing those as
    no-shows would invent an appointment that never existed and corrupt the metric.
- **The timezone lives in ONE place: `vms_day_start_ist()`.** 061 put it in the cron
  schedule (`30 18 * * *` = midnight IST) *and* left the SQL saying `now()`; the rule was
  only correct because the two happened to agree, with nothing linking them. Since 066's
  predicate is self-contained and idempotent, the schedule no longer carries the rule, so
  migration **072** made the job **hourly** (`sweep-no-shows-hourly`, `40 * * * *`). The
  schedule now decides only how promptly a finished day is swept. The client half is
  `IST_OFFSET_MS` in `lib/visitExpiry.ts` — that pair is what to keep in step; there is no
  third copy. **The day END lives in one place too: `vms_day_end_ist()` ↔ `istDayEnd`
  (22:00 IST, migration 075)** — the start pair above and the end pair must move
  together, never one side alone. The function still bears the name
  `sweep_no_shows_daily()`; renaming a live
  function means re-granting and re-pointing the job for no gain.
- **`visits.expected_departure` is what makes a multi-day visit legible.** Migration
  **073**. 067's overstay sweep shipped unscheduled precisely because nothing could
  distinguish a contractor legitimately on site for two days from a check-out somebody
  forgot — any fixed threshold is wrong for one of them, and guessing is not a design. The
  rule is now a deadline, not an interval:
  `coalesce(expected_departure, checked_in_at + N hours)`, mirrored exactly in
  `isOverstaying`. **Optional on purpose** — requiring it would put a second mandatory
  datetime in front of every routine meeting, and an approver who does not know would type
  something false, which is worse than null. `visits_departure_after_arrival` CHECK plus
  `validatePreApproval` reject a departure at or before the arrival. The QR is anchored to
  the **departure** day (`vms_day_end_ist(coalesce(expected_departure, scheduled_for))`),
  or a three-day contractor's pass dies on night one — 071's bug with a longer fuse.
- **`pre_approve_visitor_v2` had to be DROPped to gain a parameter**, since adding one
  creates an overload rather than replacing, and PostgREST then refuses the call as
  ambiguous. The ACL does not survive a drop, and `CREATE FUNCTION` grants EXECUTE to
  **PUBLIC** by default — which the original did not carry. 073 re-grants the original four
  roles and revokes PUBLIC explicitly. Check `\df+` after any RPC signature change.
- **A check-out can be undone for 15 minutes, by the guard who made it.** Migration
  **074**. `checked_in -> checked_out` was a one-way door: a guard clicking the wrong row
  left a visitor who is still in the building recorded as gone, with no route back, and
  migration 060 then makes the obvious fix (check them in again) create a *second* visit
  row for one continuous presence. The window is the restriction — an admin-only undo was
  rejected because admins have no route to visitor records at all, so the capability would
  -- STILL TRUE AFTER 2026-08-17, though the reason narrowed: the admin console now
  READS visitor records, but every one of its tabs is read-only, so an admin-only undo
  would still have nowhere to be invoked. The rest of this note is unchanged. --
  have had nowhere to be invoked. The undo nulls `checked_out_at`/`exit_verified` rather
  than annotating them (the visitor never left), and deliberately does **not** re-stamp
  `checked_in_at`. The sweep's auto-closed rows get no exemption — revisit that only when
  067's sweep is actually scheduled.
- **The pre-approval pass says SCHEDULED AT and VALID UNTIL, and neither is clipped**
  (client report, 2026-08-15). `PreApprovalPass` had one row, "Valid For", carrying
  `scheduled_for` — mislabelled, because when a visitor is expected is not how long their
  pass works, and 071/073 set `qr_expires_at` to the end of the **departure** day, which
  for a multi-day contractor is days later. It now prints both, resolved through the same
  `qr_expires_at ?? expected_departure ?? istDayEnd(...)` ladder `CheckInBadgeRail` climbs,
  so the HOD's copy and the guard's copy cannot disagree about when a pass dies. The block
  is **one column, not two**: at `text-xs` inside a 320px card, half the width could not
  hold "14 Aug 2026, 10:30 am". `PassField` uses **`break-words`, never `truncate`** — a
  clipped date is indistinguishable from a complete one, and there is no width worth that.
  The **company name** on the pass was invisible in dark mode for the inverted-scale reason
  below: its value was `text-navy-700 dark:text-navy-200`, so the word "Company" rendered
  and the company itself did not.
- **The pass can be sent to the visitor's WhatsApp, and it needs no Meta account.**
  Added 2026-08-17 on the client's question *"can the HOD forward the QR / visitor
  pass directly to the mobile or WhatsApp number of the visitor?"*. Before this, the
  only ways out of `PreApprovalPass` were Download Image and Download PDF — both of
  which end with a file in the HOD's downloads folder, which is not where the visitor
  is. **Send on WhatsApp** is now the primary action on that card. `lib/sharePass.ts`.
  - **TWO mechanisms behind one button, and neither is optional — they do different
    halves of the job.** `navigator.share({ files })` carries the **file**: the OS
    share sheet opens with the pass PNG attached and the HOD picks WhatsApp. `wa.me`
    carries the **recipient**: click-to-chat opens the visitor's own chat with the
    details prefilled, and it **categorically cannot attach anything** — there is no
    file parameter in the click-to-chat spec and never has been. The sheet knows the
    file but not the recipient; the link knows the recipient but not the file.
    Fallback order is sheet → link, and the link path **downloads the PNG alongside**
    because otherwise the QR never reaches the visitor at all.
  - **TRANSIENT ACTIVATION IS THE TRAP, and it is why `dataUrlToFile` is synchronous.**
    `navigator.share` throws unless it is called inside a live user gesture, and an
    `await` in front of it spends that gesture. `fetch(dataUrl).then(r => r.blob())`
    is the tidier spelling and is exactly what must not be used here — the decode is
    hand-rolled `atob` + `Uint8Array` so nothing is awaited before the share call.
    There is a test pinning the signature, not just the output. **Do not put a photo
    fetch, a canvas re-encode or a PDF build in front of that call.**
  - `canShare({ files })` returns **false**, never throws, where unsupported —
    Firefox has no file sharing at all, and neither does any http origin. That is the
    gate. Desktop Chrome/Edge work but depend on registered OS share targets.
  - **A wrong recipient is worse than none.** `waPhone` runs the number through
    `normalizePhone` and puts `91` back on a 10-digit Indian mobile; anything it
    refuses yields `null`, and the link then opens WhatsApp's **contact picker**
    rather than a stranger's chat with a visitor's name already typed into it. The
    caption under the button names the number it is about to open, or says there
    isn't one.
  - **No CSP change was needed.** Link/`window.open` navigation to an external origin
    is not governed by any shipped CSP directive — `form-action` covers only form
    submissions, and `navigate-to` was dropped from CSP3 and never shipped. The app's
    `index.html` meta CSP has neither.
  - **This is a shortcut to a human action, not automated messaging**, which is also
    why no TRAI/DLT registration applies: that framework governs bulk commercial
    traffic over telecom operators, not a person forwarding one message from their
    own account. **An automated send is a different project** — Meta Business
    account, verified sender number, an approved *utility* template (media-header
    templates need the image at a public HTTPS URL or an uploaded media ID) and a new
    edge function beside `notify-host`. Utility messages are cheap in India (~₹0.11–0.15
    each at Meta's 2026 rates, plus any BSP markup), so the cost is not the obstacle;
    the account, the number and the template approval are.
- **A popup's close (×) must never be able to overlap its own header.**
  `ModalCloseButton` takes an **`inline`** prop (added 2026-08-15, client report). The
  default is still `absolute top-4 right-4`, which is right when the × floats over a tall
  banner or an image with empty space to spare. It is WRONG on a compact header row that
  already has content on its right: the button is out of the flow, so the layout reserves
  nothing for it and the text runs underneath. That is what happened to the **notifications
  popup**, whose `justify-between` header put "Mark all read" 4px from the ×. With `inline`
  the button is a normal flex child and collision is structurally impossible at any width,
  rather than something a padding value has to keep guessing at.
  - For the absolute variant the rule is arithmetic, not taste: the button spans **16-52px
    from the right edge**, so anything on the modal's first row needs **`pr-14` (56px)** —
    `pr-8` is not enough, which is what `CardReturnConfirm` had. A centred heading takes
    symmetric `px-8` so it stays centred and still clears the button.
- **The visitor popup's identity band is tinted in LIGHT MODE ONLY** (client report,
  2026-08-16). The 2026-08-15 "one surface, top to bottom" fix flattened the header row
  onto the modal's own glass, which was right for the complaint it answered — a *light*
  patch behind the visitor's name on a *dark* panel. In light mode that same flattening
  left the photo and the name white-on-white with only a hairline under them, so the
  first thing the popup shows had no edge at all. The header row and the ID tab's
  photo/verdict block both carry `bg-surface-100/70 dark:bg-transparent`: the light end
  gains the step, dark mode stays exactly as the client accepted it. Never give either
  block a tint that also paints in dark mode.
- **The visitor popup's close button is OUTSIDE the scroll container.** `.modal-content`
  is the scroller; with the cross inside it, the guard's copy of the popup — the tallest,
  since a guard also sees the ID document, timeline and pass — scrolled the cross out of
  reach, and at rest its right edge sat under the scrollbar gutter. `VisitorDetails` now
  sets `!overflow-hidden` on the modal, puts the button directly on it, and scrolls an
  inner `flex-1 min-h-0 overflow-y-auto` child. `min-h-0` is load-bearing.
- **The day boundary is `public.vms_day_start_ist()`, not `now()`.** 061 put the
  timezone in the cron schedule and left the SQL saying `scheduled_for < now()` — correct
  only if the job fires at exactly the right instant. `mark_no_shows()`, the HOD-callable
  entry point, therefore still had 052's bug: run by hand at 14:00 it killed a 10:00
  visit whose visitor was mid-journey. Both paths now share `close_stale_approvals()`,
  whose predicate means "the day containing this visit's moment has ENDED" — true
  whenever evaluated, so it is safe to run at any hour and is idempotent (verified live:
  second run returns 0). `src/lib/visitExpiry.ts` is the client mirror; keep the two in
  step, every rule there has a test.
- **A grace period may write a NOTIFICATION and never a status.** Migration **070**
  schedules `nudge_overdue_visits(120)` hourly: a booked visitor 2h past their slot gets
  the *host* a `visit_overdue` notification, and the visit stays fully checkable-in all
  day. This is what 052 should have been. In-app rather than email because **`pg_net` is
  not installed**, so no scheduled job on this project can make an HTTP call — the
  `notify-host` edge function is unreachable from SQL. It inserts once per visit
  (`not exists` on `related_id`) and stops at the day boundary, since past that the
  nightly sweep has already filed the absence and a second message is noise.
- **Overstays: `sweep_overstays()` is installed but DELIBERATELY NOT SCHEDULED.**
  Migration **067**. Nothing closed a visit the guard forgot to check out, so
  `status = 'checked_in'` — the list you hand a fire marshal — drifts wrong in one
  direction only, and migration 060's unique index means one uncleared row blocks that
  phone number from ever checking in again. The live mechanism is the guard dashboard's
  **Overstaying** tile (`isOverstaying`, default 12h from entry, measured from entry
  rather than a wall clock so a normal 21:00→08:00 stay does not trip it). A guard who
  acts on the tile records `exit_verified = true` — a witnessed exit. The sweep can only
  ever record `exit_verified = false`, which is an admission, not an observation: prefer
  it last. To enable, uncomment the one-line `cron.schedule` in 067.
- **`exit_verified` means "did a human witness this exit".** `Console.logExit` sets it
  true; `sweep_overstays` sets it false. Never auto-close a visit in a way that reads
  identically to a real check-out — that launders "we lost track of this person" into a
  claim about where they went. `checked_out_at` on an auto-closed row is the moment we
  gave up, not the moment they left.
- **Expiry is END OF DAY on the client too.** `CheckInPanel.isExpired` used
  "more than 30 minutes past `scheduled_for`", which turned away a visitor stuck in
  traffic — the pass died mid-morning while they were on their way and the guard could
  not revive it. It now calls `isVisitExpired`, which since 075 means "the IST day
  containing the visit's moment has ENDED (22:00)" — deliberately not "the moment is
  before today's close", which is true of every moment of today and would expire
  everything mid-day, unlike the sweep, which only runs after close.
  `CheckInPanel.loadData` also filtered on
  `created_at` being today, so the *ordinary* case — booked yesterday, arriving today —
  never appeared in the check-in list at all; it now fetches open approvals unbounded and
  filters with `isDueToday`, the same predicate the sweep uses.
- **"Today" is an IST day, not a UTC one.** `new Date().toISOString().slice(0, 10)` is
  the UTC date, so between 00:00 and 05:30 IST the app thought today was yesterday: a
  visit booked for 01:00 IST was filed under the previous day and was invisible on the
  morning it was due. Use `istDateKey` / `istDayStart` from `lib/visitExpiry.ts`.
- **Open visits are never date-bounded.** `Console.loadVisits`, `useTodayVisits` and
  `useTodayVisits` all used a bare `created_at >= today` window, which silently dropped
  unfinished work at midnight: a walk-in registered at 23:50 and approved at 00:05 was
  approved into an empty list, a visitor still inside from the previous evening could
  not be checked out, and a pre-approval booked last week for today never appeared.
  The console now ORs in `status.in.(pending_approval,walkin_approved,checked_in)`, and
  the two dashboard hooks OR in `scheduled_for` within today. Keep the hooks in step —
  the count and the drill-down list must come from the same window. `useTodayVisits` also
  ORs in the open statuses unbounded, so a visitor still inside from last night is
  counted as inside; the invariant survives, because every row with
  `checked_in_at` is either `checked_in` or `checked_out`.
- **A photo is mandatory on every check-in path.** `CheckInPanel` gates it structurally
  (the confirm step does not render until a photo exists), `GuardWalkInApproved`
  disables Confirm without one, and `VisitorForm.checkInPreApproved` — which used to
  flip status to `checked_in` with no photo at all — now refuses and uploads one. The
  photo is the record of who actually walked in; an approval only says who was expected.
- **There is no Recent Activity feed on the guard dashboard (deleted 2026-08-14).**
  It had two lives — once fetched with its own query and subscription beside the KPI
  tiles, then rebuilt as a pure function over the day the tiles already counted — and
  went with the rest of the old dashboard implementation when that turned out to be
  imported by nothing. `lib/recentActivity.ts` and `DashboardActivity.tsx` are gone. The
  rule that outlived it is the one worth keeping: **if a panel needs a row the tiles do
  not have, widen `useTodayVisits`; never add a second query.** Two answers to "what
  happened today" on one screen, with nothing forcing them to agree, is the same defect
  the tile-vs-drilldown mismatch was.

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
  the Walk-ins tab is walk-in-only. The segment itself carries no exit action now
  (display-only since 2026-08-14) — check-out happens on the **Entry & Exit** tab
  (`/guard/inside-now`), which owns the card-return gate; `/guard/dashboard` reads,
  it does not act. Filtering pre-approved arrivals out of the list would make them
  invisible, which is the same problem in the other direction.
- **Daily Staff and the Watchlist page are deleted (2026-08-15); the Kiosk and
  Search remain ROUTABLE.** `/guard/daily-staff` (its query selected columns that
  do not exist on `visits`, so it could never show a row) and `/guard/watchlist`
  (a browsable copy of the blacklist gate that fires inside check-in) were
  removed from `ROLE_ROUTES.guard` outright, and `routeProtection.test.tsx`
  asserts both are now forbidden. `/kiosk` and `/guard/search` remain on purpose —
  the kiosk runs on its own device. They left the sidebar because neither is
  visitor check-in (Search duplicated lookups the Visitors tabs already cover),
  not because access was revoked. Do not "tidy up" `ROLE_ROUTES` by deleting
  those two.
- **The guard's second tab is "Entry & Exit" (`/guard/inside-now`).** "Live Queue" until
  2026-08-14, "Inside Now" until 2026-08-15, both renamed on client instruction. It lists
  everyone who has been through the gate: visitors still inside, **plus visitors who have
  checked out since the IST day began**. Neither older name survived — "Live Queue" named
  the dashboard's **Live Arrival Queue** instead (visitors still waiting, who are not on
  this page at all), and "Inside Now" stopped being true the moment the list carried
  people who had left. Both `/guard/inside-now` and `/guard/live-queue` stay routable: they
  are in guards' bookmarks and in every `?verify=` link the dashboard has emitted. The FILE
  is still `GuardLiveQueue.tsx` — renaming a component half the guard surface imports buys
  nothing the route and the label do not already say.
  - **It has its own hook, `lib/useGateActivity.ts`, and that is not duplication.**
    `useTodayVisits` could not be reused two ways over. It feeds the dashboard KPI tiles,
    where a tile's count is the length of the list it opens, so widening its window
    silently changes every tile; and its window was **wrong for this page anyway** — a
    visitor who came in at 21:00 yesterday and left at 09:00 today was neither created
    today nor scheduled today, and `checked_out` is not one of the open statuses it carries
    unbounded, so the one exit most likely to be asked about, the one that crossed
    midnight, is exactly the row that would have been missing. The window is stated
    directly instead: `checked_in_at IS NOT NULL` **and** (`status = 'checked_in'`
    unbounded **or** `checked_out_at >= istDayStart()`). `istDayStart`, never
    `${dayKey}T00:00:00Z` — a UTC midnight drops every exit made between 00:00 and 05:30
    IST.
  - **Still-inside rows sort ABOVE departed ones**, inside by arrival (oldest first —
    longest on site, closest to an overstay), departed by exit (most recent first). They
    are the only rows a guard can still act on; a departure above them buries the page's
    only action. The count line reads `N inside · M left today`, two numbers rather than a
    total, because a single figure answers neither question the tab is opened with.
  - **TWO LANES, not one merged list** (client instruction, 2026-08-15).
    `EntryExitTabs.tsx` is a `.gate-tab-bar` segmented control toggling **Checked
    In** / **Checked Out**; only one lane's rows render at a time, defaulting to
    the people still on site (the only rows a guard can act on). A guard opens
    this tab already knowing which of the two they are asking about, and
    interleaving them meant scanning past the group you did not want. **The count
    lives ON each tab** — a lane's number is the length of the list that lane
    opens, the `guardTiles.ts` rule again — so the old
    `N inside · M left today` summary line is gone; two statements of one fact on
    one screen is what that rule exists to prevent. Each lane also carries its own
    empty state (`emptyMessage` on `LiveQueueTable`), because "nobody is inside"
    and "nobody has left yet" are different facts and were the same sentence.
  - **The table carries BOTH times, in an `In` column and an `Out` column, each with
    the DATE as well as the time** (client instruction, 2026-08-17). They were
    `formatStamp`, which prints a bare time on a today row and pays for the date only on
    an older one — and the two shapes are indistinguishable at a glance, so a guard
    scanning the column could not tell a today row rendered short from an older row whose
    date they had skipped past. This list carries earlier days BY DESIGN (anyone still
    inside is here regardless of when they arrived; an exit that crossed midnight is the
    row most often asked about), so it is now `formatDateTime` on every row. Same change
    to `lib/dashboardColumns.ts`'s shared `stamp`, which is every time cell on the guard
    AND HOD boards — one rule, both surfaces. The cells are `whitespace-nowrap` and
    `LiveQueueTable`'s wrapper is `overflow-x-auto` rather than `overflow-hidden`: nine
    columns can outgrow a narrow window, and a clipped exit time is indistinguishable
    from one that was never recorded. A visitor
    still on site shows an **em dash** under Out, never a blank cell: blank reads as "not
    recorded", and here it means "still here", which is precisely the distinction being
    looked for. A `checked_out` row offers no action at all — a grey "Left" tick where the
    Check Out button sits on an inside row — because the only action this page has is the
    exit and it has already happened.
  - **This page starts no check-in.** The "N arrivals still at the gate" banner and the
    photo + OCR overlay it was the only caller of were removed 2026-08-14. Check-in starts
    on the dashboard's Live Arrival Queue — one route in, not two that can disagree.
  - **Notify Host writes a NOTIFICATION, never `visits.remarks`.** It used to append
    `' - host notified on arrival'` to that column and treat the substring as a flag.
    `remarks` is the walk-in note an **HOD** reads when deciding an approval (migration 068)
    and Reports prints it, so guard bookkeeping landed inside a colleague's approval card;
    and a magic substring in free prose is not a flag, since a genuine note can contain it.
    `lib/notifyHostCheckIn.ts` inserts one `visitor_checked_in` row, idempotently.
    CheckInFrame's "Host Notified" step is now `status === 'checked_in'` alone — every
    check-in path already notifies the host (`lib/checkInFlow.ts`), so a checked-in visit IS
    a notified host.
  - **There is NO "Check-In Details" card on the frame** (removed 2026-08-15, client
    instruction). It listed Visitor Name, Company, Purpose and Host — the exact four
    columns of the Entry & Exit table directly above it, on the row the guard clicked to
    open the frame. That is the no-duplicate-renders rule: the same value twice on one
    screen makes the eye check whether the two agree. The **Badge type** control went with
    it, a disabled `<select>` holding one option, which was never a choice. The two things
    the table does *not* carry — the **vehicle number** and the **Notify Host** button —
    moved into the identity column, so nothing was lost with the card; an action was never
    a duplicate of a table cell. `CheckInFrameTimeline.test.tsx` fails on any `<input>`,
    any `<select>`, or the vendor/host/purpose appearing in the frame; it superseded
    `CheckInFrameLegibility.test.tsx`, which guarded that card's text wrapping. The frame
    is now two columns: identity (`xl:col-span-7`) and the pass rail (`xl:col-span-5`).
  - **The frame carries a VISIT TIMELINE: approval, check-in, check-out.**
    `lib/visitTimeline.ts` + `CheckInTimeline.tsx`, under the step tracker. The tracker
    says *whether* each stage happened; this says *when* — and the times were previously
    reachable only from Reports, a surface the guard has no route to. **The approval
    instant shows for a PRE-APPROVED visitor only** (client instruction): a walk-in's
    approval happened minutes ago at this gate in front of this guard, a pre-approval's
    happened elsewhere and possibly days earlier. It comes from `approvalTimestamp()`,
    never a column — there is no `visits.approved_at`.
    - **The DATE is printed once, the TIME on every entry** (client instruction). The three
      instants almost always fall on one day, so repeating it spends the line the guard
      reads fastest on the fact that varies least. The exception is not collapsed: when the
      entries span more than one IST day — an approval booked last week, a stay that
      crossed midnight — `date` is null and **each entry carries its own**. A bare "08:15
      AM" on a stay that crossed midnight is the same defect this file removed from every
      `scheduled_for` line. IST is explicit (`timeZone: 'Asia/Kolkata'`), not the browser's
      zone; this deployment is IST wherever the laptop is.
    - It renders **nothing at all** when no stage has a usable time yet, and drops an
      unparseable timestamp rather than printing "Invalid Date". Three em dashes would be
      three claims of "no time recorded" where the honest answer is that the visit has not
      reached those stages.
  - **"Identity verified" renders only when it is TRUE** — photo captured AND an ID type on
    the visitor. It used to render unconditionally, in green, with a green ring, for
    everyone. A claim about a person, on a screen someone may later be asked to account for,
    is the last place to hardcode a reassuring string: the same class of error as the "Gate
    Status: Operational" chip this file already rejects.
  - **The pass's validity is computed, never printed from a constant.** `qr_expires_at` then
    `expected_departure` then `istDayEnd(visitMoment(v))`. It read a hardcoded "Valid until
    06:00 PM", wrong in two ways at once: it ignored the row, and the IST day has ended at
    **22:00** since migration 075.
  - **No fabricated facts on the frame.** The Vehicle row printed `"(parking slot B-12)"`
    after every vehicle number; there is no parking allocation anywhere in the schema.
    Removed.
- **The Pre-Registered board is TODAY'S PRE-APPROVALS WHO HAVE NOT ARRIVED YET**
  (client instruction, 2026-08-15). `lib/preRegisteredBoard.ts` decides membership in one
  place — `isPreRegisteredArrival` = `status === 'approved'` **and** `checked_in_at IS
  NULL` **and** the slot is today (IST). Both constraints remove a whole class of row, and
  each was briefly wrong in the opposite direction earlier that same day:
  - **Today only.** The board was widened to every pre-registration ever made (with an
    all-history hook, `usePreRegisteredVisits.ts`, now **deleted**). That turned a list of
    people to expect at the gate into an archive. **Reports is the archive.** The page is
    back on `useTodayVisits`, which is read, never modified — it feeds the dashboard tiles,
    where a tile's count is the length of the list it opens.
  - **Not yet checked in.** The moment a visitor walks through they stop being an arrival
    and become a person on site — the **Entry & Exit** tab's subject, which carries their
    entry time, exit time and pass. A visitor on both boards is one visitor rendered twice,
    and the guard is left deciding which screen is authoritative.
  - **There is therefore NO "Arrived" chip.** An arrived visitor is not on this board at
    all, so a chip for them could only ever read 0. `PreRegisteredChip` is
    `'all' | 'arriving' | 'missed' | 'late'`; one predicate per chip, and a chip's badge is
    the length of the list it opens (the `guardTiles.ts` rule). The board once computed
    `arriving` as `all - arrived - missed - late`, which is only ever a count and could
    never have been a list.
  - **The pill has three states — EXPECTED / MISSED / LATE** — because `status =
    'approved'` already excludes every closed outcome. Do not re-add a status map for
    NO-SHOW / DEPARTED / DECLINED: those rows cannot reach this board.
  - **Today at a Glance is fed the same board**, so the two panels cannot describe
    different days, and the list sorts ascending — a list of people still to arrive is read
    forwards, soonest first.
- **The topbar clock is IST, and it is `text-navy-800`.** It was
  `text-navy-500 dark:text-navy-300` — the inverted-scale bug below, resolving to
  rgb(92,86,74) on the dark topbar, so the time and the date were rendered and unreadable
  (client report, 2026-08-15). It also read the **browser's** timezone while the visit
  timeline reads IST explicitly; the topbar is the worst place for those two to disagree,
  so both `toLocaleTimeString` and `toLocaleDateString` now pass
  `timeZone: 'Asia/Kolkata'`. The en-US format is unchanged — only the zone and the colour.
- **NEVER write `dark:text-navy-*` — the navy scale is INVERTED in dark mode.**
  `tokens.css` defines light `--c-navy-200: 227 223 214` (pale) and dark
  `--c-navy-200: 48 45 38` (near-black); the whole scale flips. So **one token number
  already resolves to the correct end in both themes**, and a pair like
  `text-navy-700 dark:text-navy-200` picks a *darker* colour in dark mode — the override
  is the bug, not the fix. This is what made the Pre-Registered card's vendor, host and
  slot-time lines read as invisible against the panel behind them (client report,
  2026-08-15). Pick a single step and let the theme resolve it: **700 for secondary text,
  800 for values a guard scans, 950 for the primary name**. The four Pre-Registered files
  carry no `dark:text-navy-` at all, by rule. (`dark:text-white` is fine — it is not on
  this scale.) The literal `text-[#9aa3af] dark:text-[#b7c0cb]` pairs in `LiveQueueTable`
  are an older workaround for the same trap; they are correct, just verbose.
- **Deny Entry is a real write, and the justification is MANDATORY** (client
  instruction, 2026-08-15). The control on the dashboard's ID Verification card was a
  `<Link to="/guard/dashboard">` — it navigated to the page the guard was already standing
  on, so pressing it did nothing at all. `lib/denyEntryFlow.ts` is the write and
  `DenyEntryConfirm.tsx` is the gate: **"Refuse entry" stays disabled until a reason is
  typed**, so the justification is the only route to the write rather than a warning that
  can be clicked past. The reason lands on `visits.rejection_reason` and Reports prints it.
  - **The permission is real, not improvised.** Migration 044's
    `enforce_visit_update_rules` explicitly allows `approved | walkin_approved -> rejected`
    for a guard ("Only Guard, HOD, or Admin can clear visitors"), and `log_visit_approval`
    writes a `visit_rejected` audit row stamped with `auth.uid()`. **That audit row is what
    keeps this honest**: `status = 'rejected'` normally means an HOD declined the request,
    and the `Declined` rule below forbids printing "entry denied" for an HOD's decision.
    The status is shared but the ACTOR is recorded, so a guard's refusal and an approver's
    decline stay distinguishable in the record — which is the part someone may later be
    asked to account for.
  - `canDenyEntry` is `approved | walkin_approved` only. A visitor already inside cannot be
    denied entry — they are through the gate, and the action there is a check-out; a
    `pending_approval` row has not been cleared by anyone, so there is nothing to overturn.
    The button does not render at all when the visit is not refusable: a control a guard
    cannot honour is worse than no control.
- **The dashboard's arrivals panel is "Expected Today", not "Live Arrival Queue"**
  (client instruction, 2026-08-15). The old name was wrong twice over, the same mismatch
  that renamed Inside Now: nothing in it is **live** (these are bookings, most of them
  hours away) and nobody is in a **queue** (a queue is people waiting at the gate — the one
  thing every row shares is that the person is absent, which is exactly why they have no
  check-in time). It **deliberately shares its name with the KPI tile above it**, because
  it is literally the same predicate as `TILE_FILTER.expected` — the same list at two
  altitudes, a number to glance at and the rows with names and times. If that predicate
  changes, change it in `guardTiles.ts`; do not edit the panel's filter to match.
- **Dashboard reads, Console acts.** `/guard/dashboard` is situational awareness only;
  everything that changes a visit's state lives in `/visitors`. These two used to
  duplicate each other (both rendered an inside-list, both held their own realtime
  subscription) and a guard could not tell which was authoritative. Keep the split.
  **The two exceptions are both client-instructed**: Deny Entry (a mandatory-reason
  refusal write, `lib/denyEntryFlow.ts`) and **Verify ID**, which since 2026-08-15 is
  NOT a link to another tab but a button that renders the same check-in flow
  (`VisitorCheckInFlow`) IN PLACE, in a modal, with the ID scan overlay opening
  immediately (`autoScan` through `CheckInPhotoStep`). A button that says "Verify ID"
  must open the thing that verifies an ID — the earlier `<Link>` versions sent the
  guard to a tab where the scan was either absent (`?verify=` on the Entry & Exit
  frame) or one click deep. The modal uses the same flow as everywhere else, so the
  mutation is never a third hand-rolled copy.
  - **`IdScanOverlay` portals to `document.body` — never move it back inline.**
    The overlay claims `fixed inset-0 z-50`, which is only true at the document
    root. Inside the Verify ID modal (which carries `backdrop-blur-sm`), the
    `backdrop-filter` ancestor becomes the containing block for fixed
    descendants, so the "full-screen" scan shrank to the modal's `max-w-lg` box
    and scrolled with the modal's content — the camera looked broken (client
    report, 2026-08-15). All four phases render through the same
    `createPortal(..., document.body)`; Escape still binds on `window`
    (`useEscapeKey`) and the camera refs attach through the portal, so nothing
    else changes. `IdScanOverlay.test.tsx` queries the backdrop via
    `document.querySelector`, not the render container.
- **The guard dashboard is `GuardDashboardMain.tsx`, and it is the ONLY one.** A
  previous implementation (`DashboardSummary`, `DashboardActivity`,
  `DashboardQuickActions`, `DashboardDrilldown`, `DashboardTile`, `lib/recentActivity.ts`)
  survived the 2026-08-14 rebuild imported by nothing, while this file went on describing
  it as live — several hundred lines of dead code and a spec for a screen that did not
  exist. All of it is deleted. `pages/Guard/Dashboard.tsx` is a 17-line shell rendering
  `GuardDashboardMain`; the drill-down sheet is `KpiDrilldownSheet.tsx`. If you find a rule
  below about six tiles, a Recent Activity feed or Quick Actions, it is history.
- **`lib/useGateStats.ts` is DELETED (2026-08-14).** Moving the tiles onto
  `guardTiles.ts` took away its last importer, and a well-tested hook nothing calls is
  still dead code — the same thing that had just been cleared out of this dashboard. Its
  two load-bearing ideas were carried over rather than lost: the widened query window now
  lives in `useTodayVisits` (see below), and the `entered` vs `inside` invariant is
  asserted in `tests/unit/lib/guardTiles.test.ts`. Do not resurrect it to add a count —
  add a predicate to `guardTiles.ts`.
- **Every dashboard KPI tile drills down IN PLACE.** Clicking a count expands the matching
  cards directly below the tiles; clicking it again collapses it; clicking a different tile
  swaps the panel. **No tile is a `<Link>`** — reading the board must never cost you the
  board.
- **A TILE'S COUNT IS THE LENGTH OF THE LIST IT OPENS. There is no second rule.**
  `src/lib/guardTiles.ts` holds one predicate per tile (`TILE_FILTER`) and one slicer
  (`tileVisits`); `GuardDashboardMain` renders `drill[key].length` as the number and
  `drill[key]` as the panel. Before 2026-08-14 the number came from `useGateStats` and the
  list from a separately written inline `visits.filter(...)`, with nothing forcing them to
  agree — and they did not: "Pending Check-out" counted overstayers while its panel listed
  everyone inside who had a departure time set, so a tile reading 1 opened onto five cards.
  Never reintroduce a second source for a count. A new rule is one edit in `guardTiles.ts`
  and both halves follow.
- **The pending lane reads "Pending Walk-in Approvals"** (client instruction,
  2026-08-16). `pending_approval` is only ever reached from the gate's walk-in register —
  a pre-approval is created already approved and never passes through that status — so
  the old "Pending Approval" left a guard wondering whether a booked visitor could be
  sitting in it. One edit, in `PANEL_SPEC.pending.heading`: the tile's label IS the
  panel's heading.
- **The four tiles are Expected Today · Checked In · In Premises · Overstaying.**
  - `expected` is **a PRE-APPROVAL not yet through the gate** (`approved` with
    `checked_in_at IS NULL`). `walkin_approved` was in it until 2026-08-16 and is
    not any more — the host's yes IS the admission since 080, so a cleared walk-in
    belongs to `checked` below, and one visitor cannot be "not yet through the
    gate" and "came through the gate" on one board. It used to be
    `awaitingApproval + overdue` — unapproved walk-in requests plus approved visitors
    already running late — which omitted the ordinary case completely: a visitor booked for
    3pm, read at 10am, was in neither term, so the tile showed **0 on a fully booked
    morning**. `pending_approval` is deliberately excluded: nobody has cleared that person,
    and counting them as expected claims somebody did.
  - `checked` is `checked_in_at IS NOT NULL` **or `status = 'walkin_approved'`**
    (cumulative — everyone the gate admitted today); `inside` is
    `status = 'checked_in'` (live). Same rule as the `entered` vs `inside` note below, and
    just as load-bearing. The walk-in clause is a **client instruction
    (2026-08-16)** and it follows 080: the approver's click is the admission, so a
    host-cleared walk-in has been let in whether or not a `checked_in_at` was ever
    stamped — and a row approved before 080's function went live rests in that
    status permanently with a null timestamp (`VIS-20260816-0004`, Tinku Das, is
    one). Keyed on the timestamp alone the tile silently omitted exactly those
    visitors, who are in the building. The invariant becomes
    `checked === inside + departed + host-cleared walk-ins with no stamp`.
    **`inside` gets no such clause** — that is the list you hand a fire marshal
    and it stays exactly what the row says. The "Checked In" panel prints an em
    dash under Checked In for a stamp-less row: the approval instant is NOT
    printed there, because pre-080 an approval left the visitor at the gate, so
    reusing it would fabricate an entry time.
  - `overstaying` was labelled **"Pending Check-out"** until 2026-08-14. The number was
    always `isOverstaying`; everyone inside is pending check-out, so the old label described
    the In Premises tile beside it and left this one's real meaning — a check-out the gate
    probably forgot — unsaid.
- **`useTodayVisits` carries the open-status clause too.** It fetches created-today OR
  scheduled-today **OR `status in (pending_approval, walkin_approved, checked_in)`
  unbounded**. Without that third clause a visitor who came in
  at 21:00 yesterday and has not left drops out of the list at midnight while still being
  counted inside — the two hooks disagreed by exactly the people it is most dangerous to
  lose track of. Keep them in lockstep.
- **The dashboard follows a reference design, but only where the design was right.**
  Icon-plate KPI cards on a 4-wide grid. The palette is ours, not the mockup's: the
  reference is blue/green/purple, this app is Quest Mall gold and bronze, and a hue is only
  information if it means the same thing on every screen. Known divergence: these tiles are
  bespoke markup, **not** `components/KpiTile.tsx`, which the rule below calls the one KPI
  card. Consolidating them is a visual change and the client froze the visuals on
  2026-08-14 — do it when that freeze lifts, not before.
  - **No "Entry Denied" tile and no "Issue Pass" action.** See the `Declined` note
    below, and the no-badge-minting rule above.
  - **No gate name and no "Gate Status: Operational" chip.** There is no gates table,
    no per-guard gate assignment and nothing monitoring a gate's health, so both would
    be hardcoded claims the system cannot stand behind — and a status chip that is
    green because it is always green is worse than no chip at all.
  - The footer note says today's activity **plus anyone still inside from an earlier
    day**, not the mockup's "all statistics are for today only". Open visits are never
    date-bounded (see below); the mockup's wording would have a guard mistrust the one
    number they must not.
- **One KPI card design everywhere (2026-08-13).** `src/components/KpiTile.tsx` is the
  only clickable KPI card, used by the guard dashboard (`DashboardTile`), the Visitors
  rail (`VisitorKpiRail`), the HOD Overview (`OverviewStatCards`) and the Admin Panel
  (`AdminStats`) and `WhosInside` — same layout, same border, same hover lift, only the
  number colour varies. Active/expanded state is `gate-tile-active` = gold ring shadow
  only, **never** a border or cap change (client instruction). `KpiTile` exposes
  `pressed`/`controlsId`/`caption` for the aria contract; a tile's accessible name joins
  its block spans without spaces (e.g. "0ExpectedBooked ahead…"), so tests must query
  unanchored unique substrings, never `^` anchors. Plain stat numbers that open nothing
  (VisitorsDashboard) stay `stat-card` divs — same surface and hover via CSS
  only, no chevron. The unified rules live in `components-surfaces.css`.
  - **There is NO top cap, accent bar or per-card border treatment.** A 3px gold
    `::after` used to sit on `.stat-card` and `.gate-tile`. It was one declaration but
    it did not *look* like one: the gradient faded to transparent across each card's own
    width, so a wide Analytics card wore a long gold bar and a narrow tile wore a stub,
    and the two read on screen as different border weights — which is exactly what the
    client reported. Deleted 2026-08-13. Do not reintroduce a cap, a top border or a
    per-tile accent edge. A card's identity is its **numeral's colour**, nothing
    structural; every card carries the identical 1px hairline on all four sides.
  - Hover is `translateY(-3px) scale(1.025)` + gold ring; the scale is what makes one
    card stand out from a grid of eight, since a 2px lift is invisible when every
    neighbour shares the same shadow. `:active` squashes. `.gate-tile-active` (the
    expanded tile) holds a `-2px` lift + ring, so it still reads as pressed while a
    neighbour is hovered. All three transforms are dropped under
    `prefers-reduced-motion` — the ring and shadow survive, so state is never carried
    by movement alone.
  - **There is ONE shape — no `compact` variant.** `KpiTile` briefly had a square
    face (`.kpi-tile-compact`) for the Visitors rail while that rail was a 300px
    column beside the list. The board moved on top of the list at the dashboard's own
    size (2026-08-13, client instruction) and the variant lost its only caller, so the
    prop and its ~30 lines of CSS were deleted. Do not re-add a second face: the point
    of this component is that a guard learns the card once and recognises it
    everywhere. The qualifier is printed on the tile face again, not `sr-only`.
- **`entered` is NOT `inside`.** `visits.status` holds one value, so a visitor who came
  and left is `checked_out`, not `checked_in`. Counting `status === 'checked_in'` answers
  "who is still here", never "how many came through today". `guardTiles.ts` derives
  `entered` from `checked_in_at IS NOT NULL` and holds the invariant
  `checked === inside + departed`. `tests/unit/lib/guardTiles.test.ts` guards this —
  it is the bug the dashboard rebuild fixed and it must not silently return.
- The `Declined` tile is `status === 'rejected'`, which means **an HOD declined the
  request**, usually before the visitor ever reached the gate. It is not the guard turning
  someone away — do not relabel it "Denied Entry". The 2026-08-13 reference design called
  it exactly that, which is how a mislabel gets in: printing "entry denied" on a guard's
  screen claims a person was refused at the door, a different and far more serious event
  to have wrong in a record someone may later be asked to account for.
  `GuardDashboard.test.tsx` fails on any `/denied/i` text.
- **There is NO Watchlist tab (deleted 2026-08-15, client instruction).**
  `visitors.is_blacklisted` + `blacklist_reason` are the only columns backing
  it, and the enforcement point that matters is inside check-in —
  `lib/checkInFlow.ts` refuses the write and names the blacklist reason — so
  the browsable tab was a second, weaker path to the same protection, carrying
  a CCTV placeholder, dead buttons and a dismiss that did not persist.
  `GuardWatchlist.tsx`, `WatchlistMatchCard.tsx`, `CctvFeedCard.tsx`,
  `WatchlistAlertBanner.tsx` and `lib/notifyWatchlistEscalation.ts` are all
  **deleted**; `/guard/watchlist` is out of `ROLE_ROUTES.guard` and
  `routeProtection.test.tsx` asserts it is forbidden. Do not re-add the tab or
  the dashboard banner. The `watchlist_escalation` value stays in
  `NotificationType` (live rows can exist, migration 079) but nothing new is
  ever written. There is no VIP flag, no ID-expiry column and no
  duplicate-identity detection in the schema. Do not add placeholder sections
  for them; add the columns first or leave it alone.
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
- **The HOD view is drawn in the GUARD's design, from the guard's own files**
  (client instruction, 2026-08-16: "make the look and feel, font type and typography of
  the HOD view exactly same as guard's view, so they should not look different style
  wise, since they are part of same /vms app"). Every tile is
  `components/DashboardTile.tsx`, every list is `components/DashboardVisitorTable.tsx`,
  every card is `components/DashboardPanel.tsx`, and the guard dashboard renders those
  same three. Sharing the components is the point: two files carrying identical Tailwind
  are identical *until the next edit to one of them*, which is exactly the drift the
  client was reporting. **`src/styles/hod-compact.css` is DELETED** — a self-contained
  8-to-11px type scale in a private accent hue, scoped to one role. Do not reintroduce a
  stylesheet scoped to a role; if a surface needs a treatment, it belongs in the shared
  layers, where every role gets it.
  - `lib/tileIcons.ts` holds the KPI glyph paths and `dashboardColumns.ts` exports the
    `COLUMN` atoms, so a "people" glyph or a "Scheduled" cell cannot mean one thing on
    the guard board and another on the HOD's. Composing a panel is picking from `COLUMN`;
    it is not a licence to write a one-off column inline.
  - **Reports is drawn in the same row language** (same instruction). The glass panel,
    the uppercase 11px header band, the hairline row rule, the brand-tinted hover and the
    round brand-ringed face are `DashboardVisitorTable`'s. Its **sixteen columns are
    untouched and must stay so** — `styles/print.css` pins the printed register's widths
    by `nth-child`, so adding or merging a column silently breaks the printed copy.
- **There is NO Approval Desk** (removed 2026-08-16, client instruction). It sat at
  `/overview?tab=preapprovals` and listed `pending_approval` rows carrying a
  `scheduled_for` — a set that **cannot exist**: `WalkInRequest` and the kiosk are the
  only writers of that status and both insert `scheduled_for: null`, while a pre-approval
  is created already `approved` and never passes through it. The desk could never hold a
  row, and every decision an HOD actually makes has always been on the **Walk-in Desk**
  (`/overview?tab=walkins`, `HodWalkInDesk.tsx` + `HodDecisionPanel.tsx`). The `?tab=`
  value degrades onto the dashboard rather than 404-ing — it is in bookmarks — and
  `/approvals` is still the pre-approval FORM. `HODConsole`'s scheduled-decisions query
  went with it.
  - Consequence: the **`walkins` KPI tile went too**. With the scheduled lane gone,
    "Awaiting decision" and "Walk-ins live" were two tiles opening one identical list,
    which is the no-duplicate-renders rule. No panel carries a Department column —
    an HOD belongs to exactly one department, so it would print the same value on every
    line.
- **The five HOD tiles are On Site Now · Pre-Approvals Given · Walk-ins Approved ·
  Awaiting Walk-in Approval · Declined Today** (client instruction, 2026-08-16).
  - **The two clearances are two tiles.** "Approved Today" carried `approved` and
    `walkin_approved` in one number, and those are two different acts by two different
    routes: a pre-approval is a pass this HOD raised in advance on `/approvals`, a
    walk-in approval is a decision they made on a request the gate pushed at them
    minutes ago. One tile gave one answer to both questions and neither list could be
    opened on its own. `hodTileVisits` splits on the **status**, not on `visitOrigin` —
    at this point in a visit's life the status still proves the desk (`approved` can
    only be a pre-approval, `walkin_approved` only a walk-in), so the two lanes are
    exact rather than inferred. The glyphs are the calendar and the walking figure from
    `lib/tileIcons.ts`, since the hue is shared and must never be the only carrier.
    Their panels carry **no Type column** — the tile's own label has said it, and a
    column printing one word on every line says nothing.
  - **"Awaiting Walk-in Approval"**, not "Awaiting Your Decision" — the same edit the
    guard's pending lane took: `pending_approval` is only ever reached from the gate's
    walk-in register, so the old label left an HOD wondering whether a booked visitor
    could be sitting in it. `HodWalkInDesk` reads its heading from
    `HOD_PANEL_SPEC.pending`, so the desk and the tile cannot be named two things.
  - The board is five wide (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`), the same
    breakpoints as the guard board's five-wide secondary row.
- **The presence chip says "Checked in", not "Still inside"** (client instruction,
  2026-08-16). `presenceChip` in `lib/visitGateChips.ts` is the Status cell on the guard
  dashboard's panel *and* on the Entry & Exit table, so its wording is read at the exact
  moment a guard has pressed a tile — and pressing **Checked In** opened onto rows whose
  Status said anything but that. A **`walkin_approved`** row reads "Checked in" as well,
  because since migration 080 the approver's click IS the admission, which is why
  `TILE_FILTER.checked` counts those rows: a row counted as admitted must not report
  itself as something else. **"Checked out" survives unchanged** — it is the whole basis
  of the Entry & Exit tab's two lanes. Known seam: `/visitors/approved` still offers a
  **Check In** button on a `walkin_approved` row (the pre-080 rows resting there), so that
  desk can act on a visitor the board already calls checked in. Guarded by
  `tests/unit/lib/visitGateChips.test.ts`.
- **WHO WALKED IN AND WHO WAS BOOKED IS SAID ON EVERY MIXED LIST** (client instruction,
  2026-08-16: "always everybody should be able to see who is walk-in and who is
  pre-approved"). `COLUMN.origin` (header **Type of Visitor** — the full words, on
  every surface, since the client asked for the column by that name) resolves through
  `lib/visitOrigin.ts`, so no screen can disagree with another about a visitor's origin.
  - It goes **only on a lane that can hold both kinds**, which after the 2026-08-16
    "maintain the same everywhere" instruction is every lane except the four whose
    membership rule fixes the answer. The guard's `checked`, `inside`, `all`,
    `overstaying`, `declinedByHost` and `refusedByGuard` panels carry it; the HOD's
    `inside` and `rejectedToday` do. **Not** on `pending` or `walkinApproved` (every row
    is a walk-in by definition), not on `expected` (`approved` with no entry stamp can
    only be a pre-approval) and not on the two HOD clearance lanes. A column printing one
    word on every line says nothing, and the tile's own label has already said it.
    `dashboardColumns.test.ts` and `HodKpiBoard.test.tsx` assert both halves.
  - **The admin register carries it on screen, not only in the CSV.** `toReportRow` has
    had the key since the column was added; `Reports.tsx`'s table did not, so the one
    surface an admin actually reads was the one that could not answer it without
    exporting. The register is now **seventeen** columns and `styles/print.css` pins their
    widths by `nth-child` — the header array and that block must always be edited
    together, or the printed copy silently mis-columns.
  - **The Entry & Exit table carries it too** (`LiveQueueTable`), between Name and
    Company. That tab lists everyone the gate let through today, so both kinds are on it
    by definition, and by then every route has converged on `checked_in` — the Status chip
    beside it can no longer say which desk they came through.
  - **`WhosInsideVisitorCard`** adds it as a `CardField`, gated on `statusProvesOrigin`
    for the same non-duplication reason as the grid card below.
  - **Every CHECK-IN says it too, on `CheckInVisitorSummary`** (client instruction,
    2026-08-16: "whenever anybody's checking in they should be able to recognize by the
    field type of visitor"). That summary is rendered by `CheckInPhotoStep`, which is the
    one screen the pre-approvals desk, the scan desk, the walk-in desk and the dashboard's
    Verify ID modal ALL pass through — so the field is labelled **"Type of Visitor"** once,
    there, rather than copied onto four flows. The value stays a coloured pill (glanceable
    at a gate); the label is what makes it legible to someone who has not learned the
    badge. The approval row beside it reads **"Approved at"**, not "\<type\> at", or the
    type would be printed twice on one summary.
  - **`MatchItem.approvalType` is DERIVED FROM `visitOrigin`, and its walk-in member is
    named `walk_in`.** It used to be `walkin_approved`, computed as
    `status === 'walkin_approved'` in both `checkInMatches.ts` and `qrMatchItem.ts` — a
    second, weaker inference of a question `lib/visitOrigin.ts` already answers. Migration
    080 broke it: the approver admits a walk-in in the same click, so a host-cleared
    walk-in rests in `checked_in`, and the check-in desk labelled that visitor
    "Pre-Approved" while the dashboard column beside it said Walk-in. The labels are
    `visitOrigin`'s own words on both `CheckInMatchCard` and `CheckInVisitorSummary` —
    **Pre-approved / Walk-in / Regular** — so the desk and the board share one vocabulary.
    `recurring` survives as a genuine third case: a standing visitor has no visit row at
    all until check-in creates one. The converged case is asserted in
    `qrMatchItem.test.ts`, not `checkInMatches.test.ts` — `buildMatchItems` only ever sees
    the open pre-approvals the panel fetched, and a `checked_in` row becomes a `MatchItem`
    exclusively through `visitToMatchItem` (`useVisitHistorySearch` maps every server-side
    hit with it).
  - **`VisitorGridCard` carries the same answer as an outline chip**, and renders it
    only when `statusProvesOrigin(v.status)` is false. `STATUS_STYLES.approved` reads
    "Pre-approved" in so many words, so on an unconverged row the chip would be the same
    fact twice on one card. It is exactly the converged statuses — `checked_in` and
    everything after — where the badge stops saying, which is why the card needed this
    at all. The chip is an **outline**, never the filled status pill's shape: one says
    what kind of visit it is, the other says where the visit has got to.
    `VisitorStackList.test.tsx` guards both the presence and the non-duplication.
- **The HOD's landing page is the DASHBOARD, and every KPI on it drills down**
  (client instruction, 2026-08-16). The nav item reads **Dashboard**, not "Overview" —
  the route stays `/overview`, which is what the bookmarks and every `?tab=` link hold —
  and the `HOD COMMAND VIEW / Department overview` page header is **gone**: the sidebar
  item they just clicked already says it, the same rule that took the heading off the
  guard dashboard. The four stat cards were counted from a `select id, status`, so the
  number was all there could ever be and an HOD reading "3 awaiting decision" had to go
  looking for the three. `lib/hodTiles.ts` now owns one entry per tile and one slicer;
  `HodKpiBoard.tsx` renders `tiles[key].length` as the number and `tiles[key]` as the
  panel, so **a tile's count is the length of the list it opens** here exactly as it is
  on the guard board. (For the five tiles themselves, see the entry above.)
  The day query fetches full rows (limit 200); the
  pending tiles reuse the console's own unbounded desk lists, so a tile and the desk it
  belongs to can never act on different rows. **The panel is display-only** — approving
  and declining stay on the two decision desks, where the reason box and the audit row
  are. `lib/hodVisitLabels.ts` holds the shared row labels so the board and the desks
  name a visitor, an hour and a host identically.
- **`/approvals` is the FORM. Every HODConsole desk is a `?tab=` view of `/overview`.**
  (client report, 2026-08-16). `HODConsole` had taken over **both** HOD routes, so
  `/approvals` rendered the console's "preapprovals" **decision desk** and the
  pre-approval form — the one HOD screen that *creates* a visit rather than deciding one —
  became unreachable, leaving an HOD with no way to raise a visitor pass at all.
  `App.tsx` routes `/approvals` back to `pages/HOD/Approvals.tsx` → `PreApproveForm`;
  `tabFromLocation` no longer keys on the pathname. The sidebar carries the form as
  **Pre-Approvals** (plus icon). Two different surfaces must never share a URL. The
  **Approval Desk** item that sat beside it was removed 2026-08-16 (see above), and
  `tabHref` went with it — the console's one remaining shortcut navigates with a literal
  path.
  On success the form navigates to `/overview?tab=schedule` — the list the new booking is
  the top row of. `?filter=approved` was a param nothing on the console read, so the HOD
  landed on a bare Overview with no confirmation their pass existed.
- **The HOD surface has NO stylesheet of its own.** `styles/hod-compact.css` was deleted
  2026-08-16 when the view was rebuilt on the guard's shared components (see above). It is
  worth knowing why it existed and why token-driving it was not enough: it shipped as a
  self-contained navy operations palette (`#071522` panels, `#1677ff` accents, `#f4f8ff`
  text) that ignored the theme, so the HOD's content area stayed a dark blue slab whatever
  the sidebar beside it was doing — "the right side is not matching with the left hand
  side, it's kind of blue" (client report, 2026-08-16). Routing its neutrals through
  `--c-surface-*` / `--c-navy-*` fixed the *colour* and left the **type** — an 8-to-11px
  scale nothing else in /vms uses — which is what the follow-up report was about. A role
  does not get a stylesheet; it gets the shared layers.
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
- **The HOD Overview has no page header.** "&lt;Dept&gt; Department" restated the one
  fact that never varies for this user — an HOD belongs to exactly one department and
  every number on the page is already scoped to it — and "Overview" repeated the nav item
  they just clicked. The page opens on `OverviewStatCards`. The department *name* is no
  longer fetched at all (the id still scopes the queries). `HODOverview.test.tsx` asserts
  all three absences.
- **The visitor popup does not repeat the ref number in its header.** It is on the pass
  itself under **View Pass** — the copy the visitor shows and the guard reads back — and
  in the header it spent the most prominent line of the modal on a value nobody acts on
  there. `VisitorDetailsHeader.test.tsx` guards this and the **Expected At** row beside
  it, which shows `scheduled_for` — the one field the approver chose themselves, and the
  only thing that says whether a visitor is early, expected or overdue. Omitted (not
  dashed) for walk-ins, which have no `scheduled_for`.
- **The Upcoming-visits card leads with the VISITOR.** It used to open with
  `{Purpose} — {Vendor}`, which reads as one compound label rather than two facts (a live
  row whose `vendor_name` named a kind of pass rendered as `Delivery — …` and looked like
  a system label). It also printed the visitor's name and the vendor **twice each** — once
  on that line and again as chips below. Now: `Visitor Pass` eyebrow → visitor name →
  vendor (once) → a tinted **Person to Meet** block carrying the host and department →
  purpose as a chip. `OverviewUpcomingCard.test.tsx` asserts each value appears exactly
  once.
- **QR passes expire at the END OF THE SCHEDULED DAY.** Migration **071** (applied live
  2026-08-11). 057 fixed this on `pre_approve_visitor` — which nothing calls.
  `PreApproveForm` calls **`pre_approve_visitor_v2`**, which never set `qr_expires_at` at
  all, so every pass fell to the column default of `now() + 24h`: a booking made three
  weeks ahead had a QR that died twenty-one days before the visitor arrived
  (`VIS-20260804-0023`, live). v2 now sets `vms_day_end_ist(scheduled_for)` and the column
  default is `vms_day_end_ist(now())`, so the sweep, `isVisitExpired` and the QR gate all
  answer "is this pass live?" the same way. **If you patch a pre-approval RPC, check which
  one the app actually calls.**
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
- **`visits.remarks` is NOT `carrying_remarks`.** Migration **068** added a general-purpose
  note captured on the walk-in registration form (`WalkInRequest`), shown to the HOD on
  the `ApprovalsPendingList` card. It exists because a walk-in is the one visit an HOD
  approves blind — they get a name, a vendor and a purpose off a seven-item enum and are
  asked to decide. `carrying_remarks` describes *material only* and is gated by the
  `carrying_material` tick box; overloading it would resurrect the ambiguity 058 removed
  and make Reports' "Carrying Remarks" column print unrelated prose. Length-capped at 500
  (CHECK constraint, mirrored by `maxLength`), not character-allowlisted — this is prose
  typed at a gate, and `inputRules.ts`'s allowlist is for short structured identifiers.
  Empty is stored as `null`, never `''`.
- **A visitor card is minted at check-in and demanded back at check-out.** Migration
  **076** (live 2026-08-10) adds `visitor_card_number` + `visitor_card_returned_at`; the
  CHECKs enforce format `^[A-Za-z0-9-]{1,20}$` and that a card marked returned must have
  a return timestamp. The number is **required at the app level, not the DB**: the card
  field gates the Check In button on every check-in path (`CheckInPhotoStep` renders it
  for pre-approvals, scans, walk-in approvals and recurring), so a guard cannot reach
  confirm without one, while the format CHECK stays a backstop. Check-out records the
  return (074's undo nulls it again — the visitor never left). `lib/cardNumber.ts`
  mirrors the CHECK.
- **THE RETURN TICK IS REQUIRED ON EVERY CHECK-OUT, CARD OR NO CARD** (client
  instruction, 2026-08-17: *"without this checkbox checked the guard cannot check out
  that person, no matter whether it's a walk-in visitor or a pre-approved visitor —
  do this for all kinds of checkout"*). `CardReturnConfirm` used to render **no
  checkbox at all** when `visitor_card_number` was null and enable Complete Check Out
  immediately. Defensible while a null meant a legacy row; indefensible once 080
  started minting new walk-ins with no card. The no-card branch now keeps the
  checkbox and changes only what it asserts — not "the card came back" but "I have
  looked and no card was issued". The issued number is printed **inside the label**
  as well as above it, so the tick is always made against a stated number rather
  than against the word "card". Both surfaces that check anyone out (`Console.tsx`
  and `GuardLiveQueue.tsx`) open this one dialog, so there is one gate, not two.

### Notifications bell
- **The dropdown's click-away is a LISTENER, not an overlay** (client report,
  2026-08-16: "Read" and "Mark all read" did nothing). It used to close via a
  `fixed inset-0 z-40` scrim portaled to `document.body`. That scrim beats the whole app:
  the panel's `z-50` is resolved INSIDE AppShell's `app-shell-content` stacking context
  (`relative z-10`), so at the root it is a z-10 subtree sitting under a z-40 sibling —
  every click aimed at a button in the dropdown landed on the scrim, which closed the
  panel and marked nothing. A `mousedown`/`touchstart` listener on `document`, filtered
  by `dropdownRef.contains`, has no paint order to lose. `NotificationBell.test.tsx`
  fails on any `.fixed.inset-0` while the panel is open. Both writes also re-read on
  error, so a refused update does not leave the badge lying until the 30s poll.

### Live shared data
- `src/lib/useDepartments.ts` and `src/lib/useHods.ts` fetch **and** subscribe to
  `postgres_changes`. Every screen with a department picker uses `useDepartments()` —
  never re-add a one-shot `supabase.from('departments')` fetch in a component, or admin
  edits will stop propagating to guards/HODs/staff/kiosk.
- Both tables are in the `supabase_realtime` publication with `replica identity full`.
  Declared by `039_realtime_departments_profiles.sql`, but 039 was never applied to
  the live project — it was actually landed by
  `054_drift_realtime_departments_profiles.sql`. Realtime still honours RLS.

### `064` — admin-assisted password reset, and a forced change on first sign-in (2026-08-10)

**Applied + verified live 2026-08-10.** Self-service reset was removed from the login card
in the same session: the built-in Supabase email sender is capped at **~2 mails/hour,
PROJECT-WIDE** — and that budget is shared with the sibling GatePass app — so
"Forgot password?" failed for most people who pressed it. The login card now names a human
(`ADMIN_CONTACT_EMAIL`, exported from `src/pages/Login.tsx`) and the admin does the reset.

- **`public.admin_reset_user_password(uuid, text)`** — gated on
  `current_user_role() in ('admin','super_admin')`. Writes the password as bcrypt
  (`extensions.crypt(pw, extensions.gen_salt('bf'))` — GoTrue accepts a hash written this
  way), raises `must_change_password`, and **deletes every session that user holds**
  (`auth.sessions`; `refresh_tokens.session_id` cascades, `confdeltype` `'c'`, verified
  live). Without the delete, someone already signed in elsewhere keeps full access.
- **It refuses to target an `admin` / `super_admin`.** Otherwise the weakest admin account
  is a takeover route into every stronger one, and "reset" becomes an undetectable way to
  seize a super_admin. A locked-out admin is a Supabase-dashboard job, on purpose.
- **`public.set_my_password(text)`** — the user's own choice, scoped to `auth.uid()`.
  **It clears the flag in the same call that writes the password, and nothing else clears
  it** — a separate "clear the flag" RPC would let the forced-change screen be skipped from
  the browser console. It also refuses reusing the current password, since keeping the one
  the admin read out over the phone leaves the account as exposed as it was.
- **`public.my_must_change_password()`** — SECURITY DEFINER, scoped to `auth.uid()`, and
  the ONLY thing the app shell should ask. Do **not** `select must_change_password from
  profiles` in the startup path: `public.profiles` has a history of recursive-policy
  failures (42P17) and a select that raises there would either lock everyone out of the
  app or fail open. Policy evaluation is sidestepped entirely and it can only read your row.
- **`public.profiles.must_change_password`** is `not null default false`, so every existing
  account is unaffected and only an explicit reset can raise it. Nullable would make "never
  reset" and "reset, unknown state" indistinguishable at the one moment the answer decides
  whether to block someone out of the app.

**This column is SHARED with GatePass** and is the one place it lives — GatePass migration
`036` mirrors the two functions into the `gatepass` schema but must never alter `public`.
**Apply this migration before GatePass `036`.** The apps mirror rather than call each
other so each authorizes with its own admin check.

**Verified live 2026-08-10** via `gatepass/scripts/verify-036.mjs` — 16/16 with real
anon-key JWTs (postgres bypasses every guard here, so psql could not prove any of it),
including that a fresh user is NOT flagged, a non-admin cannot reset, an admin cannot reset
an admin, the old password dies, the new one signs in, and the flag clears only with an
actual password write. Probe user deleted; `profiles` has 0 rows flagged.

### `075` — no-shows close at 10 PM, HODs are warned at 8 PM (2026-08-13)

- **The IST day ends at 22:00, not midnight.** `vms_day_end_ist(ts)` is redefined from
  "midnight of the next IST day" to "22:00 IST of the day containing `ts`" — the mall's
  day. Everything that asks "is the day over?" uses it: `close_stale_approvals()`'s
  boundary, the QR expiry (071/073), and the client's `istDayEnd`. The QR pass's life
  moving from midnight to 22:00 was the point, not a side effect — the three answers
  stay in lockstep by construction.
- **`send_no_show_summary(p_force boolean default false)`** — a 20:00 IST forecast
  (`30 14 * * *` UTC), one `visit_no_show_summary` notification per department HOD:
  "N approvals in \<dept\> scheduled for today never arrived. They will be closed as
  no-shows at 10 PM…". Nothing is marked yet. Dedupe = one per HOD per IST day
  (`created_at >= vms_day_start_ist()`); `p_force` skips it, for verification only.
- The first hourly sweep run after 22:00 (~22:40 IST) marks every un-arrived approval
  whose moment fell before close, and the per-visit trigger writes `visit_no_show`:
  "The pass is now void — if the visitor is still expected, raise a new pre-approval
  request." No reactivation is surfaced anywhere; the DB-only `no_show -> approved`
  route stays as a safety net.

### `077` — the sweep compares each VISIT's day end, not today's (2026-08-13, applied live)

075 shipped with the boundary wrong: `close_stale_approvals()`'s predicate ended the
day containing **now()** instead of the day containing the **visit's moment**, so an
approval whose slot was still hours away was filed `no_show` the moment the job ran
any time after 22:00 IST. This actually bit live data (2026-08-12: Raju,
`VIS-20260813-0001`, booked 18:30, swept before his slot); 077 re-applied and verified.
The rule is now exact, and it makes the sweep safe to run at ANY hour, not just after
close:

- `scheduled_for IS NOT NULL` → no_show when `now() >= vms_day_end_ist(scheduled_for)`
  (the day containing the VISIT's moment has ended).
- `scheduled_for IS NULL` → expired when `now() >= vms_day_end_ist(created_at)`.
- `nudge_overdue_visits`'s "before 10 PM" guard is `now() < vms_day_end_ist(now())` —
  it was passing no args (matching the OLD zero-arg default) so the nudge and the
  sweep could fire for the same visit; both are one-sided now.
- Both functions were re-`revoke`d from anon/authenticated after the fix (the 073
  lesson: CREATE OR REPLACE keeps the ACL, but a DROP/re-CREATE resets it to PUBLIC).
- Verified live: `close_stale_approvals(true, null)` = 0, `nudge_overdue_visits()` = 0,
  `send_no_show_summary(false)` = 0, and the wrongly-swept row restored to `approved`.
- The 13:10–16:10 IST "1 row" sweeps seen on 2026-08-12 were security-test fixtures
  (noShowWorkflow.test.ts deletes its rows); the 17:44 IST `visit_no_show_summary` row
  was the 075 `p_force` verification run, not the cron.
- **`nudge_overdue_visits` stops at the day boundary too** (`now() < vms_day_end_ist()`,
  body "before 10 PM"), so the overdue notice and the no-show notice can never both
  fire for the same visit.
- Two new `notification_type` values (`visit_no_show`, `visit_no_show_summary`), both
  already in the TS union in `src/types/index.ts`. The summary's `related_id` is
  **null** on purpose — it is a count, not a visit; never render a "More information"
  link that resolves to nothing.
- ACL (the 073 lesson): `send_no_show_summary`, `sweep_no_shows_daily` and
  `close_stale_approvals` are service-role only; `mark_no_shows()` stays the
  department-scoped human entry point. Verified by `tests/security/noShowWorkflow.test.ts`
  (live project; fails until this migration is applied).

### `080` — the approver admits the visitor in the same click (2026-08-16, applied live)

> **SUPERSEDED BY `083` ON 2026-08-17. READ THAT SECTION FIRST.** The shortcut
> described below was live for one day and is gone: an HOD's approval lands a
> walk-in in `walkin_approved` again, and the guard admits them at the gate.
> Everything here is kept because 083 is a partial revert — §4 (`pre_approve_visitor_v2`
> writing its own `visit_approved` row) and §5 (`get_profile_names`) are still
> the live definitions and were not touched.

- **A walk-in the HOD approves goes straight to `checked_in`.** `approve_visit()`
  writes `status = 'checked_in'` + `checked_in_at`, and the state machine learns
  `pending_approval -> checked_in` gated on the APPROVER's roles. Safe only since
  `WalkInRequest` began refusing a request without an ID scan, a photo and a card
  number — everything the old gate step collected is already on the row by the time
  an approver sees it, so the second click was re-photographing somebody standing at
  the desk the whole time.
- **`walkin_approved` is NOT retired.** Live rows rest in it, `/visitors/approved`
  still lists and admits them, and `walkin_approved -> checked_in` still exists.
  Nothing NEW enters it.
- **One update, TWO audit rows.** `log_visit_approval` writes `visit_approved`
  (with `admitted: true`) *and* `visit_checked_in`, because the click is a decision
  and an entry: `approvalTimestamp()` and the "Approved By" column read the first,
  the activity log reads the second. Collapsing them leaves one surface unable to
  answer its own question.
- **Every "did a host approve this?" lane is keyed on the CLEARANCE, not the
  holding status.** `isApprovedWalkIn` / `isGivenPreApproval` in `lib/visitOrigin.ts`
  — shared by the guard's tile, `/visitors/approved` and the HOD's board, because
  they are one question. Keyed on `status === 'walkin_approved'` they all emptied
  themselves the moment the shortcut landed. The same row therefore counts under
  **Checked In** and under **Approved Walk-ins** at once, with Type reading Walk-in;
  that is the design, not double-counting — the tiles answer different questions.
  A tile labelled "given" that empties as visitors arrive is measuring attendance,
  not issuance.
- `pre_approve_visitor_v2` writes its own `visit_approved` row (a row born
  `approved` never changes status, so the trigger never fired), and
  `get_profile_names` gains `department_name` — a DROP/CREATE, so its ACL is
  re-granted explicitly (the 073 lesson).
- **Verified live 2026-08-16**, not just applied: a probe approval under a real
  HOD's JWT claims landed `checked_in` with `checked_in_at` set and both audit rows
  present. If a walk-in approval is ever seen resting in `walkin_approved` again,
  check the LIVE function first — the app half shipped a commit before the DB half
  was applied, and the symptom was exactly that.

### `083` — the approver clears, the GUARD admits (2026-08-17, applied + verified live)

**Reverts 080's shortcut.** Client instruction: *"once the guard sends out for the
approval it will still not show as check-in. Once the walk-in is approved by the HOD
then only the check-in box should appear for that person. When the guard clicks on
check-in that time he can enter the [card] number … until and unless approval is
given the guard cannot check in. Till that time it will show as waiting for
approval. Make sure you follow this workflow everywhere."*

The workflow, end to end: `WalkInRequest` → `pending_approval` (guard sees "Awaiting
Approval", no action) → HOD approves → `walkin_approved` → `GuardWalkInApproved`'s
**Check In** button, which will not submit without a photo, an ID scan and a
**visitor card number** → `checked_in`.

- **Why it was reverted, and it is not a matter of taste.** 080's own header records
  the gap: `WalkInRequest` does not collect a `visitor_card_number`, so every walk-in
  admitted by the shortcut reached check-out with that column null and migration
  076's card-return gate had nothing to demand back. The one route where a card was
  most likely handed over off-book was the one route the exit waved through. The two
  fixes were to move the card onto the registration form (issuing a card before the
  host has answered, burning one on every refusal) or to put the admission back at
  the gate where the card physically changes hands. The client chose the gate.
- **REBASE ON `082`, NOT ON `080`.** `enforce_visit_update_rules` has been recreated
  three times and the live body is **082's** — it carried 080's shortcut forward and
  added `pending_approval -> lapsed` and `lapsed -> pending_approval`. Writing 083
  from 080's text compiles, applies cleanly, and silently deletes both, breaking the
  10 PM sweep with no error anywhere. That is `memory.md` **SB-15** repeating itself
  (015 dropped the `walkin_approved` branches exactly this way; 022 restored them).
  Verified by diffing the two function bodies with comments stripped: the ONLY
  difference is the removed branch.
- `approve_visit()` writes `walkin_approved` and **does not stamp `checked_in_at`**.
  080's `unique_violation` handler is dropped with it — migration 060's index is
  partial on `status = 'checked_in'`, so a write landing on `walkin_approved` could
  never have fired it. That clash now raises at the gate again, where it belongs.
- `log_visit_approval()` loses the branch that wrote `visit_approved` (`admitted:
  true`) **and** `visit_checked_in` off one click. `approvalTimestamp()` and the
  admin register's "Approved By" still read the `visit_approved` row the first
  branch writes; the activity log's `visit_checked_in` now comes from the guard's
  own write, which is what it always described.
- **Rows already admitted by the shortcut are NOT rewritten.** Those visitors really
  did enter the building. They keep a null card number and leave through the
  "no card was issued" branch of the return gate.
- **Applied + verified live 2026-08-17**, not just written: `approve_visit` now writes
  `walkin_approved` and does not stamp `checked_in_at`; `enforce_visit_update_rules` was
  diffed against the live 082 body before applying and, after, was confirmed to retain
  BOTH `pending_approval -> lapsed` and `lapsed -> pending_approval` while no longer
  containing the `pending_approval -> checked_in` branch — the rebase trap above was
  checked for, not just guarded against; and `log_visit_approval` no longer contains the
  `admitted` key.

**The app was barely collapsed to match 080, so the revert is four logic changes and
a lot of stale prose.** `checkableStatus`, `qrToken`, `statusStyles`,
`CheckInMatchCard` ("Awaiting Approval"), `PreRegisteredCard`, `LiveQueueTable`,
`GuardWalkInApproved`, `WhosInside`, `Kiosk`, `visitOrigin`, `hodTiles` and
`visitorSegments` were all still pre-080-shaped and needed nothing. What did change:

- `lib/visitLifecycle.ts` — `pending_approval` loses `checked_in`.
- `lib/visitGateChips.ts` — a `walkin_approved` row read **"Checked in", tone
  `inside`**. That is the tone the fire-marshal list is read off, on a visitor still
  standing outside. Now "Awaiting entry", neutral.
- `lib/guardTiles.ts` — `IS_EXPECTED` gains `walkin_approved` back; `checked` drops
  `|| status === 'walkin_approved'` and is keyed on `checked_in_at` alone. The
  invariant is once again **checked === inside + departed**, nothing else.
- `pages/HOD/HODOverview.tsx` — the Upcoming query `.in()` list gains
  `walkin_approved`, or an HOD's own decision vanishes off their board between the
  click and the arrival. `OverviewUpcoming` has carried the badge for it
  (`awaitingGate`) throughout; the query was the only thing making it dead code.

### `081`/`082` — an unanswered walk-in request lapses at 10 PM (2026-08-17, applied live)

- **`pending_approval` was the one status the day-end sweep could not reach.** 066 closes
  APPROVALS — `no_show` when a booked slot went unused, `expired` when an approval with no
  slot lapsed — and a request nobody ever answered has no approval to close. Meanwhile
  `Console.loadVisits` carries `pending_approval` with **no date bound**, deliberately, so
  overnight work is not dropped at midnight. That is the exact pair 066 warned about: an
  open-ended list and a sweep that cannot close it are two halves of one design, and only
  one had shipped. Every unanswered request since the app went live was still sitting on
  the HOD's desk, and Reports still described it as a decision that was coming.
- **`lapsed` is a TENTH status, not a reuse of `expired`.** `expired` means "somebody
  approved this and it was never used", and two maps depend on exactly that:
  `IMPLIES_PRIOR_APPROVAL` (`lib/visitApproval.ts`) and `IMPLIES_APPROVAL`
  (`lib/visitApprover.ts`) both hold it TRUE, so the admin register prints the visit's own
  `created_at` as the approval instant and names an approver. Filing an unanswered request
  there would make the register claim a host cleared a visitor they never saw — the same
  class of error as the hardcoded "Identity verified" this file already removed, on a
  record somebody may later be asked to account for. **`lapsed` maps FALSE in both**, and
  Reports prints "Not approved" with an empty Approved column. The three closed-without-
  arriving outcomes are drawn on what happened, never on the route in:
  - `no_show` — an appointment was made and missed.
  - `expired` — an approval was given and lapsed unused.
  - `lapsed` — **no decision was ever made**, and the day it was needed for ended.
- **The predicate is 077's, unchanged in shape**: `now() >= vms_day_end_ist(coalesce(
  scheduled_for, created_at))`, i.e. the day containing the VISIT's own moment has ended
  (22:00 IST, 075). A pending row never has a `scheduled_for` — `WalkInRequest` and the
  kiosk are its only writers and both insert null — so `created_at`, the moment the visitor
  stood at the gate, is its moment. Comparing against the visit's own day rather than
  today's close is what keeps the sweep safe at any hour and idempotent (verified live: a
  second run returns 0).
- **It writes NO audit row and NO notification, and that is the design.**
  `log_visit_approval` has no branch for the transition (there is no actor and no instant
  to record), `trg_notify_no_show` fires on `no_show` alone, and `notify_guard_on_decision`
  returns early on anything but approved/rejected. 070's nudge and 075's 8 PM summary both
  key on `scheduled_for`, which these rows do not have — there is no slot to be late for.
  A host who never answered gets no new message; the request simply stops claiming a
  decision is coming. `lapsed` is therefore also **out of `DECIDED_STATUSES`** in
  `lib/visitActors.ts` — querying audit_logs for it could only ever come back empty.
- **The way back is `lapsed -> pending_approval`, never to an approved state.** The rule
  066 set down (a status written by a machine must be reversible by a human) with the
  obvious constraint: reopening puts the decision back in front of the host, it does not
  invent the answer they never gave. `approved -> lapsed` and `walkin_approved -> lapsed`
  do not exist — an approval that lapses is `expired`.
- **`lapsed` proves a walk-in origin on its own** (`DEFINITIVE` in `lib/visitOrigin.ts`),
  since only a `pending_approval` row can reach it and only a walk-in ever passes through
  that status. No `scheduled_for` guess, and `statusProvesOrigin` is true, so no origin
  chip beside a badge that has already said it.
- **Verified live 2026-08-17**, not just applied: `sweep_no_shows_daily()` closed the one
  real stale request (`VIS-20260816-0003`) and returned 0 on the second run; a request made
  today does not lapse until 22:00 IST. `tests/security/lapsedRequests.test.ts` covers the
  department scoping, today's row surviving, the absent audit/notification, the
  idempotency and the service-role-only ACL. Its fixtures **age a row with a service-role
  UPDATE, not on the insert** — `generate_visit_ref` is a BEFORE INSERT trigger that stamps
  `new.created_at := now()` unconditionally, which is why `noShowWorkflow.test.ts` ages its
  rows through `scheduled_for` and this one cannot.

### `084`–`089` — the data the admin console needed (2026-08-17, applied + verified live)

The client's reference screens asked for six figures this schema could not answer.
Rather than render them as placeholders — which would put numbers on an admin screen
that the system cannot stand behind, the same defect as the deleted "Gate Status:
Operational" chip — the columns were added. **Every one is NULLABLE and every screen
says what it does not know.**

- **`084` — `entry_points` + `visits.entry_point_id`.** WHICH DOOR a visitor came
  through. This is **not** `lib/visitOrigin.ts`, which answers which ROUTE they took
  (pre-approved vs walk-in) — "desk" in this codebase has always meant the route, so it
  could not be borrowed for the door. A TABLE, not a text column (a free-text gate name
  spells one door four ways within a month and the utilization panel then shows four
  doors) and not an enum (a door opening would need a migration). `active` retires a
  closed gate while keeping its history, which is why there is **no delete policy**.
  Seeded with the four doors the reference screen names. Arrivals with a null entry
  point are reported **separately as `unrecorded`**, never folded into a gate:
  attributing them to Reception A would put a fabricated location on a record somebody
  may later be asked to account for.
- **`085` — `visitors.email`, `visits.invitation_sent_at`.** Email is **optional and
  stays optional**: `phone` is the identity column (migration 060's one-open-visit rule
  is built on it) and demanding an address from someone standing at reception would
  block the registration this system exists to make fast. The CHECK is a loose typo
  guard, deliberately not an RFC 5322 attempt — the only authority on whether an address
  works is a delivery attempt. `invitation_sent_at` is a TIMESTAMP, not a flag: "yes"
  and "when" are one column that way. **Nothing sends the invitation yet** — there is no
  invite button on the Pre-Registration tab for that reason.
- **`086` — `visit_feedback`.** Guest satisfaction. ONE ROW PER VISIT, enforced by a
  unique index rather than by whichever screen collects it — three plausible writers
  (kiosk, guard check-out, a future emailed link) with no constraint is how one visit
  gets rated three times and the mean drifts toward whoever pressed hardest. That index
  is also what makes the wide insert policy safe. The mean is computed **at read time**
  and never stored, so it cannot go stale against the rows. Read is admin/HOD only — a
  rating judges the people who hosted the visit, and a gate screen is where the visitor
  who wrote it may be standing. **No update and no delete policy**: a rating the rated
  party can edit is not a rating.
- **`087` — `badge_prints`.** A LOG, not a queue. `lib/printBadge.ts` already existed
  and the gate was already printing; nothing recorded it, so a reprint was
  indistinguishable from a first print. The admin tab **reads it and never writes it** —
  the standing rule that a badge is minted at the gate by the guard who can see the
  visitor did not move. Append-only by construction (no update, no delete policy).
- **`088` — `visits.checkin_duration_seconds`.** How long the DESK took. The obvious
  substitutes are both wrong: `checked_in_at - scheduled_for` measures how punctual the
  VISITOR was and is undefined for every walk-in, and `checked_in_at - created_at` is
  days long for a pre-approval booked in advance. A single integer rather than a start
  timestamp, because a start is only meaningful paired with an end and invites the
  reader to subtract two columns that may straddle a guard walking away mid-flow. Bounded
  1..3600 — a flow abandoned over lunch is recorded as **unmeasured**, not as slow, or a
  38-second mean drags into the minutes exactly when the tile matters. **Null on every
  existing row**, and the tile says how many arrivals carried a measurement rather than
  averaging over nothing.
- **`089` — `app_settings`.** Key/value with a jsonb value. The alternative was leaving
  the toggles as constants in the bundle — which on a Vercel deployment means
  unchangeable from the running app, the exact trap the deleted `qr` feature flag fell
  into. Key/value rather than a column per setting so a new toggle needs no migration and
  no schema-cache reload. Nothing in the database enforces a value's SHAPE, which is why
  **`src/lib/appSettings.ts` owns the typed schema and COERCES on read** — a wrong-typed
  row falls back to the documented default rather than being cast into something
  plausible. **The seed and that file are ONE schema written twice; edit them together.**
  Every default is the behaviour the app already had, so applying the migration changes
  nothing until an admin moves a switch — in particular `checkin.require_photo` /
  `require_id_scan` / `require_card_number` seed **true**, because seeding them false
  would silently loosen four live gates on the day this applies. Read is granted to every
  signed-in role: a setting only the admin can see cannot change how the gate behaves,
  which is the entire point. **No delete policy** — a removed key falls back to a default
  silently, indistinguishable from the setting turning itself back on.

**Applied + verified live 2026-08-17**: `entry_points`, `visit_feedback`, `badge_prints`
and `app_settings` all exist, `visits.entry_point_id` / `invitation_sent_at` /
`checkin_duration_seconds` and `visitors.email` all exist, RLS is enabled on all four new
tables, `entry_points` holds its 4 seed rows and `app_settings` its 26. **What is not yet
true is that anything WRITES the new columns or rows** — no screen sets
`entry_point_id`, no flow stamps `checkin_duration_seconds`, and nothing inserts a
`visit_feedback` or `badge_prints` row yet, because wiring those writers was a separate,
deliberate scope decision from adding the schema they need. Until a writer exists, the
admin tabs render their honest empty states: "Not measured", "No visitor has rated
today", "No arrival in this range recorded an entry point". That is the design, not a
failure mode.

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
                     # Dashboard (17-line shell) + GuardDashboardMain (the whole
                     #   board: four KPI tiles, Expected Today panel, ID
                     #   Verification — whose Verify ID opens the check-in flow
                     #   IN PLACE with the scan overlay open), ArrivalQueueTable,
                     #   IdVerificationCard, KpiDrilldownSheet (the in-page KPI
                     #   expansion), DenyEntryConfirm;
                     # GuardLiveQueue = the "Entry & Exit" tab (/guard/inside-now)
                     #   + LiveQueueTable, CheckInFrame,
                     #   CheckInBadgeRail, CheckInTimeline;
                     # PreApprovals + PreApprovalRow; Search;
                     # CheckInPanel + CheckInMatchList, CheckInPhotoStep;
                     # VisitorForm + VisitorFormFields, VisitorFormAlerts,
                     # VisitorFormPreApproved; WalkInRequest
  pages/HOD/         # HODConsole (shell: dashboard / walk-in desk / schedule, all
                     #   ?tab= views of /overview) + HodKpiBoard, HodWalkInDesk,
                     #   HodDecisionPanel, HodSchedule — ALL drawn with the shared
                     #   components below, no hod-* CSS;
                     # Approvals (the pre-approval FORM), ApprovalsPendingList,
                     # ApprovalsVisitList, HODOverview, OverviewStatCards,
                     # OverviewUpcoming, OverviewNotifications, PreApproveForm
  pages/Shared/      # Reports (+ReportsToolbar, ReportsAnalytics — the admin-only
                     #   chart band that /analytics became — and ReportsDownloadCards,
                     #   the four standing CSV reports, each built from the rows
                     #   already on screen so the file and the register agree);
                     # WhosInside + WhosInsideVisitorCard; VisitorsDashboard
  pages/Admin/       # DepartmentsManager (state), DepartmentCard,
                     # DepartmentForm, HodList, HodForm, AdminStats, AdminAlerts,
                     # ConfirmDialog, AdminConfirmDialogs, Activity;
                     # click-to-drill overview: adminOverviewView (view keys),
                     # AdminOverviewPrompt (collapsed), DepartmentList,
                     # HodDirectory, UnassignedDepartments
  pages/Kiosk/       # Kiosk (state machine) + KioskIdleScreen, KioskPhoneScreen,
                     # KioskFormScreen, KioskBadgeScreen, KioskAuroraBackdrop,
                     # useKioskAutoReset (idle timeout + badge countdown)
  components/        # DashboardTile, DashboardPanel, DashboardVisitorTable — the
                     #   guard board AND the HOD board render these same three, which
                     #   is what stops the two views drifting apart visually;
                     # AdminKpiTile (the admin console's own card — a DIV, not a
                     #   button: it opens nothing, unlike the two drill-down tiles
                     #   above, whose contract is "a tile's count is the length of
                     #   the list it opens"); SettingToggle
  components/charts/ # ChartCard, LineChart, DonutChart, BarChart, UtilizationRows —
                     #   hand-rolled SVG, no charting dependency. Every chart also
                     #   emits an `sr-only` list of its label/value pairs: that is
                     #   its accessible content AND what the tests assert on, so a
                     #   cosmetic change cannot break a test about the data.
  pages/Admin/       # The nine-tab console: AdminDashboard (+AdminDashboardKpis),
                     #   AdminLiveCheckIn (+LiveCheckInTabs), AdminPreRegistration
                     #   (+Kpis, +Filters), AdminVisitorsLog (+VisitorsLogFilters),
                     #   AdminHosts (+HostDirectoryCard, HostNotificationsPanel),
                     #   AdminBadges (+BadgePrintsTable), AdminSecurity (+Kpis,
                     #   BlacklistPanel, AlertsPanel, DeniedEntriesPanel,
                     #   BlacklistForm), AdminSettings (+SettingsRail, SettingsField,
                     #   SettingsRolesUsers — which renders the OLD Admin Panel's
                     #   DepartmentsManager unchanged); AdminPageHeader,
                     #   AdminTablePagination (generic — holds no idea what a row is)
  routes/            # adminRoutes.tsx — the console's nine routes, returned as an
                     #   ARRAY of <Route> spread into App.tsx's one <Routes>. A
                     #   nested <Routes> would create a second matcher and break the
                     #   path="*" fallback.
  components/layout/ # AppShell, Sidebar, navLinks (ALL_LINKS — the one
                     #   source of truth; SidebarNavGroup.tsx was deleted
                     #   2026-08-13, there are no nav groups),
                     # SidebarProfile (SidebarAnalytics was deleted 2026-08-17)
  lib/               # roleRoutes, theme, errors, mfa,
                     # adminDashboard / adminReports / adminHosts / adminSecurity /
                     #   adminBadges / adminLiveCheckIn / preRegistration /
                     #   visitorsLog / reportBundles — the admin console's figures,
                     #   as PURE functions over Visit[]. Same rule as guardTiles:
                     #   one predicate feeds both a count and the rows it opens, and
                     #   a pure module is what makes every figure unit-testable,
                     # useAdminVisits (the ONE admin visit query — and it exports no
                     #   mutation, which is what makes the read-only rule structural),
                     # appSettings + settingsSections (the typed half of migration
                     #   089; the defaults here and the seed there are one schema
                     #   written twice), chartPalette, initials,
                     # guardTiles (ONE predicate per dashboard tile — the count
                     #   and the drill-down list are both derived from it),
                     # useTodayVisits (the whole day, one fetch, feeds every
                     #   drill-down and the Verify ID flow),
                     # activeVisit (already-inside checks + guard-readable message),
                     # usePreApprovals,
                     # useGateActivity (Entry & Exit: inside + today's exits),
                     # preRegisteredBoard (who is on the board at all, one
                     #   predicate per chip, and the three-state pill),
                     # visitTimeline (approved/checked-in/checked-out instants),
                     # visitorSearch (pure query parsing),
                     # statusRail (VisitorCard only — the stacked card has no rail),
                     # visitOrigin (pre-approved vs walk-in, INFERRED — read the note),
                     # adminDepartments, adminHods (admin CRUD + validation),
                     # useDepartments, useHods (live, realtime-subscribed)
  styles/            # tokens, base, components-forms, components-surfaces,
                     # components-feedback, components-guard, components-dashboard,
                     # components-filter, components-visitor-stack, aurora, animations
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
