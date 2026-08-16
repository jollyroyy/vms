import type { Visit, VisitStatus } from '../types/index';

// Did this visitor book ahead, or turn up unannounced?
//
// It matters at the gate: a guard reading a card for someone already inside
// wants to know which of the two desks that person came through, because it
// tells them what paperwork exists behind the visit. Nothing on the visit row
// records it directly, so this is the one place the question gets answered and
// the one place the caveat below has to be understood.
export type VisitOrigin = 'pre_approved' | 'walk_in';

// Statuses that PROVE an origin on their own.
//
// A walk-in is the only visit that ever passes through `pending_approval` (it
// is raised at the gate and waits on an HOD) or reaches `walkin_approved`. A
// pre-approval is INSERTed already `approved` and never visits either state.
// A full Record is deliberate: adding a status forces a decision here rather
// than silently falling through to the guess.
const DEFINITIVE: Record<VisitStatus, VisitOrigin | null> = {
  pending_approval: 'walk_in',
  walkin_approved: 'walk_in',
  approved: 'pre_approved',
  // Both routes converge on these — the proof is gone and only the guess is
  // left. This is exactly the case the feature needs, since the card shows the
  // origin for visitors who are already inside.
  checked_in: null,
  checked_out: null,
  no_show: null,
  expired: null,
  cancelled: null,
  rejected: null,
};

/** Which desk this visit came through.
 *
 *  For a converged status this is INFERRED from `scheduled_for`, not read: the
 *  walk-in path never sets it (see the no_show/expired split in migration 066)
 *  and `validatePreApproval` makes it mandatory on a pre-approval. The known
 *  gap is a pre-approval created BEFORE that validation landed, which has a
 *  null `scheduled_for` and will read here as a walk-in. That is a label being
 *  wrong on an old row, never a permission or an action — nothing branches on
 *  this. If it ever needs to be exact, the fix is a column on `visits` written
 *  at creation, not a cleverer guess. */
export function visitOrigin(v: Pick<Visit, 'status' | 'scheduled_for'>): VisitOrigin {
  return DEFINITIVE[v.status] ?? (v.scheduled_for ? 'pre_approved' : 'walk_in');
}

/** Does the STATUS on its own already say which desk this visit came through?
 *
 *  A card that carries a status badge must ask this before it prints an origin
 *  label of its own: `STATUS_STYLES.approved` reads "Pre-approved", so on a
 *  row that has not converged yet the two would be the same fact twice on one
 *  card, which CLAUDE.md's no-duplicate-renders rule forbids. It is the
 *  converged statuses — `checked_in` and everything after — where the origin is
 *  no longer legible from the badge and therefore has to be said. */
export function statusProvesOrigin(status: VisitStatus): boolean {
  return DEFINITIVE[status] !== null;
}

const LABEL: Record<VisitOrigin, string> = {
  pre_approved: 'Pre-approved',
  walk_in: 'Walk-in',
};

export function visitOriginLabel(origin: VisitOrigin): string {
  return LABEL[origin];
}
