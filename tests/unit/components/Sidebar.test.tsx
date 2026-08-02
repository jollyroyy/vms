import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/Sidebar';
import type { UserRole } from '../../../src/types/index';

vi.mock('../../../src/lib/theme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  ThemeProvider: (p: any) => p.children,
}));

vi.mock('../../../src/components/layout/SidebarAnalytics', () => ({
  default: () => null,
}));

vi.mock('../../../src/components/layout/SidebarProfile', () => ({
  default: () => null,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { app_metadata: {} } } }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { full_name: 'Test User', department_id: null }, error: null }),
            }),
          }),
        };
      }
      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { name: 'Test Dept' }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  },
}));

afterEach(cleanup);

const fakeSession = {
  user: { id: 'u1', email: 'admin@test.com', app_metadata: {} },
} as any;

function renderSidebar(role: UserRole, initialEntries: string[] = ['/'], collapsed?: boolean) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Sidebar session={fakeSession} role={role} collapsed={collapsed} />
    </MemoryRouter>,
  );
}

describe('Sidebar navigation links per role', () => {
  it('admin sees only Analytics, Reports and Settings links', () => {
    renderSidebar('admin');
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
  });

  // Each nav link renders as a single <a class="sidebar-link ...">. The mobile
  // drawer is not rendered by default (mobileOpen starts false), so only the
  // desktop <aside> tree contributes matches here.
  it('admin sidebar has exactly 3 nav links', () => {
    const { container } = renderSidebar('admin');
    const links = container.querySelectorAll('a.sidebar-link');
    expect(links.length).toBe(3);
  });

  it('guard still sees Visitors', () => {
    renderSidebar('guard');
    expect(screen.getByText('Visitors')).toBeInTheDocument();
  });

  it('staff still sees Visitors', () => {
    renderSidebar('staff');
    expect(screen.getByText('Visitors')).toBeInTheDocument();
  });

  it('hod does not see Visitors', () => {
    renderSidebar('hod');
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
  });

  it('guard sees all four nav labels, in the visitor-only console, and no Search', () => {
    renderSidebar('guard');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
    expect(screen.getByText('Watchlist & Alerts')).toBeInTheDocument();
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('guard sidebar has exactly 4 nav links', () => {
    const { container } = renderSidebar('guard');
    const links = container.querySelectorAll('a.sidebar-link');
    expect(links.length).toBe(4);
  });

  // Daily Staff and the Self-Service Kiosk are still ROUTABLE (see
  // roleRoutes.ts: /guard/daily-staff and /kiosk remain in ROLE_ROUTES.guard)
  // — the kiosk runs on its own device and both stay reachable by direct
  // link. They were dropped from the SIDEBAR only because neither is visitor
  // check-in, not because guard access was revoked. Both facts must hold at
  // once: absent from nav, present in ROLE_ROUTES.
  it('guard does not see Daily Staff or Self-Service Kiosk in the sidebar (they remain routable, see roleRoutes.ts)', () => {
    renderSidebar('guard');
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
  });

  // The Visitors sidebar link no longer carries sub-nav children (Expected /
  // Walk-ins / Inside moved to the GuardConsoleModeTabs in the main content
  // area). It must never render a sub-nav, active or not, collapsed or not.
  it('Visitors sidebar link renders no sub-nav children, on /visitors or elsewhere', () => {
    const { unmount } = renderSidebar('guard', ['/guard/dashboard']);
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk-ins')).not.toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
    unmount();

    renderSidebar('guard', ['/visitors']);
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk-ins')).not.toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
  });
});
