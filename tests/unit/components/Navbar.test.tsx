import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../../src/components/layout/Sidebar';

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
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
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('Kiosk')).toBeInTheDocument();
    expect(screen.getByText("Who's Inside")).toBeInTheDocument();
    expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Sidebar session={adminSession} role="admin" />);
    // "Admin" text appears both as nav link text and as role badge label
    const adminEls = screen.getAllByText('Admin');
    expect(adminEls.length).toBeGreaterThanOrEqual(1);
    // Verify the nav link element points to /admin
    const adminLink = adminEls.find((el) => el.closest('a')?.getAttribute('href') === '/admin');
    expect(adminLink).toBeTruthy();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText("Who's Inside")).not.toBeInTheDocument();
    expect(screen.queryByText('Gate Passes')).not.toBeInTheDocument();
  });

  it('renders correct nav links for staff role', () => {
    renderWithRouter(<Sidebar session={staffSession} role="staff" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText("Who's Inside")).toBeInTheDocument();
    expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('highlights active link based on current route', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/guard' });
    const consoleLinks = screen.getAllByText('Console');
    const activeLink = consoleLinks.find((el) => el.closest('a')?.className.includes('sidebar-link-active'));
    expect(activeLink).toBeTruthy();
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const consoleLinks = screen.getAllByText('Console');
    const inactiveLink = consoleLinks.find((el) => !el.closest('a')?.className.includes('sidebar-link-active'));
    expect(inactiveLink).toBeTruthy();
  });

  it('shows role badge when role is provided', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('Guard')).toBeInTheDocument();
  });

  it('shows default role label for unknown role', () => {
    renderWithRouter(<Sidebar session={guardSession} role={null} />);
    expect(screen.getByText('Unknown role')).toBeInTheDocument();
  });

  it('renders email in sidebar', () => {
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    expect(screen.getByText('guard@example.com')).toBeInTheDocument();
  });

  it('renders initials from email', () => {
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
    const beforeCount = screen.getAllByText('Dashboard').length;
    const toggleBtn = screen.getByLabelText('Open menu');
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(beforeCount);
  });

  it('handles sign out click', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    renderWithRouter(<Sidebar session={guardSession} role="guard" />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
