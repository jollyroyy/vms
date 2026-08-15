import type { VisitStatus } from '../types/index';
import type { ReportVisit } from './reportRow';
import { istDateKey } from './visitExpiry';

// The Pre-Registered board's two rules: what pill a card wears, and what each
// filter chip selects.
//
// One predicate per chip, in one file, because the chip's COUNT and the cards
// it opens are both derived from it — the same rule `lib/guardTiles.ts` holds
// for the dashboard, and for the same reason: the board used to compute
// `arriving` as `all - arrived - missed - late`, which is only a count and
// could never be a list.
//
// The board now shows EVERY visitor ever pre-registered (client instruction,
// 2026-08-15), so "today" has to be said out loud rather than assumed from the
// fetch. `all` is the whole record; the other four are today's board, which is
// what their labels already claim — "Arriving Today" was never a promise about
// last Tuesday.

/** Minutes past a slot after which "missed" hardens into "late". */
export const LATE_AFTER_MINUTES = 30;

export type PreRegisteredChip = 'all' | 'arriving' | 'arrived' | 'missed' | 'late';

/** Was this visit's slot today, in IST? */
export function isScheduledToday(v: ReportVisit, now: Date): boolean {
  const when = v.scheduled_for ?? v.created_at;
  return istDateKey(new Date(when)) === istDateKey(now);
}

function minutesPastSlot(v: ReportVisit, now: Date): number | null {
  if (!v.scheduled_for) return null;
  const slot = new Date(v.scheduled_for).getTime();
  if (Number.isNaN(slot)) return null;
  return (now.getTime() - slot) / 60000;
}

/** Statuses that have already closed — nothing about a clock can change them. */
const CLOSED: Partial<Record<VisitStatus, { label: string; cls: string }>> = {
  checked_in: { label: 'ARRIVED', cls: 'bg-success-600/15 text-success-500 border-success-500/30' },
  checked_out: { label: 'DEPARTED', cls: 'bg-navy-500/15 text-navy-400 border-navy-400/30' },
  no_show: { label: 'NO-SHOW', cls: 'bg-danger-600/15 text-danger-400 border-danger-500/30' },
  expired: { label: 'EXPIRED', cls: 'bg-navy-500/15 text-navy-400 border-navy-400/30' },
  cancelled: { label: 'CANCELLED', cls: 'bg-navy-500/15 text-navy-400 border-navy-400/30' },
  // An HOD declined the request. Never "denied entry" — see CLAUDE.md; that
  // would claim a guard turned someone away at the door.
  rejected: { label: 'DECLINED', cls: 'bg-danger-600/15 text-danger-400 border-danger-500/30' },
};

export type PreRegisteredPill = { label: string; cls: string };

/** What this card says about itself.
 *
 *  The STATUS is asked first and the clock second. It used to be the other way
 *  round, which was harmless while the board only held today's open rows and
 *  wrong the moment it held history: a visit swept `no_show` last month has a
 *  slot far in the past, so a clock-first rule labelled it LATE — a word that
 *  says the visitor is still expected. */
export function preRegisteredPill(v: ReportVisit, now: Date): PreRegisteredPill {
  const closed = CLOSED[v.status];
  if (closed) return closed;
  const past = minutesPastSlot(v, now);
  if (past !== null && past > 0) {
    return past > LATE_AFTER_MINUTES
      ? { label: 'LATE', cls: 'bg-warning-500/15 text-warning-400 border-warning-400/30' }
      : { label: 'MISSED', cls: 'bg-danger-600/15 text-danger-400 border-danger-500/30' };
  }
  return { label: 'EXPECTED', cls: 'bg-brand-600/15 text-brand-400 border-brand-500/30' };
}

const CHIP_FILTER: Record<PreRegisteredChip, (v: ReportVisit, now: Date) => boolean> = {
  // Everything ever pre-registered, whatever became of it. This is the chip the
  // client asked for and the reason the fetch is no longer day-bounded.
  all: () => true,
  arriving: (v, now) => {
    if (!isScheduledToday(v, now) || v.checked_in_at) return false;
    const past = minutesPastSlot(v, now);
    return past === null || past <= 0;
  },
  arrived: (v, now) => isScheduledToday(v, now) && Boolean(v.checked_in_at),
  missed: (v, now) => {
    if (!isScheduledToday(v, now) || v.checked_in_at) return false;
    const past = minutesPastSlot(v, now);
    return past !== null && past > 0 && past <= LATE_AFTER_MINUTES;
  },
  late: (v, now) => {
    if (!isScheduledToday(v, now) || v.checked_in_at) return false;
    const past = minutesPastSlot(v, now);
    return past !== null && past > LATE_AFTER_MINUTES;
  },
};

/** The rows a chip selects. The chip's badge is this list's length — there is
 *  no second rule, so a count can never disagree with what it opens. */
export function chipVisits(chip: PreRegisteredChip, visits: ReportVisit[], now: Date): ReportVisit[] {
  return visits.filter((v) => CHIP_FILTER[chip](v, now));
}

export function chipCounts(visits: ReportVisit[], now: Date): Record<PreRegisteredChip, number> {
  return {
    all: visits.length,
    arriving: chipVisits('arriving', visits, now).length,
    arrived: chipVisits('arrived', visits, now).length,
    missed: chipVisits('missed', visits, now).length,
    late: chipVisits('late', visits, now).length,
  };
}
