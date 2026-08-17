// Taking a visitor OFF the blacklist — the admin's half and the CEO's half.
//
// This is the mirror of `lib/adminBlacklist.ts`, and the asymmetry between the
// two files is the whole feature (client instruction, 2026-08-17). Flagging a
// visitor is one admin's call, because a protective action delayed by an
// approval leaves somebody admissible who should not be. UNflagging is two
// people: an admin who justifies it and a CEO who grants it.
//
// NEITHER FUNCTION HERE WRITES `visitors`. Both call a SECURITY DEFINER RPC
// (migration 092), and the flag itself is cleared inside
// `decide_blacklist_removal` — the same statement as the decision. That is not
// a style choice: `prevent_guard_blacklist` already restricted the flag to
// admins, so the hole the migration closes is the ADMIN's own ability to PATCH
// `is_blacklisted = false` through PostgREST and skip the CEO entirely. A
// two-person rule one person's API call can walk around is not a rule, so the
// database refuses that write from every caller except the CEO's path. If this
// file ever grows a `supabase.from('visitors').update(...)`, the feature has
// been undone.
import { supabase } from '../supabaseClient';
import { stripControlChars, squashSpace } from './inputRules';

// `Database['public']['Functions']` is `Record<string, never>` in
// src/types/index.ts, which types every `supabase.rpc(name, args)` call as
// taking `undefined`. Widening that shared type ripples into postgrest-js's
// relationship inference for every table, so the narrow cast is the house
// pattern here — see the identical note in pages/Admin/HodPasswordReset.tsx.
// CALLED ON `supabase`, never lifted off it: `rpc` reads `this.rest`, so a
// detached `const f = supabase.rpc` throws on every call.
type RequestRpc = (
  fn: 'request_blacklist_removal',
  args: { p_visitor_id: string; p_justification: string },
) => Promise<{ data: string | null; error: { message: string } | null }>;

type DecideRpc = (
  fn: 'decide_blacklist_removal',
  args: { p_request_id: string; p_approve: boolean; p_note: string | null },
) => Promise<{ data: null; error: { message: string } | null }>;

const callRequestRpc: RequestRpc = (fn, args) =>
  (supabase.rpc as unknown as RequestRpc).call(supabase, fn, args);
const callDecideRpc: DecideRpc = (fn, args) =>
  (supabase.rpc as unknown as DecideRpc).call(supabase, fn, args);

/** Mirrors the `blacklist_removal_justification_len` CHECK exactly. The floor
 *  is the point: "ok", "fine" and "per email" are what a mandatory free-text
 *  box collects when the only rule is that it is non-empty, and a CEO deciding
 *  on one of those is being asked to rubber-stamp rather than to judge. */
export const REMOVAL_JUSTIFICATION_MIN = 10;
export const REMOVAL_JUSTIFICATION_MAX = 500;
export const REMOVAL_NOTE_MAX = 500;

export function normalizeRemovalText(raw: string, max: number): string {
  return squashSpace(stripControlChars(raw)).slice(0, max);
}

/** Human-readable error, or null when the justification may be submitted.
 *  This is what gates the confirm button, the same shape
 *  `blacklistReasonError` and `CardReturnConfirm`'s tick follow: the
 *  justification is the only route to the write, never a warning that can be
 *  clicked past. The DB repeats the rule, because a client-side check is a
 *  usability guard that any admin token can skip by calling PostgREST. */
export function removalJustificationError(raw: string): string | null {
  const text = normalizeRemovalText(raw, REMOVAL_JUSTIFICATION_MAX);
  if (!text) return 'A justification is required before a removal can be requested.';
  if (text.length < REMOVAL_JUSTIFICATION_MIN) {
    return `Please give at least ${REMOVAL_JUSTIFICATION_MIN} characters — the CEO decides on this sentence alone.`;
  }
  return null;
}

/**
 * Files a removal request against a blacklisted visitor. Throws with the
 * database's own message, which is written to be read by a person: "That
 * visitor is not blacklisted", "Only an admin can request a blacklist
 * removal".
 *
 * Returns the new request's id.
 */
export async function requestBlacklistRemoval(
  visitorId: string,
  justification: string,
): Promise<string> {
  const text = normalizeRemovalText(justification, REMOVAL_JUSTIFICATION_MAX);
  const problem = removalJustificationError(text);
  if (problem) throw new Error(problem);

  const { data, error } = await callRequestRpc('request_blacklist_removal', {
    p_visitor_id: visitorId,
    p_justification: text,
  });
  if (error) throw new Error(error.message);
  return data ?? '';
}

/**
 * The CEO's decision. Approving clears the flag in the same statement; refusing
 * leaves the visitor blacklisted and records why.
 *
 * A REFUSAL REQUIRES A NOTE AND AN APPROVAL DOES NOT, and that is deliberate
 * rather than an oversight. Approving grants what the admin asked for and
 * their justification is already on the row, so a second sentence would only
 * restate it. Refusing overrides a colleague who did write one, and "no" with
 * no reason attached leaves the admin with nothing to act on and nothing to
 * appeal — the same reasoning that makes the guard's Deny Entry reason
 * mandatory. Enforced here rather than in the CHECK constraint because the
 * constraint cannot see which way the decision went without duplicating the
 * status logic; the screen keeps the confirm disabled until the note exists.
 */
export async function decideBlacklistRemoval(
  requestId: string,
  approve: boolean,
  note: string,
): Promise<void> {
  const text = normalizeRemovalText(note, REMOVAL_NOTE_MAX);
  if (!approve && !text) {
    throw new Error('A reason is required before a removal request can be refused.');
  }
  const { error } = await callDecideRpc('decide_blacklist_removal', {
    p_request_id: requestId,
    p_approve: approve,
    p_note: text || null,
  });
  if (error) throw new Error(error.message);
}
