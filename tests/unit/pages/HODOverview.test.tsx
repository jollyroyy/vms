import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODOverview from '../../../src/pages/HOD/HODOverview';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

let mockTodayData: any;
let mockPendingData: any;
let mockUpcomingData: any;
let mockOnSiteData: any;
let mockNotifData: any;
let mockFilteredData: any;
let mockProfileDept: string | null = 'dept1';
let mockProfileDeptName: string | null = 'Information Technology';

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { department_id: mockProfileDept }, error: null }) }) }),
        };
      }
      if (table === 'departments') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { name: mockProfileDeptName }, error: null }) }) }),
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
          // General case: select → eq(department) → { eq(status) | in(status) }
          // The pending walk-in query is `.eq(department).eq('status',
          // 'pending_approval').order().limit()` — a second .eq(), not
          // .in() — so it needs its own branch ahead of the .in() ones used
          // by the "upcoming" and "on-site" queries (distinguished from
          // each other by the statuses actually requested).
          return {
            eq: () => ({
              eq: () => ({
                order: () => ({ limit: () => Promise.resolve({ data: mockPendingData, error: null }) }),
              }),
              in: (_col: string, statuses: string[]) => ({
                order: () => ({
                  limit: () => {
                    const isOnSiteQuery = statuses.length === 1 && statuses[0] === 'checked_in';
                    return Promise.resolve({ data: isOnSiteQuery ? mockOnSiteData : mockUpcomingData, error: null });
                  },
                }),
                gte: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: mockFilteredData, error: null }),
                  }),
                }),
              }),
              gte: () => Promise.resolve({ data: mockTodayData, error: null }),
            }),
          };
        },
      };
    },
    rpc: mockRpc,
    channel: () => {
      const ch: any = {};
      ch.on = () => ch;
      ch.subscribe = () => 'sub-1';
      return ch;
    },
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
  mockPendingData = [];
  mockUpcomingData = [];
  mockOnSiteData = [];
  mockNotifData = [];
  mockFilteredData = [];
}

describe('M12-HOD: HODOverview', () => {
  it('renders the visitors-at-a-glance subtitle', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Your visitors at a glance')).toBeInTheDocument();
    });
  });

  it('shows all four stat cards with correct counts', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Inside')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Pending Walk-in Approvals')).toBeInTheDocument();
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
      expect(screen.getByText(/Your visitors at a glance/)).toBeInTheDocument();
    });
  });

  it('renders OverviewStatCards with activeFilter="" prop initially', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Inside')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Pending Walk-in Approvals')).toBeInTheDocument();
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  it('clicking Inside stat card triggers filter and shows filtered view', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Inside')).toBeInTheDocument();
    });
    const btn = screen.getByText('Inside').closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Currently Inside')).toBeInTheDocument();
    });
  });

  it('clicking Approved stat card shows filtered view with premium card', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
    const btn = screen.getByText('Approved').closest('button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Approved Today')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Today's Approvals")).toBeInTheDocument();
    });
  });

  it('clicking Back to overview restores full layout', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Upcoming visits')).toBeInTheDocument();
    });
    const insideBtn = screen.getByText('Inside').closest('button')!;
    fireEvent.click(insideBtn);
    await waitFor(() => {
      expect(screen.getByText('Currently Inside')).toBeInTheDocument();
    });
    const backBtn = screen.getByText('Back to overview');
    fireEvent.click(backBtn);
    await waitFor(() => {
      expect(screen.getByText('Upcoming visits')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Status & Notifications/i)).toBeInTheDocument();
    });
  });

  it('excludes visits whose scheduled time has already passed from Upcoming visits', async () => {
    setup();
    const past = new Date(Date.now() - 3600_000).toISOString();
    const future = new Date(Date.now() + 3600_000).toISOString();
    const makeVisit = (id: string, name: string, when: string) => ({
      id, ref_number: `VIS-${id}`, visitor_id: `${id}-vis`, department_id: 'dept1', host_id: 'h1',
      purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
      checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      carrying_material: false, scheduled_for: when, created_at: when,
      visitor: { id: `${id}-vis`, full_name: name, phone: '9000000000', vendor_name: null },
      department: { id: 'dept1', name: 'IT' },
      host: { id: 'h1', full_name: 'Host' },
    });
    mockUpcomingData = [makeVisit('past1', 'Past Visitor', past), makeVisit('future1', 'Future Visitor', future)];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Future Visitor')).toBeInTheDocument();
    });
    expect(screen.queryByText('Past Visitor')).not.toBeInTheDocument();
  });

  it('wires Approve/Reject actions through the filtered view into the detail modal', async () => {
    setup();
    mockFilteredData = [{
      id: 'pv1', ref_number: 'VIS-PV1', visitor_id: 'v1', department_id: 'dept1', host_id: 'h1',
      purpose: 'meeting', photo_path: null, photo_data: null, status: 'pending_approval',
      checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      carrying_material: false, scheduled_for: null, created_at: new Date().toISOString(),
      visitor: { id: 'v1', full_name: 'Pending Visitor', phone: '9000000000', vendor_name: null },
      department: { id: 'dept1', name: 'IT' },
      host: { id: 'h1', full_name: 'Host' },
    }];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Pending Walk-in Approvals')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Pending Walk-in Approvals').closest('button')!);
    await waitFor(() => { expect(screen.getByText('Pending Visitor')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Pending Visitor'));
    await waitFor(() => { expect(screen.getByText('Approve')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('approve_visit', { visit_id: 'pv1' });
    });
  });
});
