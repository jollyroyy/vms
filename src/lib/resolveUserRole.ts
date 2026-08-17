import { supabase } from '../supabaseClient';
import type { UserRole } from '../types/index';

// Every member of `UserRole`, listed once. A signed-in user whose role is not
// in here reaches no route at all — which is indistinguishable from being
// locked out — so a role added to the union and forgotten here is a lockout,
// not a cosmetic gap. `satisfies` makes that a compile error rather than a
// support call: `ceo` (migration 090) had to be added here as well as to the
// type.
const ROLES = ['guard', 'hod', 'senior_manager', 'staff', 'admin', 'ceo'] as const satisfies readonly UserRole[];

export const isUserRole = (value: unknown): value is UserRole =>
  (ROLES as readonly string[]).includes(value as string);

/**
 * The signed-in user's role, JWT first and `profiles` as the fallback.
 *
 * `app_metadata.role` is the authoritative copy (migration 010's
 * sync_profile_role_to_auth mirrors profiles.role into it), but a session
 * minted before that trigger existed carries no role at all — and a session
 * with no role reaches no route, which is indistinguishable from being locked
 * out. Reading the profile row recovers it for exactly those sessions.
 */
export async function resolveUserRole(userId: string, metadataRole: unknown): Promise<UserRole | null> {
  if (isUserRole(metadataRole)) return metadataRole;

  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) {
    console.error('[VMS] Unable to resolve the signed-in user role:', error);
    return null;
  }
  const role = (data as { role?: unknown } | null)?.role;
  return isUserRole(role) ? role : null;
}
