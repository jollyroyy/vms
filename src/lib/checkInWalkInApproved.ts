import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { isAlreadyInsideError } from './activeVisit';
import { notifyHostOnCheckIn } from './notifyHostCheckIn';
import { safeErrorMessage } from './errors';
import { findCardHolder, cardInUseMessage, isCardTakenError, CARD_TAKEN_FALLBACK } from './cardAssignment';

// The approved-walk-in check-in WRITE, in one place.
//
// This is the only route from `walkin_approved` to `checked_in`: CheckInPanel
// searches PRE-approvals, so once it moved off /visitors an approved walk-in
// had no way through the gate at all. It used to live inline in Console.tsx,
// which was fine while /visitors was the guard's walk-in tab. The Visitors tab
// left the sidebar on 2026-08-15 (its cards moved onto the dashboard) and the
// walk-in lane became its own destination, /guard/walk-in — so the write now
// has two callers and must not be hand-copied for the second one.
//
// NO PHOTO AND NO ID SCAN ARE TAKEN HERE (client instruction, 2026-08-17).
// WalkInRequest refuses to submit a walk-in request without both, uploads the
// photo before inserting the visit row and writes id_type/id_last4 onto the
// visitor — so by the time the host has said yes the identity record is already
// complete, and asking for it again at the gate photographed the same person
// twice for one visit. What the gate alone knows is the card number, and that
// is what this write adds. Do not re-add a photo/scan argument: the fields it
// would overwrite are the ones registration filled.

export type WalkInCheckIn = {
  carrying: boolean;
  remarks: string;
  cardNumber: string;
};

export type WalkInCheckInOutcome =
  | { ok: true; visitorName: string }
  | { ok: false; message: string };

export async function checkInApprovedWalkIn(
  visit: Visit,
  details: WalkInCheckIn,
): Promise<WalkInCheckInOutcome> {
  try {
    const remarks = details.remarks.trim();

    // ONE CARD, ONE HOLDER (client instruction, 2026-08-18). The card number is
    // the only thing this desk collects, so it is also the only thing this desk
    // can get wrong twice. Migration 102 enforces it; this names the holder.
    const cardHolder = await findCardHolder(details.cardNumber, { excludeVisitId: visit.id });
    if (cardHolder) return { ok: false, message: cardInUseMessage(cardHolder) };

    const { error, data: updated } = await supabase.from('visits').update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      carrying_material: details.carrying,
      carrying_remarks: details.carrying && remarks ? remarks : null,
      visitor_card_number: details.cardNumber.trim(),
    } as never).eq('id', visit.id).select('id, host_id').maybeSingle();
    if (error) throw error;

    if (updated) {
      void notifyHostOnCheckIn({
        id: updated.id,
        host_id: (updated as { host_id: string | null }).host_id,
        visitor_name: visit.visitor?.full_name ?? undefined,
      });
    }
    return { ok: true, visitorName: visit.visitor?.full_name ?? 'Visitor' };
  } catch (err) {
    // The one-open-visit-per-visitor index (migration 060) is matched by
    // constraint NAME, so an unrelated unique violation is not mislabelled.
    return {
      ok: false,
      message: isAlreadyInsideError(err)
        ? 'That visitor is already checked in and has not been checked out.'
        : isCardTakenError(err)
          ? CARD_TAKEN_FALLBACK
          : safeErrorMessage(err, 'Check-in failed.'),
    };
  }
}
