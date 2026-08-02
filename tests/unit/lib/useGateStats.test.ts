import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useGateStats } from '../../../src/lib/useGateStats';

const mockRows = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: () => ({
        select: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: mockRows.current, error: null }),
          }),
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

afterEach(() => { cleanup(); mockRows.current = []; });

describe('useGateStats', () => {
  it('reports zeros when nothing happened today', async () => {
    const { result } = renderHook(() => useGateStats(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toMatchObject({
      expected: 0, entered: 0, inside: 0, checkedOut: 0, declined: 0,
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

  describe('expected', () => {
    it('counts both approval routes and nothing else', async () => {
      mockRows.current = [
        row({ status: 'approved' }),          // pre-approval
        row({ status: 'walkin_approved' }),   // approved at the gate
        row({ status: 'pending_approval' }),  // not yet decided
        row({ status: 'checked_in', checked_in_at: '2026-08-02T09:00:00Z' }), // already arrived
      ];
      const { result } = renderHook(() => useGateStats(TODAY));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.stats.expected).toBe(2);
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
