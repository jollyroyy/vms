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

describe('PreApproveForm validation', () => {
  beforeEach(() => setupDefaultMocks());

  /* ── Blacklist ─────────────────────────────────────── */

  it('shows blacklist banner and blocks submission when phone is blacklisted', async () => {
    // Setup blacklist data
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
      if (table === 'visitors') return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }), upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      if (table === 'visits') return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      if (table === 'profiles') return { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: mockHosts, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
    });

    const onApproved = vi.fn();
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    // Enter a blacklisted phone and trigger blur to check it
    const phoneInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(phoneInput, { target: { value: '5555666660' } });
    fireEvent.blur(phoneInput);

    await waitFor(() => {
      expect(screen.getByText(/BLACKLISTED/i)).toBeInTheDocument();
      expect(screen.getByText(/Fraud/)).toBeInTheDocument();
    });

    // Submit button should be disabled
    expect(screen.getByRole('button', { name: /pre-approve visitor/i })).toBeDisabled();
  });

  /* ── Phone Validation ──────────────────────────────── */

  it('shows error for invalid phone number', async () => {
    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '123' } }); // too short
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid 10-digit/i)).toBeInTheDocument();
    });
  });

  /* ── Schedule Validation ───────────────────────────── */

  it('shows the scheduled-date error and does not call the RPC when Schedule for is left blank', async () => {
    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    // Schedule for is deliberately left blank. Dispatch the submit event
    // directly on the form (rather than clicking the submit button) so the
    // browser's native `required` constraint validation — which would
    // otherwise silently swallow the submit before React ever sees it —
    // doesn't mask the assertion we actually care about: the app's own
    // validatePreApproval() check.
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Scheduled date and time is required/i)).toBeInTheDocument();
    });

    expect(mockRpc).not.toHaveBeenCalledWith('pre_approve_visitor_v2', expect.anything());
  });

  /* ── Session Expired ───────────────────────────────── */

  it('shows session expired error when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
    });
  });
});
