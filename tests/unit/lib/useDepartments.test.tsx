// TDD: shared live department list.
// Every role-facing screen that offers a department picker uses this hook, so an
// admin adding/renaming/deleting a department must reach guards, HODs, staff and
// the kiosk immediately — without a page reload.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { useDepartments } from '../../../src/lib/useDepartments';
import type { Department } from '../../../src/types/index';

const state = vi.hoisted(() => ({
  rows: [] as any[],
  fetchCount: 0,
  handlers: [] as Array<{ config: any; cb: (payload: any) => void }>,
  channelNames: [] as string[],
  subscribed: 0,
  removed: 0,
}));

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => {
          state.fetchCount += 1;
          return Promise.resolve({ data: state.rows, error: null });
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
  state.fetchCount = 0;
  state.handlers = [];
  state.channelNames = [];
  state.subscribed = 0;
  state.removed = 0;
});

afterEach(cleanup);

const dept = (over: Partial<Department> = {}): Department => ({
  id: 'd1', name: 'Human Resources', code: 'HR', created_at: 'now', ...over,
});

function Probe(): React.ReactElement {
  const { departments, loading } = useDepartments();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <ul>{departments.map((d) => <li key={d.id}>{d.name} ({d.code})</li>)}</ul>
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

describe('useDepartments', () => {
  it('loads departments on mount', async () => {
    state.rows = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByText('Human Resources (HR)')).toBeInTheDocument();
      expect(screen.getByText('Finance (FIN)')).toBeInTheDocument();
    });
  });

  it('clears the loading flag once loaded', async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
  });

  it('subscribes to postgres_changes on the departments table', async () => {
    render(<Probe />);
    await waitFor(() => expect(state.subscribed).toBe(1));
    expect(state.handlers).toHaveLength(1);
    expect(state.handlers[0].config).toMatchObject({
      event: '*',
      schema: 'public',
      table: 'departments',
    });
  });

  it('refetches when a department is INSERTed elsewhere (admin adds one)', async () => {
    state.rows = [dept()];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Human Resources (HR)')).toBeInTheDocument());

    state.rows = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    await emitChange({ eventType: 'INSERT' });

    await waitFor(() => expect(screen.getByText('Finance (FIN)')).toBeInTheDocument());
  });

  it('reflects a rename immediately (admin modifies one)', async () => {
    state.rows = [dept()];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Human Resources (HR)')).toBeInTheDocument());

    state.rows = [dept({ name: 'People Operations', code: 'POPS' })];
    await emitChange({ eventType: 'UPDATE' });

    await waitFor(() => expect(screen.getByText('People Operations (POPS)')).toBeInTheDocument());
    expect(screen.queryByText('Human Resources (HR)')).not.toBeInTheDocument();
  });

  it('drops a deleted department immediately (admin deletes one)', async () => {
    state.rows = [dept(), dept({ id: 'd2', name: 'Finance', code: 'FIN' })];
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('Finance (FIN)')).toBeInTheDocument());

    state.rows = [dept()];
    await emitChange({ eventType: 'DELETE' });

    await waitFor(() => expect(screen.queryByText('Finance (FIN)')).not.toBeInTheDocument());
    expect(screen.getByText('Human Resources (HR)')).toBeInTheDocument();
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
});
