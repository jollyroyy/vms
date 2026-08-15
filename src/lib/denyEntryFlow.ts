// A guard turning somebody away at the gate.
//
// The Deny Entry button on the dashboard's ID Verification card was a
// `<Link to="/guard/dashboard">` — it navigated to the page the guard was
// already on, so pressing it did nothing at all. This is the write it should
// always have been.
//
// IT IS A REAL PERMISSION, NOT AN IMPROVISED ONE. Migration 044's
// `enforce_visit_update_rules` explicitly allows
// `approved | walkin_approved -> rejected` for a guard ("Only Guard, HOD, or
// Admin can clear visitors"), and `log_visit_approval` writes a `visit_rejected`
// audit row stamped with `auth.uid()`. That audit row is what keeps this honest:
// CLAUDE.md's rule is that `status = 'rejected'` normally means an HOD declined
// the request, and printing "entry denied" on a guard's screen must not launder
// a guard's refusal into a claim about what an approver decided. The status is
// shared, but the actor is recorded, so the two remain distinguishable in the
// record — which is the part someone may later be asked to account for.
//
// A REASON IS MANDATORY, and it is stored, because "we refused this person" is
// the single most consequential thing a guard can record about somebody. An
// unexplained refusal in a register is worse than no register.
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { safeErrorMessage } from './errors';

export type DenyOutcome = { ok: true } | { ok: false; message: string };

/** The only statuses a guard may refuse from. A visitor already inside cannot
 *  be denied entry — they are through the gate, and the action there is a
 *  check-out. A `pending_approval` row has not been cleared by anyone yet, so
 *  there is nothing for a guard to overturn. */
export function canDenyEntry(visit: Pick<Visit, 'status'>): boolean {
  return visit.status === 'approved' || visit.status === 'walkin_approved';
}

/** Minimum characters of explanation. Short enough not to be theatre, long
 *  enough that "x" is not an answer. */
export const DENY_REASON_MIN = 3;

export async function denyEntry(visit: Visit, reason: string): Promise<DenyOutcome> {
  if (!canDenyEntry(visit)) {
    return {
      ok: false,
      message: visit.status === 'checked_in'
        ? 'This visitor is already inside — check them out instead.'
        : 'Only an approved visitor can be turned away at the gate.',
    };
  }
  const trimmed = reason.trim();
  if (trimmed.length < DENY_REASON_MIN) {
    return { ok: false, message: 'Give a reason for refusing entry.' };
  }
  try {
    const { error } = await supabase.from('visits')
      .update({ status: 'rejected', rejection_reason: trimmed })
      .eq('id', visit.id);
    if (error) return { ok: false, message: safeErrorMessage(error, 'Could not record the refusal.') };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err, 'Could not record the refusal.') };
  }
}
