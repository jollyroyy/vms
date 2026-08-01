// QR check-in lookup: resolves a scanned/hand-keyed code to a visit row and
// reports whether it may proceed to check-in. Fetch-and-gate only — no host
// name attachment, no photo upload, no check-in write (those stay elsewhere).
import { supabase } from '../supabaseClient';
import { safeErrorMessage } from './errors';
import { parseQrPayload, evaluateQrVisit, type QrGate } from './qrToken';
import type { Visit } from '../types/index';

export type QrLookupResult =
  | { status: 'found'; visit: Visit; gate: QrGate }
  | { status: 'invalid' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/** Resolves a scanned QR payload (or bare token) to a visit and its check-in gate. */
export async function lookupVisitByQr(raw: string, now?: Date): Promise<QrLookupResult> {
  const token = parseQrPayload(raw);
  if (!token) return { status: 'invalid' };

  try {
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .eq('qr_token', token)
      .maybeSingle();

    if (error) {
      return { status: 'error', message: safeErrorMessage(error, 'Failed to look up QR code.') };
    }

    if (!data) return { status: 'not_found' };

    const visit = data as unknown as Visit;
    return { status: 'found', visit, gate: evaluateQrVisit(visit, now) };
  } catch (err) {
    return { status: 'error', message: safeErrorMessage(err, 'Failed to look up QR code.') };
  }
}
