// New component (src/pages/Guard/CheckInVisitorSummary.tsx). It is only ever
// rendered inside CheckInPhotoStep when photoBlob is null (the pre-photo
// step) — CheckInPhotoStepCarrying.test.tsx and CheckInPhotoStepScan.test.tsx
// both always supply a non-null photoBlob, so this component has never
// actually been rendered anywhere in the suite. Tested directly here.
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CheckInVisitorSummary from '../../../src/pages/Guard/CheckInVisitorSummary';
import { formatDateTime, formatTime } from '../../../src/lib/formatDate';
import type { MatchItem } from '../../../src/pages/Guard/CheckInPanel';

afterEach(cleanup);

function match(overrides: Partial<MatchItem> = {}): MatchItem {
  return {
    id: 'pre:v1',
    source: 'pre_approved',
    visitorName: 'Rahul Verma',
    visitorPhone: '9876543210',
    departmentName: 'Information Technology',
    purpose: 'meeting',
    hostName: 'Priya Sharma',
    vendorName: 'Acme',
    approvalType: 'pre_approved',
    approvedAt: '2026-08-01T08:00:00Z',
    scheduledFor: null,
    visitId: 'v1',
    ...overrides,
  };
}

describe('CheckInVisitorSummary', () => {
  it('renders the identity, department, purpose and host', () => {
    render(<CheckInVisitorSummary match={match()} />);
    expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(screen.getByText('meeting')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });

  // The one field every check-in path passes through (client instruction,
  // 2026-08-16). This summary is rendered by CheckInPhotoStep, which serves the
  // pre-approvals desk, the scan desk, the walk-in desk and the dashboard's
  // Verify ID modal — so labelling it here answers "walk-in or pre-approved?"
  // on every check-in there is, in the same words the dashboard column uses.
  it.each([
    ['pre_approved', 'Pre-approved'],
    ['walk_in', 'Walk-in'],
    ['recurring', 'Regular visitor'],
  ] as const)('names the "%s" type of visitor as "%s"', (approvalType, label) => {
    render(<CheckInVisitorSummary match={match({ approvalType })} />);
    expect(screen.getByText('Type of Visitor')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the exact approval timestamp when approvedAt is set', () => {
    render(<CheckInVisitorSummary match={match({ approvalType: 'pre_approved', approvedAt: '2026-08-01T08:00:00Z' })} />);
    expect(screen.getByText('Approved at')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-08-01T08:00:00Z'))).toBeInTheDocument();
  });

  it('omits the approval-timestamp row entirely when approvedAt is null', () => {
    render(<CheckInVisitorSummary match={match({ approvedAt: null })} />);
    expect(screen.queryByText('Approved at')).not.toBeInTheDocument();
  });

  // Date AND time (client instruction, 2026-08-13): an open pre-approval can be
  // booked for any day, so a bare clock reading says when but not whether that
  // when is now.
  it('shows the formatted scheduled date and time when scheduledFor is set', () => {
    render(<CheckInVisitorSummary match={match({ scheduledFor: '2026-08-01T09:30:00Z' })} />);
    expect(screen.getByText(formatDateTime('2026-08-01T09:30:00Z'))).toBeInTheDocument();
    expect(screen.queryByText(formatTime('2026-08-01T09:30:00Z'))).toBeNull();
  });

  it('shows "Anytime today" when scheduledFor is null', () => {
    render(<CheckInVisitorSummary match={match({ scheduledFor: null })} />);
    expect(screen.getByText('Anytime today')).toBeInTheDocument();
  });

  it('renders the ref number when present', () => {
    render(<CheckInVisitorSummary match={match({ refNumber: 'VIS-042' })} />);
    expect(screen.getByText('VIS-042')).toBeInTheDocument();
  });

  it('omits the ref number when absent', () => {
    render(<CheckInVisitorSummary match={match({ refNumber: undefined })} />);
    expect(screen.queryByText(/^VIS-/)).not.toBeInTheDocument();
  });

  it('falls back to an em dash for a blank host', () => {
    render(<CheckInVisitorSummary match={match({ hostName: '' })} />);
    const hostDt = screen.getByText('Person to Meet');
    expect(hostDt.nextElementSibling?.textContent).toBe('—');
  });
});
