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
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
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
