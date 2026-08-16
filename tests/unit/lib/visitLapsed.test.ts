// A walk-in request nobody answered by 10 PM (migrations 081/082).
//
// `pending_approval` was the one status the day-end sweep could not reach: 066
// closes approvals, and a request that was never approved has no approval to
// close. So a walk-in the host simply never answered sat in the guard's
// unbounded "awaiting decision" list for ever, and never appeared in Reports as
// anything but "pending" — a record that says a decision is still coming when
// the day it was needed for ended weeks ago.
//
// WHY A TENTH STATUS AND NOT `expired`. `expired` means "an approval lapsed
// unused" and is load-bearing for exactly that: `IMPLIES_PRIOR_APPROVAL` maps it
// to TRUE, so Reports prints the visit's own `created_at` as the approval
// instant and names the approver. Filing an unanswered request there would make
// the register claim a host cleared somebody they never even saw. `lapsed` is
// the third outcome, and the one thing it must never imply is an approval.
import { describe, it, expect } from 'vitest';
import { visitStatusLabel } from '../../../src/lib/visitStatusLabel';
import { approvalTimestamp } from '../../../src/lib/visitApproval';
import { approverLabel } from '../../../src/lib/visitApprover';
import { canShowPass } from '../../../src/lib/passVisibility';
import { isCheckableStatus } from '../../../src/lib/checkableStatus';
import { evaluateQrVisit } from '../../../src/lib/qrToken';
import { canTransition } from '../../../src/lib/visitLifecycle';
import { visitOrigin, statusProvesOrigin } from '../../../src/lib/visitOrigin';
import { STATUS_STYLES } from '../../../src/lib/statusStyles';
import { railFor } from '../../../src/lib/statusRail';

describe('lapsed — a walk-in request the day ended on', () => {
  it('reads as "lapsed" wherever a status is printed', () => {
    expect(visitStatusLabel({ status: 'lapsed' })).toBe('lapsed');
    expect(STATUS_STYLES.lapsed.label).toBe('Lapsed');
  });

  // The whole reason it is not `expired`. Nobody approved this visit, so there
  // is no approval instant and no approver, and Reports must say so rather than
  // fall back to created_at.
  it('never implies an approval', () => {
    const v = { status: 'lapsed' as const, created_at: '2026-08-16T04:00:00Z' };
    expect(approvalTimestamp(v)).toBeNull();
    expect(approverLabel({ status: 'lapsed' })).toBe('Not approved');
  });

  it('is closed: no pass, not checkable, and the QR says why', () => {
    expect(canShowPass('lapsed')).toBe(false);
    expect(isCheckableStatus('lapsed')).toBe(false);
    const gate = evaluateQrVisit({ status: 'lapsed', qr_expires_at: null });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toMatch(/never approved/i);
  });

  // A machine wrote this status, so a human must be able to undo it — the rule
  // migration 066 set for no_show/expired. The way back is to the decision that
  // was never made, not to an approval nobody gave.
  it('is reachable only from pending_approval, and is reversible back to it', () => {
    expect(canTransition('pending_approval', 'lapsed')).toBe(true);
    expect(canTransition('lapsed', 'pending_approval')).toBe(true);
    expect(canTransition('approved', 'lapsed')).toBe(false);
    expect(canTransition('walkin_approved', 'lapsed')).toBe(false);
    expect(canTransition('lapsed', 'checked_in')).toBe(false);
    expect(canTransition('lapsed', 'approved')).toBe(false);
  });

  // `pending_approval` is only ever reached from the gate's walk-in register, so
  // a lapsed row proves its origin on its own — no scheduled_for guess needed,
  // and no origin chip beside a badge that has already said it.
  it('proves a walk-in origin on its own', () => {
    expect(visitOrigin({ status: 'lapsed', scheduled_for: null })).toBe('walk_in');
    expect(statusProvesOrigin('lapsed')).toBe(true);
  });

  // Muted, like expired and cancelled. Nobody was let down by an appointment —
  // colouring it as an incident would fill the guard's history with events that
  // never happened.
  it('rails as a closed visit', () => {
    expect(railFor('lapsed')).toBe('rail-out');
  });
});
