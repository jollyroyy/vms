import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Visit } from '../../../src/types/index';
import ApprovalsVisitList from '../../../src/pages/HOD/ApprovalsVisitList';

afterEach(cleanup);

const makeVisit = (overrides: Record<string, unknown> = {}): Visit => ({
  id: 'v1',
  ref_number: 'VIS-400',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'walkin_approved',
  checked_in_at: new Date().toISOString(),
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  created_at: new Date().toISOString(),
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Approved Visitor', company: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
  host: { id: 'h1', full_name: 'Dr. Sharma' },
  ...overrides,
}) as Visit;

const baseProps = {
  loading: false,
  acting: null as string | null,
  onViewDetails: vi.fn(),
};

describe('ApprovalsVisitList — loading', () => {
  it('shows "Loading..." while loading, regardless of mode', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[]} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('ApprovalsVisitList — approved mode', () => {
  it('shows the approved empty state when there are no approved visits', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[]} />);
    expect(screen.getByText('No approved visitors')).toBeInTheDocument();
    expect(screen.getByText('Approved visitors will appear here')).toBeInTheDocument();
  });

  it('renders visitor name, status label, purpose, host, ref number and count', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} />);
    expect(screen.getByText('Approved Visitor')).toBeInTheDocument();
    expect(screen.getByText('Walk-in')).toBeInTheDocument(); // STATUS_STYLES.walkin_approved.label
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sharma')).toBeInTheDocument();
    expect(screen.getByText('VIS-400')).toBeInTheDocument();
    expect(screen.getByText('1 Approved')).toBeInTheDocument();
    expect(screen.queryByText('No approved visitors')).not.toBeInTheDocument();
  });

  it('does not render a Cancel button when onCancel is not provided', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} />);
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('does not render a Clear All button when onClearAll is not provided', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} />);
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });

  it('calls onViewDetails with the visit when the card is clicked', () => {
    const onViewDetails = vi.fn();
    const visit = makeVisit();
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[visit]} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Approved Visitor'));
    expect(onViewDetails).toHaveBeenCalledWith(visit);
  });

  it('calls onCancel with the visit id and does not also trigger onViewDetails', () => {
    const onCancel = vi.fn();
    const onViewDetails = vi.fn();
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} onCancel={onCancel} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledWith('v1');
    expect(onViewDetails).not.toHaveBeenCalled();
  });

  it('calls onClearAll when Clear All is clicked', () => {
    const onClearAll = vi.fn();
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText('Clear All'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('disables Clear All while a clear-all action is in flight', () => {
    render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[makeVisit()]} onClearAll={vi.fn()} acting="clear-all" />);
    expect(screen.getByText('Clear All').closest('button')).toBeDisabled();
  });

  it('falls back gracefully when visitor and host are missing', () => {
    const bare = makeVisit({ visitor: undefined, host: undefined });
    expect(() => render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[bare]} />)).not.toThrow();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('falls back to the raw status string rather than crashing for an unmapped status', () => {
    const weird = makeVisit({ status: 'some_future_status' as unknown as Visit['status'] });
    expect(() => render(<ApprovalsVisitList {...baseProps} mode="approved" visits={[weird]} />)).not.toThrow();
    expect(screen.getByText('some_future_status')).toBeInTheDocument();
  });
});

describe('ApprovalsVisitList — rejected mode', () => {
  const rejectedVisit = (overrides: Record<string, unknown> = {}) =>
    makeVisit({
      id: 'r1', status: 'rejected', rejection_reason: 'Not on the approved list',
      visitor: { id: 'vis2', phone: '9111111111', full_name: 'Rejected Visitor', company: 'Beta Inc', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
      ...overrides,
    });

  it('shows the rejected empty state when there are no rejected visits', () => {
    render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[]} />);
    expect(screen.getByText('No rejected visitors')).toBeInTheDocument();
    expect(screen.getByText('Rejected visitors will appear here')).toBeInTheDocument();
  });

  it('renders visitor name, company/host line, ref number and the rejection reason', () => {
    render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[rejectedVisit()]} />);
    expect(screen.getByText('Rejected Visitor')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Beta Inc/)).toBeInTheDocument();
    expect(screen.getByText('VIS-400')).toBeInTheDocument();
    expect(screen.getByText('Not on the approved list')).toBeInTheDocument();
    expect(screen.queryByText('No rejected visitors')).not.toBeInTheDocument();
  });

  it('does not render a rejection-reason box when rejection_reason is null', () => {
    const noReason = rejectedVisit({ rejection_reason: null });
    render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[noReason]} />);
    expect(screen.getByText('Rejected Visitor')).toBeInTheDocument();
    expect(screen.queryByText('Not on the approved list')).not.toBeInTheDocument();
  });

  it('calls onViewDetails when a rejected card is clicked', () => {
    const onViewDetails = vi.fn();
    const visit = rejectedVisit();
    render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[visit]} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Rejected Visitor'));
    expect(onViewDetails).toHaveBeenCalledWith(visit);
  });

  it('falls back gracefully when visitor and host are missing in rejected mode', () => {
    const bare = rejectedVisit({ visitor: undefined, host: undefined });
    expect(() => render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[bare]} />)).not.toThrow();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('does not crash on a very long rejection reason and still renders it', () => {
    const longReason = 'X'.repeat(400);
    const visit = rejectedVisit({ rejection_reason: longReason });
    expect(() => render(<ApprovalsVisitList {...baseProps} mode="rejected" visits={[visit]} />)).not.toThrow();
    expect(screen.getByText(longReason)).toBeInTheDocument();
  });
});
