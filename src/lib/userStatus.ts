// What a role is called on the Users screen, and whether an account may use the
// app — one derivation, read by Settings → Users and by App.tsx's startup gate.
//
// "Inactive" IS NOT A ROLE. Migration 094 put the fact in `public.user_status`
// precisely so the Role column keeps holding a role: GatePass suspended people
// by writing `role = 'staff'` and destroyed their real role in the act, and in
// VMS that would be worse still — `staff` is a live role here with its own
// routes, so the "suspension" would have moved a guard sideways onto a
// different set of screens rather than shutting them out.
import type { UserRole } from '../types/index';

/**
 * Roles the directory can RECEIVE. `super_admin` is still in the database enum
 * and still means "administrative ceiling", so the list can hand one back even
 * though nothing in this app assigns it — a row whose role the screen cannot
 * name would render blank in the one column that decides what it is.
 */
export type DirectoryRole = UserRole | 'super_admin';

export const ROLE_LABEL: Record<DirectoryRole, string> = {
  guard: 'Guard',
  hod: 'HOD',
  senior_manager: 'Senior Manager',
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
  ceo: 'CEO',
};

// Colour is never the only carrier — the chip prints the role's name too.
export const ROLE_CHIP: Record<DirectoryRole, string> = {
  guard: 'bg-brand-50 text-brand-700 border border-brand-500/25',
  hod: 'bg-accent-50 text-accent-700 border border-accent-500/25',
  // The same chip as an HOD, because it is the same authority — and the chip
  // prints the role's name, so the two are never told apart by colour alone.
  senior_manager: 'bg-accent-50 text-accent-700 border border-accent-500/25',
  staff: 'bg-surface-100 text-navy-700 border border-surface-300',
  admin: 'bg-danger-50 text-danger-700 border border-danger-500/25',
  super_admin: 'bg-danger-50 text-danger-700 border border-danger-500/25',
  ceo: 'bg-danger-50 text-danger-700 border border-danger-500/25',
};

/**
 * The roles Settings → Users may assign, mirroring exactly what
 * `admin_create_user` / `admin_update_user` accept server-side (migration 095).
 *
 * `staff` IS HERE, unlike in GatePass. Over there `staff` means "does not use
 * this app" and was being abused as an off switch; in VMS it is what a HOST is
 * — `get_hosts_for_department` returns the staff and HODs attached to a
 * department — so an admin who cannot create a staff account cannot onboard a
 * host. `admin`, `super_admin` and `ceo` are absent on purpose and the database
 * refuses them independently, because a rule enforced only by a <select> is a
 * rule any token can skip by POSTing to PostgREST directly.
 */
export const ASSIGNABLE_ROLES = [
  { key: 'guard', label: 'Guard' },
  { key: 'hod', label: 'HOD' },
  // SENIOR MANAGER (client instruction, 2026-08-18): an HOD's permissions under
  // a different job title, for a department headed by somebody who is not
  // called an HOD. Assignable here because that is the whole point of the role
  // — and accepted server-side by migration 099's widened allowlist, so this
  // entry and the RPC agree. It takes a department for the same reason an HOD
  // does: it IS one, and `get_hosts_for_department` returns everybody attached
  // to a department, so a senior manager appears in the host picker unedited.
  { key: 'senior_manager', label: 'Senior Manager' },
  { key: 'staff', label: 'Staff' },
] as const satisfies readonly { key: UserRole; label: string }[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]['key'];

export function isAssignableRole(role: string): role is AssignableRole {
  return ASSIGNABLE_ROLES.some((r) => r.key === role);
}

/**
 * A department is meaningful for an HOD and for staff — both can be the person
 * a visitor came to meet. A guard belongs to a gate, and leaving a stale
 * department on one would put them in a host picker. `admin_update_user`
 * recomputes this server-side against the role being SAVED, so the two cannot
 * disagree.
 */
export function roleTakesDepartment(role: AssignableRole): boolean {
  return role !== 'guard';
}

/**
 * May this account reach the app?
 *
 * `undefined`/`null` means the person has no `user_status` row, which migration
 * 094 defines as active — a row is written only when somebody is actually
 * suspended, so every account that predates the table stays exactly as it was.
 */
export function isAccountActive(flag: boolean | null | undefined): boolean {
  return flag !== false;
}

export function accountStatusLabel(flag: boolean | null | undefined): string {
  return isAccountActive(flag) ? 'Active' : 'Suspended';
}

export function accountStatusChip(flag: boolean | null | undefined): string {
  return isAccountActive(flag)
    ? 'bg-success-50 text-success-700 border border-success-500/25'
    : 'bg-surface-100 text-navy-700 border border-surface-300';
}

/**
 * Whether this screen may act on the row at all. An admin/super_admin is
 * refused by every one of the four RPCs (migrations 095 and 096) for the reason
 * 064 gives about password resets: the weakest admin account must not be a
 * route into a stronger one. The table renders no controls for such a row
 * rather than offering buttons that could only fail.
 */
export function isManageable(role: string): boolean {
  return role !== 'admin' && role !== 'super_admin';
}
