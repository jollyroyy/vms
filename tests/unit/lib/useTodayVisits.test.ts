// New hook (src/lib/useTodayVisits.ts) — replaced useInsideNow. The whole
// point of this hook is that it fetches the WHOLE day, unfiltered by status,
// so all five dashboard drill-downs can share one fetch and one subscription.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useTodayVisits } from '../../../src/lib/useTodayVisits';

const mockRows = vi.hoisted(() => ({ current: null as any[] | null }));
const gteSpy = vi.hoisted(() => vi.fn());
const lteSpy = vi.hoisted(() => vi.fn());
const onSpy = vi.hoisted(() => vi.fn());
const removeChannelSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = (...args: any[]) => { onSpy(...args); return ch; };
  ch.subscribe = () => ch;
  return {
    supabase: {
      from: () => ({
        select: () => ({
          gte: (...gArgs: any[]) => {
            gteSpy(...gArgs);
            return {
              lte: (...lArgs: any[]) => {
                lteSpy(...lArgs);
                return Promise.resolve({ data: mockRows.current });
              },
            };
          },
        }),
      }),
      channel: () => ch,
      removeChannel: removeChannelSpy,
    },
  };
});

// Kept as pass-through identity mocks: useTodayVisits' own contract is what is
// under test here, not the host-name/actor-attachment lookups, which have
// their own test files.
vi.mock('../../../src/lib/hostNames', () => ({
  attachHostNames: async (rows: any[]) => rows,
}));
vi.mock('../../../src/lib/visitActors', () => ({
  attachVisitActors: async (rows: any[]) => rows,
}));

const TODAY = '2026-08-03';

afterEach(() => {
  cleanup();
  mockRows.current = null;
  gteSpy.mockClear();
  lteSpy.mockClear();
  onSpy.mockClear();
  removeChannelSpy.mockClear();
});

describe('useTodayVisits', () => {
  it('fetches the whole day: gte/lte bound the created_at column to midnight-to-midnight UTC', async () => {
    mockRows.current = [];
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(gteSpy).toHaveBeenCalledWith('created_at', `${TODAY}T00:00:00Z`);
    expect(lteSpy).toHaveBeenCalledWith('created_at', `${TODAY}T23:59:59Z`);
  });

  it('does not filter by status — every status shares this one fetch', async () => {
    mockRows.current = [
      { id: 'a', status: 'pending_approval', created_at: TODAY },
      { id: 'b', status: 'checked_in', created_at: TODAY },
      { id: 'c', status: 'rejected', created_at: TODAY },
      { id: 'd', status: 'checked_out', created_at: TODAY },
    ];
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.visits.map((v) => v.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('subscribes to postgres_changes on visits and reloads silently on an event', async () => {
    mockRows.current = [{ id: 'a', status: 'approved', created_at: TODAY }];
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(onSpy).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: '*', schema: 'public', table: 'visits' }),
      expect.any(Function),
    );

    // Trigger the registered callback and confirm it reloads without
    // flashing `loading` back to true (a "silent" refresh).
    mockRows.current = [
      { id: 'a', status: 'approved', created_at: TODAY },
      { id: 'b', status: 'checked_in', created_at: TODAY },
    ];
    const callback = onSpy.mock.calls[0][2];
    callback();
    await waitFor(() => expect(result.current.visits).toHaveLength(2));
    expect(result.current.loading).toBe(false);
  });

  it('removes the channel on unmount', () => {
    mockRows.current = [];
    const { unmount } = renderHook(() => useTodayVisits(TODAY));
    unmount();
    expect(removeChannelSpy).toHaveBeenCalledTimes(1);
  });

  it('maps photo_data onto photo_url', async () => {
    mockRows.current = [{ id: 'a', status: 'approved', created_at: TODAY, photo_data: 'data:image/jpeg;base64,xyz' }];
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits[0].photo_url).toBe('data:image/jpeg;base64,xyz');
  });

  it('leaves photo_url undefined when photo_data is null', async () => {
    mockRows.current = [{ id: 'a', status: 'approved', created_at: TODAY, photo_data: null }];
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits[0].photo_url).toBeUndefined();
  });

  it('returns an empty array, not undefined, and does not throw when the query returns null data', async () => {
    mockRows.current = null;
    const { result } = renderHook(() => useTodayVisits(TODAY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits).toEqual([]);
  });
});
