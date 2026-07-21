import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuardConsole from '../../../src/pages/Guard/Console';

const mockOrder = vi.hoisted(() => vi.fn());
const mockChannel = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());
const mockOn = vi.hoisted(() => vi.fn());
const mockExportCsv = vi.hoisted(() => vi.fn());
const mockExportJson = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/exportUtils', () => ({
  exportToCsv: mockExportCsv,
  exportToJson: mockExportJson,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ gte: () => ({ order: mockOrder }) }),
      update: () => ({ eq: vi.fn(() => mockUpdate()) }),
    }),
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

describe('M12-GUARD: GuardConsole', () => {
  it('renders header', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Guard Console')).toBeInTheDocument();
    });
  });

  it('shows tabs', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText("Today's Visits").length).toBeGreaterThan(0);
      expect(screen.getByText('Register Visitor')).toBeInTheDocument();
      expect(screen.getByText('Log Exit')).toBeInTheDocument();
    });
  });

  it('shows empty state when no visits', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No visits today yet')).toBeInTheDocument();
    });
  });

  it('shows Export CSV button', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
    });
  });

  it('shows Export JSON button', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
    });
  });

  it('renders visit list when data is returned', async () => {
    const mockVisits = [
      {
        id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
        status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
        carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis1', full_name: 'Test Visitor', phone: '9876543210', company: 'Test Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Test Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Test Visitor')).toBeInTheDocument();
    });
  });

  it('calls checkIn on approved visit', async () => {
    mockUpdate.mockResolvedValue({ error: null });
    const mockVisits = [
      {
        id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
        status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
        carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis1', full_name: 'Check Me In', phone: '9876543210', company: 'Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Check Me In')).toBeInTheDocument();
    });
    const checkInBtn = screen.getByRole('button', { name: /check in/i });
    fireEvent.click(checkInBtn);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('shows error when check-in fails', async () => {
    mockUpdate.mockResolvedValue({ error: { message: 'Check-in failed' } });
    const mockVisits = [
      {
        id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
        status: 'approved' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
        carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis1', full_name: 'Fail Check', phone: '9876543210', company: 'Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Fail Check')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /check in/i }));
    await waitFor(() => {
      expect(screen.getByText('Check-in failed')).toBeInTheDocument();
    });
  });

  it('shows error for non-checked-in visit on log exit tab', async () => {
    mockUpdate.mockResolvedValue({ error: null });
    const mockVisits = [
      {
        id: 'v1', ref_number: 'VIS-001', visitor_id: 'vis1', department_id: 'dept1', host_id: 'h1',
        status: 'pending_approval' as const, purpose: 'meeting' as const, photo_path: null, photo_data: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
        carrying_material: false, created_at: new Date().toISOString(),
        visitor: { id: 'vis1', full_name: 'Pending Visitor', phone: '9876543210', company: 'Corp' },
        department: { id: 'dept1', name: 'IT', code: 'IT' },
        host: { id: 'h1', full_name: 'Host' },
      },
    ];
    mockOrder.mockResolvedValue({ data: mockVisits, error: null });
    mockChannel.mockReturnValue({ on: () => ({ subscribe: mockSubscribe }) });
    mockSubscribe.mockReturnValue('sub-1');
    render(<MemoryRouter><GuardConsole /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Pending Visitor')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /log exit/i }));
    await waitFor(() => {
      expect(screen.getByText('No checked-in visitors')).toBeInTheDocument();
    });
  });
});
