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

function renderSidebar(role: UserRole) {
  return render(
    <MemoryRouter>
      <Sidebar session={fakeSession} role={role} />
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
});
