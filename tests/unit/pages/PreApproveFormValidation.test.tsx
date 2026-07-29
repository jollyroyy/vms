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

  /* ── Validation ────────────────────────────────────── */

  it('shows validation error when host is not selected', async () => {
    // Set up a mock that loads hosts so the select becomes visible, but don't select one
    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue('Meeting')).toBeInTheDocument());
    // Wait for hosts to load
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());

    // Fill required fields but leave host empty
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '9876543210' } });
    fireEvent.change(inputs[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(inputs[2], { target: { value: 'Test Corp' } });

    // Submit the form directly to avoid any button-interaction edge cases
    const form = screen.getByRole('button', { name: /pre-approve visitor/i }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText(/Host is required/i)).toBeInTheDocument();
    });
  });

  /* ── Phone Validation ──────────────────────────────── */

  it('shows error for invalid phone number', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '123' } }); // too short
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid 10-digit/i)).toBeInTheDocument();
    });
  });

  /* ── Session Expired ───────────────────────────────── */

  it('shows session expired error when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
    });
  });
});
