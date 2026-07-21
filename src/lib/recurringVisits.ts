/**
 * Recurring visit utility functions — M24-RECURRING / FR-WF-01
 */

export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurringSeries {
  id?: string;
  recurrence_type: RecurrenceType;
  recurrence_day: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Returns a human-readable label for the recurrence pattern */
export function formatRecurrenceLabel(series: RecurringSeries): string {
  switch (series.recurrence_type) {
    case 'daily': return 'Every day';
    case 'weekly': return `Every ${DAY_NAMES[series.recurrence_day ?? 1]}`;
    case 'monthly': return `Monthly on day ${series.recurrence_day ?? 1}`;
  }
}

/**
 * Returns the next occurrence date after the given date.
 * Returns null if the series is inactive or expired.
 */
export function getNextOccurrence(series: RecurringSeries, after: Date = new Date()): Date | null {
  if (!series.is_active) return null;
  if (series.end_date && new Date(series.end_date) < after) return null;

  const candidate = new Date(after);
  candidate.setHours(9, 0, 0, 0); // Default arrival time 9 AM

  switch (series.recurrence_type) {
    case 'daily': {
      candidate.setDate(candidate.getDate() + 1);
      break;
    }
    case 'weekly': {
      const targetDay = series.recurrence_day ?? 1;
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
