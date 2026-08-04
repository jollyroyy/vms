// CHECK for goal.md SEC-7 — Frontend route protection.
//
// Imports ROLE_ROUTES and isForbidden from the SAME source used by ProtectedRoute in App.tsx.
// This guarantees that passing tests mean the actual component enforces the correct rules.
// If ROLE_ROUTES changes in roleRoutes.ts, these tests automatically reflect the change.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { isForbidden, ROLE_ROUTES } from '../../src/lib/roleRoutes';
import App from '../../src/App';

// Mock supabase (imported transitively; ensures signOut spy works in component tests if added later)
const { signOut, getSession, onAuthStateChange } = vi.hoisted(() => ({
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
vi.mock('../../src/supabaseClient', () => ({
  supabase: { auth: { signOut, getSession, onAuthStateChange } },
}));

vi.mock('../../src/lib/theme', () => ({
  ThemeProvider: (props: { children: any }) => props.children,
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

beforeEach(() => {
  signOut.mockClear();
  getSession.mockClear();
  onAuthStateChange.mockClear();
});

afterEach(cleanup);

describe('SEC-7: frontend route protection', () => {
  // ── Guard ──────────────────────────────────────────────────
  describe('guard', () => {
    const role = 'guard' as const;

    it('guard is allowed on /visitors', () => {
      expect(isForbidden('/visitors', role)).toBe(false);
    });
    it('guard is allowed on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(false);
    });
    it('guard is allowed on /whos-inside', () => {
      expect(isForbidden('/whos-inside', role)).toBe(false);
    });
    it('guard is allowed on /kiosk', () => {
      expect(isForbidden('/kiosk', role)).toBe(false);
    });
    it('guard is allowed on /guard/daily-staff', () => {
      expect(isForbidden('/guard/daily-staff', role)).toBe(false);
    });
    it('guard is FORBIDDEN on /reports', () => {
      expect(isForbidden('/reports', role)).toBe(true);
    });

    // Sidebar restructure (visitor-only deployment): three new guard-only
    // routes replaced/expanded the guard console. These must be reachable...
    it('guard is allowed on /guard/pre-approvals', () => {
      expect(isForbidden('/guard/pre-approvals', role)).toBe(false);
    });
    it('guard is allowed on /guard/search', () => {
      expect(isForbidden('/guard/search', role)).toBe(false);
    });
    it('guard is allowed on /guard/watchlist', () => {
      expect(isForbidden('/guard/watchlist', role)).toBe(false);
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
    it('hod is FORBIDDEN on /kiosk', () => {
      expect(isForbidden('/kiosk', role)).toBe(true);
    });
    it('hod is FORBIDDEN on /admin', () => {
      expect(isForbidden('/admin', role)).toBe(true);
    });
    it('hod is ALLOWED on /overview (dashboard tab)', () => {
      expect(isForbidden('/overview', role)).toBe(false);
    });
    it('hod is FORBIDDEN on /visitors (removed — use Overview)', () => {
      expect(isForbidden('/visitors', role)).toBe(true);
    });
    it('hod is FORBIDDEN on /whos-inside (redundant — on-site info now lives on Overview)', () => {
      expect(isForbidden('/whos-inside', role)).toBe(true);
    });
  });

  // ── Staff ──────────────────────────────────────────────────
  describe('staff', () => {
    const role = 'staff' as const;

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
    it('admin is FORBIDDEN on /guard', () => {
      expect(isForbidden('/guard', role)).toBe(true);
    });
    it('admin is FORBIDDEN on /approvals', () => {
      expect(isForbidden('/approvals', role)).toBe(true);
    });
    it('admin is allowed on /reports', () => {
      expect(isForbidden('/reports', role)).toBe(false);
    });
    it('admin is allowed on /analytics', () => {
      expect(isForbidden('/analytics', role)).toBe(false);
    });
    it('admin is FORBIDDEN on /visitors (visitor data access removed — settings/reports/analytics only)', () => {
      expect(isForbidden('/visitors', role)).toBe(true);
    });
    it('admin is FORBIDDEN on /whos-inside (visitor data access removed — settings/reports/analytics only)', () => {
      expect(isForbidden('/whos-inside', role)).toBe(true);
    });
    it('admin is FORBIDDEN on /kiosk (visitor data access removed — settings/reports/analytics only)', () => {
      expect(isForbidden('/kiosk', role)).toBe(true);
    });
  });

  // ── Deleted gate-pass feature ──────────────────────────────
  // The standalone gate-pass module (Guard/GatePassQueue, Shared/GatePassList,
  // Shared/GatePassForm and their routes) was removed from App.tsx. ROLE_ROUTES
  // never lists these top-level paths for any role, so isForbidden() denies
  // them by construction — this locks that in as an explicit regression guard
  // rather than relying on an absence of routes to stay accidental.
  describe('deleted gate-pass routes (removed feature)', () => {
    const allRoles = ['guard', 'hod', 'staff', 'admin'] as const;
    const deletedRoutes = ['/gate-passes', '/gate-passes/new'];

    for (const route of deletedRoutes) {
      for (const role of allRoles) {
        it(`${role} is FORBIDDEN on ${route} (deleted route)`, () => {
          expect(isForbidden(route, role)).toBe(true);
        });
      }
    }

    // NOTE on /guard/gate-passes specifically: isForbidden() matches by prefix
    // (`pathname.startsWith(allowedRoute)`), and 'guard' is allowed on the
    // literal prefix '/guard'. So '/guard/gate-passes'.startsWith('/guard') is
    // true and isForbidden returns false for the guard role on this exact
    // path — the frontend sign-out gate in ProtectedRoute does NOT trigger.
    // This is not a data-exposure hole: App.tsx no longer registers a <Route>
    // for '/guard/gate-passes' at all, so React Router falls through to the
    // catch-all `<Route path="*" element={<NotFoundPage />} />` regardless of
    // role. But it IS a gap in the isForbidden() prefix model worth flagging:
    // any now-deleted sub-path of an allowed prefix (e.g. anything starting
    // with '/guard', '/visitors', '/reports', '/analytics') is silently
    // "allowed" by this function even though no such route exists anymore.
    // Document the current (safe-by-router, not safe-by-isForbidden) behavior
    // explicitly instead of leaving it uncovered:
    it("guard's own '/guard' prefix makes isForbidden() return false for the now-deleted /guard/gate-passes path (safety comes from App.tsx's catch-all NotFoundPage route, not from isForbidden)", () => {
      expect(isForbidden('/guard/gate-passes', 'guard')).toBe(false);
    });
    it('non-guard roles ARE forbidden on /guard/gate-passes (no matching prefix in their ROLE_ROUTES)', () => {
      expect(isForbidden('/guard/gate-passes', 'hod')).toBe(true);
      expect(isForbidden('/guard/gate-passes', 'staff')).toBe(true);
      expect(isForbidden('/guard/gate-passes', 'admin')).toBe(true);
    });
  });

  // ── Global search (top-bar) ─────────────────────────────────
  it('/search is allowed for every role', () => {
    const allRoles = ['guard', 'hod', 'staff', 'admin'] as const;
    for (const role of allRoles) {
      expect(isForbidden('/search', role), `${role} must be allowed on /search`).toBe(false);
    }
  });

  // ── Unauthenticated ────────────────────────────────────────
  describe('unauthenticated (role is null)', () => {
    it('null role is never forbidden (handled by session guard in App.tsx)', () => {
      expect(isForbidden('/admin', null)).toBe(false);
      expect(isForbidden('/guard', null)).toBe(false);
    });
  });

  // ── Route path match semantics ────────────────────────────
  it('/visitors is allowed for guard and staff, but FORBIDDEN for hod and admin', () => {
    expect(isForbidden('/visitors', 'guard')).toBe(false);
    expect(isForbidden('/visitors', 'staff')).toBe(false);
    expect(isForbidden('/visitors', 'admin')).toBe(true);
    expect(isForbidden('/visitors', 'hod')).toBe(true);
  });
  it('/whos-inside is allowed for guard and staff, but FORBIDDEN for hod (on-site info now lives on Overview)', () => {
    const allowedRoles = ['guard', 'staff'] as const;
    for (const r of allowedRoles) {
      expect(isForbidden('/whos-inside', r)).toBe(false);
    }
    expect(isForbidden('/whos-inside', 'hod')).toBe(true);
  });
  // ── ROLE_ROUTES completeness ───────────────────────────────
  it('every role has at least one allowed route (no role is fully locked out)', () => {
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      expect(routes.length, `${role} has no allowed routes`).toBeGreaterThan(0);
    }
  });

  it('no role except admin can reach /admin', () => {
    const nonAdminRoles = ['guard', 'hod', 'staff'] as const;
    for (const role of nonAdminRoles) {
      expect(isForbidden('/admin', role), `${role} must be forbidden on /admin`).toBe(true);
    }
  });

  // ── New guard-only routes (sidebar restructure) ─────────────
  it('only guard may reach /guard/pre-approvals, /guard/search and /guard/watchlist', () => {
    const newGuardRoutes = ['/guard/pre-approvals', '/guard/search', '/guard/watchlist'];
    const nonGuardRoles = ['hod', 'staff', 'admin'] as const;
    for (const route of newGuardRoutes) {
      expect(isForbidden(route, 'guard'), `guard must be allowed on ${route}`).toBe(false);
      for (const role of nonGuardRoles) {
        expect(isForbidden(route, role), `${role} must be forbidden on ${route}`).toBe(true);
      }
    }
  });

  // ── Unauthenticated component gate — App.tsx session guard ──
  describe('unauthenticated users (component gate)', () => {
    it('renders the login page instead of dashboard when session is null', async () => {
      getSession.mockResolvedValue({ data: { session: null } });

      window.history.pushState({}, '', '/');
      render(<App />);

      // The login page has a login button; the dashboard does NOT appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      });
      expect(screen.queryByText("Today's Visits")).not.toBeInTheDocument();
    });

    it('shows login page elements and never the authenticated sidebar when unauthenticated', async () => {
      getSession.mockResolvedValue({ data: { session: null } });

      window.history.pushState({}, '', '/');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Forgot password?')).toBeInTheDocument();
      });
      // Sidebar-specific section header must not appear
      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
      // Sidebar sign-out button must not appear
      expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument();
    });

    it('redirects to / when user is not authenticated', async () => {
      getSession.mockResolvedValue({ data: { session: null } });

      window.history.pushState({}, '', '/guard');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Forgot password?')).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/');
    });
  });
});
