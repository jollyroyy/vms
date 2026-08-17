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

  it('renders the heading, blurb and the Historical scope chip', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Visitors Log' })).toBeInTheDocument();
    expect(screen.getByText('Every visit in the selected window, newest first.')).toBeInTheDocument();
    // Client instruction, 2026-08-17: every historical tab must say so on its
    // own face, since a table of visits carries no clue on which of the two
    // it is — every row looks the same.
    expect(screen.getByText('Historical')).toBeInTheDocument();
  });

  // Client instruction, 2026-08-17: historical tabs carry a date-wise plus
  // 7/30/60/90-day and 1-year filter, defaulting to 30 days so the register
  // opens on a useful window rather than an empty one.
  it('renders the range bar defaulted to Last 30 Days and switches presets', () => {
    renderPage();
    const thirtyDay = screen.getByRole('button', { name: 'Last 30 Days' });
    expect(thirtyDay).toHaveAttribute('aria-pressed', 'true');

    const sevenDay = screen.getByRole('button', { name: 'Last 7 Days' });
    fireEvent.click(sevenDay);
    expect(sevenDay).toHaveAttribute('aria-pressed', 'true');
    expect(thirtyDay).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the empty state and a disabled, unlabelled-count export button when nothing has loaded', () => {
    renderPage();
    expect(screen.getByText('No visit was recorded in this window.')).toBeInTheDocument();
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

  // The row count came OFF the export button on 2026-08-17 (client instruction,
  // with the same change to the Reports download cards): a number beside a label
  // reads as part of the control. What it was load-bearing for — telling an empty
  // set apart from a working one — survives as the disabled state, which is what
  // is asserted here instead.
  it('disables both register actions when the filters match nothing, and names them without a count', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'a', status: 'checked_in', checked_in_at: '2026-08-17T09:00:00Z', scheduled_for: '2026-08-17T09:00:00Z' }),
        visitRow({ id: 'b', status: 'checked_in', checked_in_at: '2026-08-17T09:30:00Z', scheduled_for: null }),
        visitRow({ id: 'c', status: 'checked_in', checked_in_at: '2026-08-17T09:45:00Z', scheduled_for: null }),
      ],
      loading: false,
    };
    renderPage();
    const csv = screen.getByRole('button', { name: 'Export CSV' });
    const print = screen.getByRole('button', { name: 'Print Register' });
    expect(csv).toBeEnabled();
    expect(print).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Export 3 rows/ })).toBeNull();

    // A query that matches nothing: both artefacts would be a header row and a
    // letterhead over an empty table.
    fireEvent.change(screen.getByPlaceholderText('Search name, vendor, phone or reference'), {
      target: { value: 'nobody-by-this-name' },
    });
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Print Register' })).toBeDisabled();
  });

  // Client instruction, 2026-08-17: the log needed the department filter Reports
  // had, reaching the printout and the CSV too. It lives in `filterLog`, the one
  // pipeline all three read, which is what makes that true by construction rather
  // than by three call sites agreeing.
  it('narrows the list with the department picker, built from the loaded rows', () => {
    mockVisits.current = {
      visits: [
        visitRow({ id: 'a', department_id: 'd1', department: { name: 'HR' } }),
        visitRow({ id: 'b', department_id: 'd2', department: { name: 'Engineering' },
          visitor: { ...visitRow().visitor, full_name: 'Rahul Sen' } }),
      ],
      loading: false,
    };
    renderPage();

    const picker = screen.getByLabelText('Department');
    // Alphabetical, each with its own count — and only departments actually
    // present, so no option can open an empty table.
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent))
      .toEqual(['All Departments', 'Engineering (1)', 'HR (1)']);

    fireEvent.change(picker, { target: { value: 'd2' } });
    expect(screen.getByText('Rahul Sen')).toBeInTheDocument();
    expect(screen.queryByText('Someone')).toBeNull();
  });

  // The paper register is mounted only while printing. Permanently in the tree it
  // would put every filtered row in the DOM twice, and a screen reader has no
  // `@media print` — it would read the whole register again after the table.
  it('keeps the print sheet out of the DOM until Print is pressed', () => {
    mockVisits.current = { visits: [visitRow({ id: 'a' })], loading: false };
    renderPage();
    // One row on screen means exactly one rendering of its host, not two.
    expect(screen.getAllByText('S. Verma')).toHaveLength(1);
    expect(screen.queryByText(/^End of register/)).toBeNull();
  });

  // The old advice ("use Reports, which takes a date range") went stale the
  // moment this tab grew its own date range — pointing an admin at a second
  // screen for a control they are already holding. The reworded note stays
  // keyed on the same LOG_LIMIT-row cap and now tells them to narrow the
  // range in front of them instead.
  it('reworded the cap note to point at the range bar, not Reports', () => {
    mockVisits.current = {
      visits: Array.from({ length: 500 }, (_, i) => visitRow({ id: `row-${i}` })),
      loading: false,
    };
    renderPage();
    expect(screen.getByText(/hit the 500-row cap/)).toBeInTheDocument();
    expect(screen.getByText(/narrow the date range above/)).toBeInTheDocument();
    expect(screen.queryByText(/use Reports/)).toBeNull();
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
