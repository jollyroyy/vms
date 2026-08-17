import React from 'react';
import { supabase } from '../supabaseClient';
import Logo from './Logo';

/**
 * The screens App renders before any route exists.
 *
 * BootSplash was written out twice in App.tsx — once for the auth restore and
 * once for the must-change-password check — which is two copies of one screen
 * that must never drift apart, and the reason that file crossed its line cap.
 */
export function BootSplash(): React.ReactElement {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-50 relative overflow-hidden">
      <div className="aurora-stage" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
      </div>
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 blur-lg opacity-50 animate-pulse-soft" />
          <Logo size="lg" className="relative" />
        </div>
        <p className="font-display text-sm font-bold text-navy-600 tracking-tight">Secure Gate</p>
        <div className="h-1 w-20 rounded-full bg-surface-200 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-400 to-accent-500 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

/**
 * A session that carries no recognised role reaches no route. Rendering the
 * routes anyway would land it on a blank screen with no way out, so it gets a
 * named dead end with the one control that resolves it: sign out and back in.
 */
export function NoRoleScreen(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 text-center">
      <div className="max-w-sm rounded-2xl border border-surface-200 bg-white p-8 shadow-lg">
        <Logo size="lg" className="mx-auto mb-5" />
        <h1 className="font-display text-xl font-semibold text-navy-700">Account access needs attention</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your sign-in session does not include a recognised VMS role. Sign out and sign in again to return to the
          correct dashboard.
        </p>
        <button
          type="button"
          onClick={() => { void supabase.auth.signOut(); }}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Return to sign in
        </button>
      </div>
    </div>
  );
}

/**
 * An account an admin has suspended (migration 094).
 *
 * The suspension is enforced in Postgres — `current_user_role()` returns null,
 * so every policy refuses — which without this screen would be INVISIBLE: the
 * person signs in, lands on their role's page, and every list on it is empty. A
 * guard staring at a gate board that shows nobody inside cannot tell that from
 * a quiet morning, and would keep working from it. Being told is the point.
 *
 * `admin_deactivate_user` also deletes every live session, so in practice this
 * is reached by someone who tries to sign in AFTER being suspended rather than
 * by someone sitting in front of an open tab.
 */
export function SuspendedScreen(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6 text-center">
      <div className="max-w-sm rounded-2xl border border-surface-200 bg-white p-8 shadow-lg">
        <Logo size="lg" className="mx-auto mb-5" />
        <h1 className="font-display text-xl font-semibold text-navy-700">Your access has been withdrawn</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This account has been deactivated by an administrator. Nothing you have done has been removed — ask an
          administrator to reactivate the account if this is not expected.
        </p>
        <button
          type="button"
          onClick={() => { void supabase.auth.signOut(); }}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Sign out
        </button>
      </div>
    </div>
  );
}
