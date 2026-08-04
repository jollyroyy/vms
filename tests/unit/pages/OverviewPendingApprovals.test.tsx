// The HOD's decision surface for walk-in requests, now rendered on the
// Overview above OverviewOnSite. Covers: heading + waiting count, visitor
// name render, the "render nothing" empty state, and that Approve wires
// through to onDecide(id, true).
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import OverviewPendingApprovals from '../../../src/pages/HOD/OverviewPendingApprovals';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/components/VisitorDetails', () => ({
  default: () => <div data-testid="visitor-details" />,
}));

afterEach(cleanup);

const mockVisit: Visit = {
  id: 'v1',
  ref_number: 'VIS-001',
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
  visitor: {
    id: 'vis1',
    phone: '9876543210',
    full_name: 'Test Visitor',
    vendor_name: 'Test Corp',
    id_type: null,
    id_last4: null,
    vehicle_number: null,
    is_blacklisted: false,
    blacklist_reason: null,
    created_at: new Date().toISOString(),
  },
  department: { id: 'dept1', name: 'IT', code: 'IT', created_at: new Date().toISOString() },
  host: { id: 'h1', full_name: 'Test Host' },
};

const baseProps = {
  loading: false,
  acting: null,
  reasons: {},
  onReasonChange: vi.fn(),
  onDecide: vi.fn(),
};

describe('OverviewPendingApprovals', () => {
  it('renders the "Pending Walk-in Approvals" heading and the waiting count', () => {
    render(<OverviewPendingApprovals {...baseProps} visits={[mockVisit]} />);
    expect(screen.getByText('Pending Walk-in Approvals')).toBeInTheDocument();
    expect(screen.getByText('1 waiting')).toBeInTheDocument();
  });

  it("renders the visitor's name", () => {
    render(<OverviewPendingApprovals {...baseProps} visits={[mockVisit]} />);
    expect(screen.getByText('Test Visitor')).toBeInTheDocument();
  });

  it('renders nothing at all when visits is empty and loading is false', () => {
    const { container } = render(<OverviewPendingApprovals {...baseProps} visits={[]} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onDecide with (id, true) when Approve is clicked', () => {
    const onDecide = vi.fn();
    render(<OverviewPendingApprovals {...baseProps} visits={[mockVisit]} onDecide={onDecide} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(onDecide).toHaveBeenCalledWith('v1', true);
  });
});
