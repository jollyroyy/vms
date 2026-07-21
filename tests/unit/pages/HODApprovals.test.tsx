import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODApprovals from '../../../src/pages/HOD/Approvals';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/formatDate', () => ({
  formatDateTime: () => '',
  formatTime: () => '',
  formatDuration: () => null,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ in: () => ({ order: mockOrder }) }) }) }),
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockPending = {
  id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
  status: 'pending_approval' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
  checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
  carrying_material: false, created_at: new Date().toISOString(),
  visitor: { id: 'vis1', full_name: 'Test Visitor', phone: '9876543210', company: 'Test Corp' },
  department: { id: 'dept1', name: 'IT', code: 'IT' },
  host: { id: 'h1', full_name: 'Test Host' },
};

const mockApproved = {
  ...mockPending, id: 'v2', ref_number: 'VIS-002',
  status: 'walkin_approved' as const, visitor: { ...mockPending.visitor, full_name: 'Approved Visitor' },
};

const mockRejected = {
  ...mockPending, id: 'v3', ref_number: 'VIS-003',
  status: 'rejected' as const, rejection_reason: 'Not authorized',
  visitor: { ...mockPending.visitor, full_name: 'Rejected Visitor' },
};

const setup = () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { department_id: 'dept1' } } } });
  mockChannel.mockReturnValue({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) });
};

describe('M12-HOD: HODApprovals', () => {
  it('renders title', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Approvals')).toBeInTheDocument());
  });

  it('shows all four tabs', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Pre-Approve')).toBeInTheDocument();
    });
  });

  it('shows empty state when no pending visits', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No pending approvals right now')).toBeInTheDocument();
    });
  });

  it('renders pending visit rows', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockPending], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('VIS-001')).toBeInTheDocument();
    });
  });

  it('shows approved visits in Approved tab', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockApproved], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Approved'));
    await waitFor(() => {
      expect(screen.getByText('Approved Visitor')).toBeInTheDocument();
    });
  });

  it('shows rejected visits with reason in Rejected tab', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockRejected], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    fireEvent.click(screen.getByText('Rejected'));
    await waitFor(() => {
      expect(screen.getByText('Rejected Visitor')).toBeInTheDocument();
      expect(screen.getByText(/Not authorized/)).toBeInTheDocument();
    });
  });

  it('shows error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Not authenticated.')).toBeInTheDocument();
    });
  });
});
