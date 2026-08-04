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
    if (name === 'get_profile_names') return Promise.resolve({ data: [{ id: 'u1', full_name: 'Test Host' }], error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

describe('PreApproveForm phone recall', () => {
  beforeEach(() => setupDefaultMocks());

  it('recallByPhone fills existing visitor data on blur', async () => {
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
              if (recallCallCount === 2) {
                return createEqReturn({ full_name: 'Existing User', vendor_name: 'Existing Corp', phone: '9876543210' });
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
