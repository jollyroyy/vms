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
// Records the date bound the on-site query applied, so a test can assert the
// component actually asks Postgres for today's arrivals only.
let onSiteGteArgs: [string, string] | null = null;

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
          // General case: select → eq → in → gte → order → limit
          // `.in('status', [...])` is used both for the "upcoming" query
          // (pending_approval/approved) and the "on-site" query (checked_in
          // only) — distinguish by the statuses actually requested.
          return {
            eq: () => ({
              in: (_col: string, statuses: string[]) => {
                const isOnSiteQuery = statuses.length === 1 && statuses[0] === 'checked_in';
                return {
                  // Honour the bound rather than ignoring it: a mock that
                  // returned every row regardless would let the "today only"
                  // test pass even if the component dropped the .gte() call.
                  gte: (col: string, val: string) => {
                    if (isOnSiteQuery) onSiteGteArgs = [col, val];
                    const source: any[] = isOnSiteQuery ? mockOnSiteData : mockUpcomingData;
                    const rows = source.filter((r) => String(r[col] ?? '') >= val);
                    return {
                      order: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }),
                    };
                  },
                  order: () => ({
                    limit: () => Promise.resolve({ data: isOnSiteQuery ? mockOnSiteData : mockUpcomingData, error: null }),
                  }),
                };
              },
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
  onSiteGteArgs = null;
}

describe('M12-HOD: HODOverview — on-site section', () => {
  it('shows an empty state when no one is on site', async () => {
    setup();
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No one on site right now')).toBeInTheDocument();
    });
  });

  it('lists currently checked-in visitors with host and check-in time', async () => {
    setup();
    mockOnSiteData = [
      {
        id: 'os1', status: 'checked_in', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null,
        created_at: new Date().toISOString(),
        checked_in_at: new Date().toISOString(),
        visitor: { full_name: 'Onsite Visitor', company: 'Acme Co' },
        host: { id: 'h1', full_name: 'Dr. Sharma' },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Onsite Visitor/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Acme Co/)).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Sharma/)).toBeInTheDocument();
  });

  it('does not render the on-site count as a duplicate of the Inside stat value', async () => {
    setup();
    mockOnSiteData = [
      {
        id: 'os1', status: 'checked_in', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null,
        created_at: new Date().toISOString(),
        checked_in_at: new Date().toISOString(),
        visitor: { full_name: 'Onsite Visitor', company: null },
        host: { id: 'h1', full_name: 'Dr. Sharma' },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Onsite Visitor/)).toBeInTheDocument();
    });
    // "Inside" stat card shows 2 (from mockTodayData). The on-site widget
    // must not separately print that same numeric value as a badge/count.
    expect(screen.queryByText(/^2 visit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^2 on-site/i)).not.toBeInTheDocument();
  });

  it('shows only today\'s arrivals, dropping a visit checked in on a previous day', async () => {
    setup();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 3);
    const staleIso = yesterday.toISOString();
    const todayIso = new Date().toISOString();

    // Both rows still carry status 'checked_in' — the stale one was never
    // checked out. Only the date bound separates them.
    mockOnSiteData = [
      {
        id: 'stale', status: 'checked_in', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null, created_at: staleIso, checked_in_at: staleIso,
        visitor: { full_name: 'Stale Visitor', company: 'Old Co' },
        host: { id: 'h1', full_name: 'Dr. Sharma' },
      },
      {
        id: 'fresh', status: 'checked_in', purpose: 'meeting', host_id: 'h1',
        scheduled_for: null, created_at: todayIso, checked_in_at: todayIso,
        visitor: { full_name: 'Fresh Visitor', company: 'Acme Co' },
        host: { id: 'h1', full_name: 'Dr. Sharma' },
      },
    ];
    render(<MemoryRouter><HODOverview /></MemoryRouter>);

    // Wait for today's visitor, so we are asserting against a loaded list
    // rather than the transient pre-load empty state.
    await waitFor(() => {
      expect(screen.getByText(/Fresh Visitor/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Stale Visitor/)).not.toBeInTheDocument();

    // And pin the bound itself: the component must ask for today's arrivals.
    const today = new Date().toISOString().slice(0, 10);
    expect(onSiteGteArgs).toEqual(['checked_in_at', `${today}T00:00:00Z`]);
  });
});
