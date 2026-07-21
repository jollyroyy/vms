import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import LoginPage from '../../../src/pages/Login';
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
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('calls signInWithPassword on submit', () => {
    mockSignIn.mockResolvedValue({ error: null });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
  });

  it('shows loading state while authenticating', () => {
    mockSignIn.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });

  it('blocks submit after 5 failed attempts with rate-limit message', async () => {
    vi.useFakeTimers();
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    render(<LoginPage />);
    for (let i = 0; i < 5; i++) {
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'bad@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'wrong' } });
      fireEvent.click(screen.getByText('Sign in'));
      await act(() => Promise.resolve());
    }
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows forgot password link', () => {
    render(<LoginPage />);
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('shows error on forgot-password with empty email', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/forgot password/i));
    expect(screen.getByText('Enter your email address first.')).toBeInTheDocument();
  });

  it('calls resetPasswordForEmail on forgot password with valid email', async () => {
    mockResetPw.mockResolvedValue({ error: null });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByText(/forgot password/i));
    await waitFor(() => {
      expect(mockResetPw).toHaveBeenCalledWith('test@test.com', { redirectTo: window.location.origin });
    });
  });

  it('shows error message on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });
});
