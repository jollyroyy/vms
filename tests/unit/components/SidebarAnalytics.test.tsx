import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import SidebarAnalytics from '../../../src/components/layout/SidebarAnalytics';

/* ─── Supabase mock ──────────────────────────────────────────────────── */

// Every table this widget touches is recorded, so a reintroduced gate_passes
// query fails the test rather than quietly returning an empty tile.
const queriedTables: string[] = [];
const subscribedTables: string[] = [];

let mockVisits: Array<{ id: string; status: string }> = [];

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      queriedTables.push(table);
      return {
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: mockVisits, error: null }),
          }),
        }),
      };
    },
    channel: () => {
      const ch: any = {};
      ch.on = (_event: string, opts: { table?: string }) => {
        if (opts?.table) subscribedTables.push(opts.table);
        return ch;
      };
      ch.subscribe = vi.fn().mockReturnValue(ch);
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

/* ─── Tests ──────────────────────────────────────────────────────────── */

const renderWidget = (isCollapsed = false) =>
  render(<SidebarAnalytics deptId="dept-1" isCollapsed={isCollapsed} />);

describe('SidebarAnalytics (admin live widget)', () => {
  beforeEach(() => {
    queriedTables.length = 0;
    subscribedTables.length = 0;
    mockVisits = [];
  });
  afterEach(cleanup);

  it('renders the three visitor tiles', async () => {
    renderWidget();
    expect(await screen.findByText('Inside Now')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
  });

  it('shows zeroes when the department has no visits today', async () => {
    renderWidget();
    await waitFor(() => expect(screen.getByText('Inside Now')).toBeTruthy());
    expect(screen.getAllByText('0').length).toBe(3);
  });

  it('counts inside, pending and approved from visit status', async () => {
    mockVisits = [
      { id: 'v1', status: 'checked_in' },
      { id: 'v2', status: 'checked_in' },
      { id: 'v3', status: 'pending_approval' },
      { id: 'v4', status: 'approved' },
      { id: 'v5', status: 'walkin_approved' },
      { id: 'v6', status: 'checked_out' },
    ];
    renderWidget();
    // inside = 2 (checked_in), approved = 2 (approved + walkin_approved),
    // pending = 1. checked_out counts towards none of them.
    await waitFor(() => expect(screen.getAllByText('2').length).toBe(2));
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders no Gate Passes tile', async () => {
    renderWidget();
    await waitFor(() => expect(screen.getByText('Inside Now')).toBeTruthy());
    expect(screen.queryByText(/gate pass/i)).toBeNull();
  });

  it('never queries or subscribes to gate_passes', async () => {
    renderWidget();
    await waitFor(() => expect(queriedTables).toContain('visits'));
    expect(queriedTables).not.toContain('gate_passes');
    expect(subscribedTables).not.toContain('gate_passes');
  });

  it('collapses to the inside and pending counts only', async () => {
    mockVisits = [{ id: 'v1', status: 'checked_in' }];
    renderWidget(true);
    await waitFor(() => expect(screen.getByTitle('Inside now')).toBeTruthy());
    expect(screen.getByTitle('Pending')).toBeTruthy();
    expect(screen.queryByText('Approved')).toBeNull();
  });
});
