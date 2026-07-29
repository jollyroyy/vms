// Head-of-department management for the Admin Panel.
// An admin types a name + email against a department. If that email already has a
// profile it is promoted in place; otherwise a new account is invited and promoted.
// The profiles.role write is picked up by the sync_profile_role_to_auth trigger
// (migration 010), which mirrors the role into the user's JWT app_metadata.
// Tested by tests/unit/lib/adminHods.test.ts.
import { supabase } from '../supabaseClient';
import type { Profile } from '../types/index';

export type HodInput = { fullName: string; email: string };

// Deliberately strict: one @, a dotted domain, and no whitespace anywhere.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const squash = (s: string) => s.trim().replace(/\s+/g, ' ');

export function normalizeHodInput(input: HodInput): HodInput {
  return {
    fullName: squash(input.fullName),
    email: input.email.trim().toLowerCase(),
  };
}

/**
 * Returns a human-readable error, or null when valid.
 * `existingHods` should be the HODs of the department being edited; `excludeId`
 * is the HOD currently being modified so they don't clash with themselves.
 */
export function validateHod(
  input: HodInput,
  existingHods: Profile[],
  excludeId?: string,
): string | null {
  const { fullName, email } = normalizeHodInput(input);

  if (!fullName) return 'HOD name is required.';
  if (!email) return 'Email is required.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';

  const clash = existingHods
    .filter((p) => p.id !== excludeId)
    .find((p) => (p.email ?? '').toLowerCase() === email);
  if (clash) return `"${clash.full_name}" is already an HOD in this department.`;

  return null;
}

/** A throwaway password — the invited user sets their own via the email link. */
function tempPassword(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '').slice(0, 24);
}

/**
 * Makes someone the HOD of a department.
 * Returns `{ created: true }` when a brand-new account had to be invited, so the
 * UI can tell the admin that an invitation email is on its way.
 */
export async function addHod(
  departmentId: string,
  input: HodInput,
): Promise<{ created: boolean }> {
  const { fullName, email } = normalizeHodInput(input);

  const { data: found } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (found?.id) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'hod', department_id: departmentId, full_name: fullName })
      .eq('id', found.id);
    if (error) throw new Error(error.message);
    return { created: false };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: tempPassword(),
    options: { data: { full_name: fullName } },
  });
  if (signUpError) {
    if (/rate\s*limit/i.test(signUpError.message)) {
      throw new Error(
        'Invitation email could not be sent — the email service is rate-limited. '
        + 'Wait about 60 seconds, then try again. '
        + 'If this keeps happening, disable "Confirm email" in the Supabase Auth dashboard '
        + 'so invites stop sending confirmation emails.',
      );
    }
    throw new Error(signUpError.message);
  }

  const newId = signUpData?.user?.id;
  if (!newId) throw new Error('Could not create the account for this HOD.');

  // UPDATE, not upsert. There is no insert policy on profiles (migration 013 drops
  // "profiles: admin can insert"), so an `INSERT .. ON CONFLICT` would be refused by
  // RLS even when the row already exists. handle_new_user (migration 010) inserts the
  // row inside the signUp transaction and seeds id/email/full_name, so by the time
  // signUp resolves there is a row here to promote.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role: 'hod', department_id: departmentId })
    .eq('id', newId);
  if (error) throw new Error(error.message);

  return { created: true };
}

/**
 * Renames / re-addresses an HOD. Does not change which department they head.
 * NOTE: this updates the `profiles` row only — it does NOT change the address the
 * user signs in with. Changing an auth email requires an admin API call from a
 * trusted server context, which the browser client deliberately cannot make.
 */
export async function updateHod(profileId: string, input: HodInput): Promise<void> {
  const { fullName, email } = normalizeHodInput(input);
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, email })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
}

/** Demotes an HOD back to staff and detaches them from the department. */
export async function removeHod(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'staff', department_id: null, delegate_id: null })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
}
