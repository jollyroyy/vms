import type { VisitStatus } from '../types/index';
import type { VisitActor } from './visitActors';

const ROLE_LABELS: Record<string, string> = {
  guard: 'Guard',
  hod: 'Person to Meet',
  admin: 'Admin',
  super_admin: 'Admin',
  staff: 'Staff',
};

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function visitStatusLabel(visit: { status: VisitStatus; actor?: VisitActor | null }): string {
  const { status, actor } = visit;

  switch (status) {
    case 'approved':
      return 'Pre-approved';

    case 'walkin_approved':
      if (actor) {
        const roleLabel = getRoleLabel(actor.role);
        return `Walk-in approved by ${actor.name} (${roleLabel})`;
      }
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
      return status.replace(/_/g, ' ');

    default:
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
