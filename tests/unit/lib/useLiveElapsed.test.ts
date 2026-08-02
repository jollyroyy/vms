// The duration a guard reads off the Who's Inside card and the details popup
// used to be a render-time snapshot. On the popup — which renders once, when it
// opens — that meant the figure never moved, so a visitor who had been inside
// for three hours could still read "30m". These tests pin the clock behaviour.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveElapsed } from '../../../src/lib/useLiveElapsed';

afterEach(() => { vi.useRealTimers(); });

const CHECKED_IN = '2026-08-02T10:00:00Z';

function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe('useLiveElapsed', () => {
  it('keeps counting while the visitor is still inside', () => {
    at('2026-08-02T10:05:00Z');
    const { result } = renderHook(() => useLiveElapsed(CHECKED_IN, null));

    expect(result.current.text).toBe('5m');
    expect(result.current.live).toBe(true);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.text).toBe('6m');

    act(() => { vi.advanceTimersByTime(60_000 * 60); });
    expect(result.current.text).toBe('1h 6m');
  });

  it('freezes at the total stay once the visitor has checked out', () => {
    at('2026-08-02T10:05:00Z');
    const { result } = renderHook(() => useLiveElapsed(CHECKED_IN, '2026-08-02T10:02:00Z'));

    expect(result.current.text).toBe('2m');
    expect(result.current.live).toBe(false);

    act(() => { vi.advanceTimersByTime(60_000 * 30); });
    expect(result.current.text).toBe('2m');
  });

  it('flags an overtime stay as the hours accumulate', () => {
    at('2026-08-02T18:59:00Z');
    const { result } = renderHook(() => useLiveElapsed(CHECKED_IN, null));

    expect(result.current.isOvertime).toBe(false);

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.text).toBe('9h 0m');
    expect(result.current.isOvertime).toBe(true);
  });

  it('reports no elapsed time for a visit that has not checked in', () => {
    at('2026-08-02T10:05:00Z');
    const { result } = renderHook(() => useLiveElapsed(null, null));

    expect(result.current.text).toBe('—');
    expect(result.current.live).toBe(false);
  });

  it('stops its timer when the card unmounts', () => {
    at('2026-08-02T10:05:00Z');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useLiveElapsed(CHECKED_IN, null));

    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
