import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckInMatchList from '../../../src/pages/Guard/CheckInMatchList';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(() => cleanup());

// The empty state routes to the Register Walk-in tab with a <Link>.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

function baseProps(overrides: Partial<React.ComponentProps<typeof CheckInMatchList>> = {}) {
  return {
    error: '',
    search: 'jane',
    onSearchChange: vi.fn(),
    deptFilter: '',
    onDeptFilterChange: vi.fn(),
    departments: [],
    loading: false,
    allMatches: [],
    preApproved: [],
    checkedInIds: new Set<string>(),
    isExpired: () => false,
    onSelectMatch: vi.fn(),
    ...overrides,
  };
}

function match(overrides: Partial<MatchItem> = {}): MatchItem {
  return {
    id: 'pre:1',
    source: 'pre_approved',
    visitorName: 'Jane Doe',
    visitorPhone: '9999999999',
    departmentName: 'Engineering',
    purpose: 'meeting',
    hostName: '',
    vendorName: '',
    approvalType: 'pre_approved',
    approvedAt: null,
    scheduledFor: null,
    dueToday: true,
    visitId: '1',
    status: 'approved',
    ...overrides,
  };
}

// Searching now spans every open pass regardless of state (see the doc
// comment on isCheckableStatus, src/lib/checkableStatus.ts), so a search hit
// can be closed — checked_out, rejected, cancelled, no_show, expired — and
// those rows must render clearly labelled and must never be checkable-in,
// distinct from the pre-existing dueToday-only describe block above.
describe('CheckInMatchList — closed-status matches are labelled and not checkable', () => {
  it('renders a "Checked Out" badge and no Check In button for a checked_out match', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'checked_out' })],
    })} />);
    expect(screen.getByText('Checked Out')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('does not call onSelectMatch when clicking a checked_out match', () => {
    const onSelectMatch = vi.fn();
    const { container } = render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'checked_out' })],
      onSelectMatch,
    })} />);
    fireEvent.click(container.querySelector('.pointer-events-none')!);
    expect(onSelectMatch).not.toHaveBeenCalled();
  });

  it('renders a "Rejected" badge and no Check In button for a rejected match', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'rejected' })],
    })} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('does not call onSelectMatch when clicking a rejected match', () => {
    const onSelectMatch = vi.fn();
    const { container } = render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'rejected' })],
      onSelectMatch,
    })} />);
    fireEvent.click(container.querySelector('.pointer-events-none')!);
    expect(onSelectMatch).not.toHaveBeenCalled();
  });

  // The exact hole isCheckableStatus closes: dueToday alone says "act now",
  // but a rejected visit has no checked_in_at so isDueToday can still be
  // true for it. Status must veto dueToday, not the other way round.
  it('a rejected match with dueToday true is still not checkable', () => {
    const onSelectMatch = vi.fn();
    const { container } = render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'rejected', dueToday: true })],
      onSelectMatch,
    })} />);
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('.pointer-events-none')!);
    expect(onSelectMatch).not.toHaveBeenCalled();
  });

  it('an approved match due today IS checkable and fires onSelectMatch', () => {
    const onSelectMatch = vi.fn();
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ status: 'approved', dueToday: true })],
      onSelectMatch,
    })} />);
    const button = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(button);
    expect(onSelectMatch).toHaveBeenCalledTimes(1);
  });
});
