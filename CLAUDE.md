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
- **The guard sidebar is three items — Dashboard, Scan Pass, and Visitors** as
  plain links. Defined in `src/components/layout/navLinks.tsx` (extracted out of
  `Sidebar.tsx`). The `/visitors` entry is declared **twice** — once for `guard`,
  once for `staff` — because the two roles land on different components at that
  route and the staff label carries no sub-nav either. There is **no group and no
  `SidebarNavGroup.tsx` since 2026-08-13**: the eight segments that used to expand
  under the guard's Visitors item now live on the page itself as KPI tiles
  (`VisitorKpiRail`), counted from the page's own data. The sidebar naming the
  segments was the old answer to "where can I go"; the page carrying the counts
  and the filters is the same answer one click closer.
- **`src/lib/visitorSegments.ts` is the single source of truth for the Visitors
  surface.** The sidebar children, the page content, the page copy and the live
  count badges are all derived from `VISITOR_SEGMENTS` / `SEGMENT_META` /
  `SEGMENT_FILTER` there, so a segment cannot exist in the nav without existing
  on the page, and "what Expected means" is defined once. Adding a segment is one
  edit in that file. The eight are: All Visitors, Expected, Inside, Pending
  Approval, Approved Walk-ins, Overstayed, Checked Out, Walk-in Register.
- **Each segment is a real URL** (`/visitors`, `/visitors/expected`,
  `/visitors/inside`, …), routed in `App.tsx` via `/visitors/:segment`. This
  replaced a three-tab bar buried inside the page: the tabs were invisible from
  the nav, unbookmarkable, and the back button did nothing between them. Every
  legacy `?tab=` value is mapped by `segmentFromSlug`, and an unknown slug
  degrades onto `all` rather than 404-ing into a blank page — those values live
  in old bookmarks. `GuardConsoleModeTabs.tsx` and `GuardConsoleModeContent.tsx`
  were deleted; `pages/Guard/VisitorSegmentContent.tsx` superseded them.
- **The stacked card is the one visitor layout.** `VisitorStackCard.tsx` (+
  `VisitorStackFacts.tsx`) renders three columns — identity, contact facts,
  verification and action — because a guard reads the name and the host, glances
  at the time and the phone to confirm it is the right person, then acts. The
  older single-row `VisitorCard.tsx` **still exists** and is used by
  `GuardWalkIns` and `GuardWalkInApproved`; do not delete it. Styles are in
  `styles/components-visitor-stack.css`.
  - **It has NO leading colour rail, by instruction (2026-08-13).** `.stack-card`
    used to declare a `::before` with no background so the bare `.rail-*::before`
    selectors in `components-guard.css` would colour it. The `::before` is now
    **deleted**, not made transparent, and the `padding-left` inset that cleared it
    is back on the normal `p-4` step — nothing is left holding space for something
    that no longer draws. The rule this does not break: colour must never be the
    **only** carrier of status. It never was here; the text badge in the third
    column always said it, and still does. `VisitorStackCard.test.tsx` fails on any
    `rail-` class. `.visitor-card` keeps its own rail — `lib/statusRail.ts` is still
    live for it, so do not delete that either.
  - **The dashboard drill-down uses this same card.** `DashboardDrilldown.tsx`
    rendered `WhosInsideVisitorCard` until 2026-08-13; the two surfaces now look
    identical, which is what the client asked for. It passes **`onSelect` only and
    never an `action`** — "Dashboard reads, Console acts", so a Check In / Check Out
    button there would let a situational-awareness panel change a visit's state.
    Tested. `WhosInsideVisitorCard` is untouched and still serves `/whos-inside`.
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
- **Which action a row offers depends on the VISIT, not on the segment heading.**
  `actionFor` in `VisitorSegmentContent.tsx`: `approved` → Check In,
  `checked_in` → Check Out, everything else → no button. "All Visitors" mixes an
  expected arrival and a departed one on one screen, and a button the guard
  cannot honour is worse than no button.
