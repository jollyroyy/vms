// Verifies App.tsx's two startup gates.
//
// The forced-password-change gate (my_must_change_password(), migration 064): a
// signed-in user who still owes a password change must see ForcePasswordChange
// and never the app shell — and, just as important, a user whose flag is false
// must NOT be blocked (the regression that matters most: locking out every
// existing user because the RPC exists).
//
// The SUSPENSION gate (my_account_active(), migration 094) sits in front of it
// and follows the same rules, including failing OPEN on error. Both are mocked
// BY FUNCTION NAME below: a single `rpc.mockResolvedValue` would answer both
// questions with one value, and `{ data: false }` means opposite things to
// them — "nothing owed" to one, "suspended" to the other.
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

/** Script the two startup RPCs independently. Anything else resolves empty. */
function mockGates(
  { mustChange = false, active = true }:
  { mustChange?: boolean | null; active?: boolean | null } = {},
  error: { message: string } | null = null,
) {
  rpc.mockImplementation((fn: string) => {
    if (fn === 'my_must_change_password') return Promise.resolve({ data: mustChange, error });
    if (fn === 'my_account_active') return Promise.resolve({ data: active, error });
    return Promise.resolve({ data: null, error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(cleanup);

describe('App: forced password change gate', () => {
  it('a signed-in user whose flag is true sees the gate, not the app shell', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates({ mustChange: true });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/administrator reset your password/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Secure Gate — Visitor Management System')).not.toBeInTheDocument();
  });

  it('a signed-in user whose flag is false reaches the app normally', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates();

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Secure Gate — Visitor Management System')).toBeInTheDocument();
    });
    expect(screen.queryByText(/administrator reset your password/i)).not.toBeInTheDocument();
  });

  it('does not lock the user out when the flag check errors — fails open, not closed', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates({ mustChange: null, active: null }, { message: 'boom' });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Secure Gate — Visitor Management System')).toBeInTheDocument();
    });
    expect(screen.queryByText(/administrator reset your password/i)).not.toBeInTheDocument();
  });

  it('calls my_must_change_password (not a direct profiles select) to check the flag', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates();

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('my_must_change_password');
    });
  });

  // Migration 094. The suspension is enforced in Postgres — current_user_role()
  // returns null for a suspended caller, so every policy refuses — and without
  // this screen that enforcement is INVISIBLE: the person lands on their role's
  // page and every list on it is empty, which a guard cannot tell from a quiet
  // morning.
  it('a suspended account sees the withdrawn-access screen, not the app shell', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates({ active: false });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/access has been withdrawn/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Secure Gate — Visitor Management System')).not.toBeInTheDocument();
  });

  // The suspension outranks the password gate: there is no point making
  // somebody choose a new password for an account that may not sign in.
  it('a suspended account is not offered the password form even when it owes one', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates({ mustChange: true, active: false });

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/access has been withdrawn/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/administrator reset your password/i)).not.toBeInTheDocument();
  });

  it('calls my_account_active (not a direct user_status select) to check the suspension', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION } });
    mockGates();

    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith('my_account_active');
    });
  });
});
