import { describe, it, expect } from 'vitest';
import { validatePreApproval } from '../../../src/lib/visitLifecycle';

// NOBODY CAN ARRIVE ON TIME FOR A SLOT THAT HAS ALREADY PASSED (client report,
// 2026-08-18: "his scheduled time was 12 am and he checked in around 11 am —
// how is he late here?").
//
// The row behind the report was raised at 10:08 IST for 00:10 IST the same
// morning, which is a datetime picker left on AM. Every screen then reported
// eleven hours of lateness, correctly subtracting one real timestamp from
// another and describing the visitor with the answer. `isKeepableSlot` keeps
// the chips quiet about the rows already stored; this is the half that stops
// another one being created.
const base = {
  department_id: 'dept-1',
  purpose: 'meeting',
};

// 2026-08-18 10:08 IST — the moment the live booking was made.
const NOW = new Date('2026-08-18T04:38:00Z');

describe('validatePreApproval — the slot cannot be in the past', () => {
  it('refuses the AM/PM slip that prompted the report, and says which mistake to look for', () => {
    const error = validatePreApproval({
      ...base,
      scheduled_for: '2026-08-17T18:40:00Z', // 00:10 IST, ten hours before NOW
      now: NOW,
    });
    expect(error).toMatch(/past/i);
    expect(error).toMatch(/AM\/PM/);
  });

  it('accepts a booking for later today', () => {
    expect(validatePreApproval({
      ...base,
      scheduled_for: '2026-08-18T09:00:00Z', // 14:30 IST
      now: NOW,
    })).toBeNull();
  });

  // Raising a pass for a visitor already at the desk is ordinary, and the
  // minutes between typing "now" and pressing submit must not become an error.
  it('accepts a slot a few minutes behind the clock', () => {
    expect(validatePreApproval({
      ...base,
      scheduled_for: '2026-08-18T04:30:00Z', // eight minutes before NOW
      now: NOW,
    })).toBeNull();
  });

  // The rule runs AFTER the ones that were already here, so a missing slot
  // still reports as missing rather than as a slot in the past.
  it('still reports the older failures first', () => {
    expect(validatePreApproval({ ...base, scheduled_for: '', now: NOW }))
      .toBe('Scheduled date and time is required');
    expect(validatePreApproval({ ...base, department_id: '', scheduled_for: '2026-08-18T09:00:00Z', now: NOW }))
      .toBe('Department is required');
  });
});
