import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import LoginPage, { ADMIN_CONTACT_EMAIL } from '../../../src/pages/Login';
import { resetRateLimit } from '../../../src/lib/rateLimiter';

const mockSignIn = vi.hoisted(() => vi.fn());
const mockResetPw = vi.hoisted(() => vi.fn());

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { signInWithPassword: mockSignIn, resetPasswordForEmail: mockResetPw },
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetRateLimit();
});

describe('M12-LOGIN: LoginPage', () => {
  it('renders sign-in form', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeInTheDocument();
  });

  it('calls signInWithPassword on submit', () => {
    mockSignIn.mockResolvedValue({ error: null });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign In'));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
  });

  it('shows loading state while authenticating', () => {
    mockSignIn.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.getByText('Signing in\u2026')).toBeInTheDocument();
  });

  it('blocks submit after 5 failed attempts with rate-limit message', async () => {
    vi.useFakeTimers();
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    render(<LoginPage />);
    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'bad@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'wrong' } });
      fireEvent.click(screen.getByText('Sign In'));
      await act(() => Promise.resolve());
    }
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  // Password reset is NOT self-service (user's call, 2026-08-10). The old
  // "Forgot password?" button called resetPasswordForEmail directly from this
  // page; it is gone, because the built-in Supabase email sender is capped at
  // ~2 messages/hour PROJECT-WIDE (shared with GatePass), so most people who
  // pressed it got a rate-limit error and no next step. The card names a human
  // instead. These tests pin both halves — the button must not come back, and
  // the admin's address must be on the page and actionable.
  it('has no forgot-password control at all', () => {
    render(<LoginPage />);
    expect(screen.queryByText(/forgot password\?/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /forgot password/i })).not.toBeInTheDocument();
  });

  it('never sends a reset email from the login page', () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    expect(mockResetPw).not.toHaveBeenCalled();
  });

  it('tells the user to contact the administrator, and names the address', () => {
    render(<LoginPage />);
    expect(screen.getByText(/contact the administrator/i)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_CONTACT_EMAIL)).toBeInTheDocument();
  });

  it('makes the admin address a mailto link so it can be actioned in one tap', () => {
    render(<LoginPage />);
    const link = screen.getByRole('link', { name: ADMIN_CONTACT_EMAIL });
    expect(link).toHaveAttribute('href', `mailto:${ADMIN_CONTACT_EMAIL}`);
  });

  it('shows error message on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });
});
