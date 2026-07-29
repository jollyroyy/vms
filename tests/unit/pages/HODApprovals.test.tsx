import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
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

// The mock MUST honour the `statuses` passed to .in('status', …). Returning mockData
// verbatim made every tab look correct even if Approvals.tsx requested the wrong
// statuses — the tab filter was effectively untested.
function applyStatusFilter(statuses: readonly string[]) {
  if (!mockData || !Array.isArray(mockData.data)) return mockData;
  return { ...mockData, data: mockData.data.filter((v: any) => statuses.includes(v.status)) };
}

const mockEqChain = vi.hoisted(() => vi.fn(() => ({
  in: vi.fn((_col: string, statuses: readonly string[]) => ({
    order: (col: string, opts: any) => Promise.resolve(applyStatusFilter(statuses)),
  })),
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
    await waitFor(() => expect(screen.getByText('Approvals')).toBeInTheDocument());
  });

  it('shows only the Pending and Pre-Approve tabs (Approved/Rejected moved to Overview)', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Pre-Approve')).toBeInTheDocument();
    });
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
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

  // Pending tab must request and show only pending_approval rows — approved/rejected
  // visits belong on the Overview page now, not here.
  it('pending tab shows only pending_approval visits, never approved/rejected ones', async () => {
    setup({ data: [mockPending, mockApproved, mockRejected], error: null });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('VIS-001')).toBeInTheDocument();
    });
    expect(screen.queryByText('Approved Visitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected Visitor')).not.toBeInTheDocument();
  });

  it('shows error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) });
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Not authenticated.')).toBeInTheDocument();
    });
  });

  // Notifications moved to the HOD Overview page; Approvals now shows only its own header/tabs.
  it('renders the page header and subtitle', async () => {
    setup();
    render(<MemoryRouter><HODApprovals /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Approvals$/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/Visitor approvals & activity/i)).toBeInTheDocument();
  });
});
