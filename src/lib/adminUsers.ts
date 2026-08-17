// The four writes and one read behind Settings → Users.
//
// Every one of them is an RPC, never a PostgREST call on `public.profiles`.
// Creating an account writes `auth.users`, which the browser cannot do without
// the service-role key; the role allowlist is a rule the database has to own,
// or any token skips it by POSTing directly; and the directory read avoids a
// table with a history of recursive-policy failures (42P17). See migrations
// 094, 095 and 096 — the reasoning lives there, in full.
//
// This file deliberately does NOT export anything that writes `profiles.role`
// directly. `lib/adminHods.ts` still does, for the department cards' own HOD
// invite path; the two coexist because they answer different questions (that
// one attaches a person to a department, this one administers the account).
import { supabase } from '../supabaseClient';
import { personNameError, squashSpace, stripControlChars } from './inputRules';
import type { DirectoryRole, AssignableRole } from './userStatus';

/** One row of `admin_list_profiles` (migration 095). */
export type DirectoryUser = {
  id: string;
  email: string | null;
  full_name: string;
  role: DirectoryRole;
  department_id: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
  deactivated_at: string | null;
};

// `Database['public']['Functions']` is `Record<string, never>` in
// src/types/index.ts, so every supabase.rpc(name, args) call types its argument
// as `undefined`. Widening that shared type ripples into postgrest-js's
// relationship inference for unrelated queries (verified: it breaks a
// recurring_visits/departments select elsewhere), so the cast is narrow and
// scoped to this file — the same approach HodPasswordReset.tsx takes.
//
// Invoked ON the client, never lifted off it: supabase.rpc reads `this.rest`,
// so a detached `const f = supabase.rpc` throws on every call.
type Rpc = (fn: string, args?: Record<string, unknown>)
  => Promise<{ data: unknown; error: { message: string } | null }>;

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const rpc = supabase.rpc as unknown as Rpc;
  const { data, error } = await rpc.call(supabase, fn, args);
  // The RPCs raise with sentences meant to be read by the admin who triggered
  // them ("A user with email … already exists."), so the message is passed
  // through rather than replaced with a generic failure.
  if (error) throw new Error(error.message);
  return (data ?? null) as T | null;
}

export type UserInput = {
  fullName: string;
  email: string;
  role: AssignableRole;
  /** Ignored server-side for a guard — see `roleTakesDepartment`. */
  departmentId: string | null;
};

// Deliberately strict: one @, a dotted domain, no whitespace anywhere. Copied
// in shape from adminHods.ts rather than imported, because that file's version
// is private to its own validator; if a third caller appears, hoist it.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const EMAIL_MAX = 254;

/** Matches GoTrue's own floor, and the CHECK inside `admin_create_user`. */
export const PASSWORD_MIN = 6;

export function normalizeUserInput(input: UserInput): UserInput {
  return {
    ...input,
    fullName: squashSpace(stripControlChars(input.fullName)),
    email: stripControlChars(input.email).trim().toLowerCase(),
  };
}

/**
 * A human-readable error, or null when valid.
 *
 * @param password  omit when editing — an edit never touches the credential.
 */
export function validateUser(input: UserInput, password?: string): string | null {
  const { fullName, email } = normalizeUserInput(input);

  if (!fullName) return 'Name is required.';
  // The same allowlist every other stored identity gets, mirrored as a CHECK
  // constraint in migration 062.
  const nameError = personNameError(fullName, 'Name');
  if (nameError) return nameError;

  if (!email) return 'Email is required.';
  if (email.length > EMAIL_MAX) return `Email must be ${EMAIL_MAX} characters or fewer.`;
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';

  if (password !== undefined && password.length < PASSWORD_MIN) {
    return `The password must be at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}

/** Every account, newest label first — the RPC orders by name. */
export async function fetchUserDirectory(): Promise<DirectoryUser[]> {
  return (await call<DirectoryUser[]>('admin_list_profiles', { p_role: null })) ?? [];
}

/**
 * Create an account with a password the admin hands over in person.
 *
 * The account is flagged `must_change_password`, so migration 064's forced
 * change screen makes the person replace it on first sign-in. An email invite
 * was the alternative and is not usable here: the built-in Supabase mailer is
 * capped at ~2 messages an hour project-wide and is shared with GatePass.
 */
export async function createUser(input: UserInput, password: string): Promise<void> {
  const { fullName, email, role, departmentId } = normalizeUserInput(input);
  await call('admin_create_user', {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
    p_department_id: departmentId,
  });
}

/**
 * Rename, re-role, re-department.
 *
 * NOT the email: changing the address somebody signs in with is an auth-admin
 * operation, and rewriting only `profiles.email` would leave the screen showing
 * one address while the login accepts another.
 *
 * `p_apply_department` is always true here — this form always states a
 * department, and "none" is a decision, not silence.
 */
export async function updateUser(userId: string, input: UserInput): Promise<void> {
  const { fullName, role, departmentId } = normalizeUserInput(input);
  await call('admin_update_user', {
    p_user_id: userId,
    p_full_name: fullName,
    p_role: role,
    p_department_id: departmentId,
    p_apply_department: true,
  });
}

/** Withdraw access. Keeps the role, kills every live session (migration 096). */
export async function deactivateUser(userId: string): Promise<void> {
  await call('admin_deactivate_user', { p_user_id: userId });
}

/** Give it back. Restores exactly what was withdrawn — no role choice needed. */
export async function reactivateUser(userId: string): Promise<void> {
  await call('admin_reactivate_user', { p_user_id: userId });
}
