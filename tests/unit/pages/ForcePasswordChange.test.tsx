import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import ForcePasswordChange from '../../../src/pages/ForcePasswordChange';

const mockRpc = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { signOut: (...a: any[]) => mockSignOut(...a) },
    rpc: (...a: any[]) => mockRpc(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);

function renderPage(onSuccess = vi.fn()) {
  return { onSuccess, ...render(<ForcePasswordChange onSuccess={onSuccess} />) };
}

function fill(newPw: string, confirmPw: string) {
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: newPw } });
  fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: confirmPw } });
}

describe('ForcePasswordChange page', () => {
  it('explains why the user is here', () => {
    renderPage();
    expect(screen.getByText(/administrator reset your password/i)).toBeInTheDocument();
  });

  it('rejects mismatched passwords without calling the RPC', async () => {
    renderPage();
    fill('newpass123', 'different123');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than the minimum without calling the RPC', async () => {
    renderPage();
    fill('abc', 'abc');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls set_my_password with p_password on a valid submit', async () => {
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('set_my_password', { p_password: 'goodpassword1' });
    });
  });

  it('calls onSuccess after a successful submit, without signing out', async () => {
    const onSuccess = vi.fn();
    renderPage(onSuccess);
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('surfaces the server "not used before" refusal', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Choose a password you have not used before.' } });
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/have not used before/i)).toBeInTheDocument();
    });
  });

  it('does not call onSuccess when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Choose a password you have not used before.' } });
    const onSuccess = vi.fn();
    renderPage(onSuccess);
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /set password|update password|continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/have not used before/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('signs out via the escape hatch', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
