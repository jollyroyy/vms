import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import PreApproveForm from '../../../src/pages/HOD/PreApproveForm';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser, getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockDepts = [{ id: 'dept1', name: 'IT', code: 'IT', created_at: '2026-01-01' }];
const mockBlacklist: { phone: string; blacklist_reason: string | null }[] = [];

function setupDefaultMocks() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: 'dept1' } } },
  });
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1' } } },
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }),
      };
    }
    return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: 'h1', full_name: 'Test Host' }]),
  });
  mockRpc.mockResolvedValue({ data: { ref_number: 'VIS-20260721-0001' }, error: null });
}

describe('PreApproveForm submission', () => {
  beforeEach(() => setupDefaultMocks());

  it('renders the form heading', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /pre-approve visitor/i })).toBeInTheDocument();
    });
  });

  it('calls pre_approve_visitor RPC on submit with valid data', async () => {
    const onApproved = vi.fn();
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /pre-approve visitor/i })).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const phoneInput = inputs[0];
    const nameInput = inputs[1];
    const companyInput = inputs[2];
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    fireEvent.change(nameInput, { target: { value: 'Test Visitor' } });
    fireEvent.change(companyInput, { target: { value: 'Test Corp' } });

    await waitFor(() => {
      const hostOption = screen.getByText('Test Host');
      expect(hostOption).toBeInTheDocument();
    });
    const selects = screen.getAllByRole('combobox');
    const hostSelect = selects[2]; // purpose(0), dept(1), host(2)
    fireEvent.change(hostSelect, { target: { value: 'h1' } });
    const submitBtn = screen.getByRole('button', { name: /pre-approve visitor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('pre_approve_visitor', {
        p_phone: '9876543210',
        p_full_name: 'Test Visitor',
        p_company: 'Test Corp',
        p_department_id: 'dept1',
        p_host_id: 'h1',
        p_purpose: 'meeting',
      });
    });

    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledWith('Test Visitor', 'VIS-20260721-0001');
    });
  });

  it('shows error message when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RLS violation' } });

    const onApproved = vi.fn();
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /pre-approve visitor/i })).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    const phoneInput = inputs[0];
    const nameInput = inputs[1];
    const companyInput = inputs[2];
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    fireEvent.change(nameInput, { target: { value: 'Test Visitor' } });
    fireEvent.change(companyInput, { target: { value: 'Test Corp' } });

    await waitFor(() => {
      expect(screen.getByText('Test Host')).toBeInTheDocument();
    });
    const selects = screen.getAllByRole('combobox');
    const hostSelect = selects[2];
    fireEvent.change(hostSelect, { target: { value: 'h1' } });
    const submitBtn = screen.getByRole('button', { name: /pre-approve visitor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('RLS violation')).toBeInTheDocument();
    });

    expect(onApproved).not.toHaveBeenCalled();
  });
});
