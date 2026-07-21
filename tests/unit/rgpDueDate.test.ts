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

describe('M4-RGP: edge cases', () => {
  it('leap year Feb 29 is handled correctly', () => {
    expect(getRgpState('2024-03-01', '2024-02-29')).toBe('due_soon');
    expect(getRgpState('2024-02-28', '2024-03-01')).toBe('overdue');
  });

  it('overdue for 0 days is due_today, not overdue', () => {
    expect(getRgpState('2026-07-20', '2026-07-20T23:59:59')).toBe('due_today');
  });

  it('same date with time component still matches due_today', () => {
    expect(getRgpState('2026-07-20T00:00:00Z', '2026-07-20T12:00:00Z')).toBe('due_today');
  });

  it('many days overdue still returns overdue', () => {
    expect(getRgpState('2026-01-01', '2026-12-31')).toBe('overdue');
  });

  it('date 2 days before due date shows ok (not due_soon)', () => {
    expect(getRgpState('2026-07-22', '2026-07-20')).toBe('ok');
  });

  it('date exactly 1 day before shows due_soon', () => {
    expect(getRgpState('2026-07-21', '2026-07-20')).toBe('due_soon');
  });

  it('isReminderDay on the overdue due date itself', () => {
    expect(isReminderDay('2026-07-20', '2026-07-20')).toBe(true);
  });

  it('isReminderDay on D+1 (day after due) is not a reminder day', () => {
    expect(isReminderDay('2026-07-20', '2026-07-21')).toBe(false);
  });

  it('isReminderDay on D+2 is not a reminder day', () => {
    expect(isReminderDay('2026-07-20', '2026-07-22')).toBe(false);
  });

  it('isReminderDay on D+9 (3rd batch of 3) is true', () => {
    expect(isReminderDay('2026-07-20', '2026-07-29')).toBe(true);
  });
});
