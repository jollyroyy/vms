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
  // SENIOR MANAGER IS AN HOD WITH A DIFFERENT TITLE (client instruction,
  // 2026-08-18) — the same list, deliberately written out rather than aliased
  // to `ROLE_ROUTES.hod`. A shared array reference would make the two roles
  // impossible to separate later without first discovering they were joined,
  // and this file is the one place a reader looks to ask "what can this role
  // reach?". The answer must be readable here, not one hop away.
  //
  // The DATABASE agrees by a different mechanism: migration 099's
  // `current_user_role()` maps `senior_manager` onto `hod`, so all twelve
  // department-scoped policies and every SECURITY DEFINER RPC admit them
  // without being rewritten. Audit rows still record `auth.uid()`, so a senior
  // manager's approval is never mistaken for somebody else's.
  senior_manager: ['/overview', '/approvals', '/reports', '/profile', '/search'],
  staff:       ['/visitors', '/whos-inside', '/reports', '/profile', '/search'],
  // ADMIN SEES VISITOR RECORDS, READ-ONLY (client instruction, 2026-08-17).
  // This reverses the standing rule that admin had no route to visitor data at
  // all. The reasoning that rule carried — that an admin who can act on a visit
  // is acting on somebody they cannot see — is preserved by the READ-ONLY half,
  // not by the absence of the route: the admin's Live Check-In, Visitors Log,
  // Pre-Registration and Security tabs display and export, and none of them
  // renders a control that writes to `visits`. Check-in, check-out, approval
  // and badge minting stay at the gate and on the HOD's desk.
  //
  // `/analytics` is GONE — deleted, not merely unlinked (client instruction,
  // same date). Its charts moved onto the admin Dashboard and Reports, which
  // is where the reference screens put them; leaving the old page routable
  // would mean two screens answering "what happened this week" with separately
  // written queries, the same defect the guard dashboard's tile-vs-drilldown
  // mismatch was.
  //
  // Every `/admin/*` tab is covered by the `/admin` prefix (isForbidden matches
  // on startsWith), so the entries below are listed for the reader, not for the
  // matcher. `/admin/dashboard` is FIRST because the first entry of each list
  // is that role's landing page.
  admin:       ['/admin/dashboard', '/admin/live-check-in', '/admin/pre-registration',
                // No `/admin/badges`: the Badge Printing tab was deleted on
                // 2026-08-17 (client instruction) — it read a log nothing
                // writes. The `/admin` prefix below still matches the path, so
                // it resolves to App.tsx's NotFound rather than being refused;
                // that is the honest outcome for a page that no longer exists,
                // and `/admin` cannot be dropped because it is the bookmark
                // every admin holds for the old Admin Panel.
                '/admin/visitors-log', '/admin/hosts', '/admin/security',
                '/admin/settings', '/admin', '/reports', '/profile', '/search'],
  // THE CEO HAS ONE DESTINATION AND `/profile` (client instruction,
  // 2026-08-17). This role exists for a single decision — a visitor comes off
  // the blacklist only when an admin has justified it and the CEO has granted
  // it — and it inherits nothing from `admin`. No visitor log, no settings, no
  // reports: they are not a super-admin with a nicer title, and a role handed
  // screens it has no reason to read is a role whose real scope nobody can
  // state. `/search` is omitted for the same reason — it is a visitor-record
  // lookup, and the CEO's business is with the one visitor already named on
  // the request in front of them.
  ceo:         ['/ceo/blacklist-removals', '/profile'],
};

/** Returns true if the given pathname is forbidden for this role. */
export function isForbidden(pathname: string, role: UserRole | null): boolean {
  if (role === null) return false;
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return true;
  return !allowed.some((r) => pathname.startsWith(r));
}