- **The walk-in register is untouched by all of this.** `/visitors/walk-in`
  renders `GuardWalkIns` exactly as before, with its own pending list, because
  registering an unannounced arrival is the one thing on this surface that
  *creates* a visit rather than advancing one, and registering then watching for
  the host's answer is one continuous job. `/visitors/approved` likewise still
  renders `GuardWalkInApproved` unchanged — it captures a photo before it can
  act, so it is a flow, not a row with a button.
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
  two agreed. `VisitorStackCard.test.tsx` guards this, along with the vendor and host
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
  have had nowhere to be invoked. The undo nulls `checked_out_at`/`exit_verified` rather
  than annotating them (the visitor never left), and deliberately does **not** re-stamp
  `checked_in_at`. The sweep's auto-closed rows get no exemption — revisit that only when
  067's sweep is actually scheduled.
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
- **Open visits are never date-bounded.** `Console.loadVisits`, `useGateStats` and
  `useTodayVisits` all used a bare `created_at >= today` window, which silently dropped
  unfinished work at midnight: a walk-in registered at 23:50 and approved at 00:05 was
  approved into an empty list, a visitor still inside from the previous evening could
  not be checked out, and a pre-approval booked last week for today never appeared.
  The console now ORs in `status.in.(pending_approval,walkin_approved,checked_in)`, and
  the two dashboard hooks OR in `scheduled_for` within today. Keep the hooks in step —
  the count and the drill-down list must come from the same window. `useGateStats` also
  ORs in the open statuses unbounded, so a visitor still inside from last night is
  counted in "Inside Now"; the invariant survives, because every row with
  `checked_in_at` is either `checked_in` or `checked_out`.
- **A photo is mandatory on every check-in path.** `CheckInPanel` gates it structurally
  (the confirm step does not render until a photo exists), `GuardWalkInApproved`
  disables Confirm without one, and `VisitorForm.checkInPreApproved` — which used to
  flip status to `checked_in` with no photo at all — now refuses and uploads one. The
  photo is the record of who actually walked in; an approval only says who was expected.
- **The Recent Activity feed is back, and it is DERIVED, not fetched.** It was
  deleted once (`DashboardActivity.tsx` + `lib/useRecentActivity.ts`) because it ran
  its own query and its own subscription alongside the KPI tiles: two answers to
  "what happened today" on one screen, with nothing forcing them to agree. It
  returned on 2026-08-13 with that failure mode designed out — `lib/recentActivity.ts`
  is a **pure function** over the `todayVisits` array the tiles already count, so the
  feed cannot tell a different story from the numbers above it. There is no
  `useRecentActivity` hook and there must not be one again; if the feed ever needs a
  row the tiles do not have, widen `useTodayVisits`, do not add a second query.
  - **One visit yields SEVERAL events.** A visitor who arrived at 09:00 and left at
    11:00 is one row with `status = 'checked_out'`, but two things happened. Keying
    the feed by visit id would drop every arrival the moment the visitor left — the
    exact half of the day a guard scrolls back to check. Events are keyed
    `${visit.id}:${kind}`.
  - Three kinds only: `entry` (`checked_in_at`), `exit` (`checked_out_at`),
    `declined` (`actorAt`, falling back to `created_at` — a rejection has no
    timestamp column of its own, it lives in `audit_logs`). An `approved` or
    `pending_approval` visit contributes nothing: nothing has happened yet, and a log
    of what occurred must not contain things that have not.
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
- **The dashboard follows a reference design, but only where the design was right.**
  Restyled 2026-08-13 to the client's mockup: icon-plate KPI cards on a 4-wide grid, a
  Recent Activity panel, Quick Actions, a live clock. `pages/Guard/dashboardTiles.tsx`
  owns the per-tile label/hint/tone/tint/glyph, `DashboardTile.tsx` the card,
  `styles/components-dashboard.css` the plate and chevron (split out of
  `components-guard.css`, which was at 248 of its 300 lines). Four things in the mockup
  were deliberately **not** built, and each is guarded by a test:
  - **The palette is ours, not the mockup's.** The reference is blue/green/purple; this
    app is Quest Mall gold and bronze. Every tone is the one that tile already carried,
    because a hue is only information if it means the same thing on every screen.
  - **Six tiles: Entries, Exits, Currently Inside, Overstaying, No-shows, Declined**
    (3-wide grid). Overstaying is not optional — migration 067's sweep is installed but
    deliberately unscheduled, so that tile is the *only* live mechanism for catching a
    check-out the gate forgot.
  - **Pre-approved and Walk-ins Approved were REMOVED from the dashboard (2026-08-13,
    client instruction).** Both populations are already first-class segments of the
    Visitors surface — `/visitors/expected` and `/visitors/approved`, each with its own
    KPI tile on that page's rail and its own list underneath. Carrying them here too put
    the same two counts on two screens behind two *independent* queries
    (`useGateStats` and `Console.loadVisits`), with nothing forcing them to agree: the
    duplicate-render rule, and the exact failure mode the derived Recent Activity feed
    was rebuilt to avoid. The keys are gone from `DrillKey`, `DRILL_KEYS`,
    `DRILL_FILTER`, `DRILL_COPY`, `TILES` **and `GateStats`** — do not re-add them to
    any of those. `overdue` in `useGateStats` still spans BOTH approval statuses
    (`IS_EXPECTED`); a visitor is overdue whichever route approved them, and narrowing
    it to one status is the mistake this removal could invite. One consequence worth
    knowing: no dashboard drill-down can list a not-yet-arrived visitor any more, so
    the "never offers Check In" regression test runs against `entered` instead.
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
  (Analytics, VisitorsDashboard) stay `stat-card` divs — same surface and hover via CSS
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
  - **`compact` is a layout switch, not a second design.** `KpiTile compact` gives the
    same card a square face (plate over numeral over label, centred) for the Visitors
    rail, which packs eight segments two-up in a 300px column. The surface, border,
    hover and active ring are the shared ones. The hint goes `sr-only` rather than being
    dropped: "Expected" and "Pending Approval" are ambiguous read aloud, and the
    accessible name is the only place that context survives once the square has no room
    to print it — which is also why the rail tests can still query by qualifier text.
