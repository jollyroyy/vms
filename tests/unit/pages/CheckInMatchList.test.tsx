import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckInMatchList from '../../../src/pages/Guard/CheckInMatchList';
import { formatDateTime, formatTime } from '../../../src/lib/formatDate';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(() => cleanup());

// The empty state routes to the Register Walk-in tab with a <Link>, so every
// render of this component needs a router around it.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

// Text like "Person to Meet: Alex Host" is split across a parent node and a
// nested <span> for the bolded value — getByText's default matcher only
// looks at direct text-node children, so an exact-textContent function
// matcher is needed here instead of a plain string/regex.
function fullText(text: string) {
  return (_content: string, node: Element | null) => node?.textContent === text;
}

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
    // Default true so every pre-existing test — written before searching
    // spanned every open approval — keeps exercising the checkable-in path
    // it always meant to, without having to name `dueToday` everywhere.
    dueToday: true,
    visitId: '1',
    // Default to a checkable status so every pre-existing test — written
    // before m.status existed — keeps exercising the checkable-in path it
    // always meant to, without having to name `status` everywhere.
    status: 'approved',
    ...overrides,
  };
}

// A search that finds nothing means there is no pass — but there may well be a
// visitor at the gate. The register is its own destination now, so the empty
// state ROUTES there rather than unfolding a second copy of the walk-in form
// inside a search result.
describe('CheckInMatchList — no match routes to the Register Walk-in tab', () => {
  it('links to /guard/walk-in when a search returns nothing', () => {
    render(<CheckInMatchList {...baseProps({ allMatches: [] })} />);
    const link = screen.getByRole('link', { name: /register walk-in visitor/i });
    expect(link).toHaveAttribute('href', '/guard/walk-in');
  });

  it('renders no walk-in form inline in the empty state', () => {
    render(<CheckInMatchList {...baseProps({ allMatches: [] })} />);
    expect(screen.getByText('No match found')).toBeInTheDocument();
    expect(screen.queryByLabelText(/remarks/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send approval request/i })).not.toBeInTheDocument();
  });

  it('shows no walk-in route at all before the guard has searched', () => {
    render(<CheckInMatchList {...baseProps({ search: '', allMatches: [] })} />);
    expect(screen.getByText('Search for a visitor')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /register walk-in/i })).not.toBeInTheDocument();
  });
});

describe('CheckInMatchList — host name and vendor name', () => {
  it('shows the host name and vendor name on a pre-approved visitor card', () => {
    render(<CheckInMatchList {...baseProps({
      // departmentName cleared so the assertion below stays an exact match on
      // the host line alone — its own department-under-name behaviour is
      // covered separately.
      allMatches: [match({ hostName: 'Alex Host', vendorName: 'Acme Corp', departmentName: '' })],
    })} />);
    expect(screen.getAllByText(fullText('Person to Meet: Alex Host')).length).toBeGreaterThan(0);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows only the host name when no vendor name is present', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: 'Alex Host', vendorName: '', departmentName: '' })],
    })} />);
    expect(screen.getAllByText(fullText('Person to Meet: Alex Host')).length).toBeGreaterThan(0);
  });

  it('shows the department directly beneath the host name when both are present', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: 'Alex Host', departmentName: 'Engineering' })],
    })} />);
    expect(screen.getAllByText(fullText('Person to Meet: Alex HostEngineering')).length).toBeGreaterThan(0);
  });

  it('renders no host/vendor name line when both are absent', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ hostName: '', vendorName: '' })],
    })} />);
    expect(screen.queryByText(/Person to Meet:/)).not.toBeInTheDocument();
  });
});

describe('CheckInMatchList — pre-approved vs walk-in-approved segregation', () => {
  it('labels a pre-approved visit as Pre-Approved', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ approvalType: 'pre_approved' })],
    })} />);
    expect(screen.getByText('Pre-Approved')).toBeInTheDocument();
    expect(screen.queryByText('Walk-in Approved')).not.toBeInTheDocument();
  });

  it('labels a walk-in-approved visit as Walk-in Approved, distinct from Pre-Approved', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ id: 'pre:2', approvalType: 'walkin_approved' })],
    })} />);
    expect(screen.getByText('Walk-in Approved')).toBeInTheDocument();
    expect(screen.queryByText('Pre-Approved')).not.toBeInTheDocument();
  });

  it('labels a recurring visit as Regular', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ id: 'rec:1', source: 'recurring', approvalType: 'recurring' })],
    })} />);
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });
});

