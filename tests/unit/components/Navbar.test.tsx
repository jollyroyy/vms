import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../../src/components/Navbar';

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    })),
    channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn().mockReturnValue('sub-1') })) })),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  },
}));

afterEach(cleanup);

const guardSession = { user: { email: 'guard@example.com' } } as any;
const adminSession = { user: { email: 'admin@example.com' } } as any;
const staffSession = { user: { email: 'staff@example.com' } } as any;

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/guard' } = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe('M11-NAVBAR: Navbar component', () => {
  it('renders brand logo and VMS text', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    expect(screen.getByText('VMS')).toBeInTheDocument();
  });

  it('renders correct nav links for guard role', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText("Who's Inside")).toBeInTheDocument();
    expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('renders correct nav links for admin role', () => {
    renderWithRouter(<Navbar session={adminSession} role="admin" />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getAllByText('Admin')[0]).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText("Who's Inside")).not.toBeInTheDocument();
    expect(screen.queryByText('Gate Passes')).not.toBeInTheDocument();
  });

  it('renders correct nav links for staff role', () => {
    renderWithRouter(<Navbar session={staffSession} role="staff" />);
    expect(screen.getByText("Who's Inside")).toBeInTheDocument();
    expect(screen.getByText('Gate Passes')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.queryByText('Console')).not.toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('highlights active link based on current route', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />, { route: '/guard' });
    const consoleLinks = screen.getAllByText('Console');
    const activeLink = consoleLinks.find((el) => el.className.includes('bg-brand-50'));
    expect(activeLink).toBeTruthy();
  });

  it('does not highlight inactive links', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />, { route: '/whos-inside' });
    const consoleLinks = screen.getAllByText('Console');
    const inactiveLink = consoleLinks.find((el) => el.className.includes('text-navy-500'));
    expect(inactiveLink).toBeTruthy();
  });

  it('shows role badge when role is provided', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    const guardTexts = screen.getAllByText('Guard');
    expect(guardTexts.length).toBeGreaterThanOrEqual(1);
    // one in the badge span, one in the dropdown — both sufficient to prove role is shown
  });

  it('shows default role label for unknown role', () => {
    renderWithRouter(<Navbar session={guardSession} role={null} />);
    expect(screen.getByText('Unknown role')).toBeInTheDocument();
  });

  it('renders email in dropdown', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    expect(screen.getByText('guard@example.com')).toBeInTheDocument();
  });

  it('renders initials from email', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    const initials = screen.getByText('GU');
    expect(initials).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('toggles mobile menu on hamburger click', () => {
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    // Console only in desktop nav before toggle
    const beforeCount = screen.getAllByText('Console').length;
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find((b) => b.innerHTML.includes('M3.75 6.75h16.5'));
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn!);
    // Console appears in both desktop and mobile after toggle
    expect(screen.getAllByText('Console').length).toBe(beforeCount + 1);
  });

  it('handles sign out click', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    renderWithRouter(<Navbar session={guardSession} role="guard" />);
    fireEvent.click(screen.getByText('Sign out'));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
