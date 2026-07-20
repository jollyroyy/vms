// S5 / FR-GP-01 — RGP due-date state and reminder cadence.
// All comparisons are date-only (YYYY-MM-DD) to avoid timezone fuzz.

export type RgpState = 'ok' | 'due_soon' | 'due_today' | 'overdue';

function toDateOnly(d: string): string {
  return d.slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const a = new Date(toDateOnly(earlier)).getTime();
  const b = new Date(toDateOnly(later)).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// getRgpState(dueDate, today) — where dueDate is the expected return date.
export function getRgpState(dueDate: string, today: string): RgpState {
  const due = toDateOnly(dueDate);
  const cur = toDateOnly(today);

  if (cur > due) return 'overdue';
  if (cur === due) return 'due_today';
  if (daysBetween(cur, due) === 1) return 'due_soon';
  return 'ok';
}

// isReminderDay(dueDate, today) — true on T-1, on the due date, and every 3rd day overdue.
export function isReminderDay(dueDate: string, today: string): boolean {
  const state = getRgpState(dueDate, today);
  if (state === 'due_soon' || state === 'due_today') return true;
  if (state === 'overdue') {
    const daysOverdue = daysBetween(toDateOnly(dueDate), toDateOnly(today));
    return daysOverdue % 3 === 0;
  }
  return false;
}
