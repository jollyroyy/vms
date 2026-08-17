import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../../../src/pages/Shared/Reports';

// WHO SEES THE REGISTER ON /reports, and who does not.
//
// Client instruction, 2026-08-17: remove the "Register — <date> (N entries)"
// table from Reports, the same information being on the Visitors Log. That tab
// is ADMIN-ONLY (ROLE_ROUTES), so the removal is admin-only too — an HOD and
// staff reach /reports and have no other surface that lists a visit at all, and
// dropping the table for them would leave a page holding a date picker.
//
// Split into its own file rather than added to Reports.test.tsx: that file's
// supabase mock deliberately has no `auth`, so every test in it runs with
// `userRole === null` (the getUser call throws and is caught). Proving the
// role-split needs a mock that answers, and one harness cannot be both.

const mockOrder = vi.hoisted(() => vi.fn());
const mockRole = vi.hoisted(() => ({ current: 'admin' as string | null }));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({
        data: { user: { app_metadata: { role: mockRole.current, department_id: null } } },
      }),
    },
    from: () => ({ select: () => ({ gte: () => ({ lt: () => ({ order: mockOrder }) }) }) }),
  },
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));
vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: (rows: any[]) => Promise.resolve(rows),
}));

function visitRow(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'VIS-20260817-0001', visitor_id: 'p1', department_id: 'd1',
    host_id: 'h1', status: 'checked_in', purpose: 'meeting',
    checked_in_at: '2026-08-17T04:00:00Z', checked_out_at: null, exit_verified: null,
    scheduled_for: '2026-08-17T04:00:00Z', created_at: '2026-08-17T03:00:00Z',
    carrying_material: false, carrying_remarks: null, rejection_reason: null,
    qr_token: 't', qr_expires_at: null, checkin_duration_seconds: null,
    visitor: { full_name: 'Ramesh Kumar', phone: '9000000000', vendor_name: 'Acme',
      id_type: null, id_last4: null, is_blacklisted: false, blacklist_reason: null, created_at: '' },
    department: { id: 'd1', name: 'HR', code: 'HR', created_at: '' },
    host: { full_name: 'S. Verma' },
    ...over,
  };
}

async function renderAs(role: string) {
  mockRole.current = role;
  mockOrder.mockResolvedValue({ data: [visitRow()], error: null });
  render(<MemoryRouter><ReportsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Reports')).toBeInTheDocument());
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the Reports register is role-scoped', () => {
  // THE ADMIN HAS THE REGISTER BACK (client instruction, 2026-08-18: merge the
  // Visitors Log tab into Reports and keep the reports part). It was withheld
  // from this role for one day, while that tab held a second copy of it; with
  // the tab merged away there is one register again and this is it, with the
  // department filter, the CSV and the printout that came across with it.
  it('draws the register, its count and both register actions for an admin', async () => {
    await renderAs('admin');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Register —/ })).toBeInTheDocument();
    });
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Register/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
  });

  // ONE RANGE CONTROL, AND FOR AN ADMIN IT IS THE CONSOLE'S OWN (client
  // instruction, 2026-08-18: remove the "Date: … Selected Day / Last 7 Days /
  // …" toolbar from admin Reports). The WINDOW stays — a report with no period
  // is not a report, and the charts, the four bundles and the register all read
  // it — so what went is the second spelling of the picker: this role now gets
  // `AdminRangeBar`, the same control every other admin tab carries, which
  // prints the resolved dates as well as the lit preset.
  it('gives an admin the console range bar, not this page’s own Date: toolbar', async () => {
    await renderAs('admin');
    expect(screen.queryByText('Date:')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Report range' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Date range' })).toBeInTheDocument();
    expect(screen.getByLabelText('Up to')).toBeInTheDocument();
  });

  // An HOD and staff keep this page's own toolbar unchanged — they never see
  // the admin console, so there is nothing for them to unify with.
  it('keeps the Date: toolbar for an HOD', async () => {
    await renderAs('hod');
    expect(screen.getByText('Date:')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Report range' })).toBeInTheDocument();
  });

  it('still draws the register, its count and its Print button for an HOD', async () => {
    await renderAs('hod');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Register —/ })).toBeInTheDocument();
    });
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Register/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
  });

  it('still draws the register for staff', async () => {
    await renderAs('staff');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Register —/ })).toBeInTheDocument();
    });
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
  });
});
