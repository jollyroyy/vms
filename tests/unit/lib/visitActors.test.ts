import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc, mockOrder } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockOrder: vi.fn(),
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import { attachVisitActors } from '../../../src/lib/visitActors';

function chain() {
  return { select: () => ({ eq: () => ({ in: () => ({ in: () => ({ order: mockOrder }) }) }) }) };
}

describe('M-VISIT-ACTORS: attachVisitActors', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockOrder.mockReset();
    mockFrom.mockImplementation(() => chain());
  });

  it('returns rows unchanged when no visit is in an actionable status', async () => {
    const rows = [{ id: 'v1', status: 'checked_in' }];
    const result = await attachVisitActors(rows as any);
    expect(result).toEqual(rows);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('attaches actor name+role for a rejected visit from the matching audit log', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', created_at: '2026-01-02T00:00:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane HOD', role: 'hod' }], error: null });
    const rows = [{ id: 'v1', status: 'rejected' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor).toEqual({ name: 'Jane HOD', role: 'hod' });
    expect(mockRpc).toHaveBeenCalledWith('get_profile_names', { profile_ids: ['u1'] });
  });

  it('attaches the audit log timestamp as actorAt', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', created_at: '2026-01-02T09:30:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane HOD', role: 'hod' }], error: null });
    const rows = [{ id: 'v1', status: 'walkin_approved' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actorAt).toBe('2026-01-02T09:30:00Z');
  });

  it('picks the first (most recent, already ordered desc) log when a visit has multiple entries', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { user_id: 'u-new', entity_id: 'v1', created_at: '2026-01-03T00:00:00Z' },
        { user_id: 'u-old', entity_id: 'v1', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u-new', full_name: 'Latest Actor', role: 'guard' }], error: null });
    const rows = [{ id: 'v1', status: 'rejected' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor?.name).toBe('Latest Actor');
  });

  it('sets actor to null when the matching log has no user_id (system action)', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: null, entity_id: 'v1', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    const rows = [{ id: 'v1', status: 'rejected' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns rows unchanged when the audit_logs query errors', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const rows = [{ id: 'v1', status: 'rejected' }];
    const result = await attachVisitActors(rows as any);
    expect(result).toEqual(rows);
  });

  it('only attaches actors to actionable-status visits, leaving others untouched', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v2', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'A', role: 'guard' }], error: null });
    const rows = [{ id: 'v1', status: 'checked_in' }, { id: 'v2', status: 'walkin_approved' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor).toBeNull(); // not queried for (not actionable), but harmlessly tagged null
    expect(result[1]!.actor).toEqual({ name: 'A', role: 'guard' });
  });
});