- **`entered` is NOT `inside`.** `visits.status` holds one value, so a visitor who came
  and left is `checked_out`, not `checked_in`. Counting `status === 'checked_in'` answers
  "who is still here", never "how many came through today". `useGateStats` derives
  `entered` from `checked_in_at IS NOT NULL` and holds the invariant
  `entered === inside + checkedOut`. `tests/unit/lib/useGateStats.test.ts` guards this —
  it is the bug the dashboard rebuild fixed and it must not silently return.
- The `Declined` tile is `status === 'rejected'`, which means **an HOD declined the
  request**, usually before the visitor ever reached the gate. It is not the guard turning
  someone away — do not relabel it "Denied Entry". The 2026-08-13 reference design called
  it exactly that, which is how a mislabel gets in: printing "entry denied" on a guard's
  screen claims a person was refused at the door, a different and far more serious event
  to have wrong in a record someone may later be asked to account for.
  `GuardDashboard.test.tsx` fails on any `/denied/i` text.
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
                     # Dashboard (composition) + DashboardSummary, dashboardTiles
                     #   (per-tile copy/tone/glyph), DashboardTile (the KPI card),
                     #   DashboardDrilldown (the in-page KPI expansion — superseded the
                     #   deleted GuardInsideNow), DashboardActivity (derived feed),
                     #   DashboardQuickActions (two links, never a third);
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
  components/layout/ # AppShell, Sidebar, navLinks (ALL_LINKS — the one
                     #   source of truth; SidebarNavGroup.tsx was deleted
                     #   2026-08-13, there are no nav groups),
                     # SidebarAnalytics, SidebarProfile
  lib/               # roleRoutes, theme, errors, mfa,
                     # useGateStats (guard KPIs — read the entered/inside note above),
                     # dashboardDrill (KPI → predicate + copy), useTodayVisits
                     #   (the whole day, one fetch, feeds every drill-down),
                     # activeVisit (already-inside checks + guard-readable message),
                     # recentActivity (PURE — derives the feed from the day the
                     #   tiles already loaded; there is no fetching hook),
                     # usePreApprovals, useWatchlist,
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
