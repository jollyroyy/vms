import type { VisitStatus } from '../types/index';
import type { VisitActor } from './visitActors';

const ROLE_LABELS: Record<string, string> = {
  guard: 'Guard',
  hod: 'Person to Meet',
  // Same phrase as an HOD, and deliberately so: this label names the actor's
  // relationship to the VISITOR, not their rank. Falling through to the raw
  // `senior_manager` would have printed a snake_case enum on a visitor's row.
  senior_manager: 'Person to Meet',
  admin: 'Admin',
  super_admin: 'Admin',
  // Same phrase again, and for the same reason: since 2026-08-18 a staff
  // account IS an approver (lib/hodRoles.ts), so "cleared by Staff" on a
  // visitor's row named the actor's rank where the row wants their
  // relationship to the visitor.
  staff: 'Person to Meet',
};

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function visitStatusLabel(visit: { status: VisitStatus; actor?: VisitActor | null }): string {
  const { status, actor } = visit;

  switch (status) {
    case 'approved':
      return 'Pre-approved';

    // No "by <name>" here any more (client instruction, 2026-08-16). WHO
    // cleared a visitor is now a column of its own — lib/visitApprover.ts —
    // which is what lets the HOD's register drop it (they are reading their own
    // decisions) while the admin's register keeps it with the approver's
    // department attached. Folding it into the status meant every surface that
    // printed a status inherited the name whether or not it wanted it, and
    // there was no way to ask for one without the other.
    case 'walkin_approved':
      return 'Walk-in approved';

    case 'rejected':
      if (actor) {
        const roleLabel = getRoleLabel(actor.role);
        return `Rejected by ${actor.name} (${roleLabel})`;
      }
      return 'Rejected';

    case 'pending_approval':
    case 'checked_in':
    case 'checked_out':
    case 'cancelled':
    case 'no_show':
    case 'expired':
    // "lapsed" says it on its own — nobody answered and the day ended. It is
    // deliberately not "expired": that word is spoken for by a pass that WAS
    // granted (see the union in types/index.ts).
    case 'lapsed':
      return status.replace(/_/g, ' ');

    default:
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
