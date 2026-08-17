import type { ReportVisit } from './reportRow';
import { isOverstaying, overstayMs, OVERDUE_GRACE_MINUTES } from './visitExpiry';
import { formatDuration } from './dashboardColumns';

// The small boxed labels a guard reads off a row: is this person still inside,
// are they overrunning, did they arrive late.
//
// One file, because the SAME three questions are asked on two surfaces — the
// Entry & Exit table (client instruction, 2026-08-15: "under the checked-in
// users, whether that user is still inside or has checked out … and if somebody
// is overstaying … and if somebody has late checked in, how late") and the
// dashboard panel's Status column. Two hand-written copies of "is this row
// late?" is exactly the drift `guardTiles.ts` exists to prevent, one altitude
// down.
//
// PRESENCE IS ALWAYS RENDERED; the other two only when they are TRUE. A chip
// reading "On time" on every punctual row is noise that buries the one row that
// is not, and this file's whole job is to make the exception visible.

export type GateChipTone = 'inside' | 'left' | 'warn' | 'late' | 'neutral';

export type GateChip = {
  key: 'presence' | 'overstay' | 'late';
  label: string;
  tone: GateChipTone;
};

/**
 * How late this visitor was to their own booking, in ms. 0 when they were on
 * time, when they have not arrived, or when nobody booked them a slot — a
 * walk-in cannot be late for an appointment that was never made.
 */
export function lateArrivalMs(v: ReportVisit): number {
  if (!v.checked_in_at || !v.scheduled_for) return 0;
  const late = new Date(v.checked_in_at).getTime() - new Date(v.scheduled_for).getTime();
  return Number.isNaN(late) ? 0 : Math.max(0, late);
}

/**
 * True once the overrun is worth saying out loud. The threshold is
 * `OVERDUE_GRACE_MINUTES` — the same number the board already uses to call a
 * visitor late BEFORE they arrive, so the label cannot appear and disappear as
 * a visitor walks through the gate.
 */
export function isLateArrival(v: ReportVisit): boolean {
  return lateArrivalMs(v) > OVERDUE_GRACE_MINUTES * 60_000;
}

/** Where this visit stands at the gate, in one word. */
function presenceChip(v: ReportVisit): GateChip {
  if (v.status === 'checked_out') return { key: 'presence', label: 'Checked out', tone: 'left' };
  // "Checked in", not "Still inside" (client instruction, 2026-08-16). The
  // guard's Checked In tile opens onto rows whose Status column read anything
  // but the word the tile was pressed for, so the board contradicted itself at
  // the one altitude where a guard is scanning rather than reading.
  if (v.status === 'checked_in') return { key: 'presence', label: 'Checked in', tone: 'inside' };
  if (v.status === 'pending_approval') return { key: 'presence', label: 'Awaiting approval', tone: 'warn' };
  // A host-cleared walk-in is NOT inside. It read "Checked in" between
  // 2026-08-16 and 2026-08-17, which was true only for as long as migration
  // 080's shortcut made the approver's click the admission. Migration 083 put
  // the admission back at the gate, so this row is a visitor the host has said
  // yes to who is still standing on the other side of it — the same place an
  // `approved` pre-registration sits, reached from the other desk. Naming it
  // "Checked in" now would put someone in the building on a fire-marshal's list
  // who has not walked through the door.
  // "Awaiting gate check-in", not "Awaiting entry" (client instruction,
  // 2026-08-17). The row now has a Check In button on two screens, so the
  // status has to name the ACTION that is outstanding rather than describe the
  // visitor's mood — a guard reading this on the dashboard is being told which
  // desk still owes this person something, and the answer is theirs. It also
  // matches the HOD's own board, which has said "Awaiting gate check" on the
  // same row throughout (OverviewUpcoming).
  if (v.status === 'walkin_approved') return { key: 'presence', label: 'Awaiting gate check-in', tone: 'neutral' };
  if (v.status === 'approved') return { key: 'presence', label: 'Pre-registered', tone: 'neutral' };
  if (v.status === 'rejected') return { key: 'presence', label: 'Refused', tone: 'left' };
  return { key: 'presence', label: 'Not arrived', tone: 'neutral' };
}

/**
 * Every chip this row should carry, presence first.
 *
 * Overstay comes from `overstayMs`, which shares its deadline with
 * `isOverstaying` — the predicate the dashboard's Overstaying tile counts on —
 * so a row can never be chipped as overstaying while the tile disagrees.
 */
export function gateChips(v: ReportVisit, now: Date = new Date()): GateChip[] {
  const chips: GateChip[] = [presenceChip(v)];

  if (isOverstaying(v, now)) {
    chips.push({ key: 'overstay', label: `Overstaying ${formatDuration(overstayMs(v, now))}`, tone: 'warn' });
  }

  // Stated on a row that has ALREADY checked in, deliberately. "They arrived,
  // and they arrived two hours late" are two different facts and the second
  // does not stop being true once the first is; hiding it behind the arrival
  // would lose the only record the gate has of the delay.
  if (isLateArrival(v)) {
    chips.push({ key: 'late', label: `Late by ${formatDuration(lateArrivalMs(v))}`, tone: 'late' });
  }

  return chips;
}

/** Tailwind for each tone. Kept beside the rule so a new tone cannot ship
 *  without a colour, and so status is carried by the WORD as well as the hue —
 *  colour is never the only carrier here (CLAUDE.md). */
export const CHIP_CLASS: Record<GateChipTone, string> = {
  inside: 'bg-success-600/15 text-success-500 border-success-500/30',
  left: 'bg-navy-500/10 text-navy-700 border-navy-400/30',
  warn: 'bg-warning-500/15 text-warning-400 border-warning-400/30',
  late: 'bg-danger-600/15 text-danger-400 border-danger-500/30',
  neutral: 'bg-brand-600/15 text-brand-400 border-brand-500/30',
};
