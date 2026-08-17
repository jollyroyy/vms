// The Blacklist & Security tab's one write: flagging a visitor.
//
// This is the sole mutation on the admin surface (2026-08-17 read-only
// scope, see CLAUDE.md's Admin scope section) and it writes to `visitors`,
// never to `visits` — security administration, not a visitor-record action.
// Modelled on lib/adminHods.ts: a normaliser, a validator returning a
// human-readable string or null, and a thin async write that throws the
// Supabase error message verbatim.
import { supabase } from '../supabaseClient';
import { stripControlChars, squashSpace } from './inputRules';
import type { Visitor } from '../types/index';

/** Free prose typed by an admin, capped the way `carrying_remarks` and
 *  `visits.remarks` are (migration 068) — long enough for a real reason,
 *  short enough that this stays a reason and not an essay. Not a schema CHECK:
 *  `visitors.blacklist_reason` carries none, so this is a usability guard,
 *  the same caveat lib/inputRules.ts states for its own allowlist. */
export const BLACKLIST_REASON_MAX = 500;

export function normalizeBlacklistReason(raw: string): string {
  return squashSpace(stripControlChars(raw)).slice(0, BLACKLIST_REASON_MAX);
}

/** Returns a human-readable error, or null when the reason may be submitted.
 *  The reason is MANDATORY — this is what gates the confirm button, modelled
 *  on `CardReturnConfirm`'s tick: a write nobody can justify in one sentence
 *  is a write that should not happen. */
export function blacklistReasonError(raw: string): string | null {
  const reason = normalizeBlacklistReason(raw);
  if (!reason) return 'A reason is required before a visitor can be blacklisted.';
  return null;
}

/**
 * Visitors matching a phone or name fragment, for the "who am I blacklisting"
 * search. Deliberately narrow — a handful of candidates for an admin to pick
 * the right person from, not a full directory browse (that is
 * `useVisitorDirectory`, feeding the panel below).
 */
export async function searchVisitorsForBlacklist(query: string): Promise<Visitor[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const pattern = `%${trimmed.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
    .order('full_name')
    .limit(10);
  if (error) {
    console.error('[adminBlacklist] visitor search failed', error);
    return [];
  }
  return (data as unknown as Visitor[]) ?? [];
}

/** Flags a visitor. Throws on failure so the form can show the message. */
export async function blacklistVisitor(visitorId: string, reason: string): Promise<void> {
  const cleanReason = normalizeBlacklistReason(reason);
  if (!cleanReason) throw new Error('A reason is required before a visitor can be blacklisted.');
  const { error } = await supabase
    .from('visitors')
    .update({ is_blacklisted: true, blacklist_reason: cleanReason })
    .eq('id', visitorId);
  if (error) throw new Error(error.message);
}
