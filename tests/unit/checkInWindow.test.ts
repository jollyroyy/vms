/**
 * M26-WINDOW: Configurable check-in window tests
 * Tests the time window filter logic used by Guard Console.
 */
import { describe, it, expect } from 'vitest';

// These functions will live in src/lib/checkInWindow.ts
type WindowOption = 'today' | '48h' | '72h' | 'custom';

function getWindowBounds(option: WindowOption, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  switch (option) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case '48h': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0); // from start of today
      const end = new Date(now);
      end.setTime(end.getTime() + 48 * 60 * 60 * 1000);
      return { start, end };
    }
    case '72h': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setTime(end.getTime() + 72 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'custom': {
      if (!customStart || !customEnd) throw new Error('Custom window requires start and end dates');
      return { start: customStart, end: customEnd };
    }
  }
}

function isWithinWindow(visitDate: Date, bounds: { start: Date; end: Date }): boolean {
  return visitDate >= bounds.start && visitDate <= bounds.end;
}

const WINDOW_LABELS: Record<WindowOption, string> = {
  today: 'Today',
  '48h': 'Next 48 hours',
  '72h': 'Next 72 hours',
  custom: 'Custom range',
};

describe('M26-WINDOW: Check-in window bounds', () => {
  it('today window starts at midnight and ends at 23:59:59', () => {
    const { start, end } = getWindowBounds('today');
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('48h window end is ~48 hours after now', () => {
    const before = new Date();
    const { end } = getWindowBounds('48h');
    const after = new Date();
    const diff = end.getTime() - before.getTime();
    const diffAfter = end.getTime() - after.getTime();
    expect(diff).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 1000);
    expect(diffAfter).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 1000);
  });

  it('72h window end is ~72 hours after now', () => {
    const before = new Date();
    const { end } = getWindowBounds('72h');
    const diff = end.getTime() - before.getTime();
    expect(diff).toBeGreaterThanOrEqual(72 * 60 * 60 * 1000 - 1000);
    expect(diff).toBeLessThanOrEqual(72 * 60 * 60 * 1000 + 2000);
  });

  it('custom window uses provided start and end', () => {
    const start = new Date('2026-07-21T00:00:00Z');
    const end = new Date('2026-07-23T23:59:59Z');
    const bounds = getWindowBounds('custom', start, end);
    expect(bounds.start).toBe(start);
    expect(bounds.end).toBe(end);
  });

  it('custom window without dates throws', () => {
    expect(() => getWindowBounds('custom')).toThrow('Custom window requires start and end dates');
  });
});

describe('M26-WINDOW: isWithinWindow', () => {
  const bounds = {
    start: new Date('2026-07-21T00:00:00Z'),
    end: new Date('2026-07-22T23:59:59Z'),
  };

  it('visit exactly at start is within window', () => {
    expect(isWithinWindow(new Date('2026-07-21T00:00:00Z'), bounds)).toBe(true);
  });

  it('visit exactly at end is within window', () => {
    expect(isWithinWindow(new Date('2026-07-22T23:59:59Z'), bounds)).toBe(true);
  });

  it('visit before start is NOT within window', () => {
    expect(isWithinWindow(new Date('2026-07-20T23:59:59Z'), bounds)).toBe(false);
  });

  it('visit after end is NOT within window', () => {
    expect(isWithinWindow(new Date('2026-07-23T00:00:00Z'), bounds)).toBe(false);
  });
});

describe('M26-WINDOW: Window labels', () => {
  it('today label is "Today"', () => {
    expect(WINDOW_LABELS['today']).toBe('Today');
  });

  it('48h label is "Next 48 hours"', () => {
    expect(WINDOW_LABELS['48h']).toBe('Next 48 hours');
  });
});
