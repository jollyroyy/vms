/**
 * M24-RECURRING: Recurring visit series logic tests
 */
import { describe, it, expect } from 'vitest';

type RecurrenceType = 'daily' | 'weekly' | 'monthly';

interface RecurringSeries {
  recurrence_type: RecurrenceType;
  recurrence_day: number | null; // 0-6 for weekly, 1-31 for monthly
  start_date: string; // ISO date
  end_date: string | null;
  is_active: boolean;
}

// Will be in src/lib/recurringVisits.ts
function getNextOccurrence(series: RecurringSeries, after: Date = new Date()): Date | null {
  if (!series.is_active) return null;
  if (series.end_date && new Date(series.end_date) < after) return null;

  const candidate = new Date(after);
  candidate.setHours(9, 0, 0, 0); // Default 9 AM

  switch (series.recurrence_type) {
    case 'daily': {
      // Next occurrence is tomorrow
      candidate.setDate(candidate.getDate() + 1);
      break;
    }
    case 'weekly': {
      const targetDay = series.recurrence_day ?? 1; // Default Monday
      const daysUntil = (targetDay - candidate.getDay() + 7) % 7 || 7;
      candidate.setDate(candidate.getDate() + daysUntil);
      break;
    }
    case 'monthly': {
      const targetDate = series.recurrence_day ?? 1;
      candidate.setDate(targetDate);
      if (candidate <= after) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      break;
    }
  }

  if (series.end_date && candidate > new Date(series.end_date)) return null;
  return candidate;
}

function formatRecurrenceLabel(series: RecurringSeries): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (series.recurrence_type) {
    case 'daily': return 'Every day';
    case 'weekly': return `Every ${days[series.recurrence_day ?? 1]}`;
    case 'monthly': return `Monthly on day ${series.recurrence_day ?? 1}`;
  }
}

describe('M24-RECURRING: Next occurrence calculation', () => {
  it('daily series returns tomorrow', () => {
    const series: RecurringSeries = {
      recurrence_type: 'daily',
      recurrence_day: null,
      start_date: '2026-07-01',
      end_date: null,
      is_active: true,
    };
    const after = new Date('2026-07-21T10:00:00Z');
    const next = getNextOccurrence(series, after);
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(22);
    expect(next!.getMonth()).toBe(6); // July (0-indexed)
  });

  it('weekly series on Tuesday returns next Tuesday', () => {
    // 2026-07-21 is a Tuesday (day 2)
    const series: RecurringSeries = {
      recurrence_type: 'weekly',
      recurrence_day: 2, // Tuesday
      start_date: '2026-07-01',
      end_date: null,
      is_active: true,
    };
    const after = new Date('2026-07-21T10:00:00Z'); // Tuesday already past
    const next = getNextOccurrence(series, after);
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(2); // Tuesday
  });

  it('inactive series returns null', () => {
    const series: RecurringSeries = {
      recurrence_type: 'daily',
      recurrence_day: null,
      start_date: '2026-07-01',
      end_date: null,
      is_active: false,
    };
    expect(getNextOccurrence(series, new Date())).toBeNull();
  });

  it('expired series (end_date in past) returns null', () => {
    const series: RecurringSeries = {
      recurrence_type: 'daily',
      recurrence_day: null,
      start_date: '2026-01-01',
      end_date: '2026-07-20', // Yesterday
      is_active: true,
    };
    expect(getNextOccurrence(series, new Date('2026-07-21'))).toBeNull();
  });
});

describe('M24-RECURRING: Recurrence label formatting', () => {
  it('daily shows "Every day"', () => {
    expect(formatRecurrenceLabel({ recurrence_type: 'daily', recurrence_day: null, start_date: '', end_date: null, is_active: true })).toBe('Every day');
  });

  it('weekly on Wednesday shows correct label', () => {
    expect(formatRecurrenceLabel({ recurrence_type: 'weekly', recurrence_day: 3, start_date: '', end_date: null, is_active: true })).toBe('Every Wednesday');
  });

  it('monthly on day 15 shows correct label', () => {
    expect(formatRecurrenceLabel({ recurrence_type: 'monthly', recurrence_day: 15, start_date: '', end_date: null, is_active: true })).toBe('Monthly on day 15');
  });
});
