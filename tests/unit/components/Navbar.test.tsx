import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/Sidebar';

/* ─── Supabase mock ──────────────────────────────────────────────────── */

const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { app_metadata: { department_id: 'dept-1' } } },
});
const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://storage.example.com/avatars/user-1/avatar.jpg' },
});
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

// Default profile data — can be overridden per-test via mockProfileData
let mockProfileData: any = { full_name: 'Guard User', department_id: 'dept-1', avatar_url: null };
let mockDeptData: any = { name: 'IT Department' };

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: (...args: any[]) => mockSignOut(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    from: (table: string) => {
      // For visits / gate_passes queries from SidebarAnalytics: select().eq().gte()
      // — and from useVisitorCounts (Visitors sub-nav badges): select().or().
      if (table === 'visits' || table === 'gate_passes') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: [], error: null }),
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
            or: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => {
              if (table === 'departments') return Promise.resolve({ data: mockDeptData });
              return Promise.resolve({ data: mockProfileData });
            },
          }),
        }),
        update: (data: any) => mockUpdate(data),
      };
    },
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

vi.mock('../../../src/lib/theme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockProfileData = { full_name: 'Guard User', department_id: 'dept-1', avatar_url: null };
  mockDeptData = { name: 'IT Department' };
  mockGetUser.mockResolvedValue({
    data: { user: { app_metadata: { department_id: 'dept-1' } } },
  });
});

/* ─── Sessions ───────────────────────────────────────────────────────── */

const guardSession = { user: { id: 'user-1', email: 'guard@example.com' } } as any;
const hodSession = { user: { id: 'user-2', email: 'hod@example.com' } } as any;
const adminSession = { user: { id: 'user-3', email: 'admin@example.com' } } as any;
const staffSession = { user: { id: 'user-4', email: 'staff@example.com' } } as any;

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/dashboard' } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

/* ─── Navigation link tests ──────────────────────────────────────────── */

describe('Sidebar: navigation links', () => {
  it('renders brand logo and Secure Gate text', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('Secure Gate')).toBeInTheDocument();
  });

  it('renders correct nav links for guard role', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    // The five-item visitor console (client instruction, 2026-08-15) — see
    // components/layout/navLinks.tsx.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Entry & Exit')).toBeInTheDocument();
    expect(screen.getByText('Pre-Registered')).toBeInTheDocument();
    expect(screen.getByText('Scan Pass')).toBeInTheDocument();
    expect(screen.getByText('Register Walk-in')).toBeInTheDocument();
    // No Visitors tab for the guard (removed 2026-08-15, client instruction):
    // every card it carried moved onto the dashboard — All Visitors, Pending
    // Approval and Approved Walk-ins are KPI tiles (lib/guardTiles.ts) — and
    // the Walk-in Register became the Register Walk-in item above. The ROUTE
    // stays allowed in ROLE_ROUTES.guard, the same precedent as /kiosk and
    // /guard/search: only the nav item is gone, not access.
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk-in Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Approvals')).not.toBeInTheDocument();

    // Search left the nav but stays routable at /guard/search (see
    // ROLE_ROUTES.guard in roleRoutes.ts).
    expect(screen.queryByText('Search')).not.toBeInTheDocument();

    // The Self-Service Kiosk is dropped from the NAV but deliberately still
    // ROUTABLE — it runs on its own device and remains in ROLE_ROUTES.guard.
    // It left the sidebar because it is not visitor check-in, not because a
    // guard lost access. Daily Staff was deleted outright (2026-08-15), and
    // the Watchlist tab with it. tests/security/routeProtection.test.tsx
    // asserts the access half.
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Watchlist')).not.toBeInTheDocument();

    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders correct nav links for HOD role', () => {
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    // The HOD console's own tab bar was deleted 2026-08-15 — its two other
    // desks are sidebar items now, so this panel is the only navigation.
    expect(screen.getByText('Walk-in Desk')).toBeInTheDocument();
    expect(screen.getByText('Visitor Schedule')).toBeInTheDocument();
    // Analytics is admin-only since 2026-08-15 (client instruction).
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Gate Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  // The admin console is nine tabs since 2026-08-17 (client instruction), and
  // it now DOES reach visitor records — read-only, which each page's own test
  // asserts. Analytics is gone: deleted, not unlinked.
  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    expect(screen.getByText('Live Check-In')).toBeInTheDocument();
    expect(screen.getByText('Visitors Log')).toBeInTheDocument();
    expect(screen.getByText('Blacklist & Security')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
  });

  it('renders correct nav links for staff role', () => {
    renderWithRouter(<Sidebar session={staffSession} role="staff" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  // Every guard nav item is a single <a> (2026-08-13): the segments that used
  // to expand under a group button live on the page as KPI tiles, so "active"
  // is read off the link's own class like every other nav item. Scan Pass is
  // the handle here (Visitors is gone from the guard nav since 2026-08-15) —
  // its route is unambiguous and the subject under test is the highlighting
  // behaviour, not the link's identity.
  it('highlights active link based on current route', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/guard/scan-pass' });
    const link = screen.getByRole('link', { name: /Scan Pass/ });
    expect(link.className).toContain('sidebar-link-active');
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const link = screen.getByRole('link', { name: /Scan Pass/ });
    expect(link.className).not.toContain('sidebar-link-active');
  });
});

/* ─── Sign out ────────────────────────────────────────────────────────── */

describe('Sidebar: sign out', () => {
  it('renders sign out button', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('calls supabase.auth.signOut on click', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

/* ─── Mobile menu ─────────────────────────────────────────────────────── */

describe('Sidebar: mobile menu', () => {
  it('toggles mobile menu on hamburger click', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    // Scan Pass is the handle (Visitors left the guard nav 2026-08-15) — the
    // subject under test is the mobile menu duplicating the nav, not which
    // link it duplicates.
    const beforeCount = screen.getAllByText('Scan Pass').length;
    const toggleBtn = screen.getByLabelText('Open menu');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Scan Pass').length).toBeGreaterThan(beforeCount);
  });
});
