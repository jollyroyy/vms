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
    // The three-item visitor console. Walk-in Visitors and Pre-Approvals were
    // absorbed into the Visitors GROUP — see components/layout/navLinks.tsx.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Scan Pass')).toBeInTheDocument();
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.queryByText('Walk-in Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Approvals')).not.toBeInTheDocument();

    // Search left the nav but stays routable at /guard/search (see
    // ROLE_ROUTES.guard in roleRoutes.ts) — same reasoning as Daily Staff/Kiosk.
    expect(screen.queryByText('Search')).not.toBeInTheDocument();

    // Dropped from the NAV, but deliberately still ROUTABLE — the kiosk runs on
    // its own device and both remain in ROLE_ROUTES.guard. They left the
    // sidebar because neither is visitor check-in, not because a guard lost
    // access. tests/security/routeProtection.test.tsx asserts the access half.
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();

    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders correct nav links for HOD role', () => {
    renderWithRouter(<Sidebar session={hodSession} role="hod" />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Gate Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  // Admin is limited to Reports, Analytics and Settings — visitor records are out
  // of scope for the role, so the Visitors link is gone (see tests/unit/components/
  // Sidebar.test.tsx and ROLE_ROUTES.admin in src/lib/roleRoutes.ts).
  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
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

  // Visitors is a GROUP now: its parent renders as a <button>, so "active" is
  // read off the button's own class, not an <a>.
  it('highlights active link based on current route', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/visitors' });
    const group = screen.getByRole('button', { name: /Visitors/ });
    expect(group.className).toContain('sidebar-link-active');
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const group = screen.getByRole('button', { name: /Visitors/ });
    expect(group.className).not.toContain('sidebar-link-active');
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
    const beforeCount = screen.getAllByText('Visitors').length;
    const toggleBtn = screen.getByLabelText('Open menu');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Visitors').length).toBeGreaterThan(beforeCount);
  });
});
