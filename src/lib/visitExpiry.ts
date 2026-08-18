// When an approval stops being good, and when someone has been inside too long.
//
// This is the client-side mirror of migrations 066 (close_stale_approvals) and
// 067 (sweep_overstays). The database is the authority — it is what actually
// writes the status, on a schedule, where no browser can race it. This module
// exists so the guard's screen tells the same story between sweeps, and so the
// check-in path refuses a pass the nightly job is about to close anyway.
//
// Keep the two in step. If the rule changes here it changes in the migration,
// and vice versa; there is a test for every rule below precisely so a drift
// shows up as a red test rather than as a visitor arguing at the gate.
import type { Visit } from '../types/index';

/** Minutes past a booked slot before the guard's board calls a visitor late. */
export const OVERDUE_GRACE_MINUTES = 120;

/** Hours inside before a visit is treated as never having been checked out. */
export const OVERSTAY_HOURS = 12;

/** IST is UTC+5:30 and has no DST, so a fixed offset is exact, not an approximation. */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/**
 * The IST day ends at mall close, not midnight (migration 075).
 *
 * The client mirror of `vms_day_end_ist()`: the sweep's boundary, the QR
 * expiry and this constant all answer "when does the day end?" with 22:00 IST.
 */
export const DAY_END_HOUR_IST = 22;

/**
 * Midnight IST of the day containing `now`, as a UTC instant.
 *
 * The app used `new Date().toISOString().slice(0, 10)` for "today", which is the
 * UTC date. Between 00:00 and 05:30 IST that is yesterday, so early-morning
 * visits were filed under the previous day and visits booked for 01:00 IST were
 * invisible on the day they were due. One boundary, defined once, in the same
 * place the SQL defines it (public.vms_day_start_ist).
 */
export function istDayStart(now: Date = new Date()): Date {
  const shifted = now.getTime() + IST_OFFSET_MS;
  const midnightShifted = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(midnightShifted - IST_OFFSET_MS);
}

/** The IST calendar day a timestamp falls in, as `YYYY-MM-DD`. */
export function istDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 22:00 IST of the day containing `now` — the instant the day ends (075).
 *
 * NOT midnight: the day is the mall's day, 00:00–22:00 IST. Everything that
 * asks "is this pass still live?" uses this — the SQL sweep
 * (`vms_day_end_ist`), the QR expiry and this module, so the three cannot
 * disagree (the invariant migration 071 established).
 */
export function istDayEnd(now: Date = new Date()): Date {
  return new Date(istDayStart(now).getTime() + DAY_END_HOUR_IST * 3_600_000);
}

type ExpiryFields = Pick<Visit, 'scheduled_for' | 'created_at' | 'checked_in_at' | 'status'>;

/**
 * The moment an approval was good for.
 *
 * A pre-approval has a booked slot. A walk-in never does — WalkInRequest inserts
 * `scheduled_for` as null by construction — so its own creation is the only
 * moment it has, and the day it was created is the day it was good for.
 */
export function visitMoment(v: Pick<ExpiryFields, 'scheduled_for' | 'created_at'>): string {
  return v.scheduled_for ?? v.created_at;
}

/**
 * True once the IST day containing the visit's moment has ended.
 *
 * NOT a grace period. A visitor 45 minutes late is still a visitor who is
 * coming; turning them away at the gate because a timer elapsed is a worse
 * failure than a stale row overnight. This is the rule migration 061 introduced
 * and 066 finished — expressed as "the day has ended" rather than "now is past
 * the slot" so it means the same thing whenever it is evaluated.
 */
export function isVisitExpired(v: ExpiryFields, now: Date = new Date()): boolean {
  // Attendance beats every expiry rule. Mirrors `checked_in_at is null` in
  // close_stale_approvals: a visit that was attended must never be reachable.
  if (v.checked_in_at) return false;
  // The day containing the visit's moment has ended: 22:00 IST of the moment's
  // own date has passed (075). Deliberately NOT "moment < today's 22:00" —
  // that is true for every moment of today, and unlike the sweep, which only
  // ever runs after close, this is evaluated at any hour of the day.
  return istDayEnd(new Date(visitMoment(v))).getTime() <= now.getTime();
}

/**
 * True when this approval is one the guard could act on right now.
 *
 * "Due" is the complement of two mistakes the check-in list used to make. It
 * filtered on `created_at` being today, so a pre-approval booked yesterday for
 * today — the ordinary case — never appeared in the list at all, and the guard
 * had to fall back to searching. And nothing excluded a booking for next month,
 * which reads at the gate exactly like one due now.
 *
 * Expressed against the visit's own moment, so both are one rule: its day has
 * arrived, and its day has not yet passed.
 */
export function isDueToday(v: ExpiryFields, now: Date = new Date()): boolean {
  if (v.checked_in_at) return false;
  if (isVisitExpired(v, now)) return false;
  return istDateKey(visitMoment(v)) <= istDateKey(now);
}

