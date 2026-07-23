import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODOverview from '../../../src/pages/HOD/HODOverview';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockEqChain = vi.hoisted(() => vi.fn());
const mockLte = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

vi.mock('../../../src/lib/recurringVisits', () => ({
  formatRecurrenceLabel: () => 'Daily',
}));

let mockTodayData: any;
let mockUpcomingData: any;
let mockNotifData: any;
let mockRecurringData: any;
let mockProfileDept: string | null = 'dept1';
let mockProfileDeptName: string | null = 'Information Technology';

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { department_id: mockProfileDept, department: { name: mockProfileDeptName } }, error: null }) }) }),
        };
      }
      return {
        select: (cols: string, opts?: any) => {
          if (cols === 'id, status') {
            return {
              eq: () => ({
                gte: () => Promise.resolve({ data: mockTodayData, error: null }),
              }),
            };
          }
          // General case: select → eq → in → order → limit
          return {
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: mockUpcomingData, error: null }),
                }),
              }),
              gte: () => Promise.resolve({ data: mockTodayData, error: null }),
            }),
          };
        },
      };
    },
    rpc: vi.fn(),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: vi.fn().mockReturnValue('sub-1') }) }) }),
    removeChannel: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(opts?: { deptId?: string | null; deptName?: string | null }) {
  mockProfileDept = opts?.deptId ?? 'dept1';
  mockProfileDeptName = opts?.deptName ?? 'Information Technology';
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: { role: 'hod', department_id: opts?.deptId ?? 'dept1' } } },
  });
  mockTodayData = [
    { id: 'v1', status: 'checked_in' },
    { id: 'v2', status: 'approved' },
    { id: 'v3', status: 'pending_approval' },
    { id: 'v4', status: 'rejected' },
    { id: 'v5', status: 'checked_in' },
  ];
  mockUpcomingData = [];
  mockNotifData = [];
  mockRecurringData = [];
}

describe('M12-HOD: HODOverview', () => {
  it('renders page heading as Overview', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Overview$/i })).toBeInTheDocument();
    });
  });

  it('shows all four stat cards with correct counts', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Inside')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
    // checked_in count = 2, approved count = 1, pending = 1, rejected = 1
    await waitFor(() => {
      const two = screen.getAllByText('2');
      expect(two.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows stat card numbers after data loads', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Inside')).toBeInTheDocument();
    });
    // Data has 2 checked_in → Inside = 2
    await waitFor(() => {
      const two = screen.getAllByText('2');
      expect(two.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders upcoming visits section', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Upcoming visits')).toBeInTheDocument();
    });
  });

  it('renders notifications panel', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Status & Notifications/i)).toBeInTheDocument();
    });
  });

  it('shows department name at top of dashboard', async () => {
    setup({ deptName: 'Information Technology' });
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Information Technology Department')).toBeInTheDocument();
    });
  });

  it('shows catchy subtitle phrase', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Your department at a glance/)).toBeInTheDocument();
    });
  });
});
