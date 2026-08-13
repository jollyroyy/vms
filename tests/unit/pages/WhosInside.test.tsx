import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhosInside from '../../../src/pages/Shared/WhosInside';
import { formatDateTime } from '../../../src/lib/formatDate';

const mockOrder = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ in: () => ({ gte: () => ({ order: mockOrder }) }) }) }),
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: (rows: any[]) => Promise.resolve(rows),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockCheckedIn = {
  id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
  status: 'checked_in' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
  checked_in_at: new Date().toISOString(), checked_out_at: null, exit_verified: null,
  rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
  visitor: { id: 'vis1', full_name: 'Alice', phone: '9876543210', vendor_name: 'Corp A' },
  department: { id: 'dept1', name: 'IT', code: 'IT' },
  host: { id: 'h1', full_name: 'Test Host' },
};

const mockPreApproved = {
  id: 'v2', ref_number: 'VIS-002', visitor_id: 'vis2', department_id: 'dept1', host_id: 'h1',
  status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
  checked_in_at: null, checked_out_at: null, exit_verified: null,
  rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
  visitor: { id: 'vis2', full_name: 'Bob', phone: '9876543211', vendor_name: 'Corp B' },
  department: { id: 'dept1', name: 'IT', code: 'IT' },
  host: { id: 'h1', full_name: 'Test Host' },
};

const setup = () => {
  mockChannel.mockReturnValue({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) });
};

describe('M12-GUARD: WhosInside', () => {
  it('shows title', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText("Who's Inside")).toBeInTheDocument();
    });
  });

  it('shows empty state when no checked-in visits (default tab)', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No visitors inside')).toBeInTheDocument();
    });
  });

  it('shows checked-in visitors on Checked In tab', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockCheckedIn], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  // Client feedback, 2026-08-10: cards must be "one row after another", never
  // a 2-up/3-up grid.
  it('renders the visitor list as a full-width vertical stack, not a grid', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockCheckedIn], error: null });
    const { container } = render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    const list = container.querySelector('[data-card-list]');
    expect(list).not.toBeNull();
    expect(list!.className).not.toMatch(/\bgrid\b/);
    expect(list!.className).toMatch(/flex-col/);
  });

  it('switches to Pre-Approved tab and shows pre-approved visitors', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pre-approved tab/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows Clear All button on Pre-Approved tab when visitors exist', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
  });

  it('calls clear_pre_approved RPC when Clear All is clicked and confirmed', async () => {
    setup();
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    mockRpc.mockResolvedValue({ data: 1, error: null });
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('clear_pre_approved');
    });
    window.confirm = originalConfirm;
  });

  it('shows clear error message when clear_pre_approved RPC fails', async () => {
    setup();
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    mockRpc.mockResolvedValue({ data: null, error: new Error('Only Guard, HOD, or Admin can clear pre-approvals.') });
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => {
      expect(screen.getByText(/Only Guard, HOD, or Admin can clear pre-approvals/i)).toBeInTheDocument();
    });
    window.confirm = originalConfirm;
  });

  it('does not call RPC when Clear All confirm is cancelled', async () => {
    setup();
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => false);
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(mockRpc).not.toHaveBeenCalled();
    window.confirm = originalConfirm;
  });

  it('shows Export CSV button', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    });
  });

  it('shows Pre-Approved empty state when no pre-approved visitors', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockCheckedIn], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));

    await waitFor(() => {
      expect(screen.getByText('No pre-approved visitors')).toBeInTheDocument();
    });
  });

  // Approval and check-in used to share one timeline row that only ever showed
  // the check-in time. The two timestamps are deliberately different here so a
  // regression back to a single row cannot pass.
  it('shows the approval time and the check-in time as separate rows on the inside card', async () => {
    setup();
    const approvedAt = '2026-07-01T09:00:00Z';
    const checkedInAt = '2026-07-01T11:30:00Z';
    mockOrder.mockResolvedValue({
      data: [{ ...mockCheckedIn, created_at: approvedAt, checked_in_at: checkedInAt }],
      error: null,
    });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Check-in')).toBeInTheDocument();
    });
    expect(screen.getByText(formatDateTime(approvedAt))).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(checkedInAt))).toBeInTheDocument();
    expect(screen.getByText('Not yet checked out')).toBeInTheDocument();
    expect(screen.getByText('Duration Inside')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });


  it('shows "Not yet checked in" and "Not yet checked out" for pre-approved visitors', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [mockPreApproved], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pre-approved tab/i }));
    await waitFor(() => {
      expect(screen.getByText('Not yet checked in')).toBeInTheDocument();
    });
    expect(screen.getByText('Not yet checked out')).toBeInTheDocument();
  });

  it('shows walk-in approved visitors with check-in state when the Approved stat is clicked', async () => {
    setup();
    const mockWalkin = {
      id: 'v3', ref_number: 'VIS-003', visitor_id: 'vis3', department_id: 'dept1', host_id: 'h1',
      status: 'walkin_approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
      checked_in_at: null, checked_out_at: null, exit_verified: null,
      rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
      visitor: { id: 'vis3', full_name: 'Carol', phone: '9876543212', vendor_name: 'Corp C' },
      department: { id: 'dept1', name: 'IT', code: 'IT' },
      host: { id: 'h1', full_name: 'Test Host' },
    };
    mockOrder.mockResolvedValue({ data: [mockCheckedIn, mockWalkin], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    const allButtons = screen.getAllByRole('button');
    const approvedStatCard = allButtons.find(btn =>
      btn.classList.contains('gate-tile') &&
      btn.textContent?.includes('Approved') &&
      !btn.textContent?.includes('Pre-Approved')
    );
    if (approvedStatCard) fireEvent.click(approvedStatCard);
    await waitFor(() => {
      expect(screen.getByText('Carol')).toBeInTheDocument();
      expect(screen.getByText('Not yet checked in')).toBeInTheDocument();
      expect(screen.getAllByText('Not yet checked out').length).toBeGreaterThan(0);
    });
  });
});
