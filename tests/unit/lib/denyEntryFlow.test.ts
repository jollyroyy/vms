import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deny Entry used to be a dead `<Link to="/guard/dashboard">` on the ID
// Verification card — it navigated to the page the guard was already on. This
// is the real write it should always have been: a guard may only refuse a
// visitor who was already approved (never one already inside, and never one
// still awaiting a decision), and a reason is mandatory before anything is
// written.

const state = vi.hoisted(() => ({
  updates: [] as unknown[],
  ids: [] as unknown[],
}));

vi.mock('../../../src/supabaseClient', () => {
  const builder = (): any => {
    const b: any = {};
    b.update = (payload: unknown) => { state.updates.push(payload); return b; };
    b.eq = (_col: string, val: unknown) => { state.ids.push(val); return Promise.resolve({ error: null }); };
    return b;
  };
  return { supabase: { from: () => builder() } };
});

import { canDenyEntry, denyEntry, DENY_REASON_MIN } from '../../../src/lib/denyEntryFlow';
import type { Visit } from '../../../src/types/index';

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'v1', ref_number: 'VIS-1', visitor_id: 'p1', department_id: 'd1', host_id: 'h1',
    purpose: 'meeting', photo_path: null, photo_data: null, status: 'approved',
    checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
    carrying_material: false, scheduled_for: null, qr_token: 't', qr_expires_at: null,
    created_at: '2026-08-15T04:00:00Z',
    ...overrides,
  } as Visit;
}

beforeEach(() => {
  state.updates = [];
  state.ids = [];
});

describe('canDenyEntry', () => {
  it('is true for an approved visit', () => {
    expect(canDenyEntry(visit({ status: 'approved' }))).toBe(true);
  });

  it('is true for an approved walk-in', () => {
    expect(canDenyEntry(visit({ status: 'walkin_approved' }))).toBe(true);
  });

  it('is false once the visitor is already inside', () => {
    expect(canDenyEntry(visit({ status: 'checked_in' }))).toBe(false);
  });

  it('is false for a walk-in still awaiting a decision', () => {
    expect(canDenyEntry(visit({ status: 'pending_approval' }))).toBe(false);
  });

  it('is false for a visit already rejected', () => {
    expect(canDenyEntry(visit({ status: 'rejected' }))).toBe(false);
  });
});

describe('denyEntry', () => {
  it('refuses an empty reason without calling supabase', async () => {
    const res = await denyEntry(visit(), '');
    expect(res.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it('refuses a whitespace-only reason without calling supabase', async () => {
    const res = await denyEntry(visit(), '   ');
    expect(res.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it('refuses a reason shorter than DENY_REASON_MIN', async () => {
    const short = 'x'.repeat(DENY_REASON_MIN - 1);
    const res = await denyEntry(visit(), short);
    expect(res.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it('refuses a checked_in visit with the "already inside" message, without calling supabase', async () => {
    const res = await denyEntry(visit({ status: 'checked_in' }), 'no photo ID produced');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/already inside/i);
    expect(state.updates).toHaveLength(0);
  });

  it('writes status rejected and the trimmed reason for a refusable visit', async () => {
    const res = await denyEntry(visit({ id: 'v9', status: 'approved' }), '  no photo ID produced  ');
    expect(res.ok).toBe(true);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ status: 'rejected', rejection_reason: 'no photo ID produced' });
    expect(state.ids).toEqual(['v9']);
  });
});
