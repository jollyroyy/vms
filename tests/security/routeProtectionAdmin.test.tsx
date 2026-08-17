// CHECK for goal.md SEC-7 — frontend route protection, admin console.
//
// Split out of routeProtection.test.tsx on 2026-08-17, when the admin surface
// went from three routes to nine and that file hit the 300-line cap.
//
// WHAT THIS FILE IS REALLY GUARDING has changed shape. The old rule was
// blunt — admin could not reach visitor records at all — and a route test was
// the whole enforcement. On client instruction the tabs now exist, so the
// guarantee moved: admin READS visitor records and never writes them. That
// half cannot be asserted here, because `isForbidden` knows nothing about
// buttons; it is asserted on each page's own test, which fails if a check-in,
// check-out, approve or reject control appears. What survives here is the
// other half, and it is still load-bearing: the admin must NOT reach the
// surfaces that DO write — /visitors (the guard console), /whos-inside and
// /kiosk — because reading a visit through a read-only tab and reaching the
// desk that mutates it are different permissions.

import { describe, it, expect } from 'vitest';
import { isForbidden, ROLE_ROUTES } from '../../src/lib/roleRoutes';

const role = 'admin' as const;

const CONSOLE_TABS = [
  '/admin/dashboard',
  '/admin/live-check-in',
  '/admin/pre-registration',
  '/admin/visitors-log',
  '/admin/hosts',
  '/admin/badges',
  '/admin/security',
  '/admin/settings',
];

describe('SEC-7: admin route protection', () => {
  it('admin is allowed on every console tab', () => {
    for (const path of CONSOLE_TABS) {
      expect(isForbidden(path, role), `${path} must be allowed for admin`).toBe(false);
    }
  });

  it('admin is allowed on /admin, /admin/activity and /reports', () => {
    expect(isForbidden('/admin', role)).toBe(false);
    expect(isForbidden('/admin/activity', role)).toBe(false);
    expect(isForbidden('/reports', role)).toBe(false);
  });

  // /analytics is DELETED, not merely unlinked (2026-08-17). Its charts moved
  // onto the Dashboard and Reports, derived from the rows those screens already
  // load. Removing it from ROLE_ROUTES is what makes typing the URL fail rather
  // than land on a page that no longer exists.
  it('admin is FORBIDDEN on /analytics — the page was deleted', () => {
    expect(isForbidden('/analytics', role)).toBe(true);
    expect(ROLE_ROUTES.admin).not.toContain('/analytics');
  });

  it('no role can reach /analytics any more', () => {
    for (const r of ['guard', 'hod', 'staff', 'admin'] as const) {
      expect(isForbidden('/analytics', r), `${r} must be forbidden on /analytics`).toBe(true);
    }
  });

  // THE READ-ONLY GUARANTEE, in its routable half. These three are where a
  // visit is actually mutated — the guard console checks people in and out,
  // /whos-inside owns the exit, the kiosk writes a self-service check-in. The
  // admin's own tabs read the same rows and offer no such control, so letting
  // the role reach these would hand back exactly what the read-only decision
  // withheld.
  it('admin is FORBIDDEN on the surfaces that WRITE to a visit', () => {
    for (const path of ['/visitors', '/whos-inside', '/kiosk', '/guard', '/guard/dashboard']) {
      expect(isForbidden(path, role), `${path} must stay forbidden for admin`).toBe(true);
    }
  });

  it('admin is FORBIDDEN on the HOD decision desks', () => {
    expect(isForbidden('/approvals', role)).toBe(true);
    expect(isForbidden('/overview', role)).toBe(true);
  });

  // The first entry of each ROLE_ROUTES list is that role's landing page
  // (App.tsx routes "/" to `allowed[0]`). Reordering changes where an admin
  // lands on login, which is a behaviour change and not a tidy-up.
  it('the admin landing page is the dashboard', () => {
    expect(ROLE_ROUTES.admin[0]).toBe('/admin/dashboard');
  });

  it('no other role can reach the admin console', () => {
    for (const r of ['guard', 'hod', 'staff'] as const) {
      for (const path of CONSOLE_TABS) {
        expect(isForbidden(path, r), `${r} must be forbidden on ${path}`).toBe(true);
      }
    }
  });
});
