import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScanPass from '../../../src/pages/Guard/ScanPass';
import type { MatchItem } from '../../../src/pages/Guard/checkInTypes';

// CLICKING A SEARCH HIT OPENS THE FULL RECORD (client instruction, 2026-08-18:
// "when we click on a particular visitor it would render the result the exact
// way it is rendering the result when we are clicking under the entry/exit —
// all those details should be there — and if the user is to be checked in or
// checked out, put the button also").
//
// The point of these tests is that it is the SAME frame, not a lookalike: the
// identity ring and its verdict, the Photo → ID Scan → Host Notified tracker,
// the visit timeline, the vehicle and the printable pass. A second component
// drawn to match would be the fourth place in this repo where one visitor is
// described twice and the two copies drift.
//
// The row also has to keep opening when it cannot be acted on. Reading a record
// and being allowed to honour it are different permissions, and it is the
// closed pass — where did this card go? — that a guard most often clicks.

const { mockFetchVisitById, mockFetchVisitForExit, mockLogVisitExit, historyMatches } = vi.hoisted(() => ({
  mockFetchVisitById: vi.fn(),
  mockFetchVisitForExit: vi.fn(),
  mockLogVisitExit: vi.fn(),
  historyMatches: { current: [] as MatchItem[] },
}));

vi.mock('../../../src/lib/checkInFlow', () => ({ checkInScannedVisit: vi.fn() }));
vi.mock('../../../src/lib/hostNames', () => ({ attachHostNames: (rows: any[]) => Promise.resolve(rows) }));
vi.mock('../../../src/lib/fetchVisitById', () => ({ fetchVisitById: mockFetchVisitById }));
vi.mock('../../../src/lib/checkOutFlow', () => ({
  fetchVisitForExit: mockFetchVisitForExit,
  logVisitExit: mockLogVisitExit,
}));
vi.mock('../../../src/lib/useVisitHistorySearch', () => ({
  useVisitHistorySearch: () => ({ historyMatches: historyMatches.current, searching: false }),
}));
vi.mock('../../../src/pages/Guard/GuardQRScan', () => ({ default: () => <p>QR SCANNER STUB</p> }));
// The pass renders a real code on the page; the encoder is not what is under
// test and it is the one async import inside the frame.
vi.mock('qrcode', () => ({ default: { toDataURL: () => Promise.resolve('data:image/png;base64,zz') } }));

const insideMatch: MatchItem = {
  id: 'pre:v9',
  source: 'pre_approved',
  visitorName: 'Alice Johnson',
  visitorPhone: '9876543210',
  departmentName: 'Engineering',
  departmentId: 'dept1',
  purpose: 'meeting',
  hostName: 'Jane Smith',
  vendorName: 'Acme Corp',
  approvalType: 'pre_approved',
  approvedAt: '2026-08-18T03:00:00Z',
  scheduledFor: '2026-08-18T04:00:00Z',
  dueToday: true,
  status: 'checked_in',
  checkedInAt: '2026-08-18T04:05:00Z',
  checkedOutAt: null,
  visitId: 'v9',
};

const insideVisit = {
  id: 'v9',
  ref_number: 'VIS-20260818-0001',
  status: 'checked_in',
  purpose: 'meeting',
  visitor_card_number: 'C-104',
  checked_in_at: '2026-08-18T04:05:00Z',
  checked_out_at: null,
  scheduled_for: '2026-08-18T04:00:00Z',
  created_at: '2026-08-18T03:00:00Z',
  photo_data: 'data:image/png;base64,aa',
  qr_token: 'tok-1',
  visitor: {
    full_name: 'Alice Johnson',
    phone: '9876543210',
    id_type: 'aadhaar',
    vehicle_number: 'WB 01 AB 1234',
  },
} as any;

function renderPage() {
  return render(<MemoryRouter initialEntries={['/guard/scan-pass']}><ScanPass /></MemoryRouter>);
}

function search(term = 'C-104') {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: term } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
}

/** Open the row by its name — the whole card is the control, and the buttons on
 *  it stop propagation so they stay a separate gesture. */
function openRow(name = 'Alice Johnson') {
  fireEvent.click(screen.getByText(name));
}

/** 2026-08-18, 10:30 IST — inside the same IST day as `insideVisit`'s own
 *  literal stamps, and comfortably before the 22:00 close. */
