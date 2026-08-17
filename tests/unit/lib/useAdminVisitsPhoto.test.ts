// REGRESSION GUARD (client report, 2026-08-17): the admin console showed
// monograms instead of visitor photos. useAdminVisits was the one list hook
// in the app that never mapped photo_data onto photo_url — every other
// list-feeding hook does (useTodayVisits, useGateActivity, Reports) — so
// every admin tab rendered a two-letter monogram for a visitor whose photo
// had already arrived in the row. Its select also had to start asking for
// the host's avatar_url, or the host's face is a monogram no matter what is
// in profiles.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useAdminVisits, ADMIN_VISIT_SELECT } from '../../../src/lib/useAdminVisits';

const mockRows = vi.hoisted(() => ({ current: null as any[] | null }));

vi.mock('../../../src/supabaseClient', () => {
  const ch: any = {};
  ch.on = () => ch;
  ch.subscribe = () => ch;

  // A chainable query builder — select/order/or/limit all return the builder
  // itself, and awaiting it resolves the mocked rows, matching the shape
  // useAdminVisits actually calls (order then either .or or .or+.limit).
  const builder: any = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.or = () => builder;
  builder.limit = () => builder;
  builder.then = (resolve: (v: { data: any; error: null }) => void) =>
    resolve({ data: mockRows.current, error: null });

  return {
    supabase: {
      from: () => builder,
      channel: () => ch,
      removeChannel: vi.fn(),
    },
  };
});

afterEach(() => {
  cleanup();
  mockRows.current = null;
});

describe('useAdminVisits', () => {
  it('maps photo_data onto photo_url', async () => {
    mockRows.current = [{ id: 'v1', photo_data: 'data:image/jpeg;base64,xyz' }];
    const { result } = renderHook(() => useAdminVisits({ kind: 'today' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits[0].photo_url).toBe('data:image/jpeg;base64,xyz');
  });

  // Undefined is what every `v.photo_url ? … : monogram` branch in the app
  // treats as falsy; the mapping must not invent a different falsy shape
  // (e.g. leaving it `null`) from the one every other list hook produces.
  it('leaves photo_url undefined, not null, when photo_data is null', async () => {
    mockRows.current = [{ id: 'v1', photo_data: null }];
    const { result } = renderHook(() => useAdminVisits({ kind: 'today' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visits[0].photo_url).toBeUndefined();
    expect(result.current.visits[0].photo_url).not.toBeNull();
  });

  it('requests the host\'s avatar_url in its select', () => {
    expect(ADMIN_VISIT_SELECT).toMatch(/host:profiles!visits_host_id_fkey\([^)]*avatar_url[^)]*\)/);
  });
});
