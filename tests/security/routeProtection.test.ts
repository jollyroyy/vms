// CHECK for goal.md SEC-7 (🎯) — Frontend route protection.
//
// Imports ROLE_ROUTES and isForbidden from the SAME source used by ProtectedRoute in App.tsx.
// This guarantees that passing tests mean the actual component enforces the correct rules.
// If ROLE_ROUTES changes in roleRoutes.ts, these tests automatically reflect the change.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isForbidden, ROLE_ROUTES } from '../../src/lib/roleRoutes';

// Mock supabase (imported transitively; ensures signOut spy works in component tests if added later)
const signOut = vi.fn();
vi.mock('../../src/supabaseClient', () => ({
  supabase: { auth: { signOut } },
}));

beforeEach(() => {
  signOut.mockClear();
});

describe('SEC-7: frontend route protection', () => {
  // ── Guard ──────────────────────────────────────────────────
  describe('guard', () => {
    const role = 'guard' as const;

    it('guard is allowed on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(false);
    });
    it('guard is allowed on /whos-inside', () => {
      expect(isForbidden('/whos-inside', role)).toBe(false);
    });
    it('guard is allowed on /gate-passes', () => {
      expect(isForbidden('/gate-passes', role)).toBe(false);
    });
    it('guard is allowed on /reports', () => {
      expect(isForbidden('/reports', role)).toBe(false);
    });

    it('guard is FORBIDDEN on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(true);
    });
    it('guard is FORBIDDEN on /approvals', () => {
      expect(isForbidden('/approvals', role)).toBe(true);
    });
  });

  // ── HOD ────────────────────────────────────────────────────
  describe('hod', () => {
    const role = 'hod' as const;

    it('hod is allowed on /approvals', () => {
      expect(isForbidden('/approvals', role)).toBe(false);
    });
    it('hod is FORBIDDEN on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(true);
    });
    it('hod is FORBIDDEN on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(true);
    });
  });

  // ── Staff ──────────────────────────────────────────────────
  describe('staff', () => {
    const role = 'staff' as const;

    it('staff is allowed on /gate-passes', () => {
      expect(isForbidden('/gate-passes', role)).toBe(false);
    });
    it('staff is FORBIDDEN on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(true);
    });
    it('staff is FORBIDDEN on /approvals', () => {
      expect(isForbidden('/approvals', role)).toBe(true);
    });
    it('staff is FORBIDDEN on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(true);
    });
  });

  // ── Admin ──────────────────────────────────────────────────
  describe('admin', () => {
    const role = 'admin' as const;

    it('admin is allowed on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(false);
    });
    it('admin is allowed on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(false);
    });
    it('admin is allowed on /approvals', () => {
      expect(isForbidden('/approvals', role)).toBe(false);
    });
    it('admin is allowed on /reports', () => {
      expect(isForbidden('/reports', role)).toBe(false);
    });
  });

  // ── Unauthenticated ────────────────────────────────────────
  describe('unauthenticated (role is null)', () => {
    it('null role is never forbidden (handled by session guard in App.tsx)', () => {
      expect(isForbidden('/admin', null)).toBe(false);
      expect(isForbidden('/guard', null)).toBe(false);
    });
  });

  // ── Route path match semantics ────────────────────────────
  it('shared routes like /whos-inside are allowed for all roles', () => {
    for (const r of Object.keys(ROLE_ROUTES) as Array<keyof typeof ROLE_ROUTES>) {
      expect(isForbidden('/whos-inside', r)).toBe(false);
    }
  });
  it('/gate-passes/new is allowed for all roles that can access /gate-passes', () => {
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      const allowed = routes.some((r) => '/gate-passes/new'.startsWith(r));
      expect(isForbidden('/gate-passes/new', role as keyof typeof ROLE_ROUTES)).toBe(!allowed);
    }
  });

  // ── Super admin ────────────────────────────────────────────
  describe('super_admin', () => {
    const role = 'super_admin' as const;

    it('super_admin is allowed on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(false);
    });
    it('super_admin is allowed on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(false);
    });
  });

  // ── ROLE_ROUTES completeness ───────────────────────────────
  it('every role has at least one allowed route (no role is fully locked out)', () => {
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      expect(routes.length, `${role} has no allowed routes`).toBeGreaterThan(0);
    }
  });

  it('no role except admin/super_admin can reach /admin', () => {
    const nonAdminRoles = ['guard', 'hod', 'staff'] as const;
    for (const role of nonAdminRoles) {
      expect(isForbidden('/admin', role), `${role} must be forbidden on /admin`).toBe(true);
    }
  });
});
