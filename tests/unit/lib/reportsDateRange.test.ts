import { describe, it, expect } from 'vitest';
import { computeDateRange, rangeLabel, RANGE_PRESETS } from '../../../src/lib/reportsDateRange';

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

  it('spans 60 days inclusive for the "60d" preset', () => {
    expect(computeDateRange('60d', '2026-07-29')).toEqual({ from: '2026-05-31', to: '2026-07-29' });
  });

  it('spans 90 days inclusive for the "90d" preset', () => {
    expect(computeDateRange('90d', '2026-07-29')).toEqual({ from: '2026-05-01', to: '2026-07-29' });
  });

  it('spans 1 calendar year back for the "1y" preset', () => {
    expect(computeDateRange('1y', '2026-07-29')).toEqual({ from: '2025-07-29', to: '2026-07-29' });
  });

  // Every day-span preset counts the end date as one of its days, so the
  // reader gets the number of days the button promised rather than one more.
  it('counts the end date as one of the days in every day-span preset', () => {
    const spanInDays = (preset: '7d' | '30d' | '60d' | '90d') => {
      const { from, to } = computeDateRange(preset, '2026-07-29');
      return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    };

    expect(spanInDays('7d')).toBe(7);
    expect(spanInDays('30d')).toBe(30);
    expect(spanInDays('60d')).toBe(60);
    expect(spanInDays('90d')).toBe(90);
  });

  it('crosses a month boundary without drifting', () => {
    expect(computeDateRange('7d', '2026-03-03')).toEqual({ from: '2026-02-25', to: '2026-03-03' });
  });

  // 2024 is a leap year: counting back a year from 2025-03-01 must land on
  // 2024-03-01, not on 2024-02-29 or 2024-03-02.
  it('handles a leap year on the 1y preset', () => {
    expect(computeDateRange('1y', '2025-03-01')).toEqual({ from: '2024-03-01', to: '2025-03-01' });
  });
});

describe('RANGE_PRESETS', () => {
  // The client asked for date-wise plus 7 / 30 / 60 / 90 days and one year
  // (2026-08-17). This is one vocabulary shared by Reports and every ranged
  // admin tab, so a preset added on one screen appears on all of them — the
  // pinning is deliberate.
  it('offers exactly the six agreed spans, in order', () => {
    expect(RANGE_PRESETS.map((p) => p.key)).toEqual(['today', '7d', '30d', '60d', '90d', '1y']);
  });

  it('no longer offers the calendar-month span it replaced', () => {
    expect(RANGE_PRESETS.map((p) => p.key)).not.toContain('3m');
  });
});

describe('rangeLabel', () => {
  // A single-day window is a date, not a span — printing "29 Jul 2026 – 29 Jul
  // 2026 · selected day" would make the reader check whether the two ends
  // agreed.
  it('prints one date when the range is a single day', () => {
    expect(rangeLabel('today', { from: '2026-07-29', to: '2026-07-29' })).toBe('29 Jul 2026');
  });

  it('prints both ends and the preset name for a span', () => {
    const label = rangeLabel('30d', computeDateRange('30d', '2026-07-29'));
    expect(label).toContain('30 Jun 2026');
    expect(label).toContain('29 Jul 2026');
    expect(label).toContain('last 30 days');
  });

  // A date-only key is a calendar day, not a moment. Read in a zone behind UTC
  // it would print the previous day — the same class of error `istDateKey`
  // exists to prevent, and it would put the wrong period under a table.
  it('does not shift the day when the host timezone is behind UTC', () => {
    expect(rangeLabel('today', { from: '2026-01-01', to: '2026-01-01' })).toBe('1 Jan 2026');
  });
});
