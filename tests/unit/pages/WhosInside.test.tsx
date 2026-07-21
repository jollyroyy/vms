import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhosInside from '../../../src/pages/Shared/WhosInside';

const mockOrder = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());
const mockExportJson = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
  exportToJson: mockExportJson,
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockCheckedIn = {
  id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
  status: 'checked_in' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
  checked_in_at: new Date().toISOString(), checked_out_at: null, exit_verified: null,
  rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
  visitor: { id: 'vis1', full_name: 'Alice', phone: '9876543210', company: 'Corp A' },
  department: { id: 'dept1', name: 'IT', code: 'IT' },
  host: { id: 'h1', full_name: 'Test Host' },
};

const mockPreApproved = {
  id: 'v2', ref_number: 'VIS-002', visitor_id: 'vis2', department_id: 'dept1', host_id: 'h1',
  status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
  checked_in_at: null, checked_out_at: null, exit_verified: null,
  rejection_reason: null, carrying_material: false, created_at: new Date().toISOString(),
  visitor: { id: 'vis2', full_name: 'Bob', phone: '9876543211', company: 'Corp B' },
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

  it('shows Export JSON button', async () => {
    setup();
    mockOrder.mockResolvedValue({ data: [], error: null });
    render(<MemoryRouter><WhosInside /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
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
});