/** How far a slot may sit BEFORE the moment it was booked and still be read as
 *  an appointment. A host raising a pass for a visitor already walking up to
 *  the desk types "now" and lands a minute or two behind by the time the row
 *  is written; fifteen minutes covers that, a slow form and a clock that
 *  disagrees. Beyond it the slot is not a late booking, it is a wrong one. */
export const SLOT_BACKDATE_TOLERANCE_MINUTES = 15;

/**
 * IS THIS SLOT AN APPOINTMENT SOMEBODY COULD HAVE KEPT? (client report,
 * 2026-08-18: a visitor whose slot read 12 am and who arrived at 11 am was
 * being called late.)
 *
 * The arithmetic in `lateArrivalMs` was right — 00:10 to 11:22 is eleven hours
 * — and the answer was still wrong, because the slot it measured against was
 * booked at 10:08 THAT MORNING. A pass raised at ten past ten for ten past
 * midnight is not a visitor who overslept; it is a picker set to AM instead of
 * PM, and nobody could have arrived on time for it even in principle. Reading
 * eleven hours off it and printing them on the visitor's row states a fact
 * about the person that is really a fact about the form.
 *
 * So: a slot that predates its own booking by more than the tolerance is not
 * an appointment, and everything that compares a visitor against their slot —
 * the Late chip on a row that has arrived, the LATE/MISSED pill on the
 * Pre-Registered board for one who has not — asks this first and says nothing
 * rather than something untrue. The slot is still stored, still shown, still
 * exported; what stops is the JUDGEMENT drawn from it.
 *
 * `validatePreApproval` refuses to create any more of these. This exists for
 * the rows already in the database, which cannot be re-typed.
 */
export function isKeepableSlot(
  v: Pick<ExpiryFields, 'scheduled_for' | 'created_at'>,
): boolean {
  if (!v.scheduled_for) return false;
  const slot = new Date(v.scheduled_for).getTime();
  const booked = new Date(v.created_at).getTime();
  if (Number.isNaN(slot)) return false;
  // An unparseable created_at cannot disprove the slot, so the slot stands.
  if (Number.isNaN(booked)) return true;
  return slot >= booked - SLOT_BACKDATE_TOLERANCE_MINUTES * 60_000;
}

/**
 * True when a booked visitor is late enough to be worth chasing — and nothing more.
 *
 * Deliberately separate from `isVisitExpired`, and deliberately not a status.
 * This is the only place a grace period belongs: it drives a nudge to the host,
 * never a write to `visits.status`. A visit can be overdue all afternoon and
 * still check in perfectly normally.
 */
export function isOverdue(
  v: ExpiryFields,
  now: Date = new Date(),
  graceMinutes: number = OVERDUE_GRACE_MINUTES,
): boolean {
  if (v.checked_in_at || !v.scheduled_for) return false;
  if (isVisitExpired(v, now)) return false;
  return now.getTime() - new Date(v.scheduled_for).getTime() > graceMinutes * 60_000;
}

/**
 * True when someone has been inside long enough that the record is probably wrong.
 *
 * Measured from entry rather than against a wall clock, because a fixed midnight
 * rule is wrong for exactly the people who generate overnight visits. The
 * default leaves a normal 21:00-to-08:00 stay alone.
 */
export function isOverstaying(
  v: Pick<Visit, 'status' | 'checked_in_at'> & { expected_departure?: string | null },
  now: Date = new Date(),
  hours: number = OVERSTAY_HOURS,
): boolean {
  const deadline = overstayDeadline(v, hours);
  return deadline !== null && now.getTime() > deadline;
}

/**
 * The instant this visit was due to end, in epoch ms, or null when the question
 * does not apply (nobody is inside).
 *
 * The approver's answer beats the fallback. A contractor booked until Friday is
 * not overstaying on Tuesday night, and before `expected_departure` existed
 * there was no way to say so — which is exactly why the sweep in migration 067
 * was installed unscheduled rather than guessing. Mirrors the same coalesce in
 * sweep_overstays (073).
 *
 * Extracted so `isOverstaying` (the tile's predicate) and `overstayMs` (the
 * "Overstaying by" column beside it) cannot answer from two different deadlines
 * — the same one-source rule guardTiles.ts exists for.
 */
export function overstayDeadline(
  v: Pick<Visit, 'status' | 'checked_in_at'> & { expected_departure?: string | null },
  hours: number = OVERSTAY_HOURS,
): number | null {
  if (v.status !== 'checked_in' || !v.checked_in_at) return null;
  return v.expected_departure
    ? new Date(v.expected_departure).getTime()
    : new Date(v.checked_in_at).getTime() + hours * 3_600_000;
}

/** How long past the deadline this visitor has been inside, in ms. 0 when they
 *  are not overstaying — never a negative number, which would read on screen as
 *  time owed rather than time overrun. */
export function overstayMs(
  v: Pick<Visit, 'status' | 'checked_in_at'> & { expected_departure?: string | null },
  now: Date = new Date(),
  hours: number = OVERSTAY_HOURS,
): number {
  const deadline = overstayDeadline(v, hours);
  if (deadline === null) return 0;
  return Math.max(0, now.getTime() - deadline);
}
