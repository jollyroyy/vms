// The two questions App.tsx has to answer before it renders a single route:
// does this session still owe a password change (migration 064), and has an
// admin withdrawn its access (migration 094)?
//
// Extracted out of App.tsx when the second gate pushed that file over the
// 300-line cap. Both are one shape, and keeping them together is what makes
// the shape visible.
//
// BOTH FAIL OPEN, AND NEITHER FAILS SILENTLY. A failure logs loudly to the
// console — so a real outage or a typo is visible to whoever is watching logs —
// and then answers "nothing owed" / "still active". Failing closed would turn
// any transient error into a total lockout of every existing user, which is
// strictly worse than the thing either gate exists to add. Being unable to
// reach the database is not proof that anybody has been suspended.
//
// NEITHER MAY QUERY `public.profiles` OR `public.user_status` DIRECTLY. Both
// answers come from SECURITY DEFINER functions scoped to `auth.uid()`:
// `profiles` has a history of recursive-policy failures (42P17) in the one code
// path that decides whether anyone sees anything at all, and `user_status`'s
// own policy calls `current_user_role()`, which calls the very function that
// would be answering the question.

import { supabase } from '../supabaseClient';

/** The two RPCs, both `() => boolean`. */
export type StartupGateFn = 'my_must_change_password' | 'my_account_active';

type BooleanRpc = (
  fn: StartupGateFn,
) => Promise<{ data: boolean | null; error: { message: string } | null }>;

// `Database['public']['Functions']` is `Record<string, never>` (src/types/index.ts),
// which types every `supabase.rpc(name, args)` call as taking `undefined`.
// Widening that shared type ripples into postgrest-js's relationship inference
// for unrelated queries, so the cast is narrow and scoped to this file — the
// same approach HodPasswordReset.tsx and adminUsers.ts take.
//
// INVOKED ON THE CLIENT, never lifted off it. `supabase.rpc` reads `this.rest`
// internally, so a detached `const f = supabase.rpc` throws "Cannot read
// properties of undefined (reading 'rest')" on every call — which the fail-open
// branch then swallows into a console error, leaving a gate that has never
// fired for anybody since it shipped. That is not hypothetical; it happened.
function callGate(fn: StartupGateFn) {
  return (supabase.rpc as unknown as BooleanRpc).call(supabase, fn);
}

/**
 * Ask one gate, and never throw.
 *
 * @param onError the answer to give when we could not ask — the FAIL-OPEN
 *                value, which differs per gate: `false` for "owes a password
 *                change", `true` for "account is active".
 */
async function ask(fn: StartupGateFn, onError: boolean): Promise<boolean> {
  try {
    const { data, error } = await callGate(fn);
    if (error) {
      console.error(`[VMS] ${fn} check failed — failing OPEN (not blocking sign-in):`, error);
      return onError;
    }
    // A null payload is "no answer", which is not the same as a false one.
    return data === null ? onError : Boolean(data);
  } catch (err) {
    console.error(`[VMS] ${fn} threw — failing OPEN (not blocking sign-in):`, err);
    return onError;
  }
}

/** Does this session still owe a password change? Errors resolve to false. */
export const fetchMustChangePassword = (): Promise<boolean> =>
  ask('my_must_change_password', false);

/** May this account still use VMS? Errors resolve to true. */
export const fetchAccountActive = (): Promise<boolean> =>
  ask('my_account_active', true);
