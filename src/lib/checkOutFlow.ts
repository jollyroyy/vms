// The check-out WRITE, and the undo that reverses it.
//
// One copy, two surfaces — the same rule lib/checkInFlow.ts follows for the
// other direction. It used to live inline in pages/Guard/Console.tsx, which was
// fine while /visitors/inside was the only place a visitor could leave. The
// Check-in / Check-out desk is a second place, and a second copy of this
// mutation would be two answers to the security-relevant moment at the exit:
// whether a human witnessed the departure, and whether the card came back.
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { safeErrorMessage } from './errors';

export type ExitOutcome = { ok: true } | { ok: false; message: string };

/**
 * Logs a witnessed exit.
 *
 * `exit_verified: true` means exactly that — a human saw this visitor leave.
 * `sweep_overstays` (migration 067) is the only other writer of that column and
 * it can only ever set false, because an auto-close is an admission that we
 * lost track of somebody, never an observation of where they went. Never let
 * this and the sweep write the same value.
 *
 * `visitor_card_returned_at` is set only when a card was issued (migration
 * 076). It is a different fact from `checked_out_at`: one says the card came
 * back, the other says the visitor left.
 */
export async function logVisitExit(visit: Visit): Promise<ExitOutcome> {
  if (visit.status !== 'checked_in') {
    return { ok: false, message: 'Visitor is not checked in.' };
  }
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('visits')
      .update({
        status: 'checked_out',
        checked_out_at: now,
        exit_verified: true,
        visitor_card_returned_at: visit.visitor_card_number ? now : null,
      })
      .eq('id', visit.id);
    if (error) return { ok: false, message: safeErrorMessage(error, 'Failed to log exit.') };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err, 'Failed to log exit.') };
  }
}

/**
 * Reverses a check-out just logged.
 *
 * The 15-minute window and the "same guard" rule are enforced in the database
 * (migration 074), not here — a stale attempt comes back as the trigger's own
 * message. This exists because `checked_in -> checked_out` was a one-way door:
 * a mis-clicked row left a visitor who is still in the building recorded as
 * gone, and migration 060 then makes the obvious fix (check them in again)
 * create a SECOND visit row for one continuous presence.
 *
 * The columns are NULLed rather than annotated, because the visitor never left.
 * `checked_in_at` is deliberately not re-stamped for the same reason.
 * `visitor_card_returned_at` clears too — the card is not "returned" while its
 * visitor is back inside (076's consistency CHECK says a returned card belongs
 * to a closed visit).
 */
export async function undoVisitExit(visit: Visit): Promise<ExitOutcome> {
  try {
    const { error } = await supabase.from('visits')
      .update({
        status: 'checked_in',
        checked_out_at: null,
        exit_verified: null,
        visitor_card_returned_at: null,
      })
      .eq('id', visit.id);
    if (error) return { ok: false, message: safeErrorMessage(error, 'Could not undo the check-out.') };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: safeErrorMessage(err, 'Could not undo the check-out.') };
  }
}

/**
 * The visit row behind a search hit, fetched at the moment the guard presses
 * Check Out.
 *
 * `CardReturnConfirm` and `logVisitExit` both need the real row — the card
 * number to demand back, and the status to refuse a visit that is not inside.
 * A search result is a `MatchItem`, a projection built for reading, and
 * widening it to carry a whole Visit so one button can be pressed would put the
 * exit's two security-relevant facts into a shape assembled for a list.
 *
 * One extra round trip, on a press, at a gate. It also re-reads the status a
 * moment before the write, which is exactly where the answer should come from
 * when a second device may have checked the same visitor out already.
 */
export async function fetchVisitForExit(visitId: string): Promise<Visit | null> {
  const { data, error } = await supabase
    .from('visits')
    .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
    .eq('id', visitId)
    .maybeSingle();
  if (error) {
    console.error('[checkOutFlow] could not load the visit to check out', error);
    return null;
  }
  return (data as unknown as Visit | null) ?? null;
}
