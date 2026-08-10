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

const mockFullVisit = {
  id: 'v1',
  ref_number: 'VIS-20260721-0001',
  visitor_id: 'vis-new-1',
  department_id: 'dept1',
  host_id: 'u1',
  purpose: 'meeting',
  photo_path: null,
  photo_data: null,
  status: 'approved',
  checked_in_at: null,
  checked_out_at: null,
  exit_verified: null,
  rejection_reason: null,
  carrying_material: false,
  scheduled_for: null,
  qr_token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  qr_expires_at: '2026-08-02T00:00:00Z',
  created_at: '2026-08-01T00:00:00Z',
  visitor: { id: 'vis-new-1', phone: '9876543210', full_name: 'Test Visitor', vendor_name: 'Test Corp', id_type: null, id_last4: null, vehicle_number: null, is_blacklisted: false, blacklist_reason: null, created_at: '2026-08-01T00:00:00Z' },
  department: { id: 'dept1', name: 'IT', code: 'IT', created_at: '2026-01-01T00:00:00Z' },
};

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
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockFullVisit, error: null }) }) }),
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
    if (name === 'get_profile_names') return Promise.resolve({ data: [{ id: 'u1', full_name: 'Test Host' }], error: null });
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

  it('labels the name field "Visitor Name", not "Full Name"', async () => {
    render(<PreApproveForm onPreApproved={vi.fn()} />);
    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    expect(screen.getByText('Visitor Name *')).toBeInTheDocument();
    expect(screen.queryByText('Full Name *')).not.toBeInTheDocument();
  });

  /* ── Happy path ────────────────────────────────────── */

  it('inserts visitor and visit on submit with valid data', async () => {
    const onApproved = vi.fn();
    const { container } = render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });

    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('pre_approve_visitor_v2', {
        p_phone: '9876543210',
        p_full_name: 'Test Visitor',
        p_vendor_name: 'Test Corp',
        p_department_id: 'dept1',
        p_host_id: 'u1',
        p_purpose: 'meeting',
        p_scheduled_for: '2026-08-05T10:00',
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
    const { container } = render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => {
      expect(screen.getByText(/Visitor Pre-Approved/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Got it'));

    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^VIS-/));
    });
  });

  it('shows the entry pass QR in the success popup after pre-approval', async () => {
    const { container } = render(<PreApproveForm onPreApproved={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => expect(screen.getByText(/Visitor Pre-Approved/i)).toBeInTheDocument());
    expect(await screen.findByAltText('Entry pass QR code')).toBeInTheDocument();
  });

  it('still shows the success popup (without a QR) if fetching the pass fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'departments') return { select: () => ({ order: vi.fn().mockResolvedValue({ data: mockDepts, error: null }) }) };
      if (table === 'visitors') {
        return {
          select: () => ({ eq: vi.fn().mockResolvedValue({ data: mockBlacklist, error: null }) }),
          upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'vis-new-1' }, error: null }) }) }),
        };
      }
      if (table === 'visits') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { ref_number: 'VIS-20260721-0001' }, error: null }) }) }),
          select: () => ({ eq: () => ({ single: () => Promise.reject(new Error('network down')) }) }),
        };
      }
      if (table === 'profiles') return { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: mockHosts, error: null }) }) }) };
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
    });

    const onApproved = vi.fn();
    const { container } = render(<PreApproveForm onPreApproved={onApproved} />);

    await waitFor(() => expect(screen.getByPlaceholderText(/\+91/)).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '9876543210' } });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Test Visitor' } });
    fireEvent.change(screen.getAllByRole('textbox')[2], { target: { value: 'Test Corp' } });
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-08-05T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /pre-approve visitor/i }));

    await waitFor(() => expect(screen.getByText(/Visitor Pre-Approved/i)).toBeInTheDocument());
    expect(screen.queryByAltText('Entry pass QR code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Got it'));
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('Test Visitor', 'VIS-20260721-0001'));
  });
});