const FIXED_NOW = new Date('2026-08-18T05:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  // A FIXED CLOCK, for the same reason the three PreApproveForm files and
  // visitLifecycle.test.ts carry one. The two Check In cases below need a
  // visitor whose pass is both DUE TODAY and NOT YET EXPIRED, and after 22:00
  // IST — when the IST day closes (migration 075) — no such visit exists at
  // any date: today's slot has expired and tomorrow's is not due. Built against
  // a real `now`, those two tests therefore passed all day and failed every
  // night, which is worse than failing outright because it looks like a flake.
  // `shouldAdvanceTime` keeps findBy*/waitFor working — they are timer-driven,
  // and a frozen clock hangs them until they time out.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
  historyMatches.current = [insideMatch];
  mockFetchVisitById.mockResolvedValue(insideVisit);
  mockFetchVisitForExit.mockResolvedValue(insideVisit);
  mockLogVisitExit.mockResolvedValue({ ok: true });
});

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Find & Scan: opening a search hit', () => {
  it('renders the Entry & Exit frame — identity, the three steps, the vehicle and the pass', async () => {
    renderPage();
    search();
    openRow();

    expect(await screen.findByText('Identity verified')).toBeInTheDocument();
    for (const step of ['Photo', 'ID Scan', 'Host Notified']) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(screen.getByText('Vehicle')).toBeInTheDocument();
    expect(screen.getByText('WB 01 AB 1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print badge/i })).toBeInTheDocument();
  });

  // Re-read at the press, never the list's copy: another device may have moved
  // this visitor while the results sat on screen.
  it('re-reads the visit rather than rendering the search projection', async () => {
    renderPage();
    search();
    openRow();
    await waitFor(() => expect(mockFetchVisitById).toHaveBeenCalledWith('v9'));
  });

  it('offers Check Out on the open record of a visitor who is inside', async () => {
    renderPage();
    search();
    openRow();

    const buttons = await screen.findAllByRole('button', { name: 'Check Out' });
    expect(buttons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Check In' })).toBeNull();
  });

  // The exit is the same dialog and the same write as everywhere else — the
  // open record does not get its own shortcut past the card-return gate.
  it('routes Check Out through the card-return dialog and the shared write', async () => {
    renderPage();
    search();
    openRow();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Check Out' }))[0]);
    expect(await screen.findByText('Confirm check-out')).toBeInTheDocument();
    expect(mockLogVisitExit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/card/i, { selector: 'input[type="checkbox"]' }));
    fireEvent.click(screen.getByRole('button', { name: /complete check out/i }));
    await waitFor(() => expect(mockLogVisitExit).toHaveBeenCalledWith(insideVisit));
  });

  // The other half of the rule, and the reason Check In is on the rail at all:
  // this surface can reach a visitor who has not come through the gate yet.
  it('offers Check In on the open record of a cleared visitor who is still outside', async () => {
    historyMatches.current = [{ ...insideMatch, status: 'approved', checkedInAt: null }];
    mockFetchVisitById.mockResolvedValue({
      ...insideVisit,
      status: 'approved',
      checked_in_at: null,
      photo_data: null,
      scheduled_for: new Date().toISOString(),
    });
    renderPage();
    search();
    openRow();

    expect((await screen.findAllByRole('button', { name: 'Check In' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Check Out' })).toBeNull();
  });

  // Check In on the record must not be a shortcut past the identity step: it
  // hands the guard to the one flow that collects the photo, the mandatory ID
  // scan and the visitor card number.
  it('sends Check In into the photo and ID step rather than writing', async () => {
    historyMatches.current = [{ ...insideMatch, status: 'approved', checkedInAt: null }];
    mockFetchVisitById.mockResolvedValue({
      ...insideVisit,
      status: 'approved',
      checked_in_at: null,
      photo_data: null,
      scheduled_for: new Date().toISOString(),
    });
    renderPage();
    search();
    openRow();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Check In' }))[0]);
    // The step that opens is the IDENTITY one — the scan is mandatory and the
    // card number is demanded further down the same flow. What matters here is
    // that pressing Check In lands in that flow rather than writing anything.
    expect(await screen.findByText(/cannot be checked in until their ID card has been scanned/i))
      .toBeInTheDocument();
  });

  // A closed pass still opens. This is the commonest card-number question of
  // all — where did C-104 go? — and it carries no button.
  it('opens a closed pass fully, with neither button on it', async () => {
    historyMatches.current = [{ ...insideMatch, status: 'checked_out', checkedOutAt: '2026-08-18T09:00:00Z' }];
    mockFetchVisitById.mockResolvedValue({
      ...insideVisit,
      status: 'checked_out',
      checked_out_at: '2026-08-18T09:00:00Z',
    });
    renderPage();
    search();
    openRow();

    expect(await screen.findByText('Vehicle')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check In' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Out' })).toBeNull();
  });

  it('returns to the results without acting', async () => {
    renderPage();
    search();
    openRow();

    fireEvent.click(await screen.findByRole('button', { name: 'Back to results' }));
    await waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument());
    expect(mockLogVisitExit).not.toHaveBeenCalled();
  });
});
