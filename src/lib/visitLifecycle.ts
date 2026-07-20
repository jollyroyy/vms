// S1/S2a/S8 — visit state machine and auto-close logic.
// Status transitions are the server-authoritative truth (SEC-3); this module
// backs the Postgres trigger that enforces them and the seed script.

export type VisitStatus =
  | 'pending_approval'
  | 'approved'
  | 'checked_in'
  | 'checked_out'
  | 'rejected';

export type Visit = {
  id: string;
  status: VisitStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  exitVerified: boolean | null;
};

const TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  pending_approval: ['approved', 'rejected'],
  approved:         ['checked_in'],
  checked_in:       ['checked_out'],
  checked_out:      [],
  rejected:         [],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// FR-VIS-08: close any still-inside visit at day end and flag exit as unverified.
export function autoCloseAtDayEnd(visit: Visit, timestamp: string): Visit {
  if (visit.status !== 'checked_in') return visit;
  return {
    ...visit,
    status: 'checked_out',
    checkedOutAt: timestamp,
    exitVerified: false,
  };
}
