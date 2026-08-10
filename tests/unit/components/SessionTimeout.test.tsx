import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import SessionTimeout from '../../../src/components/SessionTimeout';

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const TIMEOUT_MS = 10 * 60 * 1000;

describe('M11-TIMEOUT: SessionTimeout component', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const { supabase } = await import('../../../src/supabaseClient');
    vi.mocked(supabase.auth.signOut).mockClear();
  });

  it('renders null initially', () => {
    render(<SessionTimeout />);
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
  });

  it('shows dialog after inactivity timeout', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
  });

  it('shows countdown starting at 60', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('60s')).toBeInTheDocument();
  });

  it('decrements countdown every second', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('60s')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('59s')).toBeInTheDocument();
  });

  it('renders "Keep session" and "Sign out" buttons when dialog is visible', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('Keep session')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('resets timer on "Keep session" click', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Keep session'));
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
  });

  it('calls signOut on "Sign out" click', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.click(screen.getByText('Sign out'));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('renders a corner Close button when the dialog is visible', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  // Close on THIS dialog means "Keep session", not "hide the warning".
  //
  // The earlier behaviour dismissed the prompt while leaving the countdown
  // running, so the one and only warning a user gets could be closed and the
  // sign-out would still land mid-task, wiping unsaved work with nothing on
  // screen to explain it. Clicking × is itself proof a human is present, which
  // is the exact thing the idle timer is trying to establish — so it must
  // extend the session, not silently swallow the alarm.
  //
  // This does not weaken the timeout: an unattended terminal has nobody to
  // click anything, so it still signs out on schedule. GatePass's SessionTimeout
  // makes the same call; the two apps must not disagree about what × does.
  it('clicking Close keeps the session — it does not sign out', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('the countdown does NOT keep running after Close — no silent sign-out', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('the idle clock restarts after Close, so the prompt returns on real inactivity', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
    // Genuinely idle again → the warning must come back. Closing buys one
    // full window, it does not disable the timeout for the rest of the session.
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
  });

  it('Escape behaves exactly like Close', async () => {
    const { supabase } = await import('../../../src/supabaseClient');
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('clicking inside the dialog does not close it', () => {
    render(<SessionTimeout />);
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    fireEvent.click(screen.getByText('Session Timeout'));
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
  });

  it('resets timer on user activity event', () => {
    render(<SessionTimeout />);
    // advance part-way, then trigger activity
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - 1000); });
    fireEvent(document, new MouseEvent('mousedown', { bubbles: true }));
    act(() => { vi.advanceTimersByTime(1000); });
    // should NOT show dialog yet because activity reset the timer
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
    // now advance the full timeout again
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });
    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
  });
});
