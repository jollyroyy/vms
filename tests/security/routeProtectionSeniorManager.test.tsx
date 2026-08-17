// SEC-7 — route protection for `senior_manager`, split into its own file at the
// 300-line cap, the same way admin and ceo were (see routeProtection.test.tsx's
// header). Imports `isForbidden` / `ROLE_ROUTES` from the one source App.tsx's
// ProtectedRoute enforces with, so a pass here means the real component agrees.
import { describe, it, expect } from 'vitest';
import { isForbidden, ROLE_ROUTES } from '../../src/lib/roleRoutes';

describe('SEC-7: senior_manager route access', () => {
  // An HOD's permissions under a different job title (client instruction,
  // 2026-08-18), so the assertion is not a list of paths but an EQUIVALENCE:
  // every route resolves the same for both roles. Written this way on purpose —
  // a hand-copied list of five paths would pass on the day it was written and
  // then quietly diverge the first time either role gained or lost one, which
  // is the only way this role can break. The database says the same thing by a
  // different mechanism (migration 099 maps `senior_manager` onto `hod` inside
  // `current_user_role()`), so neither half can drift alone.
  const paths = [
    '/overview', '/approvals', '/reports', '/profile', '/search',
    '/guard', '/guard/dashboard', '/kiosk', '/visitors', '/whos-inside',
    '/admin', '/admin/settings', '/analytics', '/ceo/blacklist-removals',
  ];

  it('is forbidden on exactly the routes an HOD is forbidden on', () => {
    for (const path of paths) {
      expect([path, isForbidden(path, 'senior_manager')])
        .toEqual([path, isForbidden(path, 'hod')]);
    }
  });

  it('lands on the HOD dashboard and keeps /profile last', () => {
    expect(ROLE_ROUTES.senior_manager[0]).toBe('/overview');
    expect(ROLE_ROUTES.senior_manager).toContain('/profile');
    expect(ROLE_ROUTES.senior_manager.at(-1)).toBe('/search');
  });

  it('cannot reach the admin console or the CEO queue', () => {
    expect(isForbidden('/admin', 'senior_manager')).toBe(true);
    expect(isForbidden('/ceo/blacklist-removals', 'senior_manager')).toBe(true);
  });
});
