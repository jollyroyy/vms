// TDD: shared live HOD list.
// The Admin Panel and every department card render "who is the head of department"
// from this hook. A failed `profiles` read (e.g. the RLS policy recursion fixed in
// migration 040) must surface as an error, never as a silently empty "No head of
// department assigned" state.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { useHods } from '../../../src/lib/useHods';
import type { Profile } from '../../../src/types/index';

const state = vi.hoisted(() => ({
  rows: [] as any[],
  rowsError: null as { message: string } | null,
  fetchCount: 0,
  eqCalls: [] as Array<[string, any]>,
  handlers: [] as Array<{ config: any; cb: (payload: any) => void }>,
  channelNames: [] as string[],
  subscribed: 0,
  removed: 0,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (col: string, val: any) => {
          state.eqCalls.push([col, val]);
          return {
            order: () => {
              state.fetchCount += 1;
              return Promise.resolve({ data: state.rows, error: state.rowsError });
            },
          };
        },
      }),
    }),
    channel: (name: string) => {
      state.channelNames.push(name);
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
  state.rowsError = null;
  state.fetchCount = 0;
  state.eqCalls = [];
  state.handlers = [];
  state.channelNames = [];
  state.subscribed = 0;
  state.removed = 0;
});

afterEach(cleanup);

const hod = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  role: 'hod',
  department_id: 'd1',
  created_at: 'now',
  ...over,
} as Profile);

function Probe(): React.ReactElement {
  const { hods, loading, error } = useHods();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <ul>{hods.map((h) => <li key={h.id}>{h.full_name}</li>)}</ul>
    </div>
  );
}

/** Fires every registered postgres_changes handler, as Supabase would on a DB write. */
async function emitChange(payload: any = { eventType: 'INSERT' }) {
  await act(async () => {
    state.handlers.forEach((h) => h.cb(payload));
    await Promise.resolve();
  });
}

describe('useHods', () => {
  it('loads HODs on mount and renders their names', async () => {
    state.rows = [hod(), hod({ id: 'p2', full_name: 'Ben Cole' })];
    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('Asha Rao')).toBeInTheDocument();
      expect(screen.getByText('Ben Cole')).toBeInTheDocument();
    });
  });

  it('clears the loading flag once loaded', async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  });

  it("filters on role='hod'", async () => {
    render(<Probe />);
    await waitFor(() => expect(state.eqCalls).toContainEqual(['role', 'hod']));
  });

  it('subscribes to postgres_changes on the profiles table', async () => {
    render(<Probe />);
    await waitFor(() => expect(state.subscribed).toBe(1));
    expect(state.handlers).toHaveLength(1);
    expect(state.handlers[0].config).toMatchObject({
      event: '*',
      schema: 'public',
      table: 'profiles',
    });
  });

  it('refetches when a profiles change is emitted (a newly promoted HOD appears)', async () => {
    state.rows = [hod()];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    state.rows = [hod(), hod({ id: 'p2', full_name: 'Ben Cole' })];
    await emitChange({ eventType: 'UPDATE' });

    await waitFor(() => expect(screen.getByText('Ben Cole')).toBeInTheDocument());
  });

  it('drops a demoted HOD when a change is emitted', async () => {
    state.rows = [hod(), hod({ id: 'p2', full_name: 'Ben Cole' })];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Ben Cole')).toBeInTheDocument());

    state.rows = [hod()];
    await emitChange({ eventType: 'UPDATE' });

    await waitFor(() => expect(screen.queryByText('Ben Cole')).not.toBeInTheDocument());
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
  });

  it('removes its channel on unmount so subscriptions do not leak', async () => {
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(state.subscribed).toBe(1));
    unmount();
    expect(state.removed).toBe(1);
  });

  it('handles a null data response without crashing', async () => {
    state.rows = null as any;
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('surfaces a failed load as an error instead of an empty list', async () => {
    state.rows = null as any;
    state.rowsError = { message: 'infinite recursion detected in policy for relation "profiles"' };
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent(
      'infinite recursion detected in policy for relation "profiles"'
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('keeps previously loaded HODs on screen when a later refetch fails', async () => {
    state.rows = [hod()];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Asha Rao')).toBeInTheDocument());

    state.rowsError = { message: 'infinite recursion detected in policy for relation "profiles"' };
    await emitChange({ eventType: 'UPDATE' });

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent(
      'infinite recursion detected in policy for relation "profiles"'
    ));
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
  });
});
