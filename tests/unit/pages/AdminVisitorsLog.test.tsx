import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AdminVisitorsLog from '../../../src/pages/Admin/AdminVisitorsLog';

// AdminVisitorsLog draws off `useAdminVisits({ kind: 'recent', limit: 500 })`,
// mocked directly per the GuardDashboard.test.tsx pattern — the page composes
// real filterLog/statusesPresent logic over a seeded array, so seeding
// mockVisits is all a test needs.
const mockVisits = vi.hoisted(() => ({ current: { visits: [] as any[], loading: false } }));

vi.mock('../../../src/lib/useAdminVisits', () => ({
  useAdminVisits: () => mockVisits.current,
}));
vi.mock('../../../src/components/VisitorDetails', () => ({ default: () => null }));

const NOW = '2026-08-17T12:00:00Z';

function visitRow(over: Record<string, any> = {}): any {
  return {
    id: 'v1', ref_number: 'REF-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    status: 'approved', checked_in_at: null, checked_out_at: null, exit_verified: null,
    rejection_reason: null, carrying_material: false, qr_token: 'tok', qr_expires_at: null,
    created_at: '2026-08-10T03:00:00Z', scheduled_for: '2026-08-20T09:30:00Z', purpose: 'meeting',
    visitor: {
      full_name: 'Someone', phone: '9000000000', email: null, vendor_name: null,
      is_blacklisted: false, blacklist_reason: null, id_type: null, id_last4: null, created_at: '',
    },
    department: { name: 'HR' }, host: { full_name: 'S. Verma' },
    ...over,
  };
}

function renderPage() {
  return render(<AdminVisitorsLog />);
}

describe('AdminVisitorsLog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mockVisits.current = { visits: [], loading: false };
  });

  it('renders the heading and blurb', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Visitors Log' })).toBeInTheDocument();
    expect(screen.getByText('Every visit on record, newest first.')).toBeInTheDocument();
  });

  it('shows the empty state and a disabled, unlabelled-count export button when nothing has loaded', () => {
    renderPage();
    expect(screen.getByText('No visit has been recorded yet.')).toBeInTheDocument();
    const exportBtn = screen.getByRole('button', { name: /Export/ });
    expect(exportBtn).toBeDisabled();
    expect(exportBtn).toHaveTextContent('Export CSV');
  });

  it('renders loaded rows', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'a', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } }),
        visitRow({ id: 'b', visitor: { ...visitRow().visitor, full_name: 'Rahul Sen' } }),
      ],
      loading: false,
    };
    renderPage();
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.getByText('Rahul Sen')).toBeInTheDocument();
  });

  // Digits-only comparison: a guard writes "98765 43210", an admin searches
  // "9876543210" — the two must agree, the same rule checkInMatches.ts follows.
  it('matches a phone query with spaces and punctuation, digits-only', () => {
    mockVisits.current = {
      visits: [
        visitRow({
          id: 'a', visitor: { ...visitRow().visitor, full_name: 'Priya Nair', phone: '9876543210' },
        }),
        visitRow({
          id: 'b', visitor: { ...visitRow().visitor, full_name: 'Rahul Sen', phone: '9111111111' },
        }),
      ],
      loading: false,
    };
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Search name, vendor, phone or reference'), {
      target: { value: '987-654 3210' },
    });
    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.queryByText('Rahul Sen')).toBeNull();
  });

  it('narrows the list with the status picker', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'a', status: 'approved', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } }),
        visitRow({ id: 'b', status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z', visitor: { ...visitRow().visitor, full_name: 'Rahul Sen' } }),
      ],
      loading: false,
    };
    renderPage();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'checked_in' } });
    expect(screen.queryByText('Priya Nair')).toBeNull();
    expect(screen.getByText('Rahul Sen')).toBeInTheDocument();
  });

  it('narrows the list with the type (origin) picker', () => {
    mockVisits.current = {
      visits: [
        // scheduled_for set -> pre_approved.
        visitRow({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z', scheduled_for: '2026-08-17T09:00:00Z', visitor: { ...visitRow().visitor, full_name: 'Priya Nair' } }),
        // scheduled_for null -> walk_in.
        visitRow({ id: 'b', status: 'checked_in', checked_in_at: '2026-08-17T09:30:00Z', scheduled_for: null, visitor: { ...visitRow().visitor, full_name: 'Rahul Sen' } }),
      ],
      loading: false,
    };
    renderPage();
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'walk_in' } });
    expect(screen.queryByText('Priya Nair')).toBeNull();
    expect(screen.getByText('Rahul Sen')).toBeInTheDocument();
  });

  // A filter that shrinks the set out from under the current page would
  // otherwise leave the reader on a page that no longer exists, reading as
  // "no results" when the real answer is "wrong page" (source's own comment).
  it('resets pagination to page 1 when a filter narrows the set', () => {
    mockVisits.current = {
      visits: Array.from({ length: 30 }, (_, i) =>
        visitRow({
          id: `row-${i}`,
          visitor: { ...visitRow().visitor, full_name: i < 15 ? 'Priya Nair' : 'Rahul Sen' },
        }),
      ),
      loading: false,
    };
    renderPage();
    expect(screen.getByText('Showing 1 to 25 of 30 entries')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 26 to 30 of 30 entries')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search name, vendor, phone or reference'), {
      target: { value: 'Priya' },
    });
    // Narrowed to 15 matches, and back on page 1 — not stuck on the now-empty page 2.
    expect(screen.getByText('Showing 1 to 15 of 15 entries')).toBeInTheDocument();
  });

  // The export takes the FILTERED set, not everything loaded — an admin who
  // narrowed to one type must see that reflected before sending the file on.
  it('reports the filtered row count on the export button, not the loaded count', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z', scheduled_for: '2026-08-17T09:00:00Z' }),
        visitRow({ id: 'b', status: 'checked_in', checked_in_at: '2026-08-17T09:30:00Z', scheduled_for: null }),
        visitRow({ id: 'c', status: 'checked_in', checked_in_at: '2026-08-17T09:45:00Z', scheduled_for: null }),
      ],
      loading: false,
    };
    renderPage();
    expect(screen.getByRole('button', { name: 'Export 3 rows' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'walk_in' } });
    expect(screen.getByRole('button', { name: 'Export 2 rows' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export 3 rows' })).toBeNull();
  });

  // READ-ONLY: no admin visitor surface may write to a visit.
  it('offers no control that writes to a visit', () => {
    mockVisits.current = { visits: [visitRow({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z' })], loading: false };
    renderPage();
    for (const btn of screen.queryAllByRole('button')) {
      expect(btn.textContent).not.toMatch(/check in|check out|approve|reject|deny/i);
    }
  });
});
