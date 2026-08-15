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
  // routable surface is deliberately wider. `/kiosk` runs on its own device —
  // it was dropped from the nav because it is not visitor check-in, not because
  // access was revoked. Removing it here would be a regression, not a cleanup.
  // (Daily Staff was deleted outright 2026-08-15: its query selected columns
  // that do not exist on `visits`, so the page could never show a row, and a
  // routable page that always renders nothing is a live destination that lies.)
  // The reference-screen guard surface — Dashboard, Entry & Exit,
  // Pre-Registered, Scan Pass — all of which link to each other from the
  // dashboard ("Verify ID" opens the scan flow in place), so those paths must
  // be allowed here or the sidebar tabs 404. The "View Full Queue" dashboard
  // link was removed 2026-08-14 (client instruction); the Inside Now route
  // stays for the nav item and for `?verify=` links in guards' bookmarks.
  // The Watchlist tab was deleted outright 2026-08-15 (client instruction):
  // the blacklist gate lives inside check-in, where it actually fires.
  guard:       ['/guard/dashboard', '/guard/inside-now', '/guard/live-queue', '/guard/preregistered',
                '/guard/scan-pass', '/guard/walk-in', '/visitors', '/guard', '/guard/pre-approvals',
                '/guard/search', '/kiosk', '/whos-inside', '/profile', '/search'],
  // No `/analytics` (client instruction, 2026-08-15). An HOD's surface is a
  // decision desk for one department; the org-wide charts are the admin's, and
  // dropping it here — not just from the sidebar — is what makes typing the URL
  // fail rather than merely being unlinked.
  hod:         ['/overview', '/approvals', '/reports', '/profile', '/search'],
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
