// The recurring-visitor check-in write, lifted out of CheckInPanel.
//
// This is the one arrival path that does NOT go through checkInScannedVisit: a
// recurring visitor has no visit row until they turn up (see the comment in
// checkInMatches.ts on why their MatchItem carries nulls), so this branch has
// to create the visitor and the visit rather than update one. Keeping it here
// leaves CheckInPanel a state shell, and keeps the two writes visibly distinct
// — they are genuinely different operations and the earlier version of this
// code read as though they were one.
import { supabase } from '../supabaseClient';
import { normalizePhone } from './blacklist';
import { safeErrorMessage } from './errors';
import { uploadPhoto } from './photoUpload';
import {
  findActiveVisitByPhone, findActiveVisitByIdProof, activeVisitMessage,
  isAlreadyInsideError, ALREADY_INSIDE_FALLBACK,
} from './activeVisit';
import type { VisitorPurpose } from '../types/index';
import type { MatchItem } from '../pages/Guard/checkInTypes';
import type { IdScanResult } from '../pages/Guard/idScanTypes';

export type RecurringCheckInInput = {
  match: MatchItem;
  photoBlob: Blob;
  carrying: boolean;
  remarks: string;
  idScan: IdScanResult | null;
  /** Physical visitor card number (migration 076) — required, as on every
      guard check-in path. */
  cardNumber: string;
};

export type RecurringCheckInOutcome = { ok: true } | { ok: false; message: string };

/**
 * Creates (or reuses) the visitor and inserts a `checked_in` visit for a
 * recurring visitor. Never throws — failures come back as `ok: false`.
 *
 * The already-inside pre-check stays on this path deliberately: migration 060's
 * partial unique index is the real guarantee, but it surfaces as a raw 23505,
 * and a guard needs to be told WHICH person is already inside rather than shown
 * a constraint name.
 */
export async function checkInRecurringVisitor(
  input: RecurringCheckInInput,
): Promise<RecurringCheckInOutcome> {
  const { match, photoBlob, carrying, remarks, idScan, cardNumber } = input;
  try {
    const clash = await findActiveVisitByPhone(match.visitorPhone)
      ?? await findActiveVisitByIdProof(
        idScan?.idType ?? match.idType,
        idScan?.idLast4 ?? match.idLast4,
      );
    if (clash) return { ok: false, message: activeVisitMessage(clash) };

    const { photoPath, photoData } = await uploadPhoto(photoBlob);

    let normalized: string;
    try { normalized = normalizePhone(match.visitorPhone); }
    catch { return { ok: false, message: 'Invalid phone' }; }

    const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
      { phone: normalized, full_name: match.visitorName, vendor_name: null },
      { onConflict: 'phone' },
    ).select().single();
    if (visErr || !vis) throw visErr ?? new Error('Failed to create visitor');

    if (idScan?.idType || idScan?.idLast4) {
      await supabase.from('visitors').update({
        id_type: idScan.idType || null,
        id_last4: idScan.idLast4 || null,
      }).eq('id', vis.id);
    }

    // The recurring MatchItem encodes its origin in the id as
    // `rec:<departmentId>:<hostId>` — see buildMatchItems.
    const deptId = match.id.split(':')[1] ?? '';
    const hostId = match.id.split(':')[2];
    const remarksTrimmed = carrying ? remarks.trim() : '';

    const { error: visitErr } = await supabase.from('visits').insert({
      visitor_id: vis.id,
      department_id: deptId,
      host_id: hostId || vis.id,
      purpose: (match.purpose as VisitorPurpose) || 'other',
      photo_path: photoPath, photo_data: photoData,
      status: 'checked_in',
      checked_in_at: new Date().toISOString(),
      checked_out_at: null, exit_verified: null, rejection_reason: null,
      carrying_material: carrying, carrying_remarks: remarksTrimmed || null,
      visitor_card_number: cardNumber.trim(),
      scheduled_for: null,
    });
    if (visitErr) throw visitErr;

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: isAlreadyInsideError(err)
        ? ALREADY_INSIDE_FALLBACK
        : safeErrorMessage(err, 'Check-in failed.'),
    };
  }
}
