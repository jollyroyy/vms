# VMS Frontend Revamp — Design Blueprint (v1)

Role lens: senior product manager + product designer who has shipped VMS to enterprise clients.
Goal: match the premium gold/navy "Galleria" snapshot aesthetic (as approved by user), both themes,
all role views, scanning/check-in flows fully functional, backend (Supabase) untouched.

## 1. Design tokens (single source of truth)
- Brand gold: primary 500 = #B8934A (keep existing tailwind `brand` scale)
- Bronze accent: `accent` scale (existing)
- Navy neutrals: `navy` scale — dark theme bg navy-950 (#0F172A-like), cards navy-900
- Surface: warm off-white #FAF9F7 light bg, navy-800 dark surfaces
- Success/warning/danger: existing semantic scales, variable-driven flip
- Fonts: display = "Playfair Display" (keep, matches premium serif headings in snapshots),
  sans = "Inter" (keep)
- Type scale: micro/caption/body/body-lg/h3/h2/h1/kpi (keep existing Minor Third scale)
- Shadows: card-premium, glow, modal (keep)
- Radius: cards 12px, pills 999px, inputs 8px

## 2. Theme system
- Keep `darkMode: 'class'`; new ThemeContext (src/lib/theme) with system/dark/light
- Toggle in AppShell topbar (sun/moon), preference persisted to localStorage
- Default: dark (per user), toggle to light
- index.css tokens: extend --c-navy/surface vars for both :root and .dark

## 3. App shell (src/components/layout)
- Sidebar: slim, icons + labels, active item = gold left bar + tinted bg
- Topbar: product name + shield icon (left), global search, date, notification bell, avatar dropdown (right)
- Guard view topbar additionally: large clock + guard profile
- Breadcrumbs on detail pages

## 4. Page-by-page blueprint (mapped to existing routes)

### Guard (role=guard)
- /visitors + /guard → GuardConsole (src/pages/Guard/Console.tsx):
  KPI row (expected/checked-in/on-site/pending check-out), Live Arrival Queue table with
  status pills, ID Verification panel with visitor photo + Verify ID / Deny Entry buttons,
  watchlist alert banner (danger).
- /guard/dashboard → GuardDashboard: drilldown tiles redesign (keep data hooks)
- /guard/scan-pass → QR scan (keep qr-scanner + onnx flows, restyle overlay)
- /guard/daily-staff → restyled table
- /guard/pre-approvals → walk-in approved queue
- Check-in flow steps: search → photo → ID scan → summary → badge print (keep libs)

### HOD
- /approvals → HODApprovals: inbox list of request cards (Approve/Decline + View Details),
  counters, filter chips (All/Pending/Approved/Rejected/VIP), right rail policy + weekly chart
- /overview → HODOverview: stat cards (pending/on-site/upcoming + notifications)

### Admin
- /admin → AdminPanel: KPIs, department & HOD management (keep AdminStats, DepartmentsManager, HodDirectory — restyle)
- /admin/activity → ActivityPage: audit trail table
- /analytics → AnalyticsPage: KPI cards + charts (keep chart logic, restyle containers)

### Shared
- /reports → ReportsPage: toolbar + printable table (restyle)
- /whos-inside → WhosInside: visitor cards grid
- /profile → ProfilePage: restyle

### Kiosk
- /kiosk → KioskPage: idle aurora screen, multi-step form, badge screen with QR
  (keep KioskAuroraBackdrop — enhance; big touch targets)

### Auth
- Login page: split layout, brand side with aurora, form side glass card

## 5. Hard rules
- NEVER change Supabase client calls, RLS, SQL, routes/roles logic, or scan engines
- Keep all feature-flag hooks intact (VITE_FEATURE_OCR etc.)
- Keep i18n keys working
- All existing data bindings remain; only visual layer changes
- Reusable primitives: KpiTile, StatusPill, DataTable, FilterChips, VisitorAvatar,
  EmptyState, PageHeader, ActionButton variants

## 6. Verification checklist
- [ ] tsc + vite build pass
- [ ] unit/security tests pass
- [ ] Dark + light toggle works on every page
- [ ] Guard console renders with live data
- [ ] QR scan flow untouched functionally
- [ ] HOD approve/reject RPC still wired
- [ ] Kiosk form + badge QR still generate
- [ ] Print reports CSS works in both themes
