import { describe, it, expect, vi, beforeEach } from 'vitest';

// The regression this locks: Dispatch Security / Notify Admin used to run
//
//   update({ remarks: ((row.remarks && ' - ') ? '' : '') + suffix })
//
// on `visits`, which always evaluates to the bare suffix — so escalating a
// watchlist match OVERWROTE `visits.remarks`, the walk-in note an HOD reads
// when deciding an approval (migration 068) and that Reports prints.
// Escalation is a message to a person; it belongs in `notifications`.

const state = vi.hoisted(() => ({
  admins: [] as { id: string }[],
  existing: [] as { id: string; recipient_id: string }[],
  inserts: [] as unknown[],
  updates: [] as { table: string; payload: unknown }[],
  tablesWritten: [] as string[],
}));

vi.mock('../../../src/supabaseClient', () => {
  const builder = (table: string): any => {
    const b: any = {};
    b.select = () => b;
    b.eq = () => b;
    b.in = () => b;
    b.insert = (payload: unknown) => {
      state.tablesWritten.push(table);
      state.inserts.push(payload);
      return Promise.resolve({ error: null });
    };
    b.update = (payload: unknown) => {
      state.tablesWritten.push(table);
      state.updates.push({ table, payload });
      return b;
    };
    // Terminal await on the select chain.
    b.then = (resolve: (v: unknown) => void) =>
      resolve(
        table === 'profiles'
          ? { data: state.admins, error: null }
          : { data: state.existing, error: null },
      );
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

import { escalateWatchlistMatch } from '../../../src/lib/notifyWatchlistEscalation';

const args = (action: 'dispatch' | 'notify' = 'dispatch') => ({
  visitId: 'visit-1',
  visitorName: 'D. Mercer',
  reason: 'Trespass',
  action,
});

beforeEach(() => {
  state.admins = [{ id: 'admin-1' }, { id: 'admin-2' }];
  state.existing = [];
  state.inserts = [];
  state.updates = [];
  state.tablesWritten = [];
});

describe('escalateWatchlistMatch', () => {
  it('never touches the visits table', async () => {
    await escalateWatchlistMatch(args());
    expect(state.tablesWritten).not.toContain('visits');
  });

  it('never writes a remarks column anywhere', async () => {
    await escalateWatchlistMatch(args());
    const payloads = [...state.inserts, ...state.updates.map((u) => u.payload)];
    for (const p of payloads.flat()) {
      expect(Object.keys(p as object)).not.toContain('remarks');
    }
  });

  it('notifies every admin, one row each, related to the visit', async () => {
    const res = await escalateWatchlistMatch(args());
    expect(res.ok).toBe(true);
    const rows = state.inserts.flat() as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recipient_id).sort()).toEqual(['admin-1', 'admin-2']);
    for (const r of rows) {
      expect(r.type).toBe('watchlist_escalation');
      expect(r.related_id).toBe('visit-1');
      expect(r.is_read).toBe(false);
    }
  });

  it('names the visitor and the watchlist reason in the body', async () => {
    await escalateWatchlistMatch(args());
    const [row] = state.inserts.flat() as Record<string, unknown>[];
    expect(row.body).toContain('D. Mercer');
    expect(row.body).toContain('Trespass');
  });

  it('omits the reason cleanly when none is recorded', async () => {
    await escalateWatchlistMatch({ ...args(), reason: null });
    const [row] = state.inserts.flat() as Record<string, unknown>[];
    expect(row.body).not.toMatch(/null|undefined|\(\)/);
  });

  // The bell badge counts unread. A second press must resurface the alert for
  // an admin who already read the first, without stacking a duplicate.
  it('re-raises an existing alert instead of duplicating it', async () => {
    state.existing = [
      { id: 'n-1', recipient_id: 'admin-1' },
      { id: 'n-2', recipient_id: 'admin-2' },
    ];
    await escalateWatchlistMatch(args());
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].payload).toMatchObject({ is_read: false });
  });

  // A success toast for a message with nowhere to go is the same class of lie
  // as a "Gate Status: Operational" chip that is always green.
  it('reports failure rather than success when no admin exists', async () => {
    state.admins = [];
    const res = await escalateWatchlistMatch(args());
    expect(res.ok).toBe(false);
    expect(state.inserts).toHaveLength(0);
  });

  it('uses different copy for dispatch and for review', async () => {
    await escalateWatchlistMatch(args('dispatch'));
    const dispatchTitle = (state.inserts.flat()[0] as Record<string, unknown>).title;
    state.inserts = [];
    await escalateWatchlistMatch(args('notify'));
    const notifyTitle = (state.inserts.flat()[0] as Record<string, unknown>).title;
    expect(dispatchTitle).not.toBe(notifyTitle);
  });
});
