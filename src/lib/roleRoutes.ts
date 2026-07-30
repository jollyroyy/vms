// SEC-7: Single source of truth for role-based route access.
// Imported by App.tsx (enforcement) and tests/security/routeProtection.test.ts (verification).
// NEVER duplicate this in application code — always import from here.
import type { UserRole } from '../types/index';

// NOTE: order matters — App.tsx routes "/" to `allowed[0]`, so the FIRST entry
// of each list is that role's landing page. Reordering changes where a role
// lands on login; it does not change what the role may access.
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  guard:       ['/guard/dashboard', '/visitors', '/guard', '/guard/daily-staff', '/kiosk', '/whos-inside'],
  hod:         ['/overview', '/approvals', '/reports', '/analytics'],
  staff:       ['/visitors', '/whos-inside', '/reports'],
  admin:       ['/analytics', '/reports', '/admin'], // admin is restricted to analytics, reports and settings — no visitor data
};

/** Returns true if the given pathname is forbidden for this role. */
export function isForbidden(pathname: string, role: UserRole | null): boolean {
  if (role === null) return false;
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return true;
  return !allowed.some((r) => pathname.startsWith(r));
}
