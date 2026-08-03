import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HODOverview from '../../../src/pages/HOD/HODOverview';

const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: (rows: any[]) => Promise.resolve(rows),
}));

let mockTodayData: any;
let mockUpcomingData: any;
let mockOnSiteData: any;
let mockNotifData: any;
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
          // General case: select → eq → in → order → limit
          // `.in('status', [...])` is used both for the "upcoming" query
          // (pending_approval/approved) and the "on-site" query (checked_in
          // only) — distinguish by the statuses actually requested.
          return {
            eq: () => ({
              in: (_col: string, statuses: string[]) => ({
                order: () => ({
                  limit: () => {
                    const isOnSiteQuery = statuses.length === 1 && statuses[0] === 'checked_in';
                    return Promise.resolve({ data: isOnSiteQuery ? mockOnSiteData : mockUpcomingData, error: null });
                  },
                }),
              }),
              gte: () => Promise.resolve({ data: mockTodayData, error: null }),
            }),
          };
        },
      };
    },
    rpc: vi.fn(),
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
  mockUpcomingData = [];
  mockOnSiteData = [];
  mockNotifData = [];
}

describe('M12-HOD: HODOverview — upcoming excludes past visits', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it('does not show a visit whose scheduled_for is in the past', async () => {
    setup();
    const now = Date.now();
    mockUpcomingData = [
      {
        id: 'p1', status: 'approved', purpose: 'meeting', host_id: 'h1',
        scheduled_for: new Date(now - DAY).toISOString(),
        created_at: new Date(now - DAY).toISOString(),
        visitor: { full_name: 'Past Visitor', vendor_name: null },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    // Wait for the load to actually finish — the empty state only renders once !loading.
    await waitFor(() => {
      expect(screen.getByText('No upcoming visits')).toBeInTheDocument();
    });
    expect(screen.queryByText('Past Visitor')).not.toBeInTheDocument();
  });

  it('shows a visit whose scheduled_for is in the future', async () => {
    setup();
    const now = Date.now();
    mockUpcomingData = [
      {
        id: 'f1', status: 'approved', purpose: 'meeting', host_id: 'h1',
        scheduled_for: new Date(now + DAY).toISOString(),
        created_at: new Date(now).toISOString(),
        visitor: { full_name: 'Future Visitor', vendor_name: null },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('1 visit')).toBeInTheDocument();
    });
    expect(screen.getByText('Future Visitor')).toBeInTheDocument();
  });

  it('shows a null-scheduled visit created today', async () => {
    setup();
    const now = Date.now();
    mockUpcomingData = [
      {
        id: 'n1', status: 'pending_approval', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null,
        created_at: new Date(now).toISOString(),
        visitor: { full_name: 'Null Today Visitor', vendor_name: null },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('1 visit')).toBeInTheDocument();
    });
    expect(screen.getByText('Null Today Visitor')).toBeInTheDocument();
  });

  it('excludes a null-scheduled visit created days ago', async () => {
    setup();
    const now = Date.now();
    mockUpcomingData = [
      {
        id: 'n2', status: 'pending_approval', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null,
        created_at: new Date(now - 5 * DAY).toISOString(),
        visitor: { full_name: 'Null Old Visitor', vendor_name: null },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No upcoming visits')).toBeInTheDocument();
    });
    expect(screen.queryByText('Null Old Visitor')).not.toBeInTheDocument();
  });

  it('orders upcoming visits soonest-first', async () => {
    setup();
    const now = Date.now();
    mockUpcomingData = [
      {
        id: 'later', status: 'approved', purpose: 'meeting', host_id: 'h1',
        scheduled_for: new Date(now + 3 * DAY).toISOString(),
        created_at: new Date(now).toISOString(),
        visitor: { full_name: 'Later Visitor', vendor_name: null },
      },
      {
        id: 'sooner', status: 'approved', purpose: 'meeting', host_id: 'h1',
        scheduled_for: new Date(now + HOUR).toISOString(),
        created_at: new Date(now).toISOString(),
        visitor: { full_name: 'Sooner Visitor', vendor_name: null },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Sooner Visitor')).toBeInTheDocument();
    });
    const names = screen.getAllByText(/Visitor$/).map((el) => el.textContent);
    const sIdx = names.indexOf('Sooner Visitor');
    const lIdx = names.indexOf('Later Visitor');
    expect(sIdx).toBeGreaterThanOrEqual(0);
    expect(lIdx).toBeGreaterThan(sIdx);
  });
});
