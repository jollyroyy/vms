import type { ReportVisit } from './reportRow';
import { istDateKey } from './visitExpiry';

// The Pre-Registered board's two rules: which visits belong on it at all, and
// what each filter chip selects.
//
// IT IS TODAY'S NOT-YET-ARRIVED PRE-APPROVALS, AND NOTHING ELSE (client
// instruction, 2026-08-15). Two constraints, and each removes a whole class of
// row that used to be here:
//
//   * TODAY. Yesterday's board is not a thing a guard at the gate can act on.
//   * NOT YET CHECKED IN. The moment a visitor walks through, they stop being
//     an arrival to expect and become a person on site — which is the Entry &
//     Exit tab's subject, where their entry time, their exit time and their
//     pass all are. A visitor listed on both tabs is one visitor rendered
//     twice, and the guard has to work out which screen is authoritative.
//
// `status = 'approved'` carries both the origin and the openness: `approved`
// definitively means pre-approved (`lib/visitOrigin.ts` — a walk-in reaches
// `walkin_approved`, never this), and every closed outcome (no_show, expired,
// cancelled, rejected, checked_out) has left it. So a closed row cannot reach
// this board, and the pill below has only three states to say.
//
// One predicate per chip, in one file, because the chip's COUNT and the cards
// it opens are both derived from it — the same rule `lib/guardTiles.ts` holds
// for the dashboard, and for the same reason: the board used to compute
// `arriving` as `all - arrived - missed - late`, which is only ever a count and
// could never have been a list.

/** Minutes past a slot after which "missed" hardens into "late". */
export const LATE_AFTER_MINUTES = 30;

/** The Today-at-a-Glance windows, in IST hours, defined ONCE.
 *
 *  They used to live as two hardcoded label strings in GlanceRail ("09:00-12:00",
 *  "12:00-17:00") and two unrelated `getHours()` comparisons in the page — so
 *  the heading and the number under it were free to disagree, and did: the
 *  afternoon test had no upper bound, counting a 20:00 booking under a label
 *  that stopped at 17:00. The rail now renders its labels from these. */
export const MORNING_FROM = 9;
export const MORNING_TO = 12;
export const AFTERNOON_FROM = 12;
export const AFTERNOON_TO = 17;

/** The hour of an instant IN IST.
 *
 *  `new Date(iso).getHours()` reads the BROWSER's timezone, which on this
 *  deployment is not something to trust — and unlike a mis-rendered string, a
 *  wrong hour here changes a count. */
export function istHour(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false,
  }).format(new Date(iso));
  return Number(h);
}

/** No `arrived` chip: an arrived visitor is not on this board at all. */
export type PreRegisteredChip = 'all' | 'arriving' | 'missed' | 'late';

/** Was this visit's slot today, in IST? */
export function isScheduledToday(v: ReportVisit, now: Date): boolean {
  const when = v.scheduled_for ?? v.created_at;
  return istDateKey(new Date(when)) === istDateKey(now);
}

/** Does this visit belong on the Pre-Registered board?
 *
 *  The single membership rule, applied to the fetch's rows before anything else
 *  looks at them — so the chips, the counts, the header and the glance rail all
 *  slice the same population and cannot disagree about what the board holds. */
export function isPreRegisteredArrival(v: ReportVisit, now: Date): boolean {
  return v.status === 'approved' && !v.checked_in_at && isScheduledToday(v, now);
}

function minutesPastSlot(v: ReportVisit, now: Date): number | null {
  if (!v.scheduled_for) return null;
  const slot = new Date(v.scheduled_for).getTime();
  if (Number.isNaN(slot)) return null;
  return (now.getTime() - slot) / 60000;
}

export type PreRegisteredPill = { label: string; cls: string };

/** What this card says about itself. Three states, because the board holds only
 *  open pre-approvals whose visitor has not walked in yet: their slot is ahead,
 *  just past, or well past. */
export function preRegisteredPill(v: ReportVisit, now: Date): PreRegisteredPill {
  const past = minutesPastSlot(v, now);
  if (past !== null && past > 0) {
    return past > LATE_AFTER_MINUTES
      ? { label: 'LATE', cls: 'bg-warning-500/15 text-warning-400 border-warning-400/30' }
      : { label: 'MISSED', cls: 'bg-danger-600/15 text-danger-400 border-danger-500/30' };
  }
  return { label: 'EXPECTED', cls: 'bg-brand-600/15 text-brand-400 border-brand-500/30' };
}

const CHIP_FILTER: Record<PreRegisteredChip, (v: ReportVisit, now: Date) => boolean> = {
  all: () => true,
  arriving: (v, now) => {
    const past = minutesPastSlot(v, now);
    return past === null || past <= 0;
  },
  missed: (v, now) => {
    const past = minutesPastSlot(v, now);
    return past !== null && past > 0 && past <= LATE_AFTER_MINUTES;
  },
  late: (v, now) => {
    const past = minutesPastSlot(v, now);
    return past !== null && past > LATE_AFTER_MINUTES;
  },
};

/** The rows a chip selects, from an already-scoped board. The chip's badge is
 *  this list's length — there is no second rule, so a count can never disagree
 *  with what it opens. */
export function chipVisits(chip: PreRegisteredChip, visits: ReportVisit[], now: Date): ReportVisit[] {
  return visits.filter((v) => CHIP_FILTER[chip](v, now));
}

export function chipCounts(visits: ReportVisit[], now: Date): Record<PreRegisteredChip, number> {
  return {
    all: visits.length,
    arriving: chipVisits('arriving', visits, now).length,
    missed: chipVisits('missed', visits, now).length,
    late: chipVisits('late', visits, now).length,
  };
}
