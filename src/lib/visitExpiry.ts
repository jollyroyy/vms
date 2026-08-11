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
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

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
  return new Date(visitMoment(v)).getTime() < istDayStart(now).getTime();
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
  if (v.status !== 'checked_in' || !v.checked_in_at) return false;
  // The approver's answer beats the fallback. A contractor booked until Friday
  // is not overstaying on Tuesday night, and before `expected_departure` existed
  // there was no way to say so — which is exactly why the sweep in migration 067
  // was installed unscheduled rather than guessing. Mirrors the same coalesce in
  // sweep_overstays (073).
  const deadline = v.expected_departure
    ? new Date(v.expected_departure).getTime()
    : new Date(v.checked_in_at).getTime() + hours * 3_600_000;
  return now.getTime() > deadline;
}
