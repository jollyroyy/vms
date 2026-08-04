// Regression guard for the removed top-bar QR scanner button (see CLAUDE.md
// "The top-bar QR scanner button is GONE"). Scanning now only exists as a
// step inside CheckInPanel on /guard/pre-approvals — AppShell must never
// grow a global scanner button back, for any role.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../../../src/components/layout/AppShell';
import type { UserRole } from '../../../src/types/index';

vi.mock('../../../src/components/layout/Sidebar', () => ({
  default: () => null,
}));

vi.mock('../../../src/components/AuroraBackground', () => ({
  default: () => null,
}));

vi.mock('../../../src/components/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

afterEach(cleanup);

const fakeSession = {
  user: { id: 'u1', email: 'user@test.com', app_metadata: {} },
} as any;

function renderShell(role: UserRole | null) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppShell session={fakeSession} role={role}>
        <div>content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell top bar', () => {
  const roles: (UserRole | null)[] = ['guard', 'hod', 'staff', 'admin', null];

  it.each(roles)('renders no scanner button for role=%s', (role) => {
    renderShell(role);
    expect(screen.queryByTitle('Scan QR code')).not.toBeInTheDocument();
  });

  it('still renders the search bar and children alongside the missing scanner button', () => {
    renderShell('guard');
    expect(screen.getByPlaceholderText('Search visitors, passes...')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByTitle('Scan QR code')).not.toBeInTheDocument();
  });
});
