# VMS — Visitor Management System

React 18 + TS + Vite · Supabase (auth, DB, realtime, RLS) · Tailwind (`brand-*`, `navy-*`,
`accent-*`, `surface-*`) · Vitest + RTL. Deployment is **IST end to end**.

Roles: `guard | hod | senior_manager | staff | admin | ceo` (`src/types/index.ts`).
**EVERY ACCOUNT THAT IS NOT A GUARD AND NOT AN ADMIN IS AN HOD** (client instruction,
2026-08-18): `hod`, `senior_manager` and `staff` get the same routes, the same nav, the
same desks and the same permissions — one list, `src/lib/hodRoles.ts` (`HOD_ROLES` /
`isHodRole`), mirrored in the database by migration 100's `public.effective_role()`. Edit
the two together. `staff` in particular is what a HOST is here
(`get_hosts_for_department` returns the staff and HODs of a department), so a staff
account raising its own pre-approval is the point of the change. `ceo` is deliberately
OUT of that list — it is the second pair of eyes on an admin's blacklist-removal request,
and it is refused by `admin_create_user`, so no created account can be one. See Settings
→ Users and migrations 098/099 (senior_manager) and 100/101 (staff).

## Hard Rules
- **Max 300 lines per file. No exceptions** — `src/`, `tests/`, CSS, SQL alike. Split
  before committing: components → sibling children, hooks/libs → one concern per file,
  tests → by behaviour under test, CSS → layer files + `@import`. Check:
  `find src tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) -exec wc -l {} + | awk '$1 > 300'`
  must print nothing.
- **No fuzzy matching for known enums.** Use `Record<string, T>` lookups, never
  `includes()` chains.
- **No duplicate renders.** Never render the same value twice in one card/widget/screen.
- **Every new page needs a test file**: heading, empty state, data, edge case.
- **One concern per file.** Fetching, layout and business logic live apart.
- **A tile's count is the length of the list it opens.** One predicate feeds both. Never
  a second source for a count.
- **Never write `dark:text-navy-*`** — the navy scale is INVERTED in dark mode
  (`tokens.css`: light `--c-navy-200` pale, dark near-black), so one step already resolves
  correctly in both themes and the override is the bug. Pick one: **700** secondary text,
  **800** values that get scanned, **950** primary name, **600** minimum for any control
  or icon. `dark:text-white` is fine (different scale).
- **Colour is never the only carrier of status** — always a text badge too.
- **A STAT CARD'S HEADING AND EVERY COLUMN HEADER ARE 13px** (2026-08-18, client
  instruction: increase them by two everywhere). Three classes carry the whole instruction —
  `.table-head` (every table header in the app), `.stat-label` (the plain stat card) and
  `.gate-tile-label` (`KpiTile`) — plus the eyebrow literal in `DashboardTile` and
  `AdminKpiTile`, which must keep matching each other. The sizes are written out rather than
  raised in the `micro` token: that token also sets form labels and every grouping caption,
  and what grew is a heading, not the smallest type in the system.
- **EVERY table header row is `.table-head`, and it is GOLD AND BOLD** (2026-08-18, two
  client instructions the same day: headers must stand out from the sub-text under them,
  and every table header is bold). One class in
  `styles/components-surfaces.css` carrying size, uppercasing, weight and colour; the colour is
  `--c-gold`, defined once per theme in `tokens.css`, so the class needs no `dark:` twin.
  All five tables wear it — `DashboardVisitorTable` (guard AND HOD), `LiveQueueTable`,
  `RegisterTable`, `AdminBlacklistPanel`, `UserDirectoryTable`. It replaced five
  hand-written copies that had already drifted (four `text-navy-500`, one `navy-700`, one
  carrying a forbidden `dark:text-navy-400`). Never give a new table its own header
  colour. The WEIGHT is on the `th` as well as the row (`font-bold`, was `font-semibold`):
  a Tailwind utility on the cell beats one inherited from the row, so the two have to
  agree — `Reports.test.tsx` asserts the cell's class. `UtilizationRows`' header row wears
  `.table-head` too, because a list that is a table in everything but its markup must not
  pick its own heading colour. Paper is unaffected: `print.css` forces
  `thead th { color: #555 !important }`, because gold ink prints as grey.
- **No fabricated facts on any screen** (no hardcoded "Gate Status: Operational", no
  unconditional "Identity verified", no invented parking slots). If the system cannot
  stand behind a claim, don't render it. Unknown reads "Not recorded" / "Not measured".

## Testing / conventions
- `npx vitest run` · `tests/unit` · `tests/security`.
- Mock `vi.mock('../../src/supabaseClient', ...)`; channel mock `const ch: any = {}; ch.on = () => ch;`
  (avoids TDZ).
- **CSS `@import` must precede `@tailwind`** in `src/index.css` — otherwise Vite drops the
  `src/styles/*.css` imports silently (bundle 94 kB → 69 kB, warning only).
- `load(silent=true)` skips `setLoading` so realtime refreshes don't flash KPIs.
- Sidebar nav: `components/layout/navLinks.tsx` `ALL_LINKS`, each with `roles: UserRole[]`.
- Classes: `status-badge`, `tab-active/inactive`, `card-hover`, `card-premium`, `input`, `label`.

## Every non-guard, non-admin role is an HOD (2026-08-18)
- **`src/lib/hodRoles.ts` is the client-side list**, `public.effective_role()` (migration
  **100**) the server's. `ROLE_ROUTES.staff` is the HOD list written out, not aliased —
  `routeProtectionStaff.test.tsx` asserts EQUIVALENCE with `hod` rather than a copied path
  list, so the three cannot drift. Staff lost `/visitors` and `/whos-inside` (that is the
  instruction, not a casualty: both were display-only views of rows `/overview` shows with
  the decisions attached). `VisitorsDashboard` stays on disk — an unlinking, not a deletion.
- **099 SAID "ONE EDIT, NOT TWELVE", AND IT WAS ONE EDIT SHORT.** Six SECURITY DEFINER
  bodies and five policies never call `current_user_role()` — they inline
  `auth.jwt() -> 'app_metadata' ->> 'role'`. So a **senior manager could not approve or
  decline a walk-in** between 098/099 and 100/101: the console offered the button and
  Postgres raised "Only HOD or Admin can approve visits." 100 rebases `approve_visit`,
  `reject_visit`, `cancel_visit`, `cancel_all_pre_approved` and `clear_pre_approved`; 101
  rebases `enforce_visit_update_rules`, the two `visitors` write policies and the three
  `recurring_visits` policies. All on `effective_role()`, which reads **`app_metadata`
  only** (SEC-8 — three of those bodies had a `user_metadata` fallback, and that column is
  writable by the person it describes).
- **`notify_hod_on_visit` is a FAN-OUT, not `limit 1`** (101). It used to pick one profile
  with `role = 'hod'`, so a department headed by a senior manager — or staffed only by
  hosts — was never told a visitor was at the gate. It now notifies every approver in the
  department plus the named host. **The enum literal needs an explicit
  `::public.notification_type` cast**: under `select distinct` an untyped literal resolves
  as `text` before the INSERT can coerce it, and the trigger raised 42804 on every walk-in
  request without it.
- **`pre_approve_visitor_v2` never had a role check** — it is SECURITY DEFINER and
  bypasses RLS — so the pre-approval half of the instruction was a FRONTEND gate all
  along: staff simply had no `/approvals` route.
- **NOTHING ON THE DEPARTMENT SCREENS REWRITES A PERSON'S ROLE ANY MORE** (2026-08-18).
  `removeHod` and `deleteDepartment`'s unlink used to stamp `role = 'staff'`; `addHod`
  used to stamp `role = 'hod'` on whoever it promoted. All three withdrew or granted
  NOTHING — a staff account is an approver — while destroying the one record of what the
  person actually is, which is the string the directory, the sidebar greeting and every
  role chip print. The write that matters is **`department_id`**, which is what every
  approver RPC and every policy scopes on, so removal leaves the account able to reach
  the desk and find nothing on it. `addHod` still writes `role = 'hod'` for a brand-new
  invite or for somebody who is not yet an approver (a guard); an existing `hod` /
  `senior_manager` / `staff` keeps their own title. A real "switched off" state is
  Settings → Users' Deactivate (migration 094), never a role rewrite.
- **`useHods()` reads `role IN (HOD_ROLES)`, not `= 'hod'`** — a department headed by a
  senior manager used to read "Awaiting an HOD" while its head approved that department's
  visitors all day. The roster and the Heads of Department directory print each person's
  OWN job title through `HodRoleChip` (`ROLE_LABEL`/`ROLE_CHIP` from `lib/userStatus.ts`,
  the same pair Settings → Users uses), because one permission with three titles is only
  legible if the screen says which. Guarded by `HodRosterRoleChip.test.tsx`.
- App-side edits, all reading `HOD_ROLES`: `navLinks` (four HOD items + Reports),
  `NotificationBell` (they receive the walk-in requests), `VisitorDetails` (no ID proof),
  `mfa` (the account can clear a stranger into the building), `visitStatusLabel`
  ("Person to Meet", not "Staff").

## Route access
`src/lib/roleRoutes.ts` is the single source of truth; `isForbidden()` enforces in
`App.tsx` (prefix match). Auth = JWT `app_metadata.role` + `department_id`, fallback
`profiles`. `/profile` is last in every `ROLE_ROUTES` list; the first entry is the
landing page.

**Adding a role means five edits and three fail silently**: `ROLE_ROUTES` (only one that
fails at compile time), `resolveUserRole.isUserRole` (missing ⇒ reaches NO route,
indistinguishable from a lockout — now `satisfies readonly UserRole[]`), `AppShell`'s
greeting (`Record<UserRole, string>`, was a ternary chain defaulting to 'Staff'), and the
two `ROLE_LABELS` maps.

## Global invariants
- **"Today" is an IST day.** `istDateKey` / `istDayStart` / `istDayEnd` from
  `lib/visitExpiry.ts` (`IST_OFFSET_MS` is defined there, once). Never
  `${dateKey}T00:00:00Z` — that bound is 05:30 IST and drops the night shift; the paired
  `T23:59:59Z` runs to 05:29 IST next morning. Nine call sites had retyped it (fixed
  2026-08-17). Guarded by `tests/unit/lib/istDayWindows.test.ts`, a SOURCE scan over
  `src/lib`, `src/pages`, `src/components`.
- **`rangeBounds(range)` in `lib/reportsDateRange.ts` is the one definition of what a
  calendar day covers**: IST midnight → next IST midnight, `[from, to)`. Parsing/formatting
  a date-only KEY in UTC (`computeDateRange`, `formatDay`) is the deliberate exception.
- **Open visits are never date-bounded.** `Console.loadVisits`, `useTodayVisits`,
  `useGateActivity` and the HOD queries all OR in open statuses / arrival / departure
  windows, or overnight work vanishes at midnight (a walk-in raised 23:50 approved 00:05,
  a visitor still inside, a booking made last week for today).
- **An open-ended list and a sweep that cannot close it are two halves of one design —
  never ship one alone.**
- **Timestamps compared as instants, never strings** — PostgREST renders `…+00:00`,
  `toISOString()` ends `Z`, and `'+' < 'Z'`.
- **An expected time is always DATE AND TIME**, never a bare time (`formatDateTime`); no
  slot reads "Anytime", never a dash. Same for every In/Out cell (`dashboardColumns.stamp`).
  **A SEARCH RESULT CARRIES NO SLOT AT ALL** (2026-08-18, client instruction: don't mention
  the schedule anywhere in the result — show the type of visitor, the walk-in approval time
  and the check-in time). Both result rows obeyed the rule above and were wrong anyway:
  `CheckInMatchCard`'s clock badge printed `scheduledFor` or, for every walk-in, the words
  "Anytime today", and `SearchResultCard` had a "Scheduled … NA" field whose commonest
  value was the admission it had nothing to say. What replaces them is not a shorter guess
  — the type badge says which desk, and the named instants (Approved at / Checked in at /
  Checked out at, each a `formatDateTime`) say what happened. The slot is still on the
  record the row opens, and `CheckInBadgeRail` / `PreApprovalRow` / `VisitorCard` /
  `CheckInVisitorSummary` keep theirs: those are the RECORD, not a result. A pass booked
  for another day now says "Not due today" instead of printing the day.
- **NOBODY IS LATE FOR A SLOT THAT WAS ALREADY GONE WHEN IT WAS BOOKED** (2026-08-18,
  client report: a visitor whose pass read 12 am and who arrived at 11 am was called late).
  The subtraction was right and the conclusion was nonsense — the live row (SP,
  `VIS-2026-08-18`) was raised at 10:08 IST for 00:10 IST the SAME morning, which is a
  datetime picker left on AM, so no one could have been punctual for it even in principle.
  **`isKeepableSlot` (`lib/visitExpiry.ts`) is the one place that judgement is made**: a
  slot preceding its own `created_at` by more than `SLOT_BACKDATE_TOLERANCE_MINUTES` (15 —
  a pass raised for somebody already at the desk lands a minute or two behind) is not an
  appointment. `lateArrivalMs` returns 0 and `minutesPastSlot` returns null, so the Late
  chip on an arrived row and the LATE/MISSED pill on the Pre-Registered board both go quiet
  together and one visitor cannot read differently on two screens. **The slot is still
  stored, still shown, still exported — what stops is the JUDGEMENT drawn from it.**
  `validatePreApproval` refuses to create any more (same tolerance, and the message names
  AM/PM); `isKeepableSlot` exists for the rows already in the database, which cannot be
  re-typed. The three `PreApproveForm*` test files and `visitLifecycle.test.ts` now carry a
  **fixed clock** — their fixtures are dated literals, so a real `now` would have passed on
  the day they were written and failed for good after.
- **No zone suffix on any exported column** (the deployment is IST; naming it on one
  column implies the others might differ).
- **If a panel needs a row the tiles don't have, widen the existing hook — never add a
  second query.** Two answers to "what happened today" on one screen is the defect this
  project has fixed repeatedly.
- **AN OVERSTAYING VISITOR IS FLAGGED IN RED AT THE TOP OF EVERY BOARD**
  (2026-08-18, client instruction). `components/OverstayAlertBanner.tsx` sits above
  `GlanceHeader` on the guard dashboard (`GuardDashboardMain`, over `useTodayVisits`), above
  it on the admin Dashboard (over the same two-day fetch, which is why that fetch is worth
  keeping — the visitor most likely to be overdue arrived at 21:00 last night) and above
  `HodKpiBoard` on the HOD Overview (over `onSite`, whose query is deliberately not
  date-bounded). **It runs `isOverstaying`, the Overstaying TILE's own predicate** — a
  banner with a threshold of its own would be a second answer to "who is overdue" on the
  same screen as the first. It names each visitor, the overrun (`formatDuration` over
  `overstayMs`, longest first) and the host, carries `role="alert"`, and renders **nothing**
  when nobody is overdue.
- **One KPI card design everywhere**: `components/KpiTile.tsx` (guard dashboard, Visitors
  rail, HOD overview, admin panel, `WhosInside`). Active = `gate-tile-active` gold ring
  only, never a border/cap change. No `compact` variant, no top cap / accent bar / per-card
  border (deleted 2026-08-13 — the gradient faded across each card's own width so wide and
  narrow cards read as different border weights). Identity is the numeral's colour. Hover
  `translateY(-3px) scale(1.025)` + ring, dropped under `prefers-reduced-motion` (ring
  survives). Aria: `pressed`/`controlsId`/`caption`; accessible names join block spans
  without spaces, so tests must query unanchored substrings. Plain non-clickable stats stay
  `stat-card` divs. `AdminKpiTile` is a DIV — it opens nothing. Rules in
  `components-surfaces.css`.
- **A KPI CARD IS THREE VOICES, NOT THREE SIZES OF ONE** (2026-08-18, client instruction:
  beautify the text in the dashboard KPI boxes, HOD and admin especially). An **11px
  semibold uppercase `tracking-[0.07em]` eyebrow** names the measure, a **display numeral
  set `leading-none font-semibold tracking-tight`** IS the answer, and an **11px
  `leading-relaxed` caption** qualifies it. It was 13px medium / 2rem medium / 12px —
  three sizes of roughly the same voice, which is exactly why the cards read as busy:
  nothing on them was clearly subordinate to anything else. `DashboardTile` (guard + HOD)
  and `AdminKpiTile` carry the IDENTICAL treatment and must keep doing so; the eyebrow
  also buys the label a line, so "Awaiting Walk-in Approval" now fits a four-across tile.
  Uppercasing is CSS, never the string — every test that queries a label by text still
  matches.
