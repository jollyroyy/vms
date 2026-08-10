// Verifies App.tsx's forced-password-change gate: a signed-in user who still
// owes a password change (my_must_change_password() === true, migration 064)
// must see ForcePasswordChange and never the app shell — and, just as
// important, a user whose flag is false must NOT be blocked (the regression
// that matters most: locking out every existing user because the RPC exists).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import App from '../../src/App';

const { signOut, getSession, onAuthStateChange, rpc, from, channel, removeChannel, getUser } = vi.hoisted(() => {
  const makeBuilder = (result: any = { data: null, error: null }): any => {
    const builder: any = {};
    const methods = [
      'select', 'eq', 'neq', 'in', 'is', 'not', 'or', 'ilike', 'like',
      'gte', 'lte', 'gt', 'lt', 'contains', 'order', 'limit', 'range',
      'update', 'insert', 'upsert', 'delete', 'maybeSingle', 'single',
    ];
    methods.forEach((m) => { builder[m] = () => builder; });
    builder.then = (resolve: any) => Promise.resolve(result).then(resolve);
    return builder;
  };
  const channelObj: any = {};
  channelObj.on = () => channelObj;
  channelObj.subscribe = () => channelObj;
  return {
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    rpc: vi.fn(),
    from: vi.fn(() => makeBuilder()),
    channel: vi.fn(() => channelObj),
    removeChannel: vi.fn(),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };
});

vi.mock('../../src/supabaseClient', () => ({
  supabase: { auth: { signOut, getSession, onAuthStateChange, getUser }, rpc, from, channel, removeChannel },
}));

vi.mock('../../src/lib/theme', () => ({
  ThemeProvider: (props: { children: any }) => props.children,
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

const SESSION = {
  user: { id: 'user-1', app_metadata: { role: 'staff' } },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(cleanup);

describe('App: forced password change gate', () => {
  it('a signed-in user whose flag is true sees the gate, not the app shell', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    rpc.mockResolvedValue({ data: true, error: null });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/administrator reset your password/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Secure Gate — Visitor Management System')).not.toBeInTheDocument();
  });

  it('a signed-in user whose flag is false reaches the app normally', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    rpc.mockResolvedValue({ data: false, error: null });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Secure Gate — Visitor Management System')).toBeInTheDocument();
    });
    expect(screen.queryByText(/administrator reset your password/i)).not.toBeInTheDocument();
  });

  it('does not lock the user out when the flag check errors — fails open, not closed', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Secure Gate — Visitor Management System')).toBeInTheDocument();
    });
    expect(screen.queryByText(/administrator reset your password/i)).not.toBeInTheDocument();
  });

  it('calls my_must_change_password (not a direct profiles select) to check the flag', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    rpc.mockResolvedValue({ data: false, error: null });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('my_must_change_password');
    });
  });
});
