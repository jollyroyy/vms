import React from 'react';
import type { UserRole } from '../../types/index';

// Single source of truth for sidebar navigation. Extracted out of Sidebar.tsx
// so that file stays under the 300-line cap.
//
// Client instruction 2026-08-14: the guard console follows four reference
// screens, so the sidebar carries their tabs — Dashboard, Entry & Exit,
// Pre-Registered, Watchlist — before Scan Pass and Visitors. Daily Staff, the
// Self-Service Kiosk and Search are intentionally NOT here: all three are
// still routable (see ROLE_ROUTES in lib/roleRoutes.ts) — the kiosk runs on its
// own device, Daily Staff isn't visitor check-in, and Search duplicated
// lookups the Visitors page already covers — but none of that revokes access.
//
// Visitors is a single link, not a group (since 2026-08-13): the segments that
// used to expand under it — Expected, Inside, Pending, … — now live as KPI
// tiles on the page itself (src/pages/Guard/VisitorKpiRail.tsx), counted from
// the page's own data. The sidebar naming them was the old answer to "where
// can I go"; the page carrying the counts and the filters is the same answer
// one click closer.

export type NavLink = {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
};

const icon = (d: string): React.ReactNode => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICON_GRID = 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z';
const ICON_USERS = 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z';
const ICON_CHECK = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_SPARKLE = 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z';
const ICON_REPORT = 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z';
const ICON_SCAN = 'M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z';
// Shield for the Watchlist tab.
const ICON_SHIELD = 'M9 12.75l3 3 6-6.75M12 2.25c-4.97 0-9 3.582-9 8.25 0 3.168 1.967 5.943 4.875 7.5.695.371 1.125 1.096 1.125 1.875V21.75h6v-1.875c0-.779.43-1.504 1.125-1.875 2.908-1.557 4.875-4.332 4.875-7.5 0-4.668-4.03-8.25-9-8.25z';
const ICON_COG = 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z';

export const ALL_LINKS: NavLink[] = [
  // ── Guard: the visitor console ───────────────────────────────────────────
  { to: '/guard/dashboard', label: 'Dashboard', roles: ['guard'], icon: icon(ICON_GRID) },
  // "Entry & Exit" — "Live Queue" until 2026-08-14, "Inside Now" until
  // 2026-08-15, both renamed on client instruction. The tab lists everyone who
  // has been through the gate: still inside, plus today's departures. "Live
  // Queue" named the dashboard's Expected Today panel instead (visitors still
  // waiting, who are not on this page at all), and "Inside Now" stopped being
  // true the moment the list carried people who had left. The route keeps its
  // old path — it is in guards' bookmarks and in every ?verify= link the
  // dashboard emits — so only the label moves.
  { to: '/guard/inside-now', label: 'Entry & Exit', roles: ['guard'], icon: icon(ICON_USERS) },
  // Today's pre-approvals who have NOT arrived yet, with filter chips and the
  // schedule rail (reference screen 3). Once a visitor checks in they leave
  // this board for Entry & Exit — one visitor is never on two tabs at once.
  { to: '/guard/preregistered', label: 'Pre-Registered', roles: ['guard'], icon: icon(ICON_CHECK) },
  // Watchlist & Alerts (reference screen 4). Severity cards plus the live
  // CCTV panel; blacklist enforcement at the gate is untouched.
  { to: '/guard/watchlist', label: 'Watchlist', roles: ['guard'], icon: icon(ICON_SHIELD) },
  // The camera lane: a pass held up to the scanner resolves straight to the
  // visitor and the check-in happens on this page.
  { to: '/guard/scan-pass', label: 'Scan Pass', roles: ['guard'], icon: icon(ICON_SCAN) },
  // A single link, not a group: the eight segments live on the page as KPI
  // tiles (VisitorKpiRail). This route is also the walk-in lane — the tile
  // rail holds the register behind the same URL.
  { to: '/visitors', label: 'Visitors', roles: ['guard'], icon: icon(ICON_USERS) },
  // Staff see a different component at this route (VisitorsDashboard, not the
  // guard console), so they get the unqualified label and no sub-nav.
  { to: '/visitors', label: 'Visitors', roles: ['staff'], icon: icon(ICON_USERS) },
  // Search left the nav but stays routable at /guard/search (see
  // ROLE_ROUTES.guard in roleRoutes.ts) — same reasoning as Daily Staff/Kiosk.

  // ── Other roles ───────────────────────────────────────────────────────────
  { to: '/overview', label: 'Overview', roles: ['hod'], icon: icon(ICON_GRID) },
  // "Pre-Approvals", not "Approvals": the pending walk-in decisions moved to the
  // Overview, so this route is now only the form for booking a visitor ahead.
  { to: '/approvals', label: 'Pre-Approvals', roles: ['hod'], icon: icon(ICON_CHECK) },
  { to: '/whos-inside', label: 'On-site', roles: ['staff'], icon: icon(ICON_USERS) },
  { to: '/analytics', label: 'Analytics', roles: ['hod', 'admin'], icon: icon(ICON_SPARKLE) },
  { to: '/reports', label: 'Reports', roles: ['hod', 'staff', 'admin'], icon: icon(ICON_REPORT) },
  { to: '/admin', label: 'Settings', roles: ['admin'], icon: icon(ICON_COG) },
];

/** Nav links visible to a role, in declaration order. */
export function linksForRole(role: UserRole | null): NavLink[] {
  if (!role) return [];
  return ALL_LINKS.filter((l) => l.roles.includes(role));
}
