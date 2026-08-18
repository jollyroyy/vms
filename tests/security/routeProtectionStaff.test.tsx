// SEC-7 — route protection for `staff`, and the one rule this file exists to
// pin: EVERY ACCOUNT THAT IS NOT A GUARD AND NOT AN ADMIN REACHES EXACTLY WHAT
// AN HOD REACHES (client instruction, 2026-08-18). Split into its own file at
// the 300-line cap, the same way admin, ceo and senior_manager were.
//
// The assertions are EQUIVALENCES rather than lists of paths, for the same
// reason routeProtectionSeniorManager.test.tsx is written that way: a
// hand-copied list passes on the day it is written and then diverges silently
// the first time any of the three roles gains or loses a route. Comparing them
// against `hod` means the drift itself is the failure.
//
// The database says the same thing by a different mechanism — migration 100's
// `effective_role()` folds `senior_manager` and `staff` onto `hod`, so every
// policy and every SECURITY DEFINER RPC admits them — and `src/lib/hodRoles.ts`
// is the client-side copy of that list. Neither half can move alone.
import { describe, it, expect } from 'vitest';
import { isForbidden, ROLE_ROUTES } from '../../src/lib/roleRoutes';
import { HOD_ROLES, isHodRole } from '../../src/lib/hodRoles';

describe('SEC-7: staff route access', () => {
  const paths = [
    '/overview', '/approvals', '/reports', '/profile', '/search',
    '/guard', '/guard/dashboard', '/guard/scan-pass', '/kiosk',
    '/visitors', '/visitors/inside', '/whos-inside',
    '/admin', '/admin/settings', '/analytics', '/ceo/blacklist-removals',
  ];

  it('is forbidden on exactly the routes an HOD is forbidden on', () => {
    for (const path of paths) {
      expect([path, isForbidden(path, 'staff')])
        .toEqual([path, isForbidden(path, 'hod')]);
    }
  });

  // The instruction's own words: a staff account must be able to raise a
  // pre-approval. This is the one route whose answer changed.
  it('may reach the pre-approval form', () => {
    expect(isForbidden('/approvals', 'staff')).toBe(false);
  });

  it('lands on the HOD dashboard and keeps /profile before /search', () => {
    expect(ROLE_ROUTES.staff[0]).toBe('/overview');
    expect(ROLE_ROUTES.staff).toContain('/profile');
    expect(ROLE_ROUTES.staff.at(-1)).toBe('/search');
  });

  // Not a casualty of the change — the instruction. Both were display-only
  // views of rows /overview now shows with the decisions attached.
  it('no longer reaches the staff-only browsing surfaces', () => {
    expect(isForbidden('/visitors', 'staff')).toBe(true);
    expect(isForbidden('/whos-inside', 'staff')).toBe(true);
  });

  it('cannot reach the guard console, the admin console or the CEO queue', () => {
    expect(isForbidden('/guard/dashboard', 'staff')).toBe(true);
    expect(isForbidden('/admin', 'staff')).toBe(true);
    expect(isForbidden('/ceo/blacklist-removals', 'staff')).toBe(true);
  });
});

describe('the approver set is one list', () => {
  // `HOD_ROLES` is what navLinks, the notification bell, the ID-proof gate and
  // the MFA requirement all read. Every member of it must reach the HOD's
  // routes, or one of those surfaces is offering a screen the router refuses.
  it('every approver role resolves every path identically to hod', () => {
    for (const role of HOD_ROLES) {
      expect([role, ROLE_ROUTES[role]]).toEqual([role, ROLE_ROUTES.hod]);
    }
  });

  it('names guard, admin and ceo as NOT approvers', () => {
    expect(isHodRole('guard')).toBe(false);
    expect(isHodRole('admin')).toBe(false);
    // The CEO is the second pair of eyes on an admin's blacklist-removal
    // request. Handing it the desk it audits would collapse the two people
    // migration 091 exists to require into one, and it is refused by
    // admin_create_user, so no created account can be one.
    expect(isHodRole('ceo')).toBe(false);
    expect(isHodRole(null)).toBe(false);
  });
});
