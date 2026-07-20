// SLA-W1 / FR-VIS-07 — approval escalation chain.
// HOD has 5 minutes; if no delegate, skips straight to Admin at 5 minutes.
// Everyone escalates to Admin at 10 minutes.
// This pure-logic module backs the Postgres scheduled function and the guard
// console's countdown timer — both use the same thresholds.

export type EscalationTarget = 'hod' | 'delegate' | 'admin';

export type EscalationRoles = {
  hod_id: string | null;
  delegate_id: string | null;
};

const HOD_DEADLINE_MS   = 5  * 60 * 1000; // 5 min  → escalate to delegate
const ADMIN_DEADLINE_MS = 10 * 60 * 1000; // 10 min → escalate to admin

export function getEscalationTarget(
  pendingAt: string,
  now: string,
  roles: EscalationRoles,
): EscalationTarget {
  const elapsed = new Date(now).getTime() - new Date(pendingAt).getTime();
  if (elapsed >= ADMIN_DEADLINE_MS) return 'admin';
  if (elapsed >= HOD_DEADLINE_MS)   return roles.delegate_id !== null ? 'delegate' : 'admin';
  return 'hod';
}
