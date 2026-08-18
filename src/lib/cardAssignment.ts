// WHO IS HOLDING A PHYSICAL VISITOR CARD, AND WHETHER IT CAN BE HANDED OUT
// AGAIN (client instruction, 2026-08-18: "the same card number cannot be
// assigned twice … until and unless it gets returned, and that only for today.
// And at the end of the day tally whatever cards did not return, flag those").
//
// Migration 076 minted the card at check-in and demanded it back at check-out,
// but nothing ever asked whether the number a guard was typing was already out
// in the building. Two visitors could be issued C-104 an hour apart, and the
// exit desk then had two open visits demanding the same card back — the guard
// collects one card, ticks one box, and the other visit's tick is a statement
// about an object that is not there.
//
// TWO QUESTIONS, DELIBERATELY NOT ONE:
//
//   1. Is the card OUT right now?  `findCardHolder` — the check made before a
//      check-in writes. Its window is the client half of migration 102's two
//      unique indexes: a card is unavailable while its holder is still inside
//      (any day — somebody who arrived last night is still carrying it), and
//      unavailable for the rest of the IST day it was issued on if it never
//      came back. A card IS reissued daily, so tomorrow it is free again;
//      without that bound a lost card would wedge its number out of the stack
//      for good, with no screen in this app able to release it.
//
//   2. Did the card come BACK?  `isCardOutstanding` — the predicate behind the
//      dashboard's Cards Not Returned tile. A card still with a visitor who is
//      inside is not outstanding, it is in use; a card whose visit is closed
//      and whose return was never stamped is the end-of-day tally the client
//      asked for.
//
// The DATABASE is the real gate (migration 102). This file exists so a guard
// reads "C-104 is still with Priya Nair" instead of a 23505 constraint name —
// the same division of labour lib/activeVisit.ts has for the one-open-visit
// rule, down to matching the violation BY CONSTRAINT NAME so an unrelated
// unique failure is never mislabelled.
import { supabase } from '../supabaseClient';
import { istDayStart } from './visitExpiry';
import { isValidCardNumber } from './cardNumber';
import type { ReportVisit } from './reportRow';

export type CardHolder = {
  visitId: string;
  visitorName: string;
  /** The number as it is STORED, which may differ in case from what was typed. */
  cardNumber: string;
  checkedInAt: string | null;
  /** Still on the premises, as opposed to gone without handing the card back. */
  stillInside: boolean;
};

/** Upper case and trimmed — the form the DB indexes on. c-104 IS C-104: the
 *  number is read off a printed card and typed by hand, and a gate that
 *  reissues a card over a shift key has no rule at all. */
export function normalizeCard(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * The card was issued and never came back, and its visit is over.
 *
 * `status !== 'checked_in'` is what makes this "not returned" rather than "in
 * use": while the visitor is inside, the card is exactly where it should be.
 * What lands here is a visit closed without the tick — in practice a row the
 * overstay sweep gave up on (migration 067 stamps `checked_out_at` and
 * `exit_verified = false` and can stamp no return, because nobody witnessed
 * one), which is precisely the card nobody has in their hand at 10 PM.
 *
 * Pure and injectable-free: this is the tile's predicate AND the panel's
 * filter, per the one-predicate rule.
 */
export function isCardOutstanding(v: ReportVisit): boolean {
  return Boolean(v.visitor_card_number)
    && !v.visitor_card_returned_at
    && v.status !== 'checked_in';
}

/**
 * The open, unreturned issue of this card, or null when the number is free.
 *
 * `excludeVisitId` is the row being checked in itself — a re-submit of the same
 * visit must not be refused by its own previous write.
 */
export async function findCardHolder(
  cardNumber: string,
  opts: { excludeVisitId?: string; now?: Date } = {},
): Promise<CardHolder | null> {
  // Only ever asked about a well-formed number. The allowlist is letters,
  // digits and hyphens (lib/cardNumber.ts), so this also guarantees the value
  // carries no `%` or `_` for the ilike below to read as a wildcard.
  if (!isValidCardNumber(cardNumber)) return null;
  const normalized = normalizeCard(cardNumber);

  const { data } = await supabase
    .from('visits')
    .select('id, status, checked_in_at, visitor_card_number, visitor:visitors(full_name)')
    .is('visitor_card_returned_at', null)
    .ilike('visitor_card_number', normalized)
    .limit(20);

  const dayStart = istDayStart(opts.now ?? new Date()).getTime();
  const rows = (data ?? []) as unknown as {
    id: string; status: string; checked_in_at: string | null;
    visitor_card_number: string | null; visitor: { full_name: string } | null;
  }[];

  const blocking = rows.find((r) => {
    if (r.id === opts.excludeVisitId) return false;
    // Still inside, on ANY day — the card is physically with that person.
    if (r.status === 'checked_in') return true;
    // Issued earlier TODAY and never handed back. Compared as an instant, never
    // as a string: PostgREST renders `…+00:00` and toISOString() ends `Z`.
    if (!r.checked_in_at) return false;
    const inAt = new Date(r.checked_in_at).getTime();
    return !Number.isNaN(inAt) && inAt >= dayStart;
  });

  if (!blocking) return null;
  return {
    visitId: blocking.id,
    visitorName: blocking.visitor?.full_name ?? 'another visitor',
    cardNumber: blocking.visitor_card_number ?? normalized,
    checkedInAt: blocking.checked_in_at,
    stillInside: blocking.status === 'checked_in',
  };
}

/** What the guard reads. Names the holder, so the next step is to go and find
 *  the card rather than to try another number and hope. */
export function cardInUseMessage(holder: CardHolder): string {
  const since = formatSince(holder.checkedInAt);
  if (holder.stillInside) {
    return `Card ${holder.cardNumber} is still with ${holder.visitorName}, who checked in${since} `
      + 'and has not checked out. Issue a different card.';
  }
  return `Card ${holder.cardNumber} was issued to ${holder.visitorName}${since} today and has not been `
    + 'returned. Issue a different card until it comes back.';
}

function formatSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return ` at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Migration 102's two unique indexes, matched BY NAME — the race
 * `findCardHolder` cannot close, when a second device issues the same card
 * between our lookup and our write.
 */
export function isCardTakenError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e || e.code !== '23505') return false;
  const msg = e.message ?? '';
  return msg.includes('visits_card_live_holder_uidx')
    || msg.includes('visits_card_unreturned_today_uidx');
}

export const CARD_TAKEN_FALLBACK =
  'That visitor card is already issued and has not been returned. Issue a different card.';
