// SEC-7: Single source of truth for role-based route access.
// Imported by App.tsx (enforcement) and tests/security/routeProtection.test.ts (verification).
// NEVER duplicate this in application code — always import from here.
import type { UserRole } from '../types/index';

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  guard:       ['/guard', '/whos-inside', '/gate-passes', '/reports'],
  hod:         ['/approvals', '/whos-inside', '/gate-passes', '/reports'],
  staff:       ['/whos-inside', '/gate-passes', '/reports'],
  admin:       ['/guard', '/approvals', '/whos-inside', '/gate-passes', '/reports', '/admin'],
  super_admin: ['/guard', '/approvals', '/whos-inside', '/gate-passes', '/reports', '/admin'],
};

/** Returns true if the given pathname is forbidden for this role. */
export function isForbidden(pathname: string, role: UserRole | null): boolean {
  if (role === null) return false;
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return true;
  return !allowed.some((r) => pathname.startsWith(r));
}
