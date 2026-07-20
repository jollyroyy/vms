// CHECK for goal.md S5 (🎯) — FR ref: FR-GP-01 (overdue color coding), FR-GP-02 / SLA-W4 (reminders)
// Due/overdue state must be correct across date boundaries.
import { describe, it, expect } from 'vitest';
import { getRgpState, isReminderDay } from '../../src/lib/rgpDueDate';

describe('S5: RGP due-date state', () => {
  it('is "ok" well before the expected return date', () => {
    expect(getRgpState('2026-07-30', '2026-07-20')).toBe('ok');
  });

  it('is "due_soon" exactly one day before (T-1, SLA-W4)', () => {
    expect(getRgpState('2026-07-21', '2026-07-20')).toBe('due_soon');
  });

  it('is "due_today" on the expected return date', () => {
    expect(getRgpState('2026-07-20', '2026-07-20')).toBe('due_today');
  });

  it('is "overdue" the day after — date boundary, not 24h fuzz', () => {
    expect(getRgpState('2026-07-20', '2026-07-21')).toBe('overdue');
  });

  it('handles month boundaries', () => {
    expect(getRgpState('2026-07-31', '2026-08-01')).toBe('overdue');
    expect(getRgpState('2026-08-01', '2026-07-31')).toBe('due_soon');
  });

  it('handles year boundaries', () => {
    expect(getRgpState('2026-12-31', '2027-01-01')).toBe('overdue');
  });
});

describe('S5/SLA-W4: reminder cadence (T-1, due date, every 3 days overdue)', () => {
  const due = '2026-07-20';
  it('reminds at T-1 and on the due date', () => {
    expect(isReminderDay(due, '2026-07-19')).toBe(true);
    expect(isReminderDay(due, '2026-07-20')).toBe(true);
  });
  it('does not remind before T-1', () => {
    expect(isReminderDay(due, '2026-07-17')).toBe(false);
  });
  it('reminds every 3rd day overdue (D+3, D+6), not daily', () => {
    expect(isReminderDay(due, '2026-07-23')).toBe(true);
    expect(isReminderDay(due, '2026-07-24')).toBe(false);
    expect(isReminderDay(due, '2026-07-26')).toBe(true);
  });
});
