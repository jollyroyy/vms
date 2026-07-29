import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Visit } from '../../../src/types/index';
import ApprovalsPendingList from '../../../src/pages/HOD/ApprovalsPendingList';

afterEach(cleanup);

const pendingVisit = (overrides: Record<string, unknown> = {}): Visit => ({
  id: 'v1',
  ref_number: 'VIS-300',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'pending_approval',
  checked_in_at: null,
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  created_at: new Date().toISOString(),
  visitor: { id: 'vis1', phone: '9876543210', full_name: 'Pending Visitor', company: 'Acme Co', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
  host: { id: 'h1', full_name: 'Dr. Sharma' },
  ...overrides,
}) as Visit;

const baseProps = {
  loading: false,
  error: '',
  acting: null as string | null,
  reasons: {} as Record<string, string>,
  onReasonChange: vi.fn(),
  onDecide: vi.fn(),
  onViewDetails: vi.fn(),
};

describe('ApprovalsPendingList', () => {
  it('renders skeleton placeholders while loading and hides the empty state', () => {
    const { container } = render(<ApprovalsPendingList {...baseProps} visits={[]} loading={true} />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
  });

  it('shows the "All caught up" empty state when there are no pending visits and no error', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[]} />);
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.getByText('No pending approvals right now')).toBeInTheDocument();
  });

  it('suppresses the empty state when an error is present, even with zero visits', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[]} error="Failed to load" />);
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
  });

  it('renders visitor name, ref number, company/host line and purpose for a real row', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} />);
    expect(screen.getByText('Pending Visitor')).toBeInTheDocument();
    expect(screen.getByText('VIS-300')).toBeInTheDocument();
    expect(screen.getByText(/Acme Co/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Sharma/)).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    // Empty state must not also render once a real row is present.
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument();
  });

  it('does not show the rejection reason input until Reject is clicked', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} reasons={{ v1: 'Wrong department' }} />);
    expect(screen.queryByPlaceholderText('Rejection reason (required to reject)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Reject'));
    const input = screen.getByPlaceholderText('Rejection reason (required to reject)') as HTMLInputElement;
    expect(input.value).toBe('Wrong department');
  });

  it('calls onReasonChange with the visit id and typed value after Reject reveals the input', () => {
    const onReasonChange = vi.fn();
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} onReasonChange={onReasonChange} />);
    fireEvent.click(screen.getByText('Reject'));
    const input = screen.getByPlaceholderText('Rejection reason (required to reject)');
    fireEvent.change(input, { target: { value: 'Not on the guest list' } });
    expect(onReasonChange).toHaveBeenCalledWith('v1', 'Not on the guest list');
  });

  it('calls onDecide(id, true) when Approve is clicked', () => {
    const onDecide = vi.fn();
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} onDecide={onDecide} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDecide).toHaveBeenCalledWith('v1', true);
  });

  it('reveals the reason box on Reject click without deciding yet, then calls onDecide(id, false) on Confirm Reject', () => {
    const onDecide = vi.fn();
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} reasons={{ v1: 'Not authorized' }} onDecide={onDecide} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(onDecide).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm Reject'));
    expect(onDecide).toHaveBeenCalledWith('v1', false);
  });

  it('Confirm Reject is disabled until a reason is entered', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} reasons={{}} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByText('Confirm Reject').closest('button')).toBeDisabled();
  });

  it('Cancel inside the reject box collapses it without calling onDecide', () => {
    const onDecide = vi.fn();
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} reasons={{ v1: 'x' }} onDecide={onDecide} />);
    fireEvent.click(screen.getByText('Reject'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Rejection reason (required to reject)')).not.toBeInTheDocument();
  });

  it('shows the visitor phone number', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} />);
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('calls onViewDetails with the visit when Details is clicked', () => {
    const onViewDetails = vi.fn();
    const visit = pendingVisit();
    render(<ApprovalsPendingList {...baseProps} visits={[visit]} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Details'));
    expect(onViewDetails).toHaveBeenCalledWith(visit);
  });

  it('disables Approve and Reject while this visit is the one being acted on', () => {
    render(<ApprovalsPendingList {...baseProps} visits={[pendingVisit()]} acting="v1" />);
    expect(screen.getByText('Approve').closest('button')).toBeDisabled();
    expect(screen.getByText('Reject').closest('button')).toBeDisabled();
  });

  it('falls back gracefully when visitor and host are missing', () => {
    const bare = pendingVisit({ visitor: undefined, host: undefined });
    expect(() => render(<ApprovalsPendingList {...baseProps} visits={[bare]} />)).not.toThrow();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('handles multiple rows and routes callbacks to the correct row', () => {
    const onDecide = vi.fn();
    const v1 = pendingVisit({ id: 'first', ref_number: 'VIS-1' });
    const v2 = pendingVisit({
      id: 'second', ref_number: 'VIS-2',
      visitor: { id: 'vis2', phone: '9000000000', full_name: 'Second Visitor', company: null, id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: new Date().toISOString() },
    });
    render(<ApprovalsPendingList {...baseProps} visits={[v1, v2]} onDecide={onDecide} />);
    const approveButtons = screen.getAllByText('Approve');
    expect(approveButtons.length).toBe(2);
    fireEvent.click(approveButtons[1]);
    expect(onDecide).toHaveBeenCalledWith('second', true);
    expect(onDecide).not.toHaveBeenCalledWith('first', true);
  });
});
