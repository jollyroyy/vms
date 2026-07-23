import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/Sidebar';

const mockSelect = vi.fn();

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { app_metadata: { department_id: 'dept-1' } } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (table === 'departments') return Promise.resolve({ data: { name: 'IT Department' } });
            return Promise.resolve({ data: { full_name: 'Guard User', department_id: 'dept-1' } });
          },
        }),
      }),
    }),
  },
}));

vi.mock('../../../src/lib/theme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

afterEach(cleanup);

const guardSession = { user: { email: 'guard@example.com' } } as any;
const adminSession = { user: { email: 'admin@example.com' } } as any;
const staffSession = { user: { email: 'staff@example.com' } } as any;

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/dashboard' } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe('M11-SIDEBAR: Sidebar component', () => {
  it('renders brand logo and SecureGate text', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('SecureGate')).toBeInTheDocument();
  });

  it('renders correct nav links for guard role', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Material Passes')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Kiosk')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('On-site')).not.toBeInTheDocument();
    expect(screen.queryByText('Material Passes')).not.toBeInTheDocument();
  });

  it('renders correct nav links for staff role', () => {
    renderWithRouter(<Sidebar session={staffSession} role="staff" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.getByText('Material Passes')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('highlights active link based on current route', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/visitors' });
    const visitorsLinks = screen.getAllByText('Visitors');
    const activeLink = visitorsLinks.find((el) => el.closest('a')?.className.includes('sidebar-link-active'));
    expect(activeLink).toBeTruthy();
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const visitorsLinks = screen.getAllByText('Visitors');
    const inactiveLink = visitorsLinks.find((el) => !el.closest('a')?.className.includes('sidebar-link-active'));
    expect(inactiveLink).toBeTruthy();
  });

  it('shows department name instead of role badge', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('IT Department')).toBeInTheDocument();
    });
  });

  it('does not show role label', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.queryByText('Guard')).not.toBeInTheDocument();
  });

  it('renders department name in sidebar', async () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    await waitFor(() => {
      expect(screen.getByText('IT Department')).toBeInTheDocument();
    });
  });

  it('renders initials from profile name', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    const initials = screen.getByText('GU');
    expect(initials).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('toggles mobile menu on hamburger click', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    const beforeCount = screen.getAllByText('Visitors').length;
    const toggleBtn = screen.getByLabelText('Open menu');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Visitors').length).toBeGreaterThan(beforeCount);
  });

  it('handles sign out click', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
