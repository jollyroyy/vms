import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScanPass from '../../../src/pages/Guard/ScanPass';
import type { MatchItem } from '../../../src/pages/Guard/checkInTypes';

// FIND & SCAN GIVES ONE RECORD ONE BUTTON (client instruction, 2026-08-17/18).
//
// A guard who has just found somebody has exactly one thing to do about them:
// let them in, or let them out. Before this the surface could only ever offer
// Check In — a visitor already inside came back as a legible but inert row, and
// the guard had to leave for Entry & Exit to do the obvious thing. That was the
// tab-hopping this consolidation exists to end, and it is what makes the
// card-number search worth having: the number is read off the card in the
// visitor's hand, and the person holding a card is by definition inside.
//
// The exit itself is NOT reimplemented here. It is the same CardReturnConfirm
// and the same `logVisitExit` Entry & Exit uses, so the two surfaces cannot
// disagree about whether a human witnessed the departure or the card came back.

const { mockFetchVisitForExit, mockLogVisitExit, historyMatches } = vi.hoisted(() => ({
  mockFetchVisitForExit: vi.fn(),
  mockLogVisitExit: vi.fn(),
  historyMatches: { current: [] as MatchItem[] },
}));

vi.mock('../../../src/lib/checkInFlow', () => ({ checkInScannedVisit: vi.fn() }));
vi.mock('../../../src/lib/hostNames', () => ({ attachHostNames: (rows: any[]) => Promise.resolve(rows) }));
vi.mock('../../../src/lib/checkOutFlow', () => ({
  fetchVisitForExit: mockFetchVisitForExit,
  logVisitExit: mockLogVisitExit,
}));
vi.mock('../../../src/lib/useVisitHistorySearch', () => ({
  useVisitHistorySearch: () => ({ historyMatches: historyMatches.current, searching: false }),
}));
vi.mock('../../../src/pages/Guard/GuardQRScan', () => ({ default: () => <p>QR SCANNER STUB</p> }));

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
  approvedAt: '2026-08-17T03:00:00Z',
  scheduledFor: '2026-08-17T04:00:00Z',
  dueToday: true,
  status: 'checked_in',
  checkedInAt: '2026-08-17T04:05:00Z',
  checkedOutAt: null,
  visitId: 'v9',
};

const insideVisit = {
  id: 'v9',
  status: 'checked_in',
  visitor_card_number: 'C-104',
  visitor: { full_name: 'Alice Johnson' },
} as any;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/guard/scan-pass']}><ScanPass /></MemoryRouter>,
  );
}

/** The box is submitted, not typed-into-the-void — Enter or Search moves the
 *  input into the query the results hang off. */
function search(term = 'C-104') {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: term } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  historyMatches.current = [insideMatch];
  mockFetchVisitForExit.mockResolvedValue(insideVisit);
  mockLogVisitExit.mockResolvedValue({ ok: true });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Find & Scan: checking a visitor out from a search hit', () => {
  it('offers Check Out — and not Check In — for a visitor who is inside', () => {
    renderPage();
    search();
    expect(screen.getByRole('button', { name: 'Check Out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check In' })).toBeNull();
  });

  // The card-return gate is not optional and is not reimplemented: pressing
  // Check Out opens the same dialog Entry & Exit opens, and nothing is written
  // until the guard ticks it.
  it('opens the card-return dialog and writes nothing until it is confirmed', async () => {
    renderPage();
    search();
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));

    expect(await screen.findByText('Confirm check-out')).toBeInTheDocument();
    // The number the guard has to collect, printed off the real visit row.
    expect(screen.getByText('C-104')).toBeInTheDocument();
    expect(mockLogVisitExit).not.toHaveBeenCalled();
  });

  // The visit is RE-READ at the press, never taken from the list's copy:
  // another device may have checked them out while the results sat on screen,
  // and the dialog must not offer to collect a card that already came back.
  it('re-reads the visit and refuses when it is no longer inside', async () => {
    mockFetchVisitForExit.mockResolvedValue({ ...insideVisit, status: 'checked_out' });
    renderPage();
    search();
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));

    expect(await screen.findByText(/already been checked out/i)).toBeInTheDocument();
    expect(screen.queryByText('Confirm check-out')).toBeNull();
    expect(mockLogVisitExit).not.toHaveBeenCalled();
  });

  it('logs the exit through the shared write and says who left', async () => {
    renderPage();
    search();
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));
    fireEvent.click(await screen.findByLabelText(/card/i, { selector: 'input[type="checkbox"]' }));
    fireEvent.click(screen.getByRole('button', { name: /complete check out/i }));

    await waitFor(() => expect(mockLogVisitExit).toHaveBeenCalledWith(insideVisit));
    expect(await screen.findByText(/"Alice Johnson" checked out successfully\./)).toBeInTheDocument();
  });

  it('reports a failed exit instead of claiming the visitor left', async () => {
    mockLogVisitExit.mockResolvedValue({ ok: false, message: 'Failed to log exit.' });
    renderPage();
    search();
    fireEvent.click(screen.getByRole('button', { name: 'Check Out' }));
    fireEvent.click(await screen.findByLabelText(/card/i, { selector: 'input[type="checkbox"]' }));
    fireEvent.click(screen.getByRole('button', { name: /complete check out/i }));

    expect(await screen.findByText('Failed to log exit.')).toBeInTheDocument();
    expect(screen.queryByText(/checked out successfully/)).toBeNull();
  });

  // A cleared, not-yet-arrived visitor keeps the other half of the rule.
  it('offers Check In — and not Check Out — for a visitor who is still outside', () => {
    historyMatches.current = [{ ...insideMatch, status: 'approved', checkedInAt: null }];
    renderPage();
    search();
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check Out' })).toBeNull();
  });

  // A closed pass is still fully legible and still carries no action: seeing a
  // pass and being allowed to honour it are different permissions.
  it('offers neither button for a pass that is already closed', () => {
    historyMatches.current = [{ ...insideMatch, status: 'checked_out', checkedOutAt: '2026-08-17T10:00:00Z' }];
    renderPage();
    search();
    expect(screen.queryByRole('button', { name: 'Check In' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Out' })).toBeNull();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
  });
});
