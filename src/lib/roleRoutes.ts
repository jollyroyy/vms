// SEC-7: Single source of truth for role-based route access.
// Imported by App.tsx (enforcement) and tests/security/routeProtection.test.ts (verification).
// NEVER duplicate this in application code — always import from here.
import type { UserRole } from '../types/index';

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  guard:       ['/visitors', '/guard', '/kiosk', '/whos-inside', '/gate-passes', '/guard/gate-passes'],
  hod:         ['/visitors', '/approvals', '/whos-inside', '/gate-passes', '/reports', '/analytics'],
  staff:       ['/visitors', '/whos-inside', '/gate-passes', '/reports'],
  admin:       ['/visitors', '/reports', '/analytics', '/admin'],
  super_admin: ['/visitors', '/reports', '/analytics', '/admin'],
};

/** Returns true if the given pathname is forbidden for this role. */
export function isForbidden(pathname: string, role: UserRole | null): boolean {
  if (role === null) return false;
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return true;
  return !allowed.some((r) => pathname.startsWith(r));
}
