import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '../../../src/pages/ResetPassword';

const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: (...a: any[]) => mockUpdateUser(...a),
      signOut: (...a: any[]) => mockSignOut(...a),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateUser.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
});
afterEach(cleanup);

function renderPage() {
  return render(<MemoryRouter><ResetPassword /></MemoryRouter>);
}

function fill(newPw: string, confirmPw: string) {
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: newPw } });
  fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: confirmPw } });
}

describe('ResetPassword page', () => {
  it('renders the set-new-password heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
  });

  it('rejects mismatched passwords without calling supabase', async () => {
    renderPage();
    fill('newpass123', 'different123');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than the minimum without calling supabase', async () => {
    renderPage();
    fill('abc', 'abc');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('submits a valid password to supabase', async () => {
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'goodpassword1' });
    });
  });

  it('signs the user out after a successful reset so they must log in again', async () => {
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('shows a confirmation message after a successful reset', async () => {
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it('clears the recovery gate on success so the user is not re-trapped', async () => {
    window.localStorage.setItem('sg-password-recovery-pending', '1');
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(window.localStorage.getItem('sg-password-recovery-pending')).toBeNull();
    });
  });

  it('abandoning the reset signs out, leaving no usable session behind', async () => {
    window.localStorage.setItem('sg-password-recovery-pending', '1');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(window.localStorage.getItem('sg-password-recovery-pending')).toBeNull();
  });

  it('keeps the recovery gate up when the update fails', async () => {
    window.localStorage.setItem('sg-password-recovery-pending', '1');
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token has expired' } });
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/expired|failed/i)).toBeInTheDocument();
    });
    expect(window.localStorage.getItem('sg-password-recovery-pending')).toBe('1');
  });

  it('surfaces a supabase failure and does not sign the user out', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token has expired' } });
    renderPage();
    fill('goodpassword1', 'goodpassword1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => {
      expect(screen.getByText(/expired|failed/i)).toBeInTheDocument();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
