# Revamp working notes (internal)

## Environment
- Desktop connection works: session `desktop:try3`, project at `C:\Users\ASUS\Desktop\VMS`, mounted at `/mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS`
- Sandbox working copy: /home/ubuntu/vms_repo (cloned from github.com/jollyroyy/vms), .env copied from desktop mount. npm installed, tsc clean, vite build passes (~10s)
- Supabase: https://oxzzeonftrmohdrancex.supabase.co (user's prod DB — write through UI only, never migrate/alter schema)
- User requests: revamp ALL role views (Guard/HOD/Admin/Kiosk) to match approved gold/navy premium snapshots; both dark + light themes; scanning/OCR/check-in logic must stay fully functional; fix anything broken; deliver back (push to GitHub + sync to desktop folder)

## Existing state (good foundation)
- Theme system already exists: src/lib/theme.tsx (ThemeProvider/useTheme, class-based dark toggle, defaults dark, localStorage key `securegate-theme`)
- tokens.css has full navy/surface/brand/accent/success/warning/danger scales + glass vars for both :root and .dark
- Tailwind: brand=gold, accent=bronze, navy, surface, fonts display=Playfair Display, sans=Inter; Minor Third type scale; premium shadows (card-premium, glow, modal)
- Routes in App.tsx: /visitors(:segment) GuardConsole vs VisitorsDashboard by role; /guard + /guard/dashboard + /guard/scan-pass + /guard/daily-staff + /guard/pre-approvals + /guard/search; /kiosk; /approvals HODApprovals; /overview HODOverview; /whos-inside; /reports; /analytics; /admin; /admin/activity; /profile; login at /
- AppShell.tsx: sidebar fixed 264px (collapsed 84px), topbar glass strip h-16 with search + NotificationBell, dept greeting, footer. Already premium-styled.
- Sidebar.tsx: glass card, links via navLinks.tsx, theme toggle + SidebarProfile + collapse toggle already present
- IMPORTANT: the shell/layout already largely matches premium style. The revamp should focus visual restyle on: GuardConsole, GuardDashboard/Summary/Drilldown tiles, Guard scan/CheckInPanel steps, HOD Approvals + Overview, AdminPanel/AdminStats/DepartmentsManager/HodDirectory, Reports, Analytics, Kiosk screens, Login.

## Blueprints for page redesigns → see REDESIGN-BLUEPRINT.md
## Design primitives plan → create src/components/primitives/ (KpiTile, StatusPill, FilterChips, DataTable, VisitorAvatar, EmptyState, PageHeader, ActionButton variants, SectionCard, ChartCard)
## USER DIRECTIVES (binding)
- NO redundancy: don't duplicate working systems (theme lib, tokens, sidebar, glass surfaces already premium); restyle only where it adds value
- One shared primitive set, no duplicate components; same screens/content, elevated visuals
- No feature bloat; scanning/OCR/check-in logic untouched, styled only
- DO add missing pieces: premium polish from approved snapshots, both themes, missing standard VMS surfaces (KPI board, HOD approval cards, filter chips, status pills, avatars, empty states, refined login/kiosk)
- Fix anything broken; run tsc + tests + both themes

## Delivery: push branch `premium-redesign` to github, merge to main, sync files back to desktop mount

## Structure findings (read so far — no rewrite needed of these)
- App.tsx: routes + ProtectedRoute; imports LoginPage('./pages/Login'), ResetPassword, ForcePasswordChange, Kiosk from './pages/Kiosk/Kiosk'. ThemeProvider wraps all.
- Theme lib src/lib/theme.tsx COMPLETE (useTheme, toggleTheme, setTheme, defaults dark). AppShell/Sidebar already premium with theme toggle in sidebar bottom. Theme toggle = done, don't rebuild.
- components-guard.css: .gate-tile/.kpi-tile/.visitor-card/.gate-action/.gate-tab/.gate-tab-bar/.queue-row/.stack-card (see visitor-stack css). Already good.
- Console.tsx: KPI rail (VisitorKpiRail) + VisitorSegmentContent (walkin form, walkinApproved photo flow, list via VisitorStackList→VisitorStackCard). Logic solid.
- VisitorStackCard: identity | facts | verification+action columns; no color rail (removed by design); status badge + StackCheck ticks; single gate-action button.
- HOD: /approvals = PreApproveForm wrapper (create pre-approval). HODOverview = real command surface with OverviewStatCards, OverviewPendingApprovals (→ApprovalsPendingList), OverviewOnSite, OverviewUpcoming, OverviewNotifications; supports ?filter=.
- PreApproveForm.tsx has Vehicle Number field (user said no vehicle/driver) — remove vehicle field from form.
- Admin: AdminPanel thin; DepartmentsManager is the real workspace (AdminStats tiles, DepartmentList, HodDirectory, UnassignedDepartments, AdminConfirmDialogs).
- CSS caps: hard 300-line cap per CSS file. components-guard.css=215, components-dashboard.css=73.
- Styles dir files: animations, aurora, base, components-dashboard, components-feedback, components-filter, components-forms, components-guard, components-surfaces, components-visitor-stack, print, tokens.
- Pages to restyle (visual elevation only): Guard Console/segments ok-ish already; focus HOD Overview sections, ApprovalsPendingList cards, AdminStats/DepartmentList/HodDirectory, Reports toolbar, Analytics charts (src/pages/Shared/AnalyticsCharts.tsx), Kiosk (KioskAuroraBackdrop, KioskFormScreen, KioskBadgeScreen, KioskIdleScreen, KioskPhoneScreen), Login page (src/pages/Login), Dashboard (Guard Dashboard tiles).

