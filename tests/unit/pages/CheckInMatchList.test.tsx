import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CheckInMatchList from '../../../src/pages/Guard/CheckInMatchList';
import { formatDateTime, formatTime } from '../../../src/lib/formatDate';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(() => cleanup());

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
    showWalkIn: false,
    onShowWalkIn: vi.fn(),
    onWalkInSubmitted: vi.fn(),
    onWalkInCancel: vi.fn(),
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
    ...overrides,
  };
}

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
  it('shows the scheduled arrival time when one was set', () => {
    const scheduledFor = '2026-07-30T09:30:00Z';
    render(<CheckInMatchList {...baseProps({
      allMatches: [match({ scheduledFor })],
    })} />);
    expect(screen.getByText(formatTime(scheduledFor))).toBeInTheDocument();
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
