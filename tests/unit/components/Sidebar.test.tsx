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
  // The SIX-tab admin console (2026-08-18, client instruction: merge
  // Pre-Registration into Live Check-In and Visitors Log into Reports).
  // Analytics and Badge Printing are asserted absent because those pages were
  // deleted outright; the two merged tabs are absent because their paths are
  // now redirects, and a nav item pointing at a bounce is worse than no item.
  it('admin sees the six console tabs and no deleted or merged-away link', () => {
    renderSidebar('admin');
    for (const label of ['Dashboard', 'Live Check-In',
      'Hosts', 'Blacklist & Security', 'Reports', 'Settings']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Badge Printing')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Registration')).not.toBeInTheDocument();
    expect(screen.queryByText('Visitors Log')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
  });

  // Each nav link renders as a single <a class="sidebar-link ...">. The mobile
  // drawer is not rendered by default (mobileOpen starts false), so only the
  // desktop <aside> tree contributes matches here.
  // Six since the 2026-08-18 merges (was eight; Badge Printing took it from
  // nine on 2026-08-17).
  it('admin sidebar has exactly 6 nav links', () => {
    const { container } = renderSidebar('admin');
    const links = container.querySelectorAll('a.sidebar-link');
    expect(links.length).toBe(6);
  });

  // The guard's Visitors nav item was removed outright 2026-08-15 (client
  // instruction): every card it carried moved to the dashboard's row-2 KPI
  // tiles (lib/guardTiles.ts) and its walk-in lane became its own "Register
  // Walk-in" item. The ROUTE stays allowed in ROLE_ROUTES.guard — same
  // precedent as /kiosk — only the nav item is gone.
  it('guard has no Visitors nav item (its cards moved to the dashboard; the route stays routable)', () => {
    renderSidebar('guard');
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Walk-in Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('Pre-Approvals')).not.toBeInTheDocument();
  });

  // Staff are approvers since 2026-08-18 (client instruction), so they see the
  // HOD's rail and nothing else — Visitors and On-site went with the rest of
  // the staff-only surface.
  it('staff sees the HOD rail, not Visitors', () => {
    renderSidebar('staff');
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
  });

  it('hod does not see Visitors', () => {
    renderSidebar('hod');
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    expect(screen.getByText('Pre-Approvals')).toBeInTheDocument();
  });

  it('guard sees the board, Find & Scan, Register Walk-in and Entry & Exit, and no Search', () => {
    renderSidebar('guard');
    for (const label of ['Dashboard', 'Entry & Exit', 'Find & Scan', 'Register Walk-in']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
    expect(screen.queryByText('Watchlist')).not.toBeInTheDocument();
  });

  it('the console tabs link to their reference-screen routes', () => {
    renderSidebar('guard');
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/guard/dashboard');
    expect(screen.getByRole('link', { name: /Entry & Exit/ })).toHaveAttribute('href', '/guard/inside-now');
    expect(screen.queryByRole('link', { name: /Watchlist/ })).not.toBeInTheDocument();
  });

  // Every guard nav item is a single <a> (2026-08-13): the segments that used
  // to expand under a group button live on the page as KPI tiles
  // (VisitorKpiRail), not in the sidebar. FIVE since 2026-08-18: the four short
  // items plus Pre-Registered, dropped and asked back the same day, whose board
  // is the dashboard's Expected Today panel from the same predicate. No item is
  // a group, so no click ever reveals a <button> in this nav.
  it('guard sidebar has exactly 5 nav links and no group button', () => {
    renderSidebar('guard');
    const links = screen.getAllByRole('link').filter((l) => l.className.includes('sidebar-link'));
    expect(links.length).toBe(5);
    const navLabels = ['Dashboard', 'Entry & Exit', 'Find & Scan', 'Register Walk-in', 'Pre-Registered'];
    for (const label of navLabels) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });

  // The Self-Service Kiosk is still ROUTABLE (see roleRoutes.ts: /kiosk remains
  // in ROLE_ROUTES.guard) — it runs on its own device and stays reachable by
  // direct link. It was dropped from the SIDEBAR only because it is not visitor
  // check-in, not because guard access was revoked. Daily Staff was deleted
  // outright 2026-08-15 (its query could never return a row), so neither
  // appears in the sidebar.
  it('guard does not see Daily Staff or Self-Service Kiosk in the sidebar (kiosk remains routable, see roleRoutes.ts)', () => {
    renderSidebar('guard');
    expect(screen.queryByText('Daily Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Self-Service Kiosk')).not.toBeInTheDocument();
  });

  // Register Walk-in is a plain link, not a group: there is no expand/collapse
  // state to hold anywhere in the guard nav, and no segment children (Expected,
  // Inside, …) ever render inside it — those live on the dashboard as KPI
  // tiles now, not under a nav item at all. This keeps alive the guarantee the
  // old Visitors-group test asserted, now that Visitors itself is gone.
  it('Register Walk-in is a plain link — no group button, no segment children in the nav', () => {
    renderSidebar('guard', ['/guard/dashboard']);
    expect(screen.queryByRole('button', { name: /Register Walk-in/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Register Walk-in/ });
    expect(link).toHaveAttribute('href', '/guard/walk-in');
  });

  // /visitors/inside is a legacy bookmark: the ROUTE still resolves (see
  // ROLE_ROUTES.guard) but no nav item points at it any more, so nothing in
  // the sidebar should light up as active while it's the current location —
  // the mismatch is expected now that Visitors was removed from the nav.
  it('on /visitors/inside no guard nav link is active', () => {
    renderSidebar('guard', ['/visitors/inside']);
    expect(screen.queryByText('Visitors')).not.toBeInTheDocument();
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink.className).not.toContain('sidebar-link-active');
    const navLabels = ['Dashboard', 'Entry & Exit', 'Find & Scan', 'Register Walk-in'];
    for (const label of navLabels) {
      const link = screen.getByRole('link', { name: new RegExp(label) });
      expect(link.className).not.toContain('sidebar-link-active');
    }
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
