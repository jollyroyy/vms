import { describe, it, expect } from 'vitest';
import { computeDateRange } from '../../../src/lib/reportsDateRange';

describe('M19-EXPORT: computeDateRange', () => {
  it('returns the same day for the "today" preset', () => {
    expect(computeDateRange('today', '2026-07-29')).toEqual({ from: '2026-07-29', to: '2026-07-29' });
  });

  it('spans 7 days inclusive for the "7d" preset', () => {
    expect(computeDateRange('7d', '2026-07-29')).toEqual({ from: '2026-07-23', to: '2026-07-29' });
  });

  it('spans 30 days inclusive for the "30d" preset', () => {
    expect(computeDateRange('30d', '2026-07-29')).toEqual({ from: '2026-06-30', to: '2026-07-29' });
  });

  it('spans 3 calendar months back for the "3m" preset', () => {
    expect(computeDateRange('3m', '2026-07-29')).toEqual({ from: '2026-04-29', to: '2026-07-29' });
  });

  it('spans 1 calendar year back for the "1y" preset', () => {
    expect(computeDateRange('1y', '2026-07-29')).toEqual({ from: '2025-07-29', to: '2026-07-29' });
  });
});
