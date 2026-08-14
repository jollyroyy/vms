import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
      // visits (and anything else): useVisitorCounts does
      // select(...).or(...), not select(...).eq(...) — needs its own branch.
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
          or: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = () => ch;
      return ch;
    },
    removeChannel: () => {},
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

  // The Visitors group absorbed "Walk-in Visitors" and "Pre-Approvals" — the
  // guard now sees the group's own label, "Visitors", as a top-level item.
  it('guard sees Visitors as a top-level item (absorbed Walk-in Visitors and Pre-Approvals)', () => {
    renderSidebar('guard');
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.queryByText('Walk-in Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Approvals')).not.toBeInTheDocument();
  });

  it('staff still sees Visitors', () => {
    renderSidebar('staff');
    expect(screen.getByText('Visitors')).toBeInTheDocument();
  });

  it('hod does not see Visitors', () => {
    renderSidebar('hod');
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
  });

  it('guard sees the reference console tabs plus Scan Pass and Visitors, and no Search', () => {
    renderSidebar('guard');
    for (const label of ['Dashboard', 'Inside Now', 'Pre-Registered', 'Watchlist', 'Scan Pass', 'Visitors']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('the four console tabs link to their reference-screen routes', () => {
    renderSidebar('guard');
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/guard/dashboard');
    expect(screen.getByRole('link', { name: /Inside Now/ })).toHaveAttribute('href', '/guard/inside-now');
    expect(screen.getByRole('link', { name: /Pre-Registered/ })).toHaveAttribute('href', '/guard/preregistered');
    expect(screen.getByRole('link', { name: /Watchlist/ })).toHaveAttribute('href', '/guard/watchlist');
  });

  // The Visitors entry is a single <a> now (2026-08-13): the segments that
  // used to expand under a group button live on the page as KPI tiles
  // (VisitorKpiRail). The guard nav is the reference four tabs plus Scan Pass
  // and Visitors — six plain links, no group button (2026-08-14).
  it('guard sidebar has exactly 6 nav links and no group button', () => {
    const { container } = renderSidebar('guard');
    const links = container.querySelectorAll('a.sidebar-link');
    expect(links.length).toBe(6);
    expect(screen.queryByRole('button', { name: /Visitors/ })).not.toBeInTheDocument();
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

  // Visitors is a plain link, not a group: there is no expand/collapse state to
  // hold, and the segments (Expected, Inside, …) never render inside the nav —
  // they live on the page as KPI tiles under /visitors.
  it('Visitors is a plain link — no group button, no segment children in the nav', () => {
    renderSidebar('guard', ['/guard/dashboard']);
    expect(screen.queryByRole('button', { name: /Visitors/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Visitors/ });
    expect(link).toHaveAttribute('href', '/visitors');
  });

  // Being ON a segment page does not change the nav's shape — there is no
  // group to open. The Visitors link reads as active for every /visitors/*
  // path, exactly like any other section link.
  it('on /visitors/inside the Visitors link is active and nothing else is', () => {
    renderSidebar('guard', ['/visitors/inside']);
    const visitorsLink = screen.getByRole('link', { name: /Visitors/ });
    expect(visitorsLink.className).toContain('sidebar-link-active');
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink.className).not.toContain('sidebar-link-active');
    expect(screen.queryByRole('button', { name: /Visitors/ })).not.toBeInTheDocument();
  });

  // Only the guard's Visitors entry is a group. Every other role's sidebar
  // must never render a sub-nav list at all.
  it('a non-guard role (hod) renders no sidebar-sub list', () => {
    const { container } = renderSidebar('hod');
    expect(container.querySelector('ul.sidebar-sub')).toBeNull();
  });
});

describe('Sidebar mobile drawer — closing', () => {
  function openDrawer() {
    renderSidebar('guard');
    fireEvent.click(screen.getByLabelText('Open menu'));
  }

  it('renders a corner Close button once the drawer is open', () => {
    openDrawer();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('clicking the corner Close button closes the drawer', () => {
    openDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('Escape closes the drawer', () => {
    openDrawer();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('clicking the backdrop closes the drawer, clicking inside it does not', () => {
    openDrawer();
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    const drawer = closeBtn.closest('aside')!;
    fireEvent.click(drawer);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    const backdrop = document.body.querySelector('.bg-black\\/40');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});
