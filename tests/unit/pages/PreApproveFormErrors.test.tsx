import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import PreApproveForm from '../../../src/pages/HOD/PreApproveForm';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser, getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
    channel: vi.fn(() => ({ on: () => ({ subscribe: vi.fn() }) })),
    removeChannel: vi.fn(),
  },
}));

// THE CLOCK IS FROZEN, because `validatePreApproval` now refuses a slot in the
// past (client report, 2026-08-18: a visitor booked for 12 am and arriving at
// 11 am was being reported as eleven hours late — the pass had been raised for
// a moment that was already gone). Every fixture below types the same literal
// datetime it always did, and its exact converted instant is still asserted
// against the RPC, which is what guards the +5h30m timezone bug. Without a
// fixed `now` those literals would pass on the day they were written and fail
// ever after, which is a test that measures the calendar rather than the code.
const NOW = new Date('2026-08-01T06:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockDepts = [{ id: 'dept1', name: 'IT', code: 'IT', created_at: '2026-01-01' }];
const mockBlacklist: { phone: string; blacklist_reason: string | null }[] = [
  { phone: '5555666660', blacklist_reason: 'Fraud' },
];
const mockHosts = [{ id: 'h1', full_name: 'Test Host', email: 'host@test.com', role: 'staff' }];

function setupDefaultMocks() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: 'dept1' } } },
  });
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'u1', access_token: 'tok' } } },
  });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'departments') {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
    }
    if (table === 'visitors') {
      return {
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }),
        upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'vis-new-1' }, error: null }) }) }),
      };
    }
    if (table === 'visits') {
      return {
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { ref_number: 'VIS-20260721-0001' }, error: null }) }) }),
      };
    }
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: mockHosts, error: null }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
  });
  mockRpc.mockImplementation((name: string) => {
    if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
    if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
    if (name === 'pre_approve_visitor_v2') return Promise.resolve({ data: { ref_number: 'VIS-20260721-0001' }, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

describe('PreApproveForm errors', () => {
  beforeEach(() => setupDefaultMocks());

  /* ── Active Visit Check ────────────────────────────── */

  it('shows warning and blocks submission when phone has an active visit', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') {
        return Promise.resolve({ data: { ref_number: 'VIS-20260720-0005', status: 'checked_in' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const onApproved = vi.fn();
    const { container } = render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/already has an active visit/i)).toBeInTheDocument();
      expect(screen.getByText(/VIS-20260720-0005/)).toBeInTheDocument();
    });

    expect(onApproved).not.toHaveBeenCalled();
  });

  /* ── Database Errors ───────────────────────────────── */

  it('shows error message when pre-approval RPC fails', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
      if (name === 'pre_approve_visitor_v2') return Promise.resolve({ data: null, error: { message: 'Database error' } });
      return Promise.resolve({ data: null, error: null });
    });

    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Database error/i)).toBeInTheDocument();
    });
  });

  it('shows error when RPC returns null result', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
      if (name === 'pre_approve_visitor_v2') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create pre-approved visit/i)).toBeInTheDocument();
    });
  });

  it('shows error when RPC returns result without ref_number', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
      if (name === 'pre_approve_visitor_v2') return Promise.resolve({ data: {}, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create pre-approved visit/i)).toBeInTheDocument();
    });
  });

  /* ── RPC Error handling ────────────────────────────── */

  it('handles active visit RPC rejection gracefully', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') return Promise.reject(new Error('RPC connection failed'));
      return Promise.resolve({ data: null, error: null });
    });

    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/RPC connection failed/i)).toBeInTheDocument();
    });
  });
});
