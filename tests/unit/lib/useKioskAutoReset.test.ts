// New hook (src/pages/Kiosk/useKioskAutoReset.ts), extracted out of Kiosk.tsx.
// Pure timer logic — no supabase, no DOM beyond the hook itself — so it is
// driven with fake timers rather than a rendered component.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKioskAutoReset } from '../../../src/pages/Kiosk/useKioskAutoReset';

afterEach(() => {
  vi.useRealTimers();
});

describe('useKioskAutoReset', () => {
  it('startIdleTimer fires resetAll after 60s and not before', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => result.current.startIdleTimer());

    act(() => vi.advanceTimersByTime(59999));
    expect(resetAll).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(resetAll).toHaveBeenCalledTimes(1);
  });

  it('clearIdleTimer prevents the idle timeout from firing', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => result.current.startIdleTimer());
    act(() => result.current.clearIdleTimer());
    act(() => vi.advanceTimersByTime(60000));

    expect(resetAll).not.toHaveBeenCalled();
  });

  it('startBadgeCountdown() counts down from 15 and calls resetAll at zero', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => result.current.startBadgeCountdown());
    expect(result.current.resetCountdown).toBe(15);

    for (let i = 14; i >= 1; i--) {
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.resetCountdown).toBe(i);
      expect(resetAll).not.toHaveBeenCalled();
    }

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.resetCountdown).toBe(0);
    expect(resetAll).toHaveBeenCalledTimes(1);
  });

  it('startBadgeCountdown(12) honours the override', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => result.current.startBadgeCountdown(12));
    expect(result.current.resetCountdown).toBe(12);

    act(() => vi.advanceTimersByTime(11000));
    expect(result.current.resetCountdown).toBe(1);
    expect(resetAll).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.resetCountdown).toBe(0);
    expect(resetAll).toHaveBeenCalledTimes(1);
  });

  it('calling startBadgeCountdown twice does not leave two intervals running', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => result.current.startBadgeCountdown(15));
    act(() => vi.advanceTimersByTime(5000)); // down to 10
    act(() => result.current.startBadgeCountdown(15)); // restarts at 15

    // If the first interval were still alive, resetCountdown would have been
    // decremented by both intervals racing, landing below 14 here.
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.resetCountdown).toBe(14);

    // Run well past where the first interval's own reset would have fired
    // (it started at 10, so would call resetAll after 10 more seconds) and
    // confirm only one reset ultimately happens, at the second countdown's
    // schedule (14 more seconds from here).
    act(() => vi.advanceTimersByTime(9000)); // total 10s since restart -> at 5
    expect(resetAll).not.toHaveBeenCalled();
    expect(result.current.resetCountdown).toBe(5);

    act(() => vi.advanceTimersByTime(5000)); // reaches 0
    expect(resetAll).toHaveBeenCalledTimes(1);
  });

  it('unmounting clears both timers so no setState-after-unmount and no stray reset fires', () => {
    vi.useFakeTimers();
    const resetAll = vi.fn();
    const { result, unmount } = renderHook(() => useKioskAutoReset(resetAll));

    act(() => {
      result.current.startIdleTimer();
      result.current.startBadgeCountdown();
    });

    unmount();

    // Advancing well past both the idle timeout and the badge countdown must
    // not call resetAll — the effect cleanup should have cleared them.
    act(() => vi.advanceTimersByTime(120000));
    expect(resetAll).not.toHaveBeenCalled();
  });
});
