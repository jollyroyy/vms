// The check-in WRITE for a visitor whose pass was scanned (or picked from the
// search desk). One copy, two surfaces: CheckInPanel on /guard/pre-approvals
// and the Scan Pass camera lane must never drift apart on the mutation that
// moves a visit to checked_in — that is the security-relevant moment of the
// whole gate. The recurring-visitor branch (which builds a visit row from
// scratch) stays in CheckInPanel; everything a QR scan can resolve is one of
// these two paths.
import { supabase } from '../supabaseClient';
import type { Visit } from '../types/index';
import { uploadPhoto } from './photoUpload';
import { safeErrorMessage } from './errors';
import {
  findActiveVisitByPhone, findActiveVisitByIdProof, activeVisitMessage,
  isAlreadyInsideError, ALREADY_INSIDE_FALLBACK,
} from './activeVisit';
import { isVisitExpired } from './visitExpiry';

/** The subset of a MatchItem this write needs. Structural on purpose: src/lib
    files are type-checked without JSX (see tsconfig.json), so they cannot
    import from a .tsx component — CheckInPanel's MatchItem satisfies this. */
export type ResolvedMatch = {
  visitorName: string;
  visitorPhone: string;
  visitId?: string;
  idType?: string | null;
  idLast4?: string | null;
};

/** The ID-scan payload collected on the photo step (IdScanOverlay result). */
export type IdScanResult = { idType: string; idLast4: string; name: string | null };

export type CheckInOutcome =
  | { ok: true; visitorName: string }
  | { ok: false; message: string };

type Opts = {
  match: ResolvedMatch;
  /** The visit row the match resolves to. A scan always has one — the QR
      token resolved to it — and CheckInPanel's search desk finds it in its
      loaded list. Pass null to skip the expiry re-check. */
  visit: Visit | null;
  photoBlob: Blob;
  carrying: boolean;
  remarks: string;
  idScan: IdScanResult | null;
  /** The physical visitor card number (migration 076). Required on every
      guard check-in — the confirm step is gated on it. */
  cardNumber: string;
};

const EXPIRED_MESSAGE = 'Cannot check in — this pass was for an earlier day and has expired. Please request a new approval.';

export async function checkInScannedVisit({ match, visit, photoBlob, carrying, remarks, idScan, cardNumber }: Opts): Promise<CheckInOutcome> {
  // The tick box is the record. Remarks only survive if the box is ticked,
  // so a guard who types a list and then unticks cannot leave orphaned text
  // describing material the visit says was never carried.
  const remarksTrimmed = carrying ? remarks.trim() : '';

  // Nobody who is already inside may check in again — they have to check out
  // first. Migration 060 enforces this on visits(visitor_id) where
  // status = 'checked_in'; this pre-check exists to name the person instead
  // of showing the guard a raw constraint violation. The ID check is the
  // weaker of the two (only the last four digits are stored) so it runs
  // second and only when the phone came back clean.
  const clash = await findActiveVisitByPhone(match.visitorPhone)
    ?? await findActiveVisitByIdProof(idScan?.idType ?? match.idType, idScan?.idLast4 ?? match.idLast4);
  if (clash) return { ok: false, message: activeVisitMessage(clash) };

  // Expiry is end-of-day (migration 061), and the QR gate already blocks an
  // expired pass at scan time — this re-check exists because the search desk
  // can also land here with a visit that has been open across days.
  if (visit && isVisitExpired(visit)) return { ok: false, message: EXPIRED_MESSAGE };

  const { photoPath, photoData } = await uploadPhoto(photoBlob);
  if (!match.visitId) return { ok: false, message: 'Missing visit ID for check-in' };

  const { data: visitRec } = await supabase.from('visits').select('visitor_id').eq('id', match.visitId).maybeSingle();
  if (idScan?.idType || idScan?.idLast4) {
    await supabase.from('visitors').update({
      id_type: idScan.idType || null,
      id_last4: idScan.idLast4 || null,
    }).eq('id', (visitRec as { visitor_id: string } | null)?.visitor_id ?? '');
  }

  const { error: err } = await supabase.from('visits').update({
    status: 'checked_in',
    checked_in_at: new Date().toISOString(),
    carrying_material: carrying,
    carrying_remarks: remarksTrimmed || null,
    visitor_card_number: cardNumber.trim(),
    ...(photoData ? { photo_data: photoData } : {}),
    ...(photoPath ? { photo_path: photoPath } : {}),
  } as any).eq('id', match.visitId);
  if (err) {
    // The race the pre-check cannot close: a second device checked the same
    // visitor in between our lookup and our write.
    return { ok: false, message: isAlreadyInsideError(err) ? ALREADY_INSIDE_FALLBACK : safeErrorMessage(err, 'Check-in failed.') };
  }
  return { ok: true, visitorName: match.visitorName };
}