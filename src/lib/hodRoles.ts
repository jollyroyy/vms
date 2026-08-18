import type { UserRole } from '../types/index';

/**
 * THE ROLES THAT GET THE HOD SURFACE — one list, imported everywhere the
 * question "is this person an approver?" is asked.
 *
 * Client instruction, 2026-08-18: every account that is not a guard and not an
 * admin gets the HOD's screens, workflow and permissions exactly. There is one
 * decision desk in this building, and a department is headed by whoever heads
 * it — the job title on the account changes what the screen CALLS them, never
 * what they may do. `staff` joining is the substance of that instruction: a
 * staff member is what a HOST is here (`get_hosts_for_department` returns the
 * staff and HODs of a department), and a host who cannot raise a pre-approval
 * for their own visitor is a host who has to ask somebody else to invite them.
 *
 * `ceo` is deliberately ABSENT, and that is not an oversight. That role exists
 * for one decision — a visitor comes off the blacklist only when an admin has
 * justified it and the CEO has granted it — and it is the second pair of eyes
 * on an admin's request. Handing it the desk it audits would collapse the two
 * people the removal workflow is built to require into one. It is also not
 * creatable from Settings → Users, so "whatever user has been created" never
 * produces one.
 *
 * The DATABASE agrees by a different mechanism: migration 100's
 * `public.effective_role()` maps `senior_manager` and `staff` onto `hod`, so
 * every RLS policy and every SECURITY DEFINER RPC admits them without being
 * rewritten. Keep the two lists in step — this one and that function are the
 * same rule written twice.
 */
export const HOD_ROLES = ['hod', 'senior_manager', 'staff'] as const satisfies readonly UserRole[];

/** True when this role gets the HOD surface. Mirrors `HOD_ROLES`. */
export function isHodRole(role: UserRole | string | null | undefined): boolean {
  return role != null && (HOD_ROLES as readonly string[]).includes(role);
}

/** `HOD_ROLES` as a mutable `UserRole[]`, for the `roles` field of a NavLink. */
export const hodRoles = (): UserRole[] => [...HOD_ROLES];
