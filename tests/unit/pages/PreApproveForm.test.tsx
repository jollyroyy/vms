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

describe('PreApproveForm submission', () => {
  beforeEach(() => setupDefaultMocks());

  /* ── Rendering ─────────────────────────────────────── */

  it('renders the form heading', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /pre-approve visitor/i })).toBeInTheDocument();
    });
  });

  it('renders all form fields', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    // Check that key form controls are present
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByDisplayValue('Meeting')).toBeInTheDocument();
    expect(screen.getAllByText('Pre-Approve Visitor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Mobile Number/)).toBeInTheDocument();
  });

  /* ── Happy path ────────────────────────────────────── */

  it('inserts visitor and visit on submit with valid data', async () => {
    const onApproved = vi.fn();
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });

    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('pre_approve_visitor_v2', {
        p_phone: '9876543210',
        p_full_name: 'Test Visitor',
        p_company: 'Test Corp',
        p_department_id: 'dept1',
        p_host_id: 'h1',
        p_purpose: 'meeting',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Visitor Pre-Approved/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Got it'));

    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledWith('Test Visitor', 'VIS-20260721-0001');
    });
  });

  it('calls onPreApproved with visitor name and ref number', async () => {
    const onApproved = vi.fn();
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Visitor Pre-Approved/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Got it'));

    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^VIS-/));
    });
  });

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
    render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/already has an active visit/i)).toBeInTheDocument();
      expect(screen.getByText(/VIS-20260720-0005/)).toBeInTheDocument();
    });

    expect(onApproved).not.toHaveBeenCalled();
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

  /* ── Database Errors ───────────────────────────────── */

  it('shows error message when pre-approval RPC fails', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_hosts_for_department') return Promise.resolve({ data: mockHosts, error: null });
      if (name === 'get_active_visit_for_phone') return Promise.resolve({ data: null, error: null });
      if (name === 'pre_approve_visitor_v2') return Promise.resolve({ data: null, error: { message: 'Database error' } });
      return Promise.resolve({ data: null, error: null });
    });

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
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

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
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

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
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

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      // safeErrorMessage should surface the original error message
      expect(screen.getByText(/RPC connection failed/i)).toBeInTheDocument();
    });
  });

  /* ── Batch Mode ────────────────────────────────────── */

  it('batch mode clears form and shows success message on submit', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    // Enable batch mode
    fireEvent.click(screen.getByText('Batch Mode'));
    await waitFor(() => expect(screen.getByText(/Save.*Add Another/i)).toBeInTheDocument());

    // Fill form
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    await waitFor(() => expect(screen.getByText('Test Host')).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'h1' } });
    fireEvent.click(screen.getByRole('button', { name: /save.*add another/i }));

    await waitFor(() => {
      expect(screen.getByText('Visitor Pre-Approved')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Got it'));

    // Form should be cleared — phone input should be empty
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
      expect(screen.getAllByRole('textbox')[1]).toHaveValue('');
    });
  });

  /* ── Phone Recall ──────────────────────────────────── */

  it('recallByPhone fills existing visitor data on blur', async () => {
    // Create a thenable eq return that also has maybeSingle
    const createEqReturn = (resolveData: any) => {
      const thenable = Promise.resolve({ data: resolveData, error: null });
      return Object.assign(thenable, {
        maybeSingle: () => Promise.resolve({ data: resolveData, error: null }),
        single: () => Promise.resolve({ data: resolveData, error: null }),
        eq: () => createEqReturn(resolveData),
        order: () => ({ limit: () => thenable }),
        in: () => ({ order: () => ({ limit: () => thenable }) }),
        gte: () => thenable,
      });
    };

    let recallCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
      if (table === 'visitors') {
        return {
          select: () => ({
            eq: vi.fn(() => {
              recallCallCount++;
              // First call is blacklist (no maybeSingle), second call is recall
              if (recallCallCount === 2) {
                return createEqReturn({ full_name: 'Existing User', company: 'Existing Corp', phone: '9876543210' });
              }
              return createEqReturn(recallCallCount === 1 ? [] : null);
            }),
          }),
          upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'vis-new-1' }, error: null }) }) }),
        };
      }
      if (table === 'visits') return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { ref_number: 'VIS-20260721-0001' }, error: null }) }) }) };
      if (table === 'profiles') return { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: mockHosts, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
    });

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('textbox')[1]).toHaveValue('Existing User');
    });
  });

  it('recallByPhone detects blacklist on blur', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
      if (table === 'visitors') {
        return {
          select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }),
          upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        };
      }
      if (table === 'visits') return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      if (table === 'profiles') return { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: mockHosts, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
    });

    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '5555666660' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);

    await waitFor(() => {
      expect(screen.getByText(/BLACKLISTED/i)).toBeInTheDocument();
    });
  });
});