- **`GlanceHeader` is the one board header** ("Today at a Glance", `h2`, per-board caption,
  no date — the topbar clock carries it). Guard, HOD and admin Dashboard render it, and
  **no tile says "Today"**: labels are `Expected` / `Checked In` / `Checked Out` /
  `Total Visitors` / `Declined`. "Total Visitors" not "Visitors" — the short form collided
  with the flow chart series and the Top Hosts count column.
- **One switch: `components/SettingToggle`** (OFF track `bg-surface-300`, focus ring,
  `aria-hidden` knob). A hand-rolled copy in `HostNotificationsPanel` had drifted to
  `bg-surface-200` — an invisible rectangle on the card behind it. (That panel was deleted
  on 2026-08-18; the rule it illustrates is why the component exists at all.)
- **`ModalCloseButton`**: default `absolute top-4 right-4` spans 16–52px from the right, so
  anything on a modal's first row needs `pr-14`; a compact header row with content on its
  right must pass **`inline`** instead (a normal flex child — collision then impossible).
- **Charts** (`components/charts/`) are hand-rolled SVG, no dependency, and each emits an
  `sr-only` label/value list — that is its accessible content AND what tests assert, so
  cosmetics can't break a data test. `DonutChart` is `flex-wrap` with a `basis-40` legend
  and `UtilizationRows` a `flex-1` / `w-12` / `w-16` split: a chart card is one
  third of a three-column grid (~270px inner width), so fixed widths overflowed. Per-row
  unit words are dropped (the header says it); the unit survives as the cell's `aria-label`.