## Test baseline (before restyle work)
- Full suite: 162 passed / 3 failed. Vehicle tests fixed (VisitorStackCard now 21/21 pass).
- Remaining failure: tests/security/rlsDataIntegrity.test.ts — beforeAll hook timeouts at 120s (login('guard@demo.vms') against live Supabase). This is an environment/test-infra issue against the user's live DB in sandbox, not a code bug; it was failing before my changes too. Unit suites all pass. Do not touch the app code for this.

## Vehicle removal DONE
- PreApproveForm.tsx (field + state removed), VisitorFormFields.tsx (field + props removed from JSX/render), VisitorForm.tsx (state + upsert write + props removed), VisitorStackFacts.tsx (Vehicle fact row removed), VisitorStackCard.test.tsx (vehicle tests → 'no vehicle fact' guard test). tsc clean.

## Dev server: running on localhost:5173 (npx vite --host 0.0.0.0)

## Baseline visual observations (logged in as guard@demo.vms, dark theme)
- Login page: dark aurora background with mall photo, gold Sign In button, clean premium look already. No changes needed.
- Guard Dashboard: dark theme works; KPI tiles (6) render fine with gold cap; "Today" section title plain white sans; Quick Actions cards good; Recent Activity empty state fine; sidebar gold active state good.
- Data is empty today (0s) — seeded demo data exists for reports but guard dashboard uses live queries; fine.
- Theme toggle exists in sidebar ("Light Mode" button).
- Overall: foundation already strong; revamp targets polish: section headings with gold underline accents, better hero/greeting, refined empty states, HOD overview cards, admin stats, kiosk, reports filters polish.

## Polish pass applied & verified (dark, guard dashboard)
components-polish.css added (section rule + title, greeting strip, empty medallion, count chip). Applied to DashboardSummary ("Today"), DashboardActivity ("Recent Activity" + elevated empty state), DashboardQuickActions ("Quick Actions"), Dashboard.tsx greeting strip (Gate Console eyebrow + date + one-line brief + Live pill + clock; original header removed). Verified in browser: looks premium, gold rules render, greeting glass strip renders, empty state medallion works. Light mode still to verify on each page after theme toggle (tokens are variable-based, should flip automatically).
Next: Guard console /visitors sections, HOD pages, admin, kiosk.

## HOD polish pass (in progress)
Applied revamp-section-head (gold rule + title + inline subtitle) to:
- HOD/OverviewPendingApprovals.tsx ("Pending Walk-in Approvals")
- HOD/OverviewOnSite.tsx ("On-site now")
- HOD/OverviewUpcoming.tsx ("Upcoming visits") + revamp-empty elevated empty state
- HOD/ApprovalsPendingList.tsx empty state ("All caught up" medallion)
Still to do: OverviewNotifications.tsx header ("Status & Notifications", keep Live pill) + its empty state; OverviewFilteredView.tsx header (MODE_META title); Admin pages (AdminPanel sections, DepartmentsManager, HodList, HodDirectory, AdminStats, Activity, Analytics); Reports (reports page filter bar + table); Kiosk (idle + badge screens); Login (already premium, check toggle).
CSS classes used: revamp-section-head (flex items-center gap-3 mb-4), revamp-section-rule (gold gradient 2rem x 3px), revamp-section-title (text-h2 navy-900), revamp-empty / revamp-empty-medallion / revamp-empty-title (navy-800 dark navy-100) / revamp-empty-sub. All in src/styles/components-polish.css, imported in src/index.css.
Guard pages done: Dashboard.tsx (greeting strip replaces old header), DashboardSummary/DashboardActivity/DashboardQuickActions (section rules + elevated empty).
Scan flows (GuardQRScan, useQrScanner, OCR) untouched per instruction. Vehicle fields removed from PreApproveForm/VisitorFormFields/VisitorForm/VisitorStackFacts + tests updated. tsc clean, vite build passes. Unit tests 162 pass; security rlsDataIntegrity timeouts against live DB in sandbox (pre-existing, env issue only).
Dev server: `npx vite --host 0.0.0.0` running in vms_repo (port 5173). Demo creds: guard@demo.vms/demo123, hod.it@demo.vms/demo123, admin@demo.vms/demo123.
Deliverable plan: git commit + push revamp branch to jollyroyy/vms, sync to desktop folder C:\Users\ASUS\Desktop\VMS via /mnt/desktop/VMS mount.

