import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { useExpectedToday } from '../../../src/lib/useExpectedToday';

const state = vi.hoisted(() => ({
  rows: [] as any[],
  handlers: [] as Array<{ config: any; cb: (payload: any) => void }>,
  subscribed: 0,
  removed: 0,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'visits') {
        return {
          select: () => ({
            in: () => ({
              gte: () => ({
                // `[gte, lt)` on IST midnights, not a `lte` on 23:59:59Z.
                lt: () => Promise.resolve({ data: state.rows, error: null }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
    channel: () => {
      const ch: any = {};
      ch.on = (_type: string, config: any, cb: (p: any) => void) => {
        state.handlers.push({ config, cb });
        return ch;
      };
      ch.subscribe = () => { state.subscribed += 1; return ch; };
      return ch;
    },
    removeChannel: () => { state.removed += 1; },
  },
}));

beforeEach(() => {
  state.rows = [];
  state.handlers = [];
  state.subscribed = 0;
  state.removed = 0;
});

afterEach(cleanup);

function visitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1', status: 'approved', scheduled_for: null,
    created_at: '2026-07-30T04:00:00Z', host_id: 'h1',
    ...overrides,
  };
}

function Probe(): React.ReactElement {
  const { visits, loading } = useExpectedToday('2026-07-30');
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <ul>{visits.map((v) => <li key={v.id}>{v.id}</li>)}</ul>
    </div>
  );
}

describe('useExpectedToday', () => {
  it('loads today\'s expected visits and clears loading', async () => {
    state.rows = [visitRow({ id: 'v1' }), visitRow({ id: 'v2' })];
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('sorts scheduled arrivals earliest-first, ahead of open-ended ones', async () => {
    state.rows = [
      visitRow({ id: 'no-time', scheduled_for: null, created_at: '2026-07-30T01:00:00Z' }),
      visitRow({ id: 'later', scheduled_for: '2026-07-30T14:00:00Z' }),
      visitRow({ id: 'earlier', scheduled_for: '2026-07-30T09:00:00Z' }),
    ];
    render(<Probe />);
    await waitFor(() => {
      const items = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(items).toEqual(['earlier', 'later', 'no-time']);
    });
  });

  it('subscribes to postgres_changes on visits', async () => {
    render(<Probe />);
    await waitFor(() => expect(state.subscribed).toBe(1));
    expect(state.handlers[0]!.config).toMatchObject({ event: '*', schema: 'public', table: 'visits' });
  });

  it('removes its channel on unmount', async () => {
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(state.subscribed).toBe(1));
    unmount();
    expect(state.removed).toBe(1);
  });

  it('refetches silently (no loading flicker) on a live change', async () => {
    state.rows = [visitRow({ id: 'v1' })];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('v1')).toBeInTheDocument());

    state.rows = [visitRow({ id: 'v1' }), visitRow({ id: 'v2' })];
    await act(async () => {
      state.handlers.forEach((h) => h.cb({ eventType: 'INSERT' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('v2')).toBeInTheDocument());
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});
