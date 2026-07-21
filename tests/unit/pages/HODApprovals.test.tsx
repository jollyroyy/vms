import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODApprovals from '../../../src/pages/HOD/Approvals';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockGte = vi.hoisted(() => vi.fn(() => ({ order: mockOrder })));
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

let mockData: any;
const mockEqChain = vi.hoisted(() => vi.fn(() => ({
  in: vi.fn(() => ({ order: (col: string, opts: any) => Promise.resolve(mockData) })),
  gte: (col: string, val: any) => ({ order: (c: string, o: any) => Promise.resolve(mockData) }),
  eq: mockEqChain,
  order: (col: string, opts: any) => ({ limit: (n: number) => Promise.resolve(mockData) }),
  limit: (n: number) => Promise.resolve(mockData),
})));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: mockEqChain,
      }),
    }),
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

const setup = (data?: { data: any[]; error: null }) => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { department_id: 'dept1' } } } });
  mockChannel.mockReturnValue({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) });
  const resolved = data ?? { data: [], error: null };
  mockData = resolved;
};

describe('M12-HOD: HODApprovals', () => {
  it('renders title', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('shows all four tabs', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Pre-Approve')).toBeInTheDocument();
    });
  });

  it('shows empty state when no pending visits', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No pending approvals right now')).toBeInTheDocument();
    });
  });

  it('renders pending visit rows', async () => {
    setup({ data: [mockPending], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('VIS-001')).toBeInTheDocument();
    });
  });

  it('shows approved visits in Approved tab', async () => {
    setup({ data: [mockApproved], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    });
    fireEvent.click(screen.getAllByText('Approved')[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Approved Visitor').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows rejected visits with reason in Rejected tab', async () => {
    setup({ data: [mockRejected], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    fireEvent.click(screen.getAllByText('Rejected')[0]);
    await waitFor(() => {
      expect(screen.getAllByText('Rejected Visitor').length).toBeGreaterThanOrEqual(1);
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

  it('renders stat cards', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Approved Today')).toBeInTheDocument();
      expect(screen.getByText('Rejected Today')).toBeInTheDocument();
      expect(screen.getByText('Avg. Response')).toBeInTheDocument();
    });
  });

  it('renders recent activity sidebar', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText("Today's Summary")).toBeInTheDocument();
    });
  });
});
