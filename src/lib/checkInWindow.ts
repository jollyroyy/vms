/**
 * Check-in window utility — M26-WINDOW / FR-WF-02
 * Computes time bounds for the Guard Console visit filter.
 */

export type WindowOption = 'today' | '48h' | '72h' | 'custom';

export interface WindowBounds {
  start: Date;
  end: Date;
}

export const WINDOW_LABELS: Record<WindowOption, string> = {
  today: 'Today',
  '48h': 'Next 48 hours',
  '72h': 'Next 72 hours',
  custom: 'Custom range',
};

/**
 * Returns start/end Date bounds for the given window option.
 * All windows start at midnight today (so past check-ins remain visible).
 */
export function getWindowBounds(
  option: WindowOption,
  customStart?: Date,
  customEnd?: Date,
): WindowBounds {
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
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      return { start, end };
    }
    case '72h': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'custom': {
      if (!customStart || !customEnd) {
        throw new Error('Custom window requires start and end dates');
      }
      return { start: customStart, end: customEnd };
    }
  }
}

/** Returns true if the given visit date falls within the window bounds */
export function isWithinWindow(visitDate: Date, bounds: WindowBounds): boolean {
  return visitDate >= bounds.start && visitDate <= bounds.end;
}

/** Converts window bounds to ISO strings for Supabase date filtering */
export function boundsToIso(bounds: WindowBounds): { startIso: string; endIso: string } {
  return {
    startIso: bounds.start.toISOString(),
    endIso: bounds.end.toISOString(),
  };
}
