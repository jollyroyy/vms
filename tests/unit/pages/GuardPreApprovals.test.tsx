import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardPreApprovals from '../../../src/pages/Guard/PreApprovals';
import type { Visit } from '../../../src/types/index';

afterEach(() => { cleanup(); mockState.current = { visits: [], loading: false }; mockFilters.current = []; });

const mockState = vi.hoisted(() => ({ current: { visits: [] as Visit[], loading: false } }));
const mockFilters = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock('../../../src/lib/usePreApprovals', () => ({
  usePreApprovals: (filter: string) => {
    mockFilters.current.push(filter);
    return mockState.current;
  },
}));

// CheckInPanel moved here from the console (see PreApprovals.tsx header
// comment) — it has its own extensive supabase surface (visits, visitors,
// recurring_visits, departments) covered by CheckInPanel's own tests, so it
// is stubbed here the same way GuardConsole.test.tsx used to stub it before
// the move.
vi.mock('../../../src/pages/Guard/CheckInPanel', () => ({
  default: () => <div>CheckInPanel</div>,
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
      channel: vi.fn(() => ch),
      removeChannel: vi.fn(),
    },
  };
});

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    ref_number: 'REF1',
    visitor_id: 'vis1',
    department_id: 'd1',
    host_id: 'h1',
    purpose: 'meeting',
    photo_path: null,
    photo_data: null,
    status: 'approved',
    checked_in_at: null,
    checked_out_at: null,
    exit_verified: null,
    rejection_reason: null,
    carrying_material: false,
    scheduled_for: null,
    created_at: '2026-08-02T04:00:00Z',
    visitor: { id: 'vis1', phone: '9999999999', full_name: 'Jane Doe', vendor_name: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-07-30T00:00:00Z' },
    department: { id: 'd1', name: 'Engineering', code: 'ENG', created_at: '2026-01-01T00:00:00Z' },
    host: { id: 'h1', full_name: 'Alex Host' },
    ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter><GuardPreApprovals /></MemoryRouter>);
}

describe('GuardPreApprovals', () => {
  it('renders the heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pre-Approvals');
  });

  // The other half of the CheckInPanel move: it left the walk-in console and
  // now lives here, above the filter tabs, since the QR gate and match search
  // both only ever resolve a visitor who was booked in advance.
  it('renders CheckInPanel above the filter tabs', () => {
    renderPage();
    expect(screen.getByText('CheckInPanel')).toBeInTheDocument();
  });

  it('shows an empty state for the default Today filter', () => {
    mockState.current = { visits: [], loading: false };
    renderPage();
    expect(screen.getByText('No pre-approvals scheduled for today.')).toBeInTheDocument();
  });

  it('renders a row for each supplied visit', () => {
    mockState.current = {
      visits: [visit({ scheduled_for: '2026-08-02T09:30:00Z' }), visit({ id: 'v2', visitor: { ...visit().visitor!, full_name: 'Sam Roy' } })],
      loading: false,
    };
    renderPage();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Sam Roy')).toBeInTheDocument();
  });

  it('shows "Anytime" when scheduled_for is null', () => {
    mockState.current = { visits: [visit({ scheduled_for: null })], loading: false };
    renderPage();
    expect(screen.getByText('Anytime')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    mockState.current = { visits: [], loading: true };
    const { container } = renderPage();
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('requests the "upcoming" filter when that option is clicked', () => {
    mockState.current = { visits: [], loading: false };
    renderPage();
    fireEvent.click(screen.getByText('Upcoming'));
    expect(mockFilters.current).toContain('upcoming');
    expect(screen.getByText('No upcoming pre-approvals scheduled.')).toBeInTheDocument();
  });
});
