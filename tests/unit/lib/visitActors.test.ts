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

  it('returns rows unchanged when every visit is still pending a decision', async () => {
    const rows = [{ id: 'v1', status: 'pending_approval' }];
    const result = await attachVisitActors(rows as any);
    expect(result).toEqual(rows);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries the audit trail for visits that have moved past approval', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    await attachVisitActors([{ id: 'v1', status: 'checked_out' }] as any);
    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
  });

  it('attaches actor name+role for a rejected visit from the matching audit log', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', action: 'visit_rejected', created_at: '2026-01-02T00:00:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane HOD', role: 'hod' }], error: null });
    const rows = [{ id: 'v1', status: 'rejected' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor).toEqual({ name: 'Jane HOD', role: 'hod', department: null });
    expect(mockRpc).toHaveBeenCalledWith('get_profile_names', { profile_ids: ['u1'] });
  });

  it('attaches the audit log timestamp as actorAt', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', action: 'visit_approved', created_at: '2026-01-02T09:30:00Z' }],
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
        { user_id: 'u-new', entity_id: 'v1', action: 'visit_rejected', created_at: '2026-01-03T00:00:00Z' },
        { user_id: 'u-old', entity_id: 'v1', action: 'visit_approved', created_at: '2026-01-01T00:00:00Z' },
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
      data: [{ user_id: null, entity_id: 'v1', action: 'visit_rejected', created_at: '2026-01-01T00:00:00Z' }],
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

  it('leaves a visit with no matching log tagged null rather than undefined', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v2', action: 'visit_approved', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'A', role: 'guard' }], error: null });
    const rows = [{ id: 'v1', status: 'checked_in' }, { id: 'v2', status: 'walkin_approved' }];
    const result = await attachVisitActors(rows as any);
    expect(result[0]!.actor).toBeNull();
    expect(result[0]!.approvedAt).toBeNull();
    expect(result[1]!.actor).toEqual({ name: 'A', role: 'guard', department: null });
  });

  it('surfaces the visit_approved log time as approvedAt', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', action: 'visit_approved', created_at: '2026-01-02T09:30:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane HOD', role: 'hod' }], error: null });
    const result = await attachVisitActors([{ id: 'v1', status: 'checked_in' }] as any);
    expect(result[0]!.approvedAt).toBe('2026-01-02T09:30:00Z');
  });

  it('keeps approvedAt pointing at the approval when a later rejection supersedes it', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { user_id: 'u2', entity_id: 'v1', action: 'visit_rejected', created_at: '2026-01-03T00:00:00Z' },
        { user_id: 'u1', entity_id: 'v1', action: 'visit_approved', created_at: '2026-01-01T00:00:00Z' },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u2', full_name: 'Bob', role: 'guard' }], error: null });
    const result = await attachVisitActors([{ id: 'v1', status: 'rejected' }] as any);
    expect(result[0]!.actorAt).toBe('2026-01-03T00:00:00Z');
    expect(result[0]!.approvedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('leaves approvedAt null for a visit that was only ever rejected', async () => {
    mockOrder.mockResolvedValue({
      data: [{ user_id: 'u1', entity_id: 'v1', action: 'visit_rejected', created_at: '2026-01-02T00:00:00Z' }],
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane HOD', role: 'hod' }], error: null });
    const result = await attachVisitActors([{ id: 'v1', status: 'rejected' }] as any);
    expect(result[0]!.approvedAt).toBeNull();
  });
});