- **`UtilizationRows` HAS NO BAR AND NEVER CLIPS A NAME** (2026-08-18, client instruction:
  on Top Hosts show the host's name in full and the share). The proportional bar was the
  only element on the row carrying no figure of its own — the percentage says how much and
  the count says how many — and it was paid for out of the label column, which then had to
  `truncate`. Row is now `name · share% · count`, the name wraps, and `showShare` is passed
  at **every** three-header call site (Top Hosts on the admin board, Department Summary on
  Hosts — the HOD board's Busiest Hosts card went on 2026-08-18) — the middle header
  renders only when it is, so a "Share" column can never head an empty cell. The `color` prop is deleted with the bar.
- **`prefers-color-scheme`/theme colours resolve through tokens** so a rebrand follows
  automatically. Palette is Quest Mall gold/bronze — a hue is only information if it means
  the same thing on every screen.

## Guard console (visitor-only deployment)
**Sidebar: FIVE plain links** — Dashboard, **Find & Scan**, Register Walk-in, Entry & Exit,
**Pre-Registered**. The first four are the 2026-08-18 client instruction ("the guard cannot
waste so much time navigating here and there"); Pre-Registered was dropped that day and
**asked back the same day**, so it sits LAST — the three items above it are where a guard
starts something, and it is a list of work already under way. No groups; `SidebarNavGroup.tsx`
deleted 2026-08-13.
- **Pre-Registered** (`/guard/preregistered` → `GuardPreRegistered`) renders today's
  approved arrivals who have not turned up, which is also the dashboard's **Expected Today**
  panel: ONE predicate feeds both (`TILE_FILTER.expected` / `isPreRegisteredArrival`, both
  over `useTodayVisits`), so this is one list on two surfaces and never two answers. Both
  can START the check-in in place. If the membership rule changes it changes in
  `lib/preRegisteredBoard.ts` and both follow.

**What went, and why each was a duplicate rather than a loss:**
- **Visitors** left the guard nav on 2026-08-15 and its five segments now redirect too:
  `/visitors`, `/visitors/:segment` and `/guard` all land on `/guard/dashboard` for a
  guard. Every one of them was DISPLAY-ONLY — a guard could reach five URLs and act on
  none — and each restated a list that exists where a guard can act (Inside = Entry &
  Exit's first lane, Pending / Approved Walk-ins = dashboard tiles, the register =
  `/guard/walk-in`). Staff still get `VisitorsDashboard` at `/visitors`; the route was
  always two components behind one path.

**This is an UNLINKING, not a deletion.** `GuardConsole`, `GuardPreRegistered`,
`VisitorSegmentContent`, `VisitorStackList`, `VisitorGridCard`, `VisitorKpiRail` and their
tests are all still on disk, and `lib/visitorSegments.ts` in particular is load-bearing for
`guardTiles`, `gateLanes` and `useGateVisits` — deleting it would take three live modules
with it. If those pages are ever to go for good, that untangling is its own pass.

### Find & Scan (`/guard/scan-pass`) is the one place a guard finds and acts
Renamed from "Scan Pass" 2026-08-18: the old name described the camera, not the page.
- **Four ways in, one record, ONE button.** QR at the lens, a PDF or image of a pass, a
  typed name / mobile / ref, or **the number on the physical visitor card**. The row it
  finds renders exactly one action, decided by where the visitor actually is:
  **Check In** when the pass is honourable today and they are outside, **Check Out** when
  `status === 'checked_in'`, and **no button** otherwise with the status stated.
- **The card lookup is TODAY ONLY, LATEST FIRST** (`fetchVisitsByCard`, client instruction
  2026-08-18). It was `status = 'checked_in'` — the single live holder — which answered half
  the question: a card handed back at 11:00 and reissued at noon has had two holders today,
  and the guard needs the current one on top with the earlier one under it. The window is
  therefore `checked_in_at >= istDayStart()` (the same bound `guardTiles.checkedOut` and
  `useGateActivity` use, and unlike a status test it cannot drop a visitor the moment they
  walk out); last week's holder is still excluded, because a card is reissued daily and those
  rows are strangers wearing the same label. Matched EXACTLY and case-insensitively — the
  guard is quoting an identifier, so `%10%` returning C-104, C-1042 and B-210 is worse than
  useless, but `c-104` must find `C-104`. Indexed by migration **097**.
- **THE PHONE LEG ONLY FIRES ON SOMETHING PHONE-SHAPED** (2026-08-18, client report:
  searching a card number returned yesterday's visitor). It fired on any query carrying two
  digits, and it is a SUBSTRING match on `visitors.phone` — so "C-V12" was reduced to "12"
  and matched a stranger whose mobile happened to contain those digits, above a card that
  had never been issued. `isPhoneShaped` now requires **no letters and four digits or more**
  (a card number, a ref and a name each have a leg that matches them properly; four is the
  "last four" a person actually quotes). Separators are still welcome — "+91 90786 12345"
  searches. Never loosen this back to a digit count alone.
- **CARD HITS SORT AMONG THEMSELVES AND SIT ABOVE EVERY OTHER LEG** (`byCardIssueDesc` in
  `searchVisits.ts`). They are ordered by `checked_in_at` — when the card was ISSUED — not
  `created_at`: a pre-approval raised last week and used this morning is the row in the
  guard's hand, and a created_at sort buries it under a walk-in registered an hour ago. The
  ref/name/phone legs keep their `created_at` order below. Two ordered groups, never one sort.
- **CLICKING A RESULT OPENS THE ENTRY & EXIT FRAME** (`ScanPassDetail.tsx`, client
  instruction 2026-08-18). It is the SAME `CheckInFrame` — identity ring, Photo → ID Scan →
  Host Notified tracker, `CheckInTimeline`, vehicle, printable pass — never a lookalike. It
  re-reads the row through `lib/fetchVisitById.ts` (one definition of the visit select,
  which `checkOutFlow.fetchVisitForExit` now delegates to) rather than widening `MatchItem`,
  and it re-reads at the press for the same reason the exit does. **It writes nothing**:
  Check Out opens `CardReturnConfirm` + `logVisitExit`, Check In hands to `CheckInPhotoStep`
  so the photo, the mandatory ID scan and the card number are still collected by the one flow
  that collects them. Exactly one of the two renders — `checked_in` → Check Out,
  `isCheckableStatus && isDueToday` → Check In, otherwise neither, and the record still
  opens. `CheckInMatchCard`'s new optional **`onOpen`** is what makes the whole row openable
  regardless of `disabled` (absent on the pre-approvals desk, where a click IS the check-in);
  `CheckInBadgeRail` gained an optional `onCheckIn` and a `backLabel`.
- **`canCheckOut` is deliberately NOT gated on `disabled`** — that flag means "cannot be
  checked IN", which is exactly what somebody already inside is.
- **The exit is NOT reimplemented here**: the same `CardReturnConfirm` + `logVisitExit`
  pair Entry & Exit uses, so `lib/checkOutFlow.logVisitExit` now has TWO callers and they
  cannot disagree about whether a human witnessed the departure. `fetchVisitForExit`
  re-reads the visit at the press — another device may have checked them out while the
  results sat on screen.

**No badge/QR minting anywhere in the guard surface** (`lib/passVisibility.ts`,
`Console.tsx` header) — a guard must never mint an entry pass. No Badge import in Console.
Tests in `VisitorCard` and `GuardConsole` assert the absence.

### Visitors surface (`/visitors/:segment`)
- **`lib/visitorSegments.ts` is the single source of truth** — sidebar children, page
  content, copy and count badges all derive from `VISITOR_SEGMENTS` / `SEGMENT_META` /
  `SEGMENT_FILTER`. Adding a segment is one edit there.
- **Five segments**: All Visitors, Inside, Pending Approval, Approved Walk-ins, Walk-in
  Register. Deleted, each on client instruction, each degrading onto a live segment rather
  than 404-ing (legacy `?tab=` values map via `segmentFromSlug`):
  - **Overstayed** (2026-08-13) — an overstay is a subset of Inside needing chasing, not a
    stage of life; the guard dashboard's Overstaying tile is where that happens.
    Degrades onto **Inside**. `isOverstaying` stays live — do not delete.
  - **Checked Out** (2026-08-15) — the Entry & Exit tab's subject (holds entry, exit and
    pass). Degrades onto `all`; removed from `visitorSegments.ts` entirely.
  - **Expected** (2026-08-15) — the Pre-Registered board's subject, and that board can
    *act*. Degrades onto `all`. `isDueToday` still live elsewhere.
- **Each segment is a real URL**, routed in `App.tsx`. This replaced an in-page tab bar
  that was invisible from the nav, unbookmarkable and dead to the back button.
  `GuardConsoleModeTabs/ModeContent` deleted; `VisitorSegmentContent.tsx` superseded them.
- **The surface is DISPLAY-ONLY except the walk-in lanes.** No card carries an action; the
  `action`/`actionFor`/`onSelect` props are gone from `VisitorGridCard` /
  `VisitorStackList` / `VisitorSegmentContent`, and `Console.tsx` does not import
  `VisitorDetails`. A card with no action renders **no buttons at all** —
  `VisitorStackList.test.tsx` asserts there is no button.
- **No toolbar**: no search box, no sort. `VisitorStackToolbar.tsx` and
  `lib/visitorStackFilter.ts` deleted, plus `.stack-toolbar`/`.stack-sort*` CSS. Rows
  arrive in `SEGMENT_FILTER` order (newest activity first) and that is the only order. The
  search could only narrow loaded rows while the topbar's `lib/searchVisits.ts` spans every
  visit; the sort's default option restated the order already on screen. The test fails on
  any `select`, `combobox`, `searchbox` or `/sort/i`.
- **The grid card is the one visitor layout**: `VisitorStackList` → `VisitorGridCard`
  (circular headshot, name, vendor, host, purpose, date-and-time stamp, status pill) — the
  same face as `PreRegisteredCard`. `VisitorCard.tsx` (single row) still serves
  `GuardWalkIns`/`GuardWalkInApproved`; do not delete. `VisitorStackCard`/`StackFacts`
  deleted. Styles: `styles/components-visitor-stack.css`.
  - **`.visitor-card` WRAPS, in two groups** (2026-08-17): `.visitor-card-lead` (time,
    photo, name — `flex-1`, `basis: 14rem`) and `.visitor-card-trail` (Person to Meet,
    status badge, action — `ml-auto`, wraps). Every child used to be a `shrink-0` sibling
    on one non-wrapping row, and Person to Meet appears at the `md` VIEWPORT breakpoint
    while the card lives in containers far narrower (`RegisterWalkIn`'s `xl:col-span-5`
    lane is ~420px at 1280px) — the row overflowed its box and the **Check In button, the
    only control on the walk-in lane, was carried outside the card**. Never re-flatten the
    two groups: a loose trailing action wraps alone. Guarded by
    `GuardWalkInApproved.test.tsx`.
  - **No leading colour rail** (deleted, not transparented; nothing holds its space). Test
    fails on any `rail-` class. `.visitor-card` keeps its rail — `lib/statusRail.ts` stays.
  - **No "Details" control** — the card IS the record. What only the sheet held (ID image,
    timeline, pass) is reached from `/guard/search` and `/whos-inside`.
  - **Department, vendor and host each appear exactly once** (guarded).
  - **Visitor TYPE chip renders only when `statusProvesOrigin` is false**, as an outline
    chip (never the filled status pill's shape), third column above the ID-proof line. For
    a `checked_in` row the tautological "Approved ✓" tick gives up its place to it.
- **`VisitorKpiRail` sits ON TOP of the list, full width, at the dashboard's size** (same
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`, full `KpiTile`). A filter must never render
  below the content it filters. **No Currently Inside tile** —
  `VisitorKpiSegment = Exclude<VisitorSegment, 'inside'>` makes re-adding it a compile
  error; the segment itself still routes. **The All Visitors tile has no icon** —
  `KpiTile` drops the whole `.kpi-plate` when `icon` is absent.
- **Sidebar count badges come from the page's own rules**: `lib/useVisitorCounts.ts` uses
  `visitorLoadFilter` + `SEGMENT_FILTER`, gated on `role === 'guard'`. Never give a badge
  its own filter.
- **`approved` is in `OPEN_STATUSES`** — load-bearing: without it "booked yesterday,
  arriving today" never loads.

### Walk-in lanes
- **`/visitors/walk-in` → `GuardWalkIns`**: the register form, then the two waits stacked
  in the order they happen — **Awaiting host approval**, then **Awaiting gate check-in**
  directly below (client instruction, 2026-08-17; both headings are the client's words).
  "Awaiting approval" left unsaid *whose* — this desk waits on two people in sequence — and
  a row crossing waits now moves one box down instead of jumping the page.
- **`/visitors/approved` → `GuardWalkInApproved`**: heading **Awaiting gate check-in**, and
  it lists ONLY rows still outside (`isAwaitingGateCheckIn`). The "Already checked in (N)"
  section **and the Check Out it carried are deleted** (client instruction, 2026-08-17): an
  admitted visitor is the Entry & Exit tab's subject, which holds entry, exit and the one
  exit control — the same one-visitor-on-two-surfaces reasoning that took Checked Out off
  the segments. `Console.tsx`'s `exitTarget`/`CardReturnConfirm`/`logVisitExit` wiring went
  with it. Do not re-add an exit here. (**`logVisitExit` has TWO callers since 2026-08-18**
  — Entry & Exit and Find & Scan's search hit — which is the point of it being a shared
  write; the rule this bullet states is about THIS lane, not about the caller count.) Guarded by `GuardWalkInApprovedExit.test.tsx`.
  - **`SEGMENT_FILTER.walkinApproved` is `isAwaitingGateCheckIn`, the NARROW half**
    (2026-08-17). It was `isApprovedWalkIn` (wide) and stayed wide when the
    already-checked-in list was deleted, so the KPI tile and the sidebar badge counted
    admitted walk-ins the page no longer listed — a count that is not the length of the
    list it opens. The tile's own hint already read "Approved at the gate, not yet in".
    The wide question is still asked where it is still answered: `TILE_FILTER.walkinApproved`
    (guard dashboard) and the HOD's Walk-ins Approved tile both keep `isApprovedWalkIn`.
  - **Kicker on top: "Walk-in Visitors at a Glance"** (client instruction, 2026-08-17) —
    `SegmentShell`'s `eyebrow`, a `<p>` above the `h1`, NOT a heading: the page keeps
    exactly one `h1` ("Approved Walk-ins") and the lane keeps its `h2`. Only this segment
    carries it; over the register, whose `h1` is already "Walk-in Visitors", it would print
    the same two words twice.
- **`/guard/walk-in` → `RegisterWalkIn`**: form on the right, the same two waits stacked in
  the left column, and **no already-checked-in list**. Ordering here is the opposite of
  `GuardWalkIns`' pre-2026-08-17 layout on purpose: the form is the page's subject and the
  column beside it is a timeline. `RegisterWalkIn.test.tsx` pins both headings and their
  order.
- **ONE form, THREE screens**: `WalkInCheckInForm.tsx` + `PendingGateCheckIn.tsx` (callers:
  `GuardWalkIns`, `GuardWalkInApproved`, `RegisterWalkIn`). The form owns CAPTURE state
  only and never touches supabase — every screen routes through `Console.checkInWalkIn` /
  `checkInApprovedWalkIn`, so there is exactly one route from `walkin_approved` to
  `checked_in`. `PendingGateCheckIn` holds the OPEN ROW (not each row) — one card is handed
  to one visitor, so two card fields open at once is how the wrong number lands on the wrong
  row — and renders no heading/count of its own.
- **THE GATE CHECK-IN OF AN APPROVED WALK-IN ASKS ONLY FOR THE CARD NUMBER** (client
  instruction, 2026-08-17). No photo, no ID scan, no `PhotoCapture`, no `IdScanOverlay` in
  `WalkInCheckInForm` — `WalkInRequest` refuses to submit without both and uploads the photo
  BEFORE the visit row exists, so the identity record is complete before the host ever sees
  the request; asking again photographed the same person twice for one visit. What is on
  file is SHOWN instead as a ticked read-only line, and each line renders **only if the row
  holds it** (`photo_data || photo_path`, `visitor.id_type`) — no unconditional "Identity
  verified". `WalkInCheckIn` is `{ carrying, remarks, cardNumber }`; `checkInApprovedWalkIn`
  no longer calls `uploadPhoto` or writes `visitors.id_type` — **do not re-add a photo/scan
  argument, it would overwrite what registration filled**. The card number stays mandatory
  (076 demands it back at check-out) and `blockedReason` still names it in one line above
  the buttons, the same rule as `CheckInPhotoStep`. The card field only turns red once
  something has been TYPED — an untouched field is not yet a mistake. `/guard/pre-approvals`
  is the opposite case and keeps its mandatory scan: that document has never been read.
  Guarded by `GuardWalkInApproved.test.tsx` and `GuardWalkIns.test.tsx`, which mock no
  camera at all.
- **`isAwaitingGateCheckIn` (`lib/visitOrigin.ts`) is the narrow half of
  `isApprovedWalkIn`.** Wide = "who did the host clear?" (a record of issuance, keeps the
  visitor after entry); narrow = "who is still at the gate?", so the count beside a box is
  the number of Check In buttons under it.
- **A walk-in registration REQUIRES an ID scan and a photo** (2026-08-16).
  `WalkInIdentityStep.tsx` owns both; submit disabled until both exist and `handleSubmit`
  re-checks (an Enter-key submit must not skip it). The photo uploads via `uploadPhoto`
  BEFORE the visit row is inserted, so a `pending_approval` row never reaches an approver
  without the face. `PhotoCapture` is unmounted while `IdScanOverlay` is open.
  This capture is the ONLY one on the walk-in route: the gate lane reuses it rather than
  taking a second face (see the card-number-only rule above).
- **The walk-in form's camera is OFF until asked for**: `armed` is false on mount and after
  every accepted photo (a submitted request remounts the step via `identityKey`, which
  previously relit the webcam at an empty form pointing at the next person in the queue).
  `live = armed && !scanOpen`.
- **`visits.remarks`** is the walk-in note the HOD reads (migration 068), NOT
  `carrying_remarks`. Length-capped 500 (CHECK + `maxLength`), not allowlisted — it is
  prose typed at a gate. Empty stores `null`.

### Guard dashboard (`/guard/dashboard`)
- **`GuardDashboardMain.tsx` is the whole board** (`Dashboard.tsx` is a 17-line shell);
  drill-down is `KpiDrilldownSheet.tsx`. The older implementation (`DashboardSummary`,
  `DashboardActivity`, `DashboardQuickActions`, `DashboardDrilldown`, `DashboardTile`,
  `lib/recentActivity.ts`, `lib/useGateStats.ts`) is **deleted** — if you find a rule about
  six tiles, Recent Activity or Quick Actions, it is history. To add a count, add a
  predicate to `guardTiles.ts`.
- **No page heading** (2026-08-13): the sidebar item just clicked says it. The date, the
  **Live** pill and the clock stay. `GuardDashboard.test.tsx` asserts no `h1` and no
  "Dashboard" text, and scopes column-header assertions to `getByRole('table')` — "Checked
  In" names a tile *and* a column.
- **Dashboard reads, Console acts.** Two client-instructed exceptions:
  - **Deny Entry** (`lib/denyEntryFlow.ts` + `DenyEntryConfirm.tsx`) — the reason is
    MANDATORY (button disabled until typed), lands on `visits.rejection_reason`, and
    Reports prints it. `canDenyEntry` is `approved | walkin_approved` only; the button does
    not render otherwise. Permission is real (migration 044 allows it for a guard) and
    `log_visit_approval` writes a `visit_rejected` row stamped with `auth.uid()` — that
    audit actor is what keeps a guard's refusal distinguishable from an HOD's decline.
  - **Verify ID** — a button that renders `VisitorCheckInFlow` IN PLACE in a modal with the
    scan overlay open immediately (`autoScan` through `CheckInPhotoStep`). Never a `<Link>`
    to a tab where the scan is absent or one click deep.
- **Row 1 is SIX tiles** (2026-08-18), in the order a visit passes the gate:
  Expected · Checked In · In Premises · Checked Out · Overstaying · **Cards Not
  Returned**. The grid is `grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6` — six across **only
  at 2xl**, never at xl: a `DashboardTile` spends **104px** before a letter is drawn, which
  is what split "Pre-/Approva/ls Given" on the HOD board, and six xl columns would leave
  ~62px of text column. It no longer matches row 2's five; a shared column rhythm was worth
  having and is not worth an unreadable tile.
- **THE CARDS NOT RETURNED TILE IS THE END-OF-DAY CARD TALLY** (client instruction,
  2026-08-18: "at the end of the day, also tally whatever cards did not return, flag
  those … dashboard KPI"). Its predicate is **`isCardOutstanding` from
  `lib/cardAssignment.ts`** — the same module that decides a number cannot be reissued, so
  "which cards are missing" and "which numbers are blocked" are one rule read from two ends
  rather than two rules that agree until they do not. `visitor_card_number` set,
  `visitor_card_returned_at` null, **and `status !== 'checked_in'`**: that last clause is
  what makes it NOT-RETURNED rather than in-use — a card with a visitor who is inside is
  exactly where it should be, and counting them would make the tile read as a fault every
  afternoon. What lands on it is the row the overstay sweep gave up on (067 can stamp
  `checked_out_at` and `exit_verified = false`, never a return nobody witnessed). Its window
  is `useTodayVisits`, the same "only for today" the reissue rule uses, so the two cannot
  describe different days. The panel leads with `COLUMN.card` — the guard reading it is
  holding a stack and looking for the gaps in it.
- **`lib/guardTiles.ts` holds one predicate per tile (`TILE_FILTER`) and one slicer
  (`tileVisits`)**; the tile renders `drill[key].length` and the panel `drill[key]`.
  - `expected` = `approved` with `checked_in_at IS NULL`, plus `walkin_approved` (restored
    by 083). NOT `pending_approval` — nobody cleared that person.
  - `checked` = `checked_in_at IS NOT NULL` (cumulative). Invariant
    **`checked === inside + departed`**, asserted in `guardTiles.test.ts`.
  - `inside` = `status === 'checked_in'` (live — the list you hand a fire marshal).
  - `checkedOut` keyed on **`checked_out_at >= istDayStart`**, never on the status: a
    visitor who arrived 21:00 yesterday and left 09:00 today is today's departure. Same
    window as `useGateActivity`'s Checked Out lane, so the two cannot disagree.
  - `overstaying` = `isOverstaying` (label was "Pending Check-out" until 2026-08-14, which
    described the In Premises tile beside it).
  - **`entered` is NOT `inside`** — `visits.status` holds one value.
- **`useTodayVisits` = created today OR scheduled today OR open statuses unbounded OR
  `checked_out_at >= istDayStart()`.** One fetch feeding every tile, panel and the Verify
  ID flow. Widen it rather than adding a query.
- **The pending lane reads "Pending Walk-in Approvals"** — `pending_approval` is only ever
  reached from the walk-in register. `PANEL_SPEC.pending.heading` is the tile's own label.
- **The arrivals panel is "Expected Today"**, deliberately sharing its name with the tile
  above it (same `TILE_FILTER.expected` predicate — change it there, not in the panel).
  "Live Arrival Queue" was wrong twice: nothing is live and nobody is in a queue.
- **No "Entry Denied" tile, no "Issue Pass" action, no gate name, no "Gate Status" chip,
  no badge-printing queue** — see the `Declined` rule and the no-fabricated-facts rule.
- **The `Declined` tile is `status === 'rejected'` = an HOD declined**, usually before the
  visitor reached the gate. Never relabel it "Denied Entry"; `GuardDashboard.test.tsx`
  fails on any `/denied/i`.
- **Footer note**: today's activity plus anyone still inside from an earlier day — not
  "statistics are for today only".
- **No Recent Activity feed** (deleted 2026-08-14 with the old dashboard).
- **Every tile drills down IN PLACE** — no tile is a `<Link>`; reading the board must never
  cost you the board. `KpiDrilldownSheet` passes `onSelect` only and **never an `action`**.

### Entry & Exit (`/guard/inside-now`, also `/guard/live-queue`)
Named "Live Queue" → "Inside Now" → **Entry & Exit** (2026-08-15). Both old routes stay
routable (bookmarks, `?verify=` links). The FILE is still `GuardLiveQueue.tsx`.
- **Its own hook, `lib/useGateActivity.ts`** — not reusable from `useTodayVisits` (whose
  window would silently change every tile, and misses the midnight-crossing exit anyway):
  `checked_in_at IS NOT NULL` AND (`status = 'checked_in'` unbounded OR
  `checked_out_at >= istDayStart()`).
- **TWO LANES** (`EntryExitTabs.tsx`, `.gate-tab-bar` segmented control): Checked In /
  Checked Out, one at a time, defaulting to people still on site. **The count lives ON each
  tab** (no summary line) and each lane carries its own `emptyMessage` — "nobody is inside"
  and "nobody has left yet" are different facts.
- Still-inside rows sort above departed; inside by arrival oldest-first (closest to an
  overstay), departed by exit newest-first.
- **`LiveQueueTable`** carries `In` and `Out` columns, both `formatDateTime` on every row
  (a bare time on a today row is indistinguishable from an older row's date being skipped),
  cells `whitespace-nowrap`, wrapper `overflow-x-auto`. A visitor still on site shows an
  **em dash** under Out (blank reads "not recorded"). A `checked_out` row gets a grey
  "Left" tick, no action. Type of Visitor sits between Name and Company.
- **This page starts no check-in** (the arrivals banner and its OCR overlay went
  2026-08-14). Check-in starts on the dashboard's Expected Today panel — one route in.
- **Notify Host writes a NOTIFICATION, never `visits.remarks`** (`lib/notifyHostCheckIn.ts`,
  idempotent, one `visitor_checked_in` row). The old magic substring landed guard
  bookkeeping inside the HOD's approval card. CheckInFrame's "Host Notified" step is
  `status === 'checked_in'` alone — every check-in path notifies.
- **`CheckInFrame` is two columns** (identity `xl:col-span-7`, pass rail `xl:col-span-5`).
  **No "Check-In Details" card** (deleted 2026-08-15) — it restated the four table columns
  of the row just clicked; the disabled one-option Badge type `<select>` went with it. The
  vehicle number and Notify Host moved into the identity column.
  `CheckInFrameTimeline.test.tsx` fails on any `<input>`, `<select>`, or vendor/host/purpose
  in the frame.
- **`CheckInTimeline`** (`lib/visitTimeline.ts`): approval / check-in / check-out. The
  approval instant shows for a **pre-approved** visitor only, and comes from
  `approvalTimestamp()` — there is no `visits.approved_at`. **Date printed once, time on
  every entry**; when entries span more than one IST day, `date` is null and each entry
  carries its own. IST explicit. Renders nothing when no stage has a usable time; drops an
  unparseable stamp rather than printing "Invalid Date".
- **"Identity verified" renders only when TRUE** (photo captured AND an ID type on file).
- **Pass validity is computed**: `qr_expires_at ?? expected_departure ?? istDayEnd(visitMoment(v))`.

### Pre-Registered board (`/guard/pre-approvals` list) & check-in desks
- **`lib/preRegisteredBoard.ts` decides membership once**: `isPreRegisteredArrival` =
  `status === 'approved'` AND `checked_in_at IS NULL` AND the slot is today (IST). Today
  only (Reports is the archive; `usePreRegisteredVisits.ts` deleted) and not-yet-arrived
  (an arrived visitor is Entry & Exit's subject). It runs off `useTodayVisits`, read never
  modified.
- **No "Arrived" chip** — such a row is not on the board, so it could only read 0.
  `PreRegisteredChip` = `all | arriving | missed | late`, one predicate per chip, each badge
  the length of the list it opens. **Three pill states — EXPECTED / MISSED / LATE**; do not
  re-add NO-SHOW / DEPARTED / DECLINED, those rows cannot reach this board.
- **Today at a Glance is fed the same board**, sorted ascending (soonest first).
- **Two arrival routes, two destinations.** `/guard/pre-approvals` is the pre-booked desk
  (`CheckInPanel`: QR gate, match search, ID scan, photo, Check In). It **lists** today
  only — Upcoming/All were removed because a guard can only check in someone due today.
  `usePreApprovals` still accepts the other filters.
- **BROWSING is today-only; SEARCHING is not.** `CheckInPanel.loadData` fetches open
  approvals unbounded; `buildMatchItems` decides — empty query → due-today rows, non-empty
  → every open approval with `dueToday: false` on the rest, returned **disabled, not
  hidden**, printing `formatDateTime`. (On 2026-08-11 all four live approvals were for
  later days, so every search said "No match found" and offered a walk-in request to a
  visitor holding a valid pass.) `buildMatchItems` takes an injectable `now`;
  `visitToMatchItem` computes `dueToday` identically so scan and search cannot disagree.
- **Search spans EVERY status** — "does this pass exist?" `lib/searchVisits.ts`
  (`searchAllVisits`) ILIKEs `ref_number`, name and phone across all ten statuses, deduped,
  newest first, capped at `VISIT_SEARCH_LIMIT`; `%`/`_` escaped. It deliberately does NOT
  use `parseSearchQuery` (which needs a complete ref / valid phone).
  `lib/useVisitHistorySearch.ts` debounces, drops rows the panel already shows and guards
  the response race with a request id. Results are non-actionable by construction:
  `isCheckableStatus` (`lib/checkableStatus.ts`, a full `Record<VisitStatus, boolean>` so a
  new status forces a decision) gates `disabled` alongside `dueToday` — not redundant, a
  `rejected` visit scheduled today has no `checked_in_at` so `isDueToday` is true.
- **A NAME MISMATCH MAY BE OVERRIDDEN BY THE GUARD, WITH NO REASON TYPED** (client
  instruction, 2026-08-18: "give an override option so the guard has leniency … not to
  delay things"). A refused name is usually the OCR and not an impostor — a married name,
  an initial the parser ate, a Devanagari card read in a different word order — and the
  visitor is standing at the gate with a queue behind them. **Two paths, one rule:**
  `CheckInScanSummary` (pre-approved desk, Scan Pass, Verify ID) and `WalkInIdentityStep`
  (the register, which now compares the scanned name against the TYPED one — it never did
  before, so a guard could send an approver a request whose name and document disagreed).
  Both print BOTH names, offer one button, and then say **"Overridden by you"** — never a
  green box, because this is not a match.
  - **NO REASON IS COLLECTED** (client instruction, same day: a mandatory text box at a gate
    is a queue). What IS recorded is that it happened: `visits.id_match_overridden`
    (migration **097**, NOT NULL DEFAULT false), threaded through `checkInFlow.idOverride`
    and written by `WalkInRequest`'s insert. The fact without the explanation — costing the
    guard nothing, and keeping the record from claiming an identity check that did not pass.
  - **An override belongs to ONE reading and never outlives it.** Discarding or re-taking
    the scan clears it (`changeScan`), and on the register so does editing the typed name.
  - **It is offered against a document that WAS read, never in place of reading one** — a
    missing scan is a different refusal and no leniency about a name releases it. A scan
    that read no name at all is not a mismatch either (`namesMatch` is false for a null,
    which would fire the warning on half the cards the parser sees).
- **THE ID SCAN IS MANDATORY ON EVERY CHECK-IN, PRE-APPROVED INCLUDED** (2026-08-17).
  `CheckInPhotoStep` gates Check In structurally while `scanResult` is null, and
  `blockedReason` names WHICH requirement is outstanding in one line. **Discarding a scan
  puts the check-in back behind the requirement** (discard must still clear a mismatch, but
  must not be the way to skip the gate). One step, so one edit — `/guard/pre-approvals`,
  Scan Pass and the Verify ID modal all render it. **The approved-walk-in lane is
  deliberately EXEMPT** — that visitor's ID was scanned at registration and is on the row,
  and since 2026-08-17 the lane asks for neither scan nor photo.
- **THE VISITOR IS PHOTOGRAPHED ONCE** (client instruction, 2026-08-18: "the photo cannot
  be taken twice, it should not ask twice — once it has captured it, it should keep it").
  The approved-walk-in LANE has refused to re-photograph since 2026-08-17; this is the same
  rule on the other three ways into the same visit, because a rule that holds on one lane
  is not a rule. A walk-in's face is uploaded by `WalkInRequest` BEFORE the visit row
  exists, and that visitor then reaches `CheckInPhotoStep` through the search desk, the
  Expected panel's Verify ID, or a scanned pass — each of which pointed a camera at the
  same person a second time, minutes later, for a record the row already held.
  **`CheckInPhotoStep` reads `selectedMatch.photoUrl`**: present ⇒ the camera never mounts,
  `CheckInPhotoRow` states "Photo already on file", and the step goes straight to the card
  and the carrying declaration. Absent (every host-raised pre-approval, every recurring
  visitor) ⇒ the camera opens exactly as before, because then nobody has taken one.
  - **`checkInScannedVisit`'s `photoBlob` is `Blob | null`.** Null uploads nothing and
    spreads no photo columns, so what registration filled survives untouched — that is what
    "keep it" means at the write. `checkInRecurringVisitor` still demands a real blob: a
    recurring visitor has no visit row and therefore never a photo on file.
  - **There is deliberately NO "replace the photo" control.** Offering one is asking twice
    with a politer label; `onRetake` renders only for a photo THIS desk just took. The
    missing-identity case a guard must still be stopped by is the ID SCAN.
  - Guarded by `CheckInPhotoStepPhotoOnce.test.tsx`, which fails on a `<video>` or a
    Capture Photo button when the row carries a face.
  - The 300-line cap split three presentational blocks out of the step in the same pass:
    `CheckInCardField`, `CheckInScanField`, `CheckInPhotoRow`. All three render only — every
    decision about whether Check In may be pressed stays in `CheckInPhotoStep`, so exactly
    one place gates the admission.
- **Every check-in path RECORDS a photo; only the pre-approved ones TAKE it** — structurally
  in `CheckInPanel`, and `VisitorForm.checkInPreApproved` uploads one. The approved-walk-in
  lane carries the photo `WalkInRequest` already uploaded onto the row.
- **`carrying_material` is a tick box, not an inference** — it gates the remarks textarea
  and unticking discards the text. Reports carries **two** columns, `Carrying` (Yes/No) and
  `Carrying Remarks`; never merge them.
- **Expiry is END OF DAY on the client too**: `isVisitExpired` (the IST day containing the
  visit's moment has ended, 22:00 since 075) — not "the moment is before today's close",
  which would expire everything mid-day.

### Scan Pass (`/guard/scan-pass`)
- **QR scanning and ID (OCR) scanning are UNCONDITIONAL — re-adding a feature flag is
  forbidden.** Vite inlines `import.meta.env.*` at BUILD time and `.env` is git-ignored, so
  the old `qr` gate meant every deployed guard saw a dead "unavailable on this deployment"
  card, unfixable from the running app. Both flags were deleted from `FeatureFlag`, not
  defaulted on. Remaining flags (`faceVerify`, …) carry the same caveat: unset on Vercel is
  off permanently.
- **THE SCANNER IS NOT ON THE PAGE UNTIL IT IS ASKED FOR** (2026-08-18, client
  instruction: give a link to scan just below the search, and only then show the camera).
  `ScanPass` owns a `scanOpen` flag and does **not render `GuardQRScan` at all** while it
  is false — a stronger guarantee than 2026-08-17's `autoStart={false}`, where the
  component sat on screen as a heading, a paragraph, a dark 3:4 placeholder the size of the
  camera frame and three buttons, above the results of a page whose commonest use is typing
  a mobile number. What is there instead is one line under the search box: a **"Scan QR
  code"** text link. `onCancel` ("Search Manually") now closes the scanner and returns to
  that box rather than navigating to `/guard/pre-approvals`. The file upload stays inside
  the opened panel, which is also where the no-camera case is handled (primary-styled
  upload under "Camera unavailable"). `GuardQRScan` keeps `autoStart` and its placeholder
  branch for `CheckInScanGate`'s contract; on this page the press has already happened by
  the time it mounts.
- **THE TAB DOES NOT OPEN THE CAMERA BY ITSELF** (2026-08-17). `GuardQRScan` takes
  `autoStart` (default true). Arming is one-way. `CheckInScanGate` keeps the default
  — it is a modal opened by pressing Scan, and a second press would be a button behind a
  button. The gate is `useQrScanner`'s **`enabled`**, not `paused`: `enabled: false` returns
  before the `hasCamera()` probe so no device is ever acquired (same rule as
  `WalkInIdentityStep`'s `armed`).
- **No heading and no subtitle** (2026-08-17) — the sidebar says "Scan Pass" and the line
  under it described the two controls beneath it. The search box keeps its top-right place.
  `ScanPass.test.tsx` asserts both absences.
- **A PDF or an image of the pass is accepted, not just the camera.** `lib/pdfQrPage.ts`
  renders page 1 via `pdfjs-dist` — its worker **must stay a bundled same-origin asset**
  (CSP `worker-src 'self' blob:`; a CDN workerSrc silently kills every decode) — and
  `decodeQrFile()` dispatches. A failed render reports as `engine`, never `no_code`, so the
  guard is not sent chasing a better photo for our fault. This is also the only way in with
  no webcam or over plain HTTP, hence primary styling when the camera is down.
- **A REFUSED SCAN SHOWS THE RECORD, NOT A RED LINE** (2026-08-17). `GuardQRScan` takes an
  **optional** `onBlocked(visit, reason)` — optional matters, `CheckInScanGate` keeps its
  inline banner. `ScanPass` swaps the scanner for the same `CheckInVisitorSummary` built by
  the same `visitToMatchItem` the accepted path uses. **The gate decision did not move** —
  `evaluateQrVisit` still decides; only the presentation of a refusal changed. Record
  first, refusal underneath; no photo step, no Check In button.
- **ONE STATE BADGE PER SEARCH ROW, AND THE VISIT'S OWN STATUS IS THE LAST WORD**
  (2026-08-18, client instruction: a visitor who has checked out must read **Checked Out**,
  never Expired; Expired is for a pass that really ran out and the visitor never appeared).
  `CheckInMatchCard` used to render up to four badges from three sources with the
  precedence backwards — the CALLER's `expired` and `isCheckedIn` computations suppressed
  the row's own `statusMeta`. Both callers therefore painted every closed pass the same red
  "Expired": `ScanPassLookup` passed `expired={!isCheckableStatus(status)}`, true of
  `checked_out` / `rejected` / `cancelled` / `no_show` / `lapsed` alike, and
  `CheckInMatchList` passes a real `isVisitExpired`, which is true of any completed visit
  from an earlier day. Now: `STATUS_META` is a **full `Record<VisitStatus, Badge | null>`**
  (a new status forces a decision; `approved`/`walkin_approved` are the two open states and
  map to `null`), and the badge is picked once — **inside now → the row's decided status →
  a computed expiry → not due today** — first match wins and there is never a second.
  `lapsed` reads **"Not Approved"**, the same words Reports uses, because no host ever
  cleared that visitor. `ScanPassLookup` now passes `expired={false}` and says why: it
  holds a `MatchItem`, not a `Visit`, and the sweep (065/066/077) writes `expired` or
  `no_show` onto the row itself once a pass really has run out.
- **A SEARCH HIT THAT CANNOT BE CHECKED IN IS STILL FULLY LEGIBLE.** `CheckInMatchCard`
  drops the click AFFORDANCE (`CRISP_CARD`, not `CRISP_CARD_INTERACTIVE`) and keeps full
  contrast; `opacity-50 pointer-events-none` is gone (it also blocked selecting the phone
  number to copy). Non-actionable by construction — no button renders, `onSelect` is gated.
  The three instants are each on their own named line: **Approved at / Checked in at /
  Checked out at**, each a `formatDateTime`. "Approved at", not "Pre-approved at" — the
  desk is already stated in a badge above.
- **`CheckInVisitorSummary` / `CheckInMatchCard` / `SearchResultCard` carry Phone, Status
  and the arrival stamps** (a rendering gap, not a data gap — `MatchItem` already had
  `visitorPhone`/`status`). `SearchResultCard`'s one "Date & Time" row is split into
  `Scheduled` (empty = **"NA"**), `Registered`, and conditional `Checked In` / `Checked
  Out`. `MatchItem` gained `checkedInAt`/`checkedOutAt`, fed at every construction site
  (`qrMatchItem.ts`, both branches of `checkInMatches.ts` — the recurring branch gets nulls).
- **`MatchItem.approvalType` derives from `visitOrigin`**, member named `walk_in`, labels
  **Pre-approved / Walk-in / Regular**. `recurring` survives (a standing visitor has no
  visit row until check-in creates one). The converged case is asserted in
  `qrMatchItem.test.ts`, not `checkInMatches.test.ts`.

### Search / other guard routes
- **`/search` and `/guard/search` are one component**, allowed for every role, and open
  `VisitorDetails`. The topbar navigates with **`?q=`** (`/visitors?search=` was a route
  that is not a search surface and a param nothing read). `lib/visitorSearch.ts` classifies
  phone / ref / name.
- **The topbar has no scanner button** — scanning is a step inside a check-in flow. Do not
  re-add it, and do not put `CheckInPanel` back on `/visitors` (`GuardConsole.test.tsx`
  asserts its absence).
- **Deleted 2026-08-15: `/guard/daily-staff`** (selected columns that do not exist) **and
  `/guard/watchlist`** — both out of `ROLE_ROUTES.guard`, asserted forbidden.
  `GuardWatchlist`, `WatchlistMatchCard`, `CctvFeedCard`, `WatchlistAlertBanner`,
  `lib/notifyWatchlistEscalation.ts` are gone; enforcement lives inside `lib/checkInFlow.ts`,
  which refuses the write and names the blacklist reason. `watchlist_escalation` stays in
  `NotificationType` (live rows exist) but nothing writes it. There is no VIP flag, no
  ID-expiry column and no duplicate-identity detection — add columns first or leave it alone.
- **`/kiosk` and `/guard/search` remain routable on purpose** (the kiosk runs on its own
  device); they left the sidebar because neither is visitor check-in. Do not "tidy"
  `ROLE_ROUTES`.
- `Console.tsx`'s `TAB_MODE_MAP` maps only walkins / inside; every legacy `?tab=` value
  degrades onto `inside`. Guard styling: `styles/components-guard.css`.
- **The Inside tab lists EVERY checked-in visitor**, pre-approved included; only the
  Walk-ins tab is walk-in-only.

## HOD surface
- **Drawn in the GUARD's design, from the guard's own files** (client instruction,
  2026-08-16): every tile is `components/DashboardTile.tsx`, every list
  `DashboardVisitorTable.tsx`, every card `DashboardPanel.tsx`. `lib/tileIcons.ts` holds
  the KPI glyphs and `dashboardColumns.ts` the `COLUMN` atoms. **`styles/hod-compact.css`
  is DELETED** — a role does not get a stylesheet; it gets the shared layers. (It shipped a
  self-contained navy palette that ignored the theme, then an 8–11px type scale nothing
  else uses.) Reports is in the same row language, and its **sixteen columns must stay** —
  `styles/print.css` pins widths by `nth-child`.
- **Landing page is the DASHBOARD** at `/overview` (nav label "Dashboard", no page header).
  **`/approvals` has NO page header** (2026-08-18, client instruction): the "Pre-Approve"
  title, its "Invite a visitor before they arrive" subtitle and the gradient icon plate are
  deleted — the sidebar item just pressed says it, and the form below opens with its own
  heading. Same rule as the HOD Overview and the guard dashboard.
  **`/approvals` is the pre-approval FORM only** (`pages/HOD/Approvals.tsx` →
  `PreApproveForm`), no tab bar; `tabFromLocation` must not key on the pathname. Two
  surfaces must never share a URL. On success the form navigates to `/overview?tab=schedule`.
- **`lib/hodTiles.ts`: one entry per tile, one slicer; `HodKpiBoard` renders
  `tiles[key].length` and `tiles[key]`.** Panels are display-only — approving/declining
  stay on the desks, where the reason box and the audit row are. `lib/hodVisitLabels.ts`
  holds shared row labels.
- **Seven tiles** (2026-08-17), in gate order: Pre-Approvals Given · Walk-ins Approved ·
  Awaiting Walk-in Approval · Checked In · On Site Now · Checked Out · Declined.
  - **NEVER SEVEN ACROSS** (2026-08-18, client report: the labels were unreadable). The
    board is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` and four is the
    widest it goes. A `DashboardTile` spends **104px** before a letter is drawn (`px-5`
    each side + the 48px icon plate + `gap-4`), so `2xl:grid-cols-7` left ~58px of text
    column and `break-words` split INSIDE words — "Pre-/Approva/ls Given". Any new tile
    goes on the second row; it never buys itself width by adding a column.
  - The two clearances are two tiles, split on **status** (`approved` can only be a
    pre-approval, `walkin_approved` only a walk-in) — one number for two different acts
    could not be opened as either list. Their panels carry **no Type column**.
  - `checkedIn` is CUMULATIVE, keyed on the arrival stamp **falling today** (`arrivedOn`
    from `lib/adminDashboard.ts`) — not on the stamp merely existing, or rows that only
    departed today would be filed as today's arrivals. `inside` is LIVE.
  - `checkedOut` is `TILE_FILTER.checkedOut`'s rule verbatim (`checked_out_at` vs
    `istDayStart`), so it is a department-scoped slice of the guard's figure.
  - **"Awaiting Walk-in Approval"**, not "Awaiting Your Decision"; `HodWalkInDesk` reads
    its heading from `HOD_PANEL_SPEC.pending`. Board is `grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`.
  - **No Department column on any panel** — an HOD belongs to exactly one department.
- **`HODConsole`'s day query = created OR arrived OR departed today**; the `onSite` query
  has **no date bound** (a contractor still on site from yesterday must not drop off the
  fire-marshal list at midnight).
- **Chart band `pages/HOD/HodDashboardCharts.tsx`**: Visitor Flow and Visit Purpose, and
  that is ALL of it. `hourlyFlow` / `purposeSplit` are **imported from
  `lib/adminDashboard.ts`, never copied** — scoping is done entirely by which rows are
  passed in (`.eq('department_id', …)` plus RLS). **No second query.** The admin's Live
  Lobby Feed is deliberately not ported (it would be the second list on this screen).
  - **BUSIEST HOSTS IS REMOVED** (2026-08-18, client instruction: take it off the
    individual employee's dashboard view). A host ranking is an org-wide question wearing
    a department's clothes — on the admin board it says who across the building is
    carrying the visitor load; inside one department, read by an account that is often one
    of the three names in it, it is a league table of colleagues. `topHosts` STAYS in
    `lib/adminDashboard.ts` for the admin Dashboard: one call site removed, not a function
    deleted. Guarded by `HodDashboardCharts.test.tsx`, which fails on `/busiest hosts/i`.
- **There is NO Approval Desk** (removed 2026-08-16): it listed `pending_approval` rows
  carrying a `scheduled_for`, a set that cannot exist. `?tab=preapprovals` degrades onto
  the dashboard. The `walkins` KPI tile went with it (two tiles opening one list).
- **Pending walk-ins render as full detail cards on the Overview**
  (`OverviewPendingApprovals.tsx`, above `OverviewOnSite`, own `VisitorDetails` modal,
  reusing `ApprovalsPendingList`). Returns `null` when empty. Its query is deliberately
  **not** day-bounded.
- **`pending_approval` is only ever reached by a walk-in** raised at the gate — hence every
  heading says "Pending Walk-in Approvals".
- **`scheduled_for` is REQUIRED on a pre-approval** (`validatePreApproval` in
  `lib/visitLifecycle.ts` and on the input) — without it the gate cannot tell early from
  overdue, and `overdue` can only be derived from a slot that exists.
- **The HOD Overview has no page header** (department name and "Overview" were both
  restatements); the name is no longer fetched, the id still scopes the queries.
- **The Upcoming card leads with the VISITOR**: `Visitor Pass` eyebrow → name → vendor
  (once) → tinted **Person to Meet** block (host + department) → purpose chip. Each value
  exactly once. Its query's `.in()` list includes `walkin_approved` (083) or an HOD's own
  decision vanishes between the click and the arrival; the `awaitingGate` badge has always
  been there.
- **The HOD never sees a visitor's ID proof** — `VisitorDetails` hides the ID Document row
  for `hod` and passes `showIdProof={false}` into `PreApprovalPass` → `PassIdentity` (which
  defaults true, preserving it for the guard).
- **The visitor popup does not repeat the ref number in its header** (it is on the pass
  under View Pass). **Expected At** shows `scheduled_for`, omitted (not dashed) for walk-ins.
- **A page-level `delete()` carries its own scope** — `HODOverview` once deleted every
  notification older than today with no `recipient_id` filter. RLS is the backstop, never
  the statement's blast radius.

## Origin, chips and shared visit vocabulary
- **`lib/visitOrigin.ts` INFERS pre-approved vs walk-in; nothing records it.**
  `pending_approval`/`walkin_approved`/`lapsed` prove a walk-in, `approved` proves a
  pre-approval; all routes converge on `checked_in`, which is when the answer is needed.
  Fallback is `scheduled_for` (the walk-in path never sets it). **Known gap:** a
  pre-approval created before `validatePreApproval` has a null slot and reads as a walk-in
  — acceptable because nothing branches on this. If it must be exact, add a column written
  at creation; do not write a cleverer guess.
- **`isApprovedWalkIn` / `isGivenPreApproval` key on the CLEARANCE**, shared by the guard
  tile, `/visitors/approved` and the HOD board — one question, one answer.
- **WHO WALKED IN AND WHO WAS BOOKED IS SAID ON EVERY MIXED LIST.** `COLUMN.origin`
  (header **Type of Visitor**) resolves through `visitOrigin`. It goes only on lanes that
  can hold both kinds: guard `checked`/`inside`/`all`/`overstaying`/`declinedByHost`/
  `refusedByGuard`, HOD `inside`/`rejectedToday`, `LiveQueueTable`,
  `WhosInsideVisitorCard` (gated on `statusProvesOrigin`), the admin register (on screen,
  not only in the CSV — now **seventeen** columns, edited in lockstep with `print.css`),
  and **every check-in** via `CheckInVisitorSummary`. NOT on `pending`/`walkinApproved`
  (all walk-ins), `expected` (all pre-approvals) or the two HOD clearance lanes — a column
  printing one word on every line says nothing. Asserted in `dashboardColumns.test.ts`
  and `HodKpiBoard.test.tsx`.
- **`presenceChip` (`lib/visitGateChips.ts`) names the ACTION outstanding**: a
  `pending_approval` row reads "Awaiting approval", a `walkin_approved` row reads
  **"Awaiting gate check-in"**, tone neutral and never `inside` (083: that person is not in
  the building). "Checked in" / "Checked out" are unchanged. Guarded by
  `visitGateChips.test.ts`.
- **`lib/visitApproval.ts` → `approvalTimestamp()`** resolves the approval instant from the
  `visit_approved` audit row (`lib/visitActors.ts`), falling back to the visit's own
  `created_at` only for statuses that prove a prior approval. There is no
  `visits.approved_at`.
- **`VisitorTimelineCard`: `showArrival` (Checked In / Checked Out, every role) vs
  `showAudit` (Approved / Duration, false for a guard).** A guard is not auditing state
  changes but must see when a visitor walked in, and must be able to say when clearance was
  given — so the approval instant moved out of `showAudit`; what stays behind it is
  Duration, a running subtraction. Renders nothing when the viewer may see no stamp and
  there is no rejection reason. The rejection reason is gated by neither.

## Visitor identity and check-in constraints
- **The organisation is `visitors.vendor_name`, never "company"** (migration 059 also
  renamed `recurring_visits.visitor_company` and the RPC arg `p_company`). Every label,
  header and CSV key reads "Vendor Name"/"Vendor". **`gate_passes.company_name` was
  deliberately NOT renamed** (a carrier, not a visitor). The `notify-host` edge function
  reads `vendor_name` — it is outside `src/` and no test covers it.
- **A visitor who is inside cannot check in again** — migration 060's partial unique index
  on `visits (visitor_id) where status = 'checked_in'`, and `visitors.phone` is unique, so
  that one index is the whole "same number cannot check in twice" rule. Enforced in the DB
  because three devices write. `src/lib/activeVisit.ts` owns the human half:
  `findActiveVisitByPhone` (strong), `findActiveVisitByIdProof` (weak — only `id_type` +
  `id_last4` are stored, so warning only, never a constraint), `activeVisitMessage`,
  `isAlreadyInsideError` (matches 23505 **by constraint name**).
- **A visitor card is minted at check-in and demanded back at check-out** (migration 076):
  `visitor_card_number` (`^[A-Za-z0-9-]{1,20}$`) + `visitor_card_returned_at`. The number is
  required at the APP level on every check-in path (`CheckInPhotoStep`), the CHECK is a
  backstop. `lib/cardNumber.ts` mirrors it.
- **ONE CARD, ONE HOLDER — A NUMBER CANNOT BE ISSUED AGAIN UNTIL IT COMES BACK**
  (client instruction, 2026-08-18: "the same card number cannot be assigned twice, until
  and unless it gets returned — and that only for today"). 076 minted the card and demanded
  it back; nothing ever asked whether the number being typed was ALREADY out, so two
  visitors could hold C-124 an hour apart and the exit desk had two open visits demanding
  one card back — the guard collects one, ticks one box, and the other tick is an assertion
  about an object that is not there.
  - **`src/lib/cardAssignment.ts` is the one place both halves are decided**:
    `findCardHolder` (may this number be issued?) and `isCardOutstanding` (did it come
    back?). Never answer either question anywhere else.
  - **THE WINDOW IS TWO CLAUSES, NOT ONE.** Blocked while the holder is **inside, on any
    day** — a contractor who arrived at 21:00 last night is still carrying it — and blocked
    for the rest of the **IST day it was issued on** if it never came back. That second
    bound is the client's "only for today", and it is load-bearing: a card is reissued
    daily, and without it one lost card would wedge its number out of the stack forever,
    with no screen in this app able to release it (there is no card-inventory surface, only
    two columns on a visit).
  - **Migration 102 is the real gate** — two unique partial indexes,
    `visits_card_live_holder_uidx` (one live holder per card, any day) and
    `visits_card_unreturned_today_uidx` (`upper(number)` + `date(timezone('Asia/Kolkata',
    checked_in_at))`). Three devices write check-ins; a pre-check can only narrow the race.
    The day key is that `timezone(text, timestamptz)` expression and **not**
    `vms_day_start_ist()`: an index expression must be IMMUTABLE and anything reading the
    session TimeZone is only STABLE. 102 also **drops 097's
    `visits_card_number_inside_idx`**, the non-unique version of exactly the first index.
    `isCardTakenError` matches BOTH names, so an unrelated 23505 is never mislabelled — the
    same rule `activeVisit.ts` follows.
  - **All three writes pre-check and all three map the race**: `checkInFlow`,
    `checkInWalkInApproved`, and `checkInRecurring` (which passes no `excludeVisitId` — it
    INSERTs, so there is no row of its own to forgive). The two forms check as the guard
    types, through `lib/useCardAvailability.ts` (debounced, request-id race guard), because
    the write happens AFTER the card is handed over: "C-124 is still with Priya Nair" is
    worth reading while it is in your hand, not once it is in the visitor's pocket.
  - Matched **case-insensitively** (`normalizeCard`, `upper()` in both indexes) — the number
    is read off a printed card and typed by hand, and a rule a shift key defeats is not a
    rule. Guarded by `cardAssignment.test.ts`.
- **THE RETURN TICK IS REQUIRED ON EVERY CHECK-OUT, CARD OR NO CARD** (2026-08-17). The
  no-card branch of `CardReturnConfirm` keeps the checkbox and changes only what it asserts
  ("I have looked and no card was issued"). The issued number is printed **inside the
  label** as well as above it. Both check-out surfaces open this one dialog.
- **`exit_verified` means "did a human witness this exit".** `Console.logExit` sets true;
  `sweep_overstays` sets false. Never auto-close a visit in a way that reads identically to
  a real check-out — `checked_out_at` on an auto-closed row is the moment we gave up.
- **A `datetime-local` value is IST and must be converted before it is written** —
  `lib/istDateTime.ts` (`istLocalToUtcIso` / `utcToIstLocalInput`). `PreApproveForm` once
  passed the bare wall-clock string to `pre_approve_visitor_v2`, where Postgres cast it in
  the session timezone (UTC): every booking shifted **+5h30m**. Convert before
  **validation too**, or `validatePreApproval` compares a different instant than the one
  stored. Never `new Date(localString)` (that reads the browser's zone) — regex + `Date.UTC`,
  then subtract `IST_OFFSET_MS`.
- **THE PASS HAS NO PHOTO SLOT UNTIL THERE IS A PHOTO** (2026-08-18, client instruction).
  A pre-approval is raised by a host hours or days before anybody points a camera at the
  visitor, so `PassIdentity`'s grey silhouette placeholder stood in for something nobody
  had failed to supply — it read as a broken image on the success pass and took a third of
  the card's width off the facts beside it. `photoUrl` absent now renders **nothing**, and
  the real face comes back by itself at check-in, when `photo_data` lands on the row. Do
  not re-add a placeholder: the missing-identity case a guard must be stopped by is the ID
  SCAN, which `CheckInPhotoStep` refuses to proceed without.
- **The success popup is TWO SECTIONS, and only the top one is centred** (same
  instruction: align it properly, make it premium). `SuccessPopup` renders the tick, the
  title and the message on the tinted ground, then `children` — the entry pass, which is a
  document of labelled facts — **outside** that block, on the modal's own surface behind a
  hairline. They used to share one `text-center` container, so every label sat over a value
  of a different width. `PreApprovalPass` matches: every block is full width on one left
  edge (the `max-w-xs` caps are gone), and only the QR, its caption and the buttons are
  centred, each saying so with `self-center`.
- **`PreApprovalPass` prints SCHEDULED AT and VALID UNTIL**, resolved through the same
  `qr_expires_at ?? expected_departure ?? istDayEnd(...)` ladder `CheckInBadgeRail` climbs.
  One column, not two (at `text-xs` in a 320px card half the width cannot hold a full
  datetime). `PassField` uses **`break-words`, never `truncate`** — a clipped date is
  indistinguishable from a complete one.
- **The pass can be sent to the visitor's WhatsApp, no Meta account needed**
  (`lib/sharePass.ts`, primary action on the pass card since 2026-08-17). **Two mechanisms,
  one button, neither optional**: `navigator.share({ files })` carries the FILE,
  `wa.me` click-to-chat carries the RECIPIENT and categorically cannot attach anything.
  Fallback sheet → link, and the link path downloads the PNG alongside.
  **`dataUrlToFile` is SYNCHRONOUS** (hand-rolled `atob` + `Uint8Array`): `navigator.share`
  throws unless called inside a live user gesture, and any `await` in front spends it —
  there is a test pinning the signature. Do not put a photo fetch, canvas re-encode or PDF
  build in front of that call. `canShare({ files })` returns false (never throws) where
  unsupported. `waPhone` runs the number through `normalizePhone` and re-adds `91` for a
  10-digit Indian mobile; anything refused yields `null` and the link opens WhatsApp's
  contact picker rather than a stranger's chat. No CSP change was needed. This is a
  shortcut to a human action, so no TRAI/DLT registration applies; an automated send is a
  different project (Meta Business account, verified number, approved utility template, a
  new edge function beside `notify-host`).
- **The visitor popup**: identity band tinted in LIGHT MODE ONLY
  (`bg-surface-100/70 dark:bg-transparent` on the header row and the ID tab's photo/verdict
  block) — never a tint that also paints in dark mode. The close button lives **outside the
  scroll container**: `!overflow-hidden` on the modal, button on it, an inner
  `flex-1 min-h-0 overflow-y-auto` child scrolls (`min-h-0` is load-bearing).
- **`IdScanOverlay` portals to `document.body`** — never inline. `fixed inset-0 z-50` is
  only true at the document root; inside the `backdrop-blur-sm` Verify ID modal the filter
  ancestor becomes the containing block and the "full-screen" scan shrank to `max-w-lg`.
  All four phases go through one `createPortal`; Escape binds on `window`.
  `IdScanOverlay.test.tsx` queries the backdrop via `document.querySelector`.
- **`VisitorsDashboard`'s select once had an unbalanced `))`** — PostgREST rejects a
  malformed embed outright and an `if (error) return` swallowed it, so the staff view had
  never returned a row. An error branch that returns silently makes a broken query and a
  quiet day look identical.

## Admin console — SIX TABS, READ-ONLY over visitor records
Order (a reshuffle is a behaviour change): Dashboard, Live Check-In, Hosts, Blacklist &
Security, Reports, Settings. Routes are an ARRAY of `<Route>` in `routes/adminRoutes.tsx`
spread into App's one `<Routes>` (a nested `<Routes>` would break the `path="*"` fallback).
`/admin` redirects to `/admin/settings` — the bookmark every admin holds.

- **IT WAS EIGHT UNTIL 2026-08-18, AND TWO MERGES TOOK IT TO SIX** (client instruction).
  Both merged paths **redirect, never 404** — they are in bookmarks and the destination
  holds what the bookmark was for.
  - **Pre-Registration → Live Check-In**, as its **Expected** lane
    (`/admin/pre-registration` → `/admin/live-check-in`). What was redundant: a booking
    that already arrived was in the Inside or Checked Out lane beside it, and a ranged
    history of every booking ever made is the Reports register's job. What had no other
    home is the one question the tab was really answering — who is the gate still
    expecting today — and that is now a lane, running the guard's OWN predicate
    (`isPreRegisteredArrival`), so the admin watches the same list the gate works from.
    Gone with it: `AdminPreRegistration.tsx`, `AdminPreRegistrationKpis.tsx` (including
    the **Invites Sent** tile, removed the same day on its own instruction),
    `AdminPreRegFilters.tsx`, `lib/preRegistration.ts` and their tests.
  - **Visitors Log → Reports** (`/admin/visitors-log` → `/reports`). The register, the
    department filter, the printout and the CSV had all MOVED to that tab on 2026-08-17
    and have now moved back; what did **not** come with them is the log's own status /
    origin filter row, its pager and its eight-column lookup table — a second, thinner
    view of rows the seventeen-column register prints in full. Gone:
    `AdminVisitorsLog.tsx`, `VisitorsLogFilters.tsx`, `lib/visitorsLog.ts`,
    `RegisterPrintSheet.tsx` (the admin's paper-only second copy of `RegisterTable`) and
    their tests. **`RegisterTable` now has exactly one caller** — which is the point:
    `print.css` pins its widths by `nth-child`, and one copy is one thing to keep in step.

- **BADGE PRINTING WAS THE NINTH AND IT IS DELETED** (2026-08-17). `AdminBadges.tsx`,
  `BadgePrintsTable.tsx`, `lib/adminBadges.ts`, `lib/useBadgePrints.ts` and its test are
  gone; the route and nav item too. Nothing writes migration 087's `badge_prints`
  (`lib/printBadge.ts` records nothing), so the tab was three zero tiles over an empty
  table. The table, migration 087, the `BadgePrint` type and the four **Settings → Badges**
  fields **stay**. `/admin/badges` resolves to **NotFound**, not refused (`isForbidden`
  matches by prefix and `/admin` must stay listed). Guarded by `navLinks.test.tsx`,
  `Sidebar.test.tsx` (exactly 6 links since the 2026-08-18 merges),
  `routeProtectionAdmin.test.tsx`.
- **READ-ONLY is structural**: `lib/useAdminVisits.ts` exports no mutation at all. No admin
  screen renders a control that writes `visits` — no check-in, check-out, approve, reject,
  deny-entry, badge mint or undo. Every admin page test asserts the absence of
  `/check in|check out|approve|reject/i`.
- **`/visitors`, `/whos-inside` and `/kiosk` STAY FORBIDDEN** — those are where a visit is
  mutated. Reading a visit and reaching the desk that changes it are different permissions.
  (This is also why an admin-only check-out undo would have nowhere to be invoked.)
- **The ONLY admin writes are the blacklist and the request to lift it** — both touch
  `visitors` / its removal queue, never `visits`.
- **Every tab says whether it is showing NOW or the PAST**: `AdminPageHeader` takes
  `scope?: 'live' | 'historical'` and renders a chip. Live: **Live Check-In**, **Hosts**.
  Historical: **Blacklist & Security**. The **Dashboard passes no header** (no toolbar,
  and its panels name their own window), and **Live Check-In passes no blurb** either
  (2026-08-18, client instruction: its four lanes name themselves and carry their own
  counts, so a line describing them was the screen explaining itself to itself).
- **`lib/reportsDateRange.ts` is the ONE range vocabulary**: `today | 7d | 30d | 60d | 90d
  | 1y`, spanning back from a **chosen end date** — so `today` reads **"Selected Day"**.
  `3m` was REPLACED by `60d`/`90d` (a calendar month is not comparable with itself across
  the year); nothing persists a preset.
- **`AdminRangeBar` is its own row, never a header action** (`AdminPageHeader`'s action slot
  is `shrink-0`). It prints the **resolved dates as well as the lit preset**.
- **Every ranged fetch passes an explicit `limit` and every ranged tab states it when hit** —
  PostgREST applies its own maximum otherwise, and a silent truncation is the worst failure
  this console can have. `Activity` states its 200-row cap.
- **`includeUpcoming` (`useAdminVisits`) now has NO caller.** It was Pre-Registration's
  alone — the range clauses are `created_at`/`checked_in_at` only, so a pass raised forty
  days ago for next week fell out of a 30-day window invisibly. The option stays in the
  hook, correct and tested; the tab that needed it is a live lane now and is not ranged at
  all. Do not delete it, and do not switch another tab on to it without reading why.
- **THERE IS NO WATCHLIST PANEL** (deleted 2026-08-18, client instruction).
  `AdminWatchlistPanel.tsx` is gone and Denied Entries now runs FULL WIDTH. It could only
  ever print one sentence saying the Blacklist panel above it was the whole story — no
  watchlist table exists in this schema, the same reason the guard's Watchlist tab went on
  2026-08-15. Being honest about an empty panel beats faking one; not rendering it beats
  both, because a heading with nothing behind it reads as broken rather than absent.
  Re-adding one means adding a table first. No fourth KPI tile either. Guarded by
  `AdminSecurity.test.tsx`.
- **Blacklist & Security is HALF ranged, half live, and each half says which.** Ranged:
  Denied Entries, and the blacklist half of Security Alerts. Live: the blacklist roster
  (`useVisitorDirectory` — `visitors` records no history of the flag) and the overstay half.
  `deniedEntries`/`securityAlerts` **no longer date-filter internally** (the fetch window
  does it; re-testing today's key inside would intersect and return nothing for past
  ranges). **`includeInside` is what makes the live half live** — the overstay predicate can
  only see loaded rows, so without it a narrowed range showed an empty Security Alerts panel
  while somebody was overdue in the building.
- **THE HOST NOTIFICATIONS PANEL IS DELETED** (2026-08-18, client instruction).
  `HostNotificationsPanel.tsx`, its test and all the settings plumbing in `AdminHosts`
  (`loadSettings` / `saveSettings` / `userId` / `saving`) are gone, so **that tab now
  writes nothing at all**. Two of the three switches were labelled "Recorded — not yet
  enforced" on the screen itself (no SMS provider, no per-host reminder job — `pg_net` is
  not installed), and the third gated nothing: `notifyHostCheckIn` writes an in-app
  notification on every check-in and never consulted it. Guarded by `AdminHosts.test.tsx`,
  which fails on any `role="switch"`.
- **Hosts is LIVE with no picker.** Window = trailing 7 IST days ending today, honest by
  construction: `useAdminVisits` subscribes to `postgres_changes` and reloads silently, and
  the window **ROLLS with the IST day** (it ticks the IST date KEY, so React bails on an
  identical string and the page re-renders once at midnight). The blurb still states the
  period in words.
- **Live Check-In is a ROSTER with no KPI tiles, and it has FOUR LANES**: Expected ·
  Inside · Checked Out · Awaiting Approval (`lib/adminLiveCheckIn.ts`, one predicate each;
  the page keys `LANE_ROWS` / `LANE_EMPTY` off the lane so a fifth cannot be half-added).
  `liveCheckInKpis` is **deleted**: three of its four tiles restated a figure already on
  screen, and the fourth (`awaitingApproval`) was a count with no list, so it became a
  lane. Awaiting Approval is deliberately **not date-bounded** and uses `COLUMN.requested`
  rather than an arrival stamp; **Expected** uses `COLUMN.scheduled` and carries **no Type
  of Visitor column** (a pre-approval is the only thing that can be on it).
  `AdminLiveCheckIn.test.tsx` fails on any of the three deleted tile labels.
- **Dashboard and Live Check-In stay SEPARATE**: the Dashboard reads today's **SHAPE**
  (hourly flow, purpose split, host ranking), Live Check-In reads today's **PEOPLE**.
  Neither states the other's figures.
- **NO ADMIN KPI CARD COMPARES ITSELF WITH YESTERDAY** (2026-08-18, client instruction:
  "too much clutter"). Total Visitors carried an arrow and a percentage, plus a third
  caption for the day the comparison could not be made — three states on a card whose job
  is one number. `visitorsYesterday` / `changeVsYesterday` are **deleted from `AdminKpis`**,
  not merely left unread: a figure no screen may print is how a comparison comes back. A
  trend is the Visitor Flow chart's answer. **The two-day FETCH stays** (`AdminDashboard`),
  for a different reason — Currently Inside and Overstays are live figures, and the visitor
  they are most likely to be about arrived at 21:00 last night.
- **The console draws FACES, not monograms.** `useAdminVisits` maps
  `photo_url: v.photo_data ?? undefined` like every other list hook.
  `ADMIN_VISIT_SELECT` also asks for the host's `avatar_url` (`Visit.host` gained it as an
  **optional** field — "nobody asked" must stay distinguishable from "has no photo").
  Every image keeps the monogram fallback and carries **`alt=""`** (the name is printed
  beside it).
### Settings — TWO sections, Departments and Users
`lib/settingsSections.ts` is the single source of truth; rail and panel both derive from
it. **It was SIX until 2026-08-18** (client instruction: keep Departments and Users, remove
everything else, Integrations included). General, Check-In Rules, Badges, Notifications and
Integrations are gone, and with them the twenty-six stored switches and the page-level
**Save Changes** button — both remaining panels write at the moment the admin confirms, so
a global save would govern nothing. A large minority of those fields were openly marked
"Recorded — not yet enforced" (no signature step, no SMS provider, no webhook dispatcher —
`pg_net` is not installed, so a scheduled job cannot make an HTTP call at all). The
`enforced` flag was an honest label on controls that should not have been offered at all.
- **`app_settings`, its rows and `lib/appSettings.ts` all STAY** — even though, since
  2026-08-18, **nothing reads the `notify.*` keys**: `HostNotificationsPanel` went with the
  Hosts tab's notification card (see the Hosts bullet). Deleting a store because its last
  screen went is how the next feature finds the table missing. Migration **093**'s deleted Time Zone row stays deleted.
- **Every stale `?section=` slug degrades onto Departments** — `roles`, `general`,
  `checkin`, `badges`, `notifications`, `integrations`. They are in bookmarks, and the
  Hosts tab's "Manage in Settings" link now points at `?section=users`.
- **Departments** is the old Admin Panel, MOVED not rebuilt: `SettingsDepartments.tsx`
  (renamed from `SettingsRolesUsers.tsx`) renders `DepartmentsManager` unchanged.
- **"Awaiting an HOD" stays filtered while you act on it**: the tile drills into
  `UnassignedDepartments` and each card's "Assign HOD" opens `HodForm` **inline on that
  card**. Do not reintroduce a `setView('departments')` in `startAssignFromGap`.

### Settings → Users, and how an account is switched off
Replicated from GatePass's admin portal (client instruction, 2026-08-17), **plus `staff`**.
Migrations **094–096**; `lib/adminUsers.ts` (the one read and four writes) and
`lib/userStatus.ts` (the labels and the derivations).
- **`staff` IS assignable here and is NOT in GatePass.** Over there `staff` means "does not
  use this app" and was being abused as an off switch; in VMS it is what a HOST is
  (`get_hosts_for_department` returns the staff and HODs of a department), so an admin who
  cannot create one cannot onboard a host. Assignable = **guard | hod | senior_manager |
  staff**. `admin`,
  `super_admin` and `ceo` are refused by `admin_create_user` / `admin_update_user`
  server-side, not only by the `<select>` — a rule enforced only by a dropdown is one any
  token skips by POSTing to PostgREST. The table renders NO controls on an admin row rather
  than buttons that could only fail (the 064 rule: the weakest admin account must not be a
  route into a stronger one).
- **"Inactive" IS NOT A ROLE.** Deactivation writes `public.user_status` (094) and leaves
  `profiles.role` alone, so reactivation restores exactly what was withdrawn instead of an
  admin guessing. Doing it GatePass's old way — `role = 'staff'` — would be worse here than
  there: `staff` has its own routes, so it would move a guard sideways rather than shut
  them out. **Absent row = active**, so there is no backfill.
- **The suspension is enforced in POSTGRES, once.** `public.current_user_role()` was rebased
  on its LIVE body and now returns NULL for a suspended caller, so every existing policy and
  every policy added later refuses — no per-policy edit. `is_user_active` is SECURITY
  DEFINER and **calls nothing**, or it would recurse through the very policy it decides.
  `CREATE OR REPLACE`, never DROP: policies all over this database reference that function.
- **And it is made LEGIBLE by `my_account_active()`** (`lib/startupGates.ts` →
  `BootScreens.SuspendedScreen`). Enforcement alone is invisible: the person signs in, lands
  on their role's page and every list is empty, which a guard cannot tell from a quiet
  morning. Both startup gates **fail OPEN and never fail silently** — being unable to reach
  the database is not proof anybody is suspended — and neither may `select` from `profiles`
  or `user_status` directly.
- **A new account gets a password the admin reads out**, flagged `must_change_password` so
  064's forced-change screen spends it on first sign-in. Not an email invite: the built-in
  Supabase mailer is capped at ~2 messages an hour PROJECT-WIDE and shared with GatePass,
  which is what took "Forgot password?" off the login card in the first place.
- **The email is READ-ONLY when editing** — changing a sign-in address is an auth-admin
  operation, and rewriting only `profiles.email` would leave the screen showing an address
  the login rejects. `HodPasswordReset` is offered in its place.
- **Department applies to `hod` and `staff`, never `guard`**, recomputed server-side against
  the role being SAVED — promoting somebody to guard drops the department they held, or
  they stay in that department's host picker.
- **Deactivate confirms and kills every session; Reactivate does neither.** The asymmetry is
  the point: one is destructive, the other restores what was withdrawn. GatePass's
  `gatepass.user_status` is a SEPARATE flag on this same project — suspending VMS access is
  not a statement about GatePass access, and GatePass must never alter `public`.
- **"Awaiting an HOD" stays filtered while you act on it**: the tile drills into
  `UnassignedDepartments` and each card's "Assign HOD" opens `HodForm` **inline on that
  card**. Do not reintroduce a `setView('departments')` in `startAssignFromGap`.
- **No gate-pass anything on the admin surface.** `gate_passes`/`gate_pass_items` are a
  material-movement module whose pages were deleted; the Analytics card, the sidebar tile
  and the unrouted `pages/Dashboard.tsx` that read them are gone, along with their realtime
  subscriptions. **Types and DB tables stay** — do not "finish the job", and do not re-add
  a pass widget.
- **There is NO `/analytics` — DELETED, not unlinked** (2026-08-17):
  `pages/Shared/Analytics.tsx`, `AnalyticsCharts.tsx`, `AnalyticsKPICards.tsx`, the
  unrouted `pages/Admin/Analytics.tsx` and `SidebarAnalytics` are gone, and the path is out
  of every `ROLE_ROUTES`. Its charts moved onto the admin **Dashboard** and **Reports**
  (`ReportsAnalytics.tsx`), **derived from rows those screens already load, never a second
  query**. The sidebar widget also counted a UTC day, so 00:00–05:30 IST it counted
  yesterday.
- **Entry Point Utilization is REMOVED** (2026-08-17): `entryPointUsage`, the trailing
  entry-point rows in the Peak Hours CSV and the `entry_point` embed in both
  `ADMIN_VISIT_SELECT` and `Reports.tsx` are gone. No check-in path ever wrote
  `entry_point_id`, so the panel could only report "we do not know, for all N". Table and
  column stay; do not re-derive a chart until a writer exists.
- **Admin-entered text is allowlisted in the browser AND the database.**
  `src/lib/inputRules.ts`; migration **062** mirrors it as CHECK constraints (client
  validation is a usability guard any admin token can skip via PostgREST). Department name
  `^[A-Za-z0-9 &./'-]+$` (2–60), code `^[A-Z0-9&-]+$` (1–10), person name `^[A-Za-z .'-]+$`
  (2–80, **no digits**). It is an allowlist — do not add `<script>`/`DROP TABLE` pattern
  matching. `profiles.full_name`'s constraints are **NOT VALID** on purpose (a legacy
  `Bugfix Test 2` row). This is not an SQL-injection fix; nothing concatenates SQL.
- **`audit_logs` is trigger-only.** Migration **063** dropped the 041-era policy that let
  any authenticated user POST an arbitrary audit row and revoked `INSERT` from
  `authenticated`; the `log_visit_approval` SECURITY DEFINER triggers never needed the
  grant. Covered by `tests/security/auditLogsRls.test.ts`. A manual audit entry belongs
  inside a SECURITY DEFINER function, never a policy.
- **HODs are added by name + email** — `addHod()` promotes an existing profile or invites
  via `supabase.auth.signUp` and upserts. Writing `profiles.role` is enough
  (`sync_profile_role_to_auth`, migration 010, mirrors it into JWT `app_metadata`).

### Blacklist and its two-person removal
- **Flagging** is `AdminBlacklistForm` → `lib/adminBlacklist.ts`, one admin's own call,
  reason mandatory (confirm disabled until typed).
- **UNflagging takes TWO PEOPLE.** "Request removal" opens `BlacklistRemovalForm`, filing a
  justification (min 10 chars) for the **CEO**; `visitors.is_blacklisted` is untouched until
  approval, so the gate keeps refusing entry for the life of the request. The asymmetry is
  the design: delaying a *protective* action leaves somebody admissible who should not be.
- **THE RULE IS IN THE DATABASE, NOT THE SCREEN** (migrations **091**/**092**).
  `enforce_blacklist_clearance` refuses the clearing direction from every caller except
  `decide_blacklist_removal`, which carries a transaction-local key **cleared again on the
  next line** (transaction-local is not statement-local; live probe 8b caught the wider
  version waving through every later UPDATE). `prevent_guard_blacklist` had to learn the key
  too, or it would refuse the CEO's own approval. **Two triggers, two questions**: who may
  touch the flag, and which direction is free.
- `blacklist_removal_requests` has **no insert/update/delete policy** — both writes go
  through SECURITY DEFINER RPCs. A **unique partial index** allows one open request per
  visitor, so the panel reads **Awaiting CEO** rather than offering a button that could only
  fail. `blacklist_reason` is **snapshotted onto the request**, because approving clears it.
- `lib/blacklistRemoval.ts` must NEVER grow a `visitors` update; `lib/useBlacklistRemovals.ts`
  holds the live queue and three pure slicers.

## `ceo` — the fifth role, inheriting NOTHING
`ROLE_ROUTES.ceo = ['/ceo/blacklist-removals', '/profile']` — no visitor log, no reports,
not even `/search`: their business is with the one visitor named on the request. It is
deliberately **NOT `super_admin`** (still in the DB enum, still the administrative ceiling
in a dozen policies) — reusing it would make the approver the same person who can reset
every password: the first pair of eyes in a different hat. One screen:
`pages/CEO/CeoBlacklistRemovals.tsx` + `CeoDecisionCard`.
**A refusal requires a note; an approval does not** — approving grants what the admin asked
for and their justification is on the row, while "no" with nothing attached leaves a
colleague nothing to act on (the same rule as the guard's Deny Entry).

## Reports (`/reports`)
- **Reports owns the approval instant** — `Approved` / `Check-in` / `Check-out` columns with
  date *and* time, on screen and in the CSV. Approval time via `approvalTimestamp()`. Admin
  is exempt from the department filter and can read `audit_logs` (migration 041).
- **REPORTS IS THE ADMIN'S VISITOR RECORD AGAIN** (2026-08-18, client instruction: merge
  the Visitors Log tab into Reports and keep the reports part). `ReportsRegister` renders
  for **every** role that can reach the page. It was withheld from an admin for exactly one
  day, while `/admin/visitors-log` held a second copy of it; with that tab merged away the
  reason went with it, and the alternative — a report page holding charts, four CSV bundles
  and no visits — would have been the only surface here that summarises rows it will not
  show you. Guarded by `ReportsRegisterScope.test.tsx`, which needs its own supabase mock
  (`Reports.test.tsx`'s has no `auth`, so every test there runs as `userRole === null`).
- **THE PAGE IS STILL ROLE-SPLIT ABOVE THE REGISTER**: the analytics band and the four CSV
  cards are an admin's org-wide read, and an HOD's register is already scoped to one
  department.
- **THE ADMIN GETS `AdminRangeBar`, NOT `ReportsToolbar`** (2026-08-18, client instruction:
  remove the "Date: … / Selected Day / Last 7 Days / …" toolbar from admin Reports). The
  instruction is about the CONTROL, not the window — a report with no period is not a
  report, and the charts, the bundles and the register all read the same `from`/`to`. What
  went is the second spelling of one picker: `pages/Shared/ReportsAdminBar.tsx` wraps the
  console's own bar (which prints the resolved dates, not just the lit preset) and carries
  the register's Export CSV / Print Register beside it. An HOD and staff keep
  `ReportsToolbar` unchanged — they never see the admin console, so there is nothing for
  them to unify with, and its two buttons are unconditional again
  (`showRegisterActions` deleted).
- **The 17-column table is `pages/Shared/RegisterTable.tsx` and there is ONE of it, with
  exactly ONE caller** — `styles/print.css` pins widths by `nth-child`, so a second copy
  fails silently on paper. `RegisterPrintSheet.tsx` was the second and is **deleted**; the
  arm-on-click / print-next-frame / unmount-on-`afterprint` dance went with it, because
  the register an admin prints is now the one already on their screen.
- **The department filter lives beside the page title** and feeds `shown`, which is what
  the register, the CSV and the printout all read — screen, paper and file cannot describe
  different sets. It is hidden for a department-scoped viewer, who has nothing to pick
  between.
- **NO ROW COUNT BESIDE A DOWNLOAD BUTTON** (2026-08-17) — the four bundles count different
  units, so four bare integers invited a comparison they do not support. What the count was
  load-bearing for survives as the **disabled state** and its sentence ("Nothing in this
  range").
- **AN EXPORTED CSV IS ASCII, AND THE FILE SAYS IT IS UTF-8.** `exportToCsv` writes a
  leading BOM (`﻿`) — without it Excel decoded with the locale ANSI code page and
  mangled every non-ASCII character, above all the visitor's own name, which is not ours to
  transliterate. The redaction FILL is ours, so `maskPhoneForExport` /
  `maskIdProofForExport` (`lib/pii.ts`) keep the same digits the screen keeps and fill with
  **`X`** (`XXXXXX3210`, `Aadhaar XXXX46`); on-screen `maskPhone`/`maskIdProof` still render
  bullets. Missing data reads **"Not recorded"**, not the screen's em dash.
  `reportRow.test.ts` asserts the whole row is ASCII.

## My Profile (`/profile`)
Reachable by every role. The sidebar profile block is a `<Link to="/profile">` (it used to
fire a bare file picker — no way to see your photo, remove it, or read your role).
Avatar upload/removal: `lib/avatarUpload.ts` + `pages/Shared/ProfilePhotoCard.tsx`. Storage
path is a fixed `${userId}/avatar` with **no extension**, so an upsert replaces the previous
photo and removal knows the one key (bucket + RLS: migration **053**). Only `full_name` and
`avatar_url` are ever written — `role`, `department_id`, `delegate_id` are administered from
Settings → Roles & Users; `role` syncs into the JWT and must never be self-service.

## Notifications bell
- **THE FIND & SCAN RESULT ROW CARRIES NO `dark:text-navy-*` EITHER** (client report,
  2026-08-18: things in the result field are not visible in the dark theme). `CheckInMatchCard`
  said `text-navy-600 dark:text-navy-200` on its neutral badges — navy-200 in dark mode is
  near-black on `bg-white/[0.06]` — plus `dark:text-navy-400` on the purpose and department
  lines and `text-navy-300` icons. Same pass on `CheckInVisitorSummary`, `CheckInFrame`,
  `CheckInBadgeRail`, `ScanPassLookup` and `ScanPassSearchBar`. **And the `brand` scale is a
  separate trap**: only `brand-50`/`brand-100` are CSS-variable driven, every step from 200 up
  is a STATIC blue, so the "Checked In" badge resolved to `#1d4ed8` on `rgb(23 37 84)` — about
  1.6:1. It needs an explicit dark twin (`dark:bg-brand-500/12 dark:text-brand-300`) in the
  shape the amber and accent badges already use; it cannot borrow the token trick
  success/danger/warning use, because those tokens flip and brand's do not.
- **THE PANEL IS WHITE IN LIGHT MODE, SO NOTHING ON IT MAY BE WHITE** (2026-08-17). It was
  authored dark-first: the heading and every title carried a hardcoded `text-white` and were
  invisible; `ModalCloseButton` was a white × on white; separators were `border-white/10`
  and `divide-white/8` (not a real Tailwind value, so it emitted nothing in either theme).
  Every foreground is now a **single navy step with no `dark:` override** — 950 title, 700
  prose, 600 timestamp/icon-only control. The bell glyph is `navy-800`, matching
  `TopbarClock` beside it.
  - Same pass fixed `OverviewNotifications` (five forbidden `dark:` pairs; its Mark-read and
    Dismiss controls were `navy-300` on white, ~1.9:1) and `HostNotificationsPanel`'s
    caveat line (`navy-500` → `navy-700`).
  - **`.revamp-empty-sub` → `navy-700`, and `.dark .revamp-empty-title` was DELETED** (it
    said `text-navy-100` = near-black on a dark panel; the base `navy-800` already resolves
    correctly).
  - Guarded by `NotificationBellContrast.test.tsx`, which asserts the CLASS CONTRACT (jsdom
    applies no stylesheet): no unqualified `text-white`, no `dark:text-navy-*`, no navy step
    below 600. It reads classes via `getAttribute('class')`, never `el.className` — on an
    SVG that is an `SVGAnimatedString`.
- **The click-away is a LISTENER, not an overlay.** A `fixed inset-0 z-40` scrim portaled to
  `document.body` beat the whole app (the panel's `z-50` resolves inside AppShell's
  `relative z-10` context), so every click in the dropdown closed it and marked nothing.
  `mousedown`/`touchstart` on `document`, filtered by `dropdownRef.contains`.
  `NotificationBell.test.tsx` fails on any `.fixed.inset-0` while the panel is open. Both
  writes re-read on error.
- **The topbar clock is IST and `text-navy-800`** — both `toLocaleTimeString` and
  `toLocaleDateString` pass `timeZone: 'Asia/Kolkata'`; the topbar is the worst place to
  disagree with the visit timeline.

## Live shared data
`src/lib/useDepartments.ts` and `useHods.ts` fetch **and** subscribe to `postgres_changes`.
Every department picker uses `useDepartments()` — never re-add a one-shot
`supabase.from('departments')` fetch, or admin edits stop propagating. Both tables are in
`supabase_realtime` with `replica identity full`; declared by 039 but actually landed by
**054**. Realtime still honours RLS.

## Migrations
Hand-applied. `supabase_migrations.schema_migrations` is **not** authoritative, the 3-digit
prefixes are not CLI versions, and `supabase db push` is not the workflow. **Verify against
the live project before trusting a file as a description of live state.** 046–055
reconciled a live-vs-disk audit (ledger in `055_drift_policy_convergence.sql`, including
what is deliberately not replayed). 021's `pre_approve_visitor` is superseded by 026/029;
**022's `visits: hod updates own department` must stay unapplied** — every HOD write goes
through a SECURITY DEFINER RPC, so a direct UPDATE grant is attack surface with no feature.

**Recurring traps**
- **REBASE A FUNCTION ON ITS LIVE BODY, NOT ON THE MIGRATION THAT FIRST WROTE IT** — diff
  `pg_get_functiondef` before and after (`memory.md` SB-15; 015 dropped the
  `walkin_approved` branches this way, 022 restored them). `enforce_visit_update_rules` has
  been recreated three times.
- **`CREATE FUNCTION` grants EXECUTE to PUBLIC**, and a DROP resets the ACL. Adding a
  parameter needs a DROP (an overload makes PostgREST refuse the call as ambiguous), and
  renaming an input parameter cannot be done with CREATE OR REPLACE. Check `\df+` after any
  signature change. 059, 073, 077, 080, 092 all re-granted explicitly.
- **The timezone lives in ONE place**: `vms_day_start_ist()` / `vms_day_end_ist()` (SQL) ↔
  `istDayStart` / `istDayEnd` / `IST_OFFSET_MS` (client). Keep each pair in step; there is
  no third copy. **The day ENDS at 22:00 IST** (075).
- **A cron session has no JWT**, so `sweep_no_shows_daily()` must
  `set_config('request.jwt.claims','{"role":"service_role"}', true)` (transaction-local) or
  `enforce_visit_update_rules` silently rejects every row.
- **`pg_net` is NOT installed**, so no scheduled job can make an HTTP call — the
  `notify-host` edge function is unreachable from SQL. Scheduled notices are in-app.

**By migration**
- **060** one open visit per visitor (see check-in constraints). **059** vendor_name rename.
  **062** input allowlists. **063** audit_logs trigger-only.
- **061** installed pg_cron and made `mark_no_shows()` mean "its moment has passed and it was
  never checked in" (was "grace_period past the slot", which killed a visit mid-journey).
  036 had defined the function but pg_cron was never installed, so it had never run once.
- **065–066** split the outcome on whether an appointment existed:
  `scheduled_for IS NOT NULL` and its day ended → **`no_show`** (an appointment was missed —
  the number a report should show); `scheduled_for IS NULL` → **`expired`** (an approval
  lapsed unused; every walk-in lands here). 061's sweep had skipped every walk-in and
  `walkin_approved` entirely, leaving seven live un-sweepable approvals offering themselves
  for check-in ten days later.
- **067** `sweep_overstays()` is installed and **DELIBERATELY NOT SCHEDULED** — nothing can
  distinguish a contractor legitimately on site for two days from a forgotten check-out, and
  any fixed threshold is wrong for one of them. The live mechanism is the guard dashboard's
  Overstaying tile (`isOverstaying`, default 12h from ENTRY). The sweep can only record
  `exit_verified = false`. To enable, uncomment the one-line `cron.schedule`.
- **070** `nudge_overdue_visits(120)` hourly: a booked visitor 2h past their slot gets the
  *host* a `visit_overdue` notification and the visit stays fully checkable-in all day —
  what 052 should have been. Inserts once per visit and stops at the day boundary.
- **071** QR passes expire at the END OF THE SCHEDULED DAY. 057 had fixed
  `pre_approve_visitor`, which nothing calls — `PreApproveForm` calls
  **`pre_approve_visitor_v2`**, which never set `qr_expires_at`, so every pass fell to the
  column default `now() + 24h`. **If you patch a pre-approval RPC, check which one the app
  calls.**
- **072** made the sweep hourly (`40 * * * *`); the schedule now decides only how promptly a
  finished day is swept, since 066's predicate is self-contained and idempotent.
- **073** `visits.expected_departure`: the overstay rule is a deadline, not an interval —
  `coalesce(expected_departure, checked_in_at + N hours)`, mirrored in `isOverstaying`.
  **Optional on purpose** (a second mandatory datetime in front of every meeting would be
  filled with something false). `visits_departure_after_arrival` CHECK +
  `validatePreApproval`. The QR is anchored to the **departure** day, or a three-day
  contractor's pass dies on night one.
- **074** a check-out can be undone for 15 minutes by the guard who made it. `checked_in →
  checked_out` was a one-way door and migration 060 makes the obvious fix create a second
  visit row for one continuous presence. The undo NULLs `checked_out_at`/`exit_verified`
  (the visitor never left) and deliberately does not re-stamp `checked_in_at`. Sweep-closed
  rows get no exemption.
- **075** the IST day ends at **22:00** (`vms_day_end_ist`), and `send_no_show_summary(force)`
  sends HODs a 20:00 IST forecast (`visit_no_show_summary`, one per HOD per IST day, nothing
  marked yet). The first sweep after 22:00 marks the no-shows and writes `visit_no_show`
  ("raise a new pre-approval"). No reactivation is surfaced; the DB-only `no_show →
  approved` route stays a safety net. The summary's `related_id` is **null** — it is a
  count, so never render a link that resolves to nothing.
- **076** visitor card columns (see check-in constraints).
- **077** the sweep compares each VISIT's day end, not today's — 075 shipped with the
  predicate ending the day containing `now()`, which filed an approval `no_show` hours
  before its slot (live: Raju, `VIS-20260813-0001`). Now `now() >=
  vms_day_end_ist(scheduled_for | created_at)`, safe at any hour and idempotent.
  `nudge_overdue_visits`'s guard is `now() < vms_day_end_ist(now())`, so the overdue notice
  and the no-show notice can never both fire.
- **080** (SUPERSEDED BY 083) briefly made an HOD's approval land a walk-in straight in
  `checked_in`. Still live from it: `pre_approve_visitor_v2` writes its own `visit_approved`
  row (a row born `approved` never changes status, so the trigger never fired), and
  `get_profile_names` returns `department_name`. `walkin_approved` was never retired — live
  rows rest in it.
- **081/082** an unanswered walk-in request **lapses** at 10 PM. `pending_approval` was the
  one status the sweep could not reach while `Console.loadVisits` carried it unbounded.
  **`lapsed` is a TENTH status, not a reuse of `expired`**: `expired` means somebody
  approved it, and `IMPLIES_PRIOR_APPROVAL` / `IMPLIES_APPROVAL` both hold it true, so
  filing an unanswered request there would make the register claim a host cleared a visitor
  they never saw. `lapsed` maps FALSE in both and Reports prints "Not approved". Predicate
  is 077's shape over `coalesce(scheduled_for, created_at)`. It writes **no audit row and no
  notification** (no actor, no instant; 070's nudge and 075's summary both key on
  `scheduled_for`, which these rows lack) and is **out of `DECIDED_STATUSES`**. The way back
  is `lapsed → pending_approval` only — reopening puts the decision back, it does not invent
  the answer. `lapsed` proves a walk-in origin on its own (`DEFINITIVE` in `visitOrigin`).
  082 also added `pending_approval → lapsed` / `lapsed → pending_approval` to
  `enforce_visit_update_rules` — **the live body to rebase on**.
- **083** the approver clears, the **GUARD admits** (client instruction; reverts 080).
  Workflow: `WalkInRequest` → `pending_approval` ("Awaiting Approval", no action) → HOD
  approves → `walkin_approved` → the gate's Check In, which will not submit without a photo,
  an ID scan and a **visitor card number** → `checked_in`. Why: `WalkInRequest` collects no
  card number, so every 080-admitted walk-in reached check-out with that column null and
  076's return gate had nothing to demand back. `approve_visit()` writes `walkin_approved`
  and does not stamp `checked_in_at` (080's `unique_violation` handler went with it — 060's
  index is partial on `checked_in`, so it could never have fired). `log_visit_approval` no
  longer writes `visit_approved`(`admitted: true`) + `visit_checked_in` off one click.
  **Rows already admitted by the shortcut are NOT rewritten** — they keep a null card and
  leave via the "no card was issued" branch. App-side changes: `visitLifecycle`
  (`pending_approval` loses `checked_in`), `visitGateChips` (a `walkin_approved` row read
  "Checked in", tone `inside` — the fire-marshal tone, on a visitor still outside),
  `guardTiles` (`IS_EXPECTED` regains `walkin_approved`; `checked` keyed on `checked_in_at`
  alone), `HODOverview`'s Upcoming query.
- **084–089** the data the admin console needed. Every column is NULLABLE and every screen
  says what it does not know. **Nothing writes the new columns/rows yet** — that was a
  deliberate scope split, and the tabs render honest empty states until a writer exists.
  - **084** `entry_points` + `visits.entry_point_id` — WHICH DOOR (not `visitOrigin`, which
    is which ROUTE). A TABLE, not free text (which spells one door four ways) and not an
    enum (a new door would need a migration); `active` retires a gate while keeping its
    history, hence **no delete policy**. Null arrivals report separately as `unrecorded`,
    never folded into a gate. Nothing reads it (see the removed utilization panel).
  - **085** `visitors.email` (optional and staying optional — `phone` is the identity
    column; the CHECK is a loose typo guard, not an RFC 5322 attempt) and
    `visits.invitation_sent_at` (a TIMESTAMP so "yes" and "when" are one column). **Nothing
    sends the invitation yet**, hence no invite button.
  - **086** `visit_feedback`, ONE ROW PER VISIT enforced by a unique index (three plausible
    writers with no constraint is how one visit gets rated three times) — which is what
    makes the wide insert policy safe. The mean is computed at read time, never stored. Read
    is admin/HOD only. **No update, no delete policy**: a rating the rated party can edit is
    not a rating.
  - **087** `badge_prints` — a LOG, append-only by construction (no update/delete policy).
    Its tab is deleted; do not re-add one until a check-in path inserts a row.
  - **088** `visits.checkin_duration_seconds` — how long the DESK took (the substitutes
    measure the visitor's punctuality or a booking's lead time). A single integer, bounded
    1..3600, so an abandoned flow is **unmeasured**, not slow. The tile states how many
    arrivals carried a measurement.
  - **089** `app_settings` key/value with a jsonb value — the alternative was constants in
    the bundle, unchangeable from a Vercel deployment (the `qr` flag trap). Key/value so a
    new toggle needs no migration. Nothing in the DB enforces a value's SHAPE:
    **`src/lib/appSettings.ts` owns the typed schema and COERCES on read**, falling back to
    the documented default. **That file and the seed are ONE schema written twice — edit
    them together.** Every default is the behaviour the app already had (in particular
    `checkin.require_photo`/`require_id_scan`/`require_card_number` seed **true**). Read is
    granted to every signed-in role. **No delete policy.**
  - Verified live 2026-08-17: all four tables and all four columns exist, RLS on,
    `entry_points` 4 seed rows, `app_settings` 26.
- **090–092** the two-person blacklist removal (see the blacklist section). **Apply in order
  090, 091, 092**: `ALTER TYPE … ADD VALUE` cannot be used by any statement in the same
  transaction, and Supabase applies a migration inside one. The 091/092 split is only the
  300-line cap. `prevent_guard_blacklist` was rebased on its LIVE body (one early return
  added, nothing removed, verified by diff). A pending row has no `decided_by`/`decided_at`
  and a decided row has both (CHECK, not convention). Verified live with 14 probes,
  including that an **admin's** direct clear is refused, the visitor stays flagged while
  pending, a refusal leaves them blacklisted, and the clearance key does not leak.
- **093** deletes the Time Zone `app_settings` row (see Settings).
- **094–096** Settings → Users. **094** `public.user_status` (absent row = active, no
  insert/update/delete policy) + `is_user_active` (SECURITY DEFINER, calls NOTHING, or it
  recurses through the policy it decides) + `current_user_role()` **rebased on its live
  body** to return NULL for a suspended caller — one edit, and every policy in the schema
  enforces it — + `my_account_active()` for the app shell. **095** `admin_list_profiles`,
  `admin_create_user`, `admin_update_user`: role allowlist **guard | hod | staff**,
  admin/super_admin/ceo refused server-side, `must_change_password` seeded true, and 034's
  four `auth.users` token columns written as `''` (omit them and the account cannot sign in
  at all). **096** `admin_deactivate_user` / `admin_reactivate_user` — only the first
  confirms and only the first deletes sessions; both refuse an admin target and
  `profiles.role` is never touched by either.
- **097** `visits.id_match_overridden` (the scan-mismatch override, recorded without a
  reason) and a PARTIAL index on `upper(visitor_card_number)` for `checked_in` rows, which
  is what Find & Scan's card lookup reads. Verified live 2026-08-18.
- **102** ONE CARD, ONE HOLDER — the two unique indexes behind "a number cannot be issued
  again until it is returned" (see the card rule above). It opens with a DO block that
  NAMES every already-double-issued card as a NOTICE before either CREATE runs, because
  "could not create unique index" pointing at a row id is not something an operator can
  act on. It also drops 097's now-redundant `visits_card_number_inside_idx`. No enum
  change, so no `ALTER TYPE` split this time. **Applied and verified live 2026-08-18**:
  both unique indexes exist on `public.visits` with the expected expressions and
  predicates, `visits_card_number_inside_idx` is gone, and the pre-check found zero
  double-issued cards, so nothing had to be reconciled first.
- **098/099** the `senior_manager` role — an HOD's permissions under a different job title
  (client instruction, 2026-08-18), so a department headed by somebody not called an HOD
  can be represented as what they are. **Apply 098 alone, then 099**: `ALTER TYPE … ADD
  VALUE` cannot be used by any statement in the transaction that adds it, the same split
  090/091/092 needed.
  - **ONE EDIT, NOT TWELVE.** Twelve policies name `'hod'` and several RPCs test it, but
    none reads `profiles.role` — they all go through **`current_user_role()`**, so 099
    teaches THAT function to answer `hod` for a senior manager and every existing policy
    follows, including the ones written next year. Rebased on its LIVE body: 094's
    suspension gate is checked FIRST, so no role mapping can hand a withdrawn account a
    permission. Verified live: `senior_manager → hod`, `hod → hod`, `guard → guard`.
  - **It maps PERMISSION, never IDENTITY.** `profiles.role` still stores `senior_manager`,
    the JWT still carries it (that is what picks the sidebar and landing page), the
    directory prints it, and audit rows stamp `auth.uid()` — a senior manager's approval is
    attributable to them, exactly as an HOD's is.
  - 099 also widens `admin_create_user` / `admin_update_user` to **guard | hod |
    senior_manager | staff**. `v_dept` keys on `= 'guard'`, so a senior manager keeps a
    department untouched — which is required, since `get_hosts_for_department` returns
    everybody in a department and they must appear in the host picker.
  - App side: `ROLE_ROUTES.senior_manager` is the HOD list **written out, not aliased** —
    this file is where a reader asks what a role can reach. Also `resolveUserRole`,
    `AppShell` greeting, both `ROLE_LABELS`, `userStatus` (`ROLE_LABEL`/`ROLE_CHIP`/
    `ASSIGNABLE_ROLES`), `navLinks` (every HOD item), `visitStatusLabel` ("Person to Meet",
    or a snake_case enum would print on a visitor's row), `mfa` (it can clear a stranger
    into the building), `NotificationBell` (it receives the walk-in requests) and
    `VisitorDetails` (no ID proof, same as an HOD). `routeProtectionSeniorManager.test.tsx`
    asserts EQUIVALENCE with `hod` rather than a copied path list, so the two cannot drift.
- **100/101** every account that is not a guard and not an admin is an HOD (see the
  section of that name). **Apply 100 then 101** — 101 calls `effective_role()`, which 100
  creates. No enum change, so no `ALTER TYPE` split is involved this time; the two files
  are the 300-line cap. Verified live 2026-08-18: policy counts unchanged on `visitors` (3)
  and `recurring_visits` (4), `enforce_visit_update_rules` rebased, `current_user_role()`
  mapping both roles, and `tests/security/rls.test.ts` proving a staff account approves in
  its OWN department, is refused in another, and gains nothing from forging
  `user_metadata`.
- **064** admin-assisted password reset + forced change on first sign-in (verified live
  2026-08-10). Self-service reset was removed from the login card the same day: the built-in
  Supabase mailer is capped at **~2 mails/hour PROJECT-WIDE**, shared with the sibling
  GatePass app, so "Forgot password?" failed for most people. The card names a human
  (`ADMIN_CONTACT_EMAIL` from `src/pages/Login.tsx`).
  - `admin_reset_user_password(uuid, text)` — admin/super_admin only; writes bcrypt via
    `extensions.crypt(pw, extensions.gen_salt('bf'))`, raises `must_change_password`, and
    **deletes every session that user holds** (`auth.sessions`; refresh tokens cascade).
    **It refuses to target an admin/super_admin** — otherwise the weakest admin account is a
    takeover route into every stronger one. A locked-out admin is a dashboard job, on purpose.
  - `set_my_password(text)` — scoped to `auth.uid()`, **clears the flag in the same call
    that writes the password and nothing else clears it** (a separate clear-the-flag RPC
    would let the forced-change screen be skipped from the console). Refuses reusing the
    current password.
  - `my_must_change_password()` — SECURITY DEFINER, `auth.uid()`-scoped, and the ONLY thing
    the app shell should ask. Do **not** `select must_change_password from profiles` in the
    startup path: `public.profiles` has a history of recursive-policy failures (42P17) and a
    raise there would lock everyone out or fail open.
  - `profiles.must_change_password` is `not null default false` (nullable would make "never
    reset" and "reset, unknown state" indistinguishable). **Shared with GatePass** — its
    migration `036` mirrors the functions into the `gatepass` schema and must never alter
    `public`. **Apply 064 before GatePass 036.**

## Directory layout
```
src/
  pages/Guard/       Console (Visitors shell) + VisitorSegmentContent, VisitorStackList,
                     VisitorGridCard, VisitorKpiRail, VisitorCard (the one shared row);
                     GuardWalkIns, GuardWalkInApproved, RegisterWalkIn, WalkInRequest,
                     WalkInIdentityStep, WalkInCheckInForm, PendingGateCheckIn;
                     Dashboard (17-line shell) + GuardDashboardMain, ArrivalQueueTable,
                     IdVerificationCard, KpiDrilldownSheet, DenyEntryConfirm;
                     GuardLiveQueue (= Entry & Exit) + LiveQueueTable, EntryExitTabs,
                     CheckInFrame, CheckInBadgeRail, CheckInTimeline;
                     GuardPreRegistered + PreRegisteredCard; PreApprovals + PreApprovalRow;
                     CheckInPanel + CheckInMatchList/MatchCard, CheckInPhotoStep
                     (+ CheckInCardField, CheckInScanField, CheckInPhotoRow),
                     CheckInVisitorSummary, CheckInScanGate, GuardQRScan, ScanPass +
                     ScanPassEntryBar/SearchBar/Lookup/Detail,
                     IdScanOverlay, CardReturnConfirm; Search + SearchResultCard;
                     VisitorForm* ; VisitorCheckInFlow
  pages/HOD/         HODConsole (dashboard / walk-in desk / schedule, all ?tab= views of
                     /overview) + HodKpiBoard, HodWalkInDesk, HodDecisionPanel, HodSchedule,
                     HodDashboardCharts; Approvals (the pre-approval FORM), PreApproveForm,
                     ApprovalsPendingList, ApprovalsVisitList, HODOverview, Overview*
  pages/Shared/      Reports (+ReportsToolbar [HOD/staff], ReportsAdminBar [admin],
                     ReportsAnalytics, ReportsDownloadCards, ReportsRegister,
                     RegisterTable, ReportsDeptFilter, ReportsPrintHeader);
                     WhosInside + WhosInsideVisitorCard; VisitorsDashboard; ProfilePhotoCard
  pages/Admin/       The six tabs: AdminDashboard(+Kpis), AdminLiveCheckIn(+LiveCheckInTabs),
                     AdminHosts(+HostDirectoryCard),
                     AdminSecurity(+Kpis, BlacklistPanel, AlertsPanel, DeniedEntriesPanel,
                     BlacklistForm, BlacklistRemovalForm), AdminSettings(+SettingsRail,
                     SettingsField, SettingsRolesUsers), AdminPageHeader, AdminRangeBar,
                     AdminTablePagination (generic); DepartmentsManager + Department*/Hod*,
                     AdminStats, AdminAlerts, ConfirmDialog, AdminConfirmDialogs, Activity,
                     adminOverviewView, AdminOverviewPrompt, DepartmentList, HodDirectory,
                     UnassignedDepartments
  pages/CEO/         CeoBlacklistRemovals + CeoDecisionCard
  pages/Kiosk/       Kiosk (state machine) + Kiosk*Screen, KioskAuroraBackdrop,
                     useKioskAutoReset
  components/        DashboardTile, DashboardPanel, DashboardVisitorTable (guard AND HOD),
                     GlanceHeader, KpiTile, AdminKpiTile (a div), SettingToggle,
                     ModalCloseButton, PhotoCapture, SuccessToast, VisitorDetails*,
                     VisitorTimelineCard, PreApprovalPass, PassIdentity, NotificationBell
  components/charts/ ChartCard, LineChart, DonutChart, BarChart, UtilizationRows
  components/layout/ AppShell, Sidebar, navLinks (ALL_LINKS), SidebarProfile, TopbarClock
  routes/            adminRoutes.tsx (an ARRAY of <Route>)
  lib/               roleRoutes, theme, errors, mfa, resolveUserRole;
                     guardTiles, hodTiles, tileIcons, dashboardColumns, visitGateChips;
                     useTodayVisits, useGateActivity, usePreApprovals, useVisitorCounts,
                     useAdminVisits (no mutation), useDepartments, useHods,
                     useVisitorDirectory, useBlacklistRemovals, useVisitHistorySearch;
                     visitorSegments, preRegisteredBoard, visitOrigin, visitLifecycle,
                     visitExpiry, istDateTime, visitTimeline, visitApproval, visitActors,
                     checkableStatus, activeVisit, statusRail, cardNumber,
                     cardAssignment, useCardAvailability, pii;
                     checkInFlow, checkInWalkInApproved, checkOutFlow, fetchVisitById,
                     denyEntryFlow,
                     notifyHostCheckIn, printBadge, photoUpload, avatarUpload;
                     searchVisits, visitorSearch, decodeQrImage, pdfQrPage, qrPassPdf,
                     sharePass, qrToken;
                     adminDashboard / adminReports / adminHosts / adminSecurity /
                     adminLiveCheckIn / reportBundles /
                     reportsDateRange (PURE functions over Visit[]);
                     appSettings + settingsSections, adminBlacklist, blacklistRemoval,
                     adminDepartments, adminHods, inputRules, chartPalette, initials
  styles/            tokens, base, components-forms, components-surfaces,
                     components-feedback, components-guard, components-dashboard,
                     components-filter, components-visitor-stack, print, aurora, animations
                     — all @imported by index.css BEFORE @tailwind
  types/             index.ts (all DB types, mirroring the live schema)
supabase/migrations/ 001–102, hand-applied. See Migrations.
tests/unit, tests/security
```
