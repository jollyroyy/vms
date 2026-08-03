import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import OverviewFilteredView from '../../../src/pages/HOD/OverviewFilteredView';
import type { Visit } from '../../../src/types/index';

vi.mock('../../../src/components/VisitorDetails', () => ({
  default: ({ visit, onClose, onApprove, onReject, onCancel }: any) => (
    <div data-testid="visitor-details">
      Details for {visit.visitor?.full_name}
      <button onClick={onClose}>Close</button>
      {onApprove && <button onClick={onApprove}>Modal Approve</button>}
      {onReject && <button onClick={onReject}>Modal Reject</button>}
      {onCancel && <button onClick={onCancel}>Modal Cancel</button>}
    </div>
  ),
}));

vi.mock('../../../src/lib/formatDate', () => ({
  formatTime: () => '10:00 AM',
  formatDuration: () => ({ text: '30m', isOvertime: false }),
  formatElapsed: () => ({ text: '30m', isOvertime: false }),
}));

vi.mock('../../../src/lib/statusStyles', () => ({
  STATUS_STYLES: {
    pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Pending' },
    approved: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Approved' },
    walkin_approved: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Walk-in' },
    checked_in: { bg: 'bg-success-50', text: 'text-success-700', dot: 'bg-success-500', label: 'On-site' },
    checked_out: { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300', label: 'Departed' },
    rejected: { bg: 'bg-danger-50', text: 'text-danger-700', dot: 'bg-danger-500', label: 'Denied' },
    cancelled: { bg: 'bg-surface-100', text: 'text-navy-400', dot: 'bg-navy-300', label: 'Cancelled' },
    no_show: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'No Show' },
  },
}));

const baseVisit: Visit = {
  id: 'v1',
  ref_number: 'VIS-20260729-0001',
  visitor_id: 'vis1',
  department_id: 'dept1',
  host_id: 'h1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'checked_in',
  checked_in_at: '2026-07-29T10:00:00Z',
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  grace_period_minutes: 30,
  created_at: '2026-07-29T09:00:00Z',
  visitor: {
    id: 'vis1',
    phone: '9999999999',
    full_name: 'John Doe',
    vendor_name: 'Acme Corp',
    id_type: null,
    id_last4: null,
    vehicle_number: null,
    is_blacklisted: false,
    blacklist_reason: null,
    created_at: '2026-07-29T09:00:00Z',
  },
  department: { id: 'dept1', name: 'Engineering', code: 'ENG', created_at: '2026-07-29T09:00:00Z' },
  host: { id: 'h1', full_name: 'Jane Smith' },
  photo_url: undefined,
};

afterEach(() => {
  cleanup();
});

describe('OverviewFilteredView', () => {
  it('renders correct title per mode', () => {
    const cases: { mode: 'inside' | 'approved' | 'pending' | 'rejected'; title: string }[] = [
      { mode: 'inside', title: 'Currently Inside' },
      { mode: 'approved', title: 'Approved Today' },
      { mode: 'pending', title: 'Pending Approval' },
      { mode: 'rejected', title: 'Rejected Today' },
    ];
    for (const { mode, title } of cases) {
      cleanup();
      render(<OverviewFilteredView mode={mode} visits={[]} loading={false} onClearFilter={vi.fn()} />);
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('shows visitor count in header', () => {
    const visits = [baseVisit, { ...baseVisit, id: 'v2' }];
    render(<OverviewFilteredView mode="inside" visits={visits} loading={false} onClearFilter={vi.fn()} />);
    expect(screen.getByText('2 visitors')).toBeInTheDocument();
  });

  it('renders premium summary card in approved mode', () => {
    render(<OverviewFilteredView mode="approved" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />);
    expect(screen.getByText("Today's Approvals")).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('visitor approved today')).toBeInTheDocument();
  });

  it('does NOT render premium card in non-approved modes', () => {
    const modes: ('inside' | 'pending' | 'rejected')[] = ['inside', 'pending', 'rejected'];
    for (const mode of modes) {
      cleanup();
      render(<OverviewFilteredView mode={mode} visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />);
      expect(screen.queryByText("Today's Approvals")).not.toBeInTheDocument();
    }
  });

  it('shows skeleton placeholders when loading', () => {
    const { container } = render(
      <OverviewFilteredView mode="approved" visits={[]} loading={true} onClearFilter={vi.fn()} />,
    );
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders empty state when no visits', () => {
    const texts: Record<string, string> = {
      inside: 'No visitors inside',
      approved: 'No approvals today',
      pending: 'No pending requests',
      rejected: 'No rejected entries',
    };
    for (const [mode, text] of Object.entries(texts)) {
      cleanup();
      render(
        <OverviewFilteredView mode={mode as 'inside' | 'approved' | 'pending' | 'rejected'} visits={[]} loading={false} onClearFilter={vi.fn()} />,
      );
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('renders visitor cards when data provided', () => {
    const visits: Visit[] = [
      baseVisit,
      {
        ...baseVisit,
        id: 'v2',
        ref_number: 'VIS-20260729-0002',
        status: 'approved',
        checked_in_at: null,
        visitor: { ...baseVisit.visitor!, id: 'vis2', full_name: 'Alice Wonder', vendor_name: 'Beta Inc' },
      },
    ];
    render(<OverviewFilteredView mode="inside" visits={visits} loading={false} onClearFilter={vi.fn()} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
    expect(screen.getByText('On-site')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('clicking visitor card opens details modal', () => {
    render(<OverviewFilteredView mode="inside" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />);
    fireEvent.click(screen.getByText('John Doe'));
    expect(screen.getByTestId('visitor-details')).toBeInTheDocument();
    expect(screen.getByText('Details for John Doe')).toBeInTheDocument();
  });

  it('"Back to overview" button calls onClearFilter', () => {
    const onClearFilter = vi.fn();
    render(<OverviewFilteredView mode="inside" visits={[baseVisit]} loading={false} onClearFilter={onClearFilter} />);
    fireEvent.click(screen.getByText('Back to overview'));
    expect(onClearFilter).toHaveBeenCalledTimes(1);
  });

  it('shows a premium field grid with department, reason, date and phone', () => {
    render(<OverviewFilteredView mode="inside" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />);
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('9999999999')).toBeInTheDocument();
  });

  it('passes approve/reject/cancel handlers into the detail modal and closes it after use', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onCancel = vi.fn();
    render(
      <OverviewFilteredView
        mode="pending" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()}
        onApprove={onApprove} onReject={onReject} onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('John Doe'));
    fireEvent.click(screen.getByText('Modal Approve'));
    expect(onApprove).toHaveBeenCalledWith('v1');
    expect(screen.queryByTestId('visitor-details')).not.toBeInTheDocument();
  });

  it('shows Clear All in approved mode when onClearAll is provided and calls it', () => {
    const onClearAll = vi.fn();
    render(
      <OverviewFilteredView mode="approved" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} onClearAll={onClearAll} />,
    );
    fireEvent.click(screen.getByText('Clear All'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('does not show Clear All when onClearAll is not provided', () => {
    render(<OverviewFilteredView mode="approved" visits={[baseVisit]} loading={false} onClearFilter={vi.fn()} />);
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });
});