describe('CheckInMatchList — exact approval date and time', () => {
  it('shows the formatted approval timestamp for a pre-approved visit', () => {
    const approvedAt = '2026-07-30T10:15:00Z';
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ approvalType: 'pre_approved', approvedAt })],
    })} />);
    expect(screen.getByText(new RegExp(formatDateTime(approvedAt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('shows the formatted approval timestamp for a walk-in-approved visit', () => {
    const approvedAt = '2026-07-30T14:42:00Z';
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ approvalType: 'walkin_approved', approvedAt })],
    })} />);
    expect(screen.getByText(new RegExp(formatDateTime(approvedAt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });

  it('renders no approval timestamp line for a recurring visit', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ id: 'rec:1', source: 'recurring', approvalType: 'recurring', approvedAt: null })],
    })} />);
    expect(screen.queryByText(/on \d/)).not.toBeInTheDocument();
  });
});

describe('CheckInMatchList — expected arrival time', () => {
  // Date AND time, even for a match due today (client instruction,
  // 2026-08-13). The card used to switch formats on dueToday; it no longer
  // does, so a guard never has to notice which format they were given.
  it('shows the scheduled arrival date and time when one was set', () => {
    const scheduledFor = '2026-07-30T09:30:00Z';
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ scheduledFor })],
    })} />);
    expect(screen.getByText(formatDateTime(scheduledFor))).toBeInTheDocument();
    expect(screen.queryByText(formatTime(scheduledFor))).toBeNull();
  });

  it('falls back to "Anytime today" when no arrival time was scheduled', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ scheduledFor: null })],
    })} />);
    expect(screen.getByText('Anytime today')).toBeInTheDocument();
  });
});

// Searching now spans every open pre-approval, not just today's (see the doc
// comment above `buildMatchItems` in checkInMatches.ts) — the live database
// had only future-dated approvals, so the today-only searchable set was
// empty and a guard searching for a visitor holding a valid pass got "No
// match found". That means "findable by search" and "checkable-in" are now
// two different things: a `dueToday: false` row must still render (so the
// guard can see the pass exists and read its date) but must be disabled,
// with no Check In button and no click-through to onSelectMatch.
describe('CheckInMatchList — dueToday disables check-in without hiding the row', () => {
  it('renders a "Not due today" badge for a match not due today', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ dueToday: false, scheduledFor: '2026-08-15T09:30:00Z' })],
    })} />);
    expect(screen.getByText('Not due today')).toBeInTheDocument();
  });

  it('renders no Check In button for a match not due today', () => {
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ dueToday: false, scheduledFor: '2026-08-15T09:30:00Z' })],
    })} />);
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('does not call onSelectMatch when clicking a row not due today', () => {
    const onSelectMatch = vi.fn();
    const { container } = render(<CheckInMatchList {...baseProps({
      allMatches: [match({ dueToday: false, scheduledFor: '2026-08-15T09:30:00Z' })],
      onSelectMatch,
    })} />);
    fireEvent.click(container.querySelector('.pointer-events-none')!);
    expect(onSelectMatch).not.toHaveBeenCalled();
  });

  it('renders a Check In button for a match due today and calls onSelectMatch when clicked', () => {
    const onSelectMatch = vi.fn();
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ dueToday: true })],
      onSelectMatch,
    })} />);
    const button = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(button);
    expect(onSelectMatch).toHaveBeenCalledTimes(1);
  });

  it('shows the scheduled DATE, not just a time, for a match not due today', () => {
    const scheduledFor = '2026-08-15T09:30:00Z';
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ dueToday: false, scheduledFor })],
    })} />);
    // formatDateTime includes the day/month/year alongside the time (e.g.
    // "15 Aug 2026, 03:00 pm") — assert against its real output rather than
    // a guessed string, and keep the match resilient to locale punctuation.
    const expected = formatDateTime(scheduledFor);
    const datePortion = expected.split(',')[0];
    expect(screen.getByText(new RegExp(datePortion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });
});
