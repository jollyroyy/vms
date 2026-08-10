// Guard universal Search — pure query-classification logic (no React, no Supabase).
// A guard pastes/types one thing into one box; we must figure out whether it is a
// phone number, a visit reference number (VIS-YYYYMMDD-NNNN / GP-IN|OUT-...), or a
// plain name, so the page knows which column to query against.
import { normalizePhone } from './blacklist';

export type SearchKind = 'phone' | 'ref' | 'name';
export type ParsedQuery = { kind: SearchKind; value: string };

// Same shape as REF_PATTERN in src/lib/refNumber.ts — kept independent here since
// that module only formats/parses sequences, it doesn't export a matcher.
const REF_PATTERN = /^(VIS|GP-IN|GP-OUT)-\d{8}-\d{4,}$/;

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  phone: 'Phone number',
  ref: 'Reference number',
  name: 'Visitor Name',
};

export function parseSearchQuery(raw: string): ParsedQuery | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;

  // Ref numbers (VIS-20260720-0001, GP-IN-...) contain 12+ digits once the
  // separators are stripped, which normalizePhone would happily accept as a
  // phone number. Check the ref format FIRST so refs never get misclassified.
  const upper = trimmed.toUpperCase();
  if (REF_PATTERN.test(upper)) {
    return { kind: 'ref', value: upper };
  }

  try {
    const normalized = normalizePhone(trimmed);
    return { kind: 'phone', value: normalized };
  } catch {
    // Not a valid phone — fall through to name.
  }

  return { kind: 'name', value: trimmed };
}
