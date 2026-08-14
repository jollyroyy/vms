// SEC-7: Single source of truth for role-based route access.
// Imported by App.tsx (enforcement) and tests/security/routeProtection.test.ts (verification).
// NEVER duplicate this in application code — always import from here.
import type { UserRole } from '../types/index';

// NOTE: order matters — App.tsx routes "/" to `allowed[0]`, so the FIRST entry
// of each list is that role's landing page. Reordering changes where a role
// lands on login; it does not change what the role may access.
//
// `/profile` is every role's own account page and is therefore listed LAST in
// all four entries — it must never become anyone's landing page. `/search`
// (the global top-bar search, see AppShell.tsx) follows the same precedent
// and is listed LAST as well, after `/profile`.
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  // The guard SIDEBAR is three items (see components/layout/navLinks.tsx), but the
  // routable surface is deliberately wider. `/kiosk` runs on its own device and
  // `/guard/daily-staff` is still reachable by direct link — they were dropped
  // from the nav because neither is visitor check-in, not because access was
  // revoked. Removing them here would be a regression, not a cleanup.
  // The four-tab guard surface from the approved reference design — Dashboard,
  // Live Queue, Pre-Registered, Watchlist — all of which link to each other
  // from the dashboard ("View Full Queue", "Verify ID", the watchlist banner),
  // so all three new paths must be allowed here or the sidebar tabs 404.
  guard:       ['/guard/dashboard', '/guard/live-queue', '/guard/preregistered', '/guard/watchlist',
                '/guard/scan-pass', '/visitors', '/guard', '/guard/pre-approvals',
                '/guard/search', '/guard/daily-staff', '/kiosk', '/whos-inside', '/profile', '/search'],
  hod:         ['/overview', '/approvals', '/reports', '/analytics', '/profile', '/search'],
  staff:       ['/visitors', '/whos-inside', '/reports', '/profile', '/search'],
  admin:       ['/analytics', '/reports', '/admin', '/profile', '/search'], // admin is restricted to analytics, reports and settings — no visitor data
};

/** Returns true if the given pathname is forbidden for this role. */
export function isForbidden(pathname: string, role: UserRole | null): boolean {
  if (role === null) return false;
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return true;
  return !allowed.some((r) => pathname.startsWith(r));
}
