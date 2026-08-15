import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import type { IdScanResult } from '../pages/Guard/idScanTypes';
import { uploadPhoto } from './photoUpload';
import { isAlreadyInsideError } from './activeVisit';
import { notifyHostOnCheckIn } from './notifyHostCheckIn';
import { safeErrorMessage } from './errors';

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
// The photo is captured HERE and not at registration: WalkInRequest inserts
// photo_path/photo_data as null on purpose, because when a walk-in is raised
// nobody yet knows whether the host will say yes.

export type WalkInCheckIn = {
  photoBlob: Blob;
  carrying: boolean;
  remarks: string;
  idScan: IdScanResult | null;
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
    const { photoPath, photoData } = await uploadPhoto(details.photoBlob);
    const remarks = details.remarks.trim();

    // The ID read at the gate belongs on the visitor row, the same way
    // checkInScannedVisit persists it for the pre-approved lane — one identity
    // record whatever the arrival route.
    if (details.idScan?.idType || details.idScan?.idLast4) {
      await supabase.from('visitors').update({
        id_type: details.idScan.idType || null,
        id_last4: details.idScan.idLast4 || null,
      }).eq('id', visit.visitor_id);
    }

    const { error, data: updated } = await supabase.from('visits').update({
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      carrying_material: details.carrying,
      carrying_remarks: details.carrying && remarks ? remarks : null,
      visitor_card_number: details.cardNumber.trim(),
      ...(photoData ? { photo_data: photoData } : {}),
      ...(photoPath ? { photo_path: photoPath } : {}),
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
        : safeErrorMessage(err, 'Check-in failed.'),
    };
  }
}
