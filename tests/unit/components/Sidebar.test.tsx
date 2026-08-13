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

  it('guard sees all three nav labels of the visitor-only console, and no Search', () => {
    renderSidebar('guard');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Scan Pass')).toBeInTheDocument();
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  // The Visitors group renders as a <button>, not an <a>, so it does not add
  // to the anchor count — only Dashboard and Scan Pass do.
  it('guard sidebar has exactly 2 top-level nav <a> links, plus the Visitors group button', () => {
    const { container } = renderSidebar('guard');
    const links = container.querySelectorAll('a.sidebar-link');
    expect(links.length).toBe(2);
    const group = screen.getByRole('button', { name: /Visitors/ });
    expect(group).toBeInTheDocument();
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

  // The Visitors group parent is a BUTTON, not a Link — clicking it opens the
  // list of where you can go, it does not navigate somewhere that then hides
  // its own contents. Collapsed, the children are still nowhere on screen
  // until it is clicked.
  it('the Visitors group is collapsed by default off /visitors, and clicking it reveals its children', () => {
    renderSidebar('guard', ['/guard/dashboard']);
    const group = screen.getByRole('button', { name: /Visitors/ });
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
    expect(screen.queryByText('Inside')).not.toBeInTheDocument();

    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Expected')).toBeInTheDocument();
    expect(screen.getByText('Inside')).toBeInTheDocument();

    // Toggling again collapses it back — one click opens, the next closes.
    fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Expected')).not.toBeInTheDocument();
  });

  // Seeded open on mount when the route already lives under /visitors, so a
  // guard who lands on a segment page can see where they are without hunting
  // for the group first.
  it('the Visitors group is already expanded on mount when the route is /visitors/inside', () => {
    renderSidebar('guard', ['/visitors/inside']);
    const group = screen.getByRole('button', { name: /Visitors/ });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Expected')).toBeInTheDocument();
    expect(screen.getByText('Inside')).toBeInTheDocument();
  });

  // Exact-match only: /visitors is a prefix of every segment path, so a
  // startsWith test on the active class would light up "All Visitors" on
  // every single segment page and tell the guard nothing about where they are.
  it('on /visitors/inside, Inside is the active sub-link and All Visitors is not', () => {
    renderSidebar('guard', ['/visitors/inside']);
    const insideLink = screen.getByText('Inside').closest('a');
    const allLink = screen.getByText('All Visitors').closest('a');
    expect(insideLink?.className).toContain('sidebar-sublink-active');
    expect(allLink?.className).not.toContain('sidebar-sublink-active');
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
