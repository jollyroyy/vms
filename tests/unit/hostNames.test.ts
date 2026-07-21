import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../src/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() }, rpc: mockRpc },
}));

import { attachHostNames } from '../../src/lib/hostNames';

describe('M8-HOST: attachHostNames', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('attaches host names to rows when RPC returns data', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: 'h1', full_name: 'Alice' },
        { id: 'h2', full_name: 'Bob' },
      ],
      error: null,
    });
    const rows = [{ host_id: 'h1' }, { host_id: 'h2' }] as any[];
    const result = await attachHostNames(rows);
    expect(result[0]!.host?.full_name).toBe('Alice');
    expect(result[1]!.host?.full_name).toBe('Bob');
    expect(mockRpc).toHaveBeenCalledWith('get_profile_names', { profile_ids: ['h1', 'h2'] });
  });

  it('sets host to null for missing host_id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const rows = [{ host_id: 'h1' }] as any[];
    const result = await attachHostNames(rows);
    expect(result[0]!.host).toBeNull();
  });

  it('returns rows unchanged when rows array is empty', async () => {
    const result = await attachHostNames([]);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns rows unchanged when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    const rows = [{ host_id: 'h1' }] as any[];
    const result = await attachHostNames(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.host).toBeUndefined();
  });

  it('deduplicates host_ids', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'h1', full_name: 'Alice' }], error: null });
    const rows = [{ host_id: 'h1' }, { host_id: 'h1' }] as any[];
    await attachHostNames(rows);
    expect(mockRpc.mock.calls[0]![1]!.profile_ids).toEqual(['h1']);
  });

  it('handles null host_id values gracefully', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const rows = [{ host_id: null }] as any[];
    const result = await attachHostNames(rows);
    expect(result).toHaveLength(1);
  });
});
