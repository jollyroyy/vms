import { supabase } from '../supabaseClient';
import { normalizePhone } from './blacklist';

// "Already inside" checks for the three check-in write paths (guard console,
// walk-in lane, kiosk).
//
// The database is the real enforcement — migration 060 puts a partial unique
// index on visits(visitor_id) where status = 'checked_in', so a duplicate
// check-in fails even if two devices race each other past the check below.
// What this file adds is the sentence a human can act on: a raw 23505 from
// PostgREST tells a guard nothing, "Priya Nair is already inside" tells them
// to look for the person, not to retry.

export type ActiveVisit = {
  visitId: string;
  visitorName: string;
  phone: string;
  checkedInAt: string | null;
  /** How the clash was found — the two cases need different wording. */
  matchedOn: 'phone' | 'id';
};

type Row = {
  id: string;
  checked_in_at: string | null;
  visitor: { full_name: string; phone: string; id_type: string | null; id_last4: string | null } | null;
};

const SELECT = 'id, checked_in_at, visitor:visitors!inner(full_name, phone, id_type, id_last4)';

/**
 * The open visit for this mobile number, or null. Phone is the strong check:
 * visitors.phone is unique, so one number is one person as far as the schema
 * is concerned.
 */
export async function findActiveVisitByPhone(phone: string): Promise<ActiveVisit | null> {
  let normalized: string;
  try { normalized = normalizePhone(phone); } catch { return null; }

  const { data } = await supabase
    .from('visits')
    .select(SELECT)
    .eq('status', 'checked_in')
    .eq('visitors.phone', normalized)
    .limit(1);

  return toActiveVisit((data as unknown as Row[])?.[0], 'phone');
}

/**
 * The open visit held by someone carrying this ID card, or null.
 *
 * Weaker than the phone check by construction: the schema stores only the ID
 * type and the last four digits, so this can collide across two genuinely
 * different people. It is a warning worth showing a guard, not a fact worth
 * asserting in the database — which is why there is no unique index behind it.
 */
export async function findActiveVisitByIdProof(
  idType: string | null | undefined,
  idLast4: string | null | undefined,
): Promise<ActiveVisit | null> {
  if (!idType || !idLast4) return null;

  const { data } = await supabase
    .from('visits')
    .select(SELECT)
    .eq('status', 'checked_in')
    .eq('visitors.id_type', idType)
    .eq('visitors.id_last4', idLast4)
    .limit(1);

  return toActiveVisit((data as unknown as Row[])?.[0], 'id');
}

function toActiveVisit(row: Row | undefined, matchedOn: 'phone' | 'id'): ActiveVisit | null {
  if (!row?.visitor) return null;
  return {
    visitId: row.id,
    visitorName: row.visitor.full_name,
    phone: row.visitor.phone,
    checkedInAt: row.checked_in_at,
    matchedOn,
  };
}

/** What the guard reads. Names the person so they can go and find them. */
export function activeVisitMessage(active: ActiveVisit): string {
  const since = formatSince(active.checkedInAt);
  if (active.matchedOn === 'phone') {
    return `${active.visitorName} (${active.phone}) is already inside${since}. `
      + 'Check them out before checking them in again.';
  }
  return `That ID card is already in use — ${active.visitorName} is inside${since} `
    + 'with the same ID proof. Check them out first, or use a different ID.';
}

function formatSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return ` since ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Postgres 23505 on the partial index — the race the pre-check cannot close.
 * Recognised by constraint name so an unrelated unique violation still surfaces
 * its own error rather than being mislabelled "already inside".
 */
export function isAlreadyInsideError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === '23505' && (e.message ?? '').includes('visits_one_open_per_visitor');
}

export const ALREADY_INSIDE_FALLBACK =
  'This visitor is already inside. Check them out before checking them in again.';
