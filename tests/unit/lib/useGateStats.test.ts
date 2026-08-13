import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useGateStats } from '../../../src/lib/useGateStats';

const mockRows = vi.hoisted(() => ({ current: [] as any[] }));
const orCalls = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: () => ({
        select: () => ({
          or: (filters: string) => {
            orCalls.current.push(filters);
            return Promise.resolve({ data: mockRows.current, error: null });
          },
        }),
      }),
      channel: () => ch,
      removeChannel: vi.fn(),
    },
  };
});

const TODAY = '2026-08-02';

// Helper: a visit row as the KPI query selects it.
function row(over: Partial<{ id: string; status: string; checked_in_at: string | null; scheduled_for: string | null }>) {
  return {
    id: Math.random().toString(36).slice(2),
    status: 'approved',
    checked_in_at: null,
    scheduled_for: null,
    ...over,
  };
}

afterEach(() => { cleanup(); mockRows.current = []; orCalls.current = []; });

describe('useGateStats', () => {
  it('reports zeros when nothing happened today', async () => {
    const { result } = renderHook(() => useGateStats(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toMatchObject({
      entered: 0, inside: 0, checkedOut: 0, declined: 0,
    });
  });

  // ── The regression this hook exists to prevent ────────────────────────────
  //
  // `visits.status` holds ONE value, so a visitor who arrived at 09:00 and left
  // at 11:00 is `checked_out` — not `checked_in`. Deriving BOTH "how many are
  // inside" and "how many came through today" from `status === 'checked_in'`
  // makes the two tiles render the identical number, always. They are different
  // questions and must stay different queries.
  describe('entered vs inside are never the same query', () => {
    it('counts a departed visitor in entered but NOT in inside', async () => {
      mockRows.current = [
        // Still here.
        row({ status: 'checked_in', checked_in_at: '2026-08-02T09:00:00Z' }),
        row({ status: 'checked_in', checked_in_at: '2026-08-02T09:30:00Z' }),
        // Came and left — must count as entered, must NOT count as inside.
        row({ status: 'checked_out', checked_in_at: '2026-08-02T08:00:00Z' }),
        row({ status: 'checked_out', checked_in_at: '2026-08-02T08:15:00Z' }),
        row({ status: 'checked_out', checked_in_at: '2026-08-02T08:30:00Z' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.stats.inside).toBe(2);
      expect(result.current.stats.checkedOut).toBe(3);
      expect(result.current.stats.entered).toBe(5);
      // The whole point: these must differ.
      expect(result.current.stats.entered).not.toBe(result.current.stats.inside);
    });

    it('holds the invariant entered === inside + checkedOut', async () => {
      mockRows.current = [
        row({ status: 'checked_in', checked_in_at: '2026-08-02T09:00:00Z' }),
        row({ status: 'checked_out', checked_in_at: '2026-08-02T08:00:00Z' }),
        row({ status: 'checked_out', checked_in_at: '2026-08-02T08:20:00Z' }),
        // Never arrived — must not count toward entered.
        row({ status: 'approved' }),
        row({ status: 'pending_approval' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));

      const { entered, inside, checkedOut } = result.current.stats;
      expect(entered).toBe(inside + checkedOut);
      expect(entered).toBe(3);
    });

    it('excludes visitors who never reached the gate from entered', async () => {
      mockRows.current = [
        row({ status: 'approved' }),
        row({ status: 'walkin_approved' }),
        row({ status: 'rejected' }),
        row({ status: 'no_show' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.entered).toBe(0);
      expect(result.current.stats.inside).toBe(0);
    });
  });

  describe('the approval counts are not this hook’s job', () => {
    // Both populations are segments of the Visitors surface, counted there
    // from that page's own array. Reporting them here as well would put one
    // number on two screens behind two independent queries, with nothing
    // forcing them to agree. Client instruction, 2026-08-13.
    it('reports no preApproved or walkInApproved field', async () => {
      mockRows.current = [
        row({ status: 'approved' }),
        row({ status: 'walkin_approved' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats).not.toHaveProperty('preApproved');
      expect(result.current.stats).not.toHaveProperty('walkInApproved');
    });

    // …but `overdue` still spans BOTH approval routes: a visitor is overdue
    // whichever way they were approved. Narrowing it to one status is the
    // mistake the removal above could invite.
    it('still counts an overdue visit from either approval route', async () => {
      mockRows.current = [
        row({ status: 'approved', scheduled_for: '2026-08-02T01:00:00Z' }),
        row({ status: 'walkin_approved', scheduled_for: '2026-08-02T01:00:00Z' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.overdue).toBe(2);
    });
  });

  describe('noShow', () => {
    // A pre-approval's scheduled moment passed with nobody arriving; a
    // nightly sweep marks it. Must count only that status.
    it('counts status === no_show only, not rejected or cancelled', async () => {
      mockRows.current = [
        row({ status: 'no_show' }),
        row({ status: 'no_show' }),
        row({ status: 'rejected' }),
        row({ status: 'cancelled' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.noShow).toBe(2);
    });
  });

  // ── Part 2 regression: the window must not be created_at alone ────────────
  //
  // A pre-approval created last week for a visit scheduled today, or a
  // no-show swept overnight (created days before the sweep), both fall
  // outside a created_at-only window. The hook must query with created_at OR
  // scheduled_for landing on `today` — otherwise the count is 0 forever for
  // a no-show whose created_at is days in the past.
  describe('widened created_at OR scheduled_for window', () => {
    it('builds an .or() filter covering both created_at and scheduled_for for today', async () => {
      mockRows.current = [
        row({ status: 'no_show', scheduled_for: `${TODAY}T09:00:00Z` }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(orCalls.current).toHaveLength(1);
      const filter = orCalls.current[0];
      expect(filter).toContain(`created_at.gte.${TODAY}T00:00:00Z`);
      expect(filter).toContain(`created_at.lte.${TODAY}T23:59:59Z`);
      expect(filter).toContain(`scheduled_for.gte.${TODAY}T00:00:00Z`);
      expect(filter).toContain(`scheduled_for.lte.${TODAY}T23:59:59Z`);

      // Regression: a visit created before today, scheduled for today, and
      // swept to no_show overnight must still surface on the tile.
      expect(result.current.stats.noShow).toBe(1);
    });
  });

  describe('declined', () => {
    // `rejected` is an HOD declining the request — usually before the visitor
    // ever reached the gate. It is NOT the guard turning someone away, which is
    // why the tile is labelled "Declined" and not "Denied Entry".
    it('counts rejected only, not cancelled or no_show', async () => {
      mockRows.current = [
        row({ status: 'rejected' }),
        row({ status: 'rejected' }),
        row({ status: 'cancelled' }),
        row({ status: 'no_show' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.declined).toBe(2);
    });
  });

  describe('queue counts', () => {
    it('counts walk-ins waiting on a host decision', async () => {
      mockRows.current = [
        row({ status: 'pending_approval' }),
        row({ status: 'pending_approval' }),
        row({ status: 'approved' }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.awaitingApproval).toBe(2);
    });

    it('counts an approved visit as overdue once its booked time has passed', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      mockRows.current = [
        row({ status: 'approved', scheduled_for: past }),
        row({ status: 'approved', scheduled_for: future }),
        // Open-ended pre-approval — no booked time, so it can never be overdue.
        row({ status: 'approved', scheduled_for: null }),
        // Already arrived, so no longer awaited however late it was.
        row({ status: 'checked_in', checked_in_at: past, scheduled_for: past }),
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.overdue).toBe(1);
    });
  });
});