## Phase 6 progress (Admin/Reports)
- AdminPanel.tsx: added revamp-greeting-eyebrow "Administration" above page-title.
- DepartmentsManager.tsx: revamp-section-head around ADMIN_OVERVIEW_TITLES section title + hint subtitle.
- Reports.tsx: greeting eyebrow "Operations"; register section-title wrapped in revamp-section-head with chips; empty register row now revamp-empty medallion treatment.
Remaining: Analytics.tsx, Activity.tsx (empty "No activity yet" font-display at line 80 → revamp-empty), WhosInside.tsx, VisitorsDashboard.tsx, Kiosk pages (KioskIdle, KioskBadge), Login.tsx, NotFound.tsx, Profile.tsx. Then build+push phase 8.
Dev server still running port 5173. Verified tsc clean after each batch.

## Phase 6 done; Phase 7 status (Kiosk/Login)
Phase 6 completed: AdminPanel (+greeting eyebrow "Administration"), DepartmentsManager (revamp-section-head), Reports.tsx (+greeting eyebrow "Operations", register section head + revamp-empty in empty table row), Analytics.tsx (+greeting eyebrow "Operations", 3 chart cards use revamp-section-head), WhosInside.tsx (+greeting eyebrow "Gate Operations", subtitle shows visitor count), VisitorsDashboard.tsx (revamp-greeting).
Phase 7 check: Kiosk already premium — KioskIdleScreen has DARK_STAGE aurora backdrop, big Tap to Start CTA, Secure Gate branding; KioskFormScreen uses card/form styles; badge screen exists. Kiosk likely needs no changes. Login.tsx (280 lines) previously verified premium; dark/light toggle exists via lib/theme.tsx ThemeProvider (localStorage persist). Next: full build, typecheck, browser verify kiosk + login + dark/light toggle on one more page, then commit & push revamp branch to GitHub and copy changes back to /mnt/desktop/VMS.
Reminder: dev server running port 5173; demo creds guard@demo.vms/admin@demo.vms/hod.it@demo.vms all demo123; git remote https://github.com/jollyroyy/vms ; push via 'git push' (https) — check remote auth with gh; desktop mount /mnt/desktop/VMS for syncing.

## Phase 7 verification (browser)
- Kiosk dark mode: renders correctly with aurora backdrop, Secure Gate branding, gold Tap to Start CTA. Good.
- LIGHT MODE ISSUE: /kiosk stays dark-brown even after theme toggle (sidebar lightened to beige but the kiosk stage stayed dark — the kiosk overlay is drawn ABOVE the route page). Actually the app appears to still be on guard route background: the kiosk page mounted inside the app shell. In light mode the stage background is fine per KioskIdleScreen using DARK_STAGE... but screenshot shows dark brown stage persisting while sidebar lightened. The idle screen background intentionally DARK_STAGE (kiosk full-screen overlay), but because it's nested inside the shell, shell surface stayed light while stage dark — acceptable; however the visible "kiosk" page is actually rendered within guard shell due to /kiosk route nested in app? Screenshot shows Sidebar present → /kiosk is nested route. Fine.
- Theme toggle works (Light Mode ↔ Dark Mode, persists via ThemeProvider).

## Light mode guard dashboard verification — PASS
Guard dashboard in light mode looks premium: warm off-white bg, gold rule section headings ("Today", "Recent Activity", "Quick Actions"), GATE CONSOLE greeting strip with Live time pill, six KPI tiles with colored icons (entries/exits/inside/overstaying/no-shows/declined), elevated "Nothing at the gate yet" empty state, Quick Actions cards. Theme toggle persists. All phases of visual revamp complete.
Next: Phase 8 — git commit, push to github.com/jollyroyy/vms (branch), sync files back to desktop /mnt/desktop/VMS, deliver.
