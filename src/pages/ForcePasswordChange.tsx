/**
 * ForcePasswordChange — the gate a user hits when an administrator reset their
 * password. `App.tsx` renders this in place of the app shell whenever
 * `my_must_change_password()` (see migration 064) returns true, so a temporary
 * password the admin knows can never reach any real screen unchallenged.
 *
 * Deliberately unlike ResetPassword.tsx: `set_my_password` writes the new
 * password AND clears the flag in one RPC call, and there is no separate
 * "clear the flag" endpoint. Success here means the caller's session is
 * already the right one to keep using — so we hand control back to App.tsx
 * via `onSuccess` and continue straight into the app, rather than forcing a
 * fresh sign-in the way the emailed-link recovery flow does.
 */
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { safeErrorMessage } from '../lib/errors';
import Logo from '../components/Logo';

const MIN_LENGTH = 6;

// Database['public']['Functions'] is Record<string, never> (src/types/index.ts), which
// types every supabase.rpc(name, args) call as taking `undefined`. Widening that shared
// type ripples into postgrest-js's relationship inference elsewhere (see
// src/pages/Admin/HodPasswordReset.tsx for the same note) — cast narrowly instead.
const callSetMyPassword = supabase.rpc as unknown as (
  fn: 'set_my_password',
  args: { p_password: string },
) => Promise<{ data: unknown; error: { message: string } | null }>;

interface Props {
  onSuccess: () => void;
}

export default function ForcePasswordChange({ onSuccess }: Props): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: rpcErr } = await callSetMyPassword('set_my_password', { p_password: password });
    if (rpcErr) {
      setError(safeErrorMessage(rpcErr, 'Could not set your new password. Please try again.'));
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  };

  // Nobody should be trapped here with no way out — sign out and let App.tsx's
  // session guard drop them back on the login screen.
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4 relative">
      <div aria-hidden="true" className="sg-login-photo fixed inset-0 z-0" />
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 backdrop-blur-[1px]"
        style={{
          background:
            'linear-gradient(to bottom, rgba(6,9,20,0.55), rgba(6,9,20,0.75)), radial-gradient(ellipse at center, rgba(6,9,20,0) 35%, rgba(6,9,20,0.6) 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[460px] bg-white border border-black/5 rounded-3xl shadow-2xl shadow-black/40 px-8 py-6 sm:px-10 sm:py-7 animate-fade-in">
        <div className="flex flex-col items-center mb-5">
          <Logo size="lg" className="mb-3" />
          <h1 className="font-display text-2xl font-bold text-navy-900 tracking-tight">Choose a new password</h1>
          <p className="text-sm text-navy-500 mt-1.5 text-center">
            An administrator reset your password. Before you can continue, please choose one only you know.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-bold text-navy-600 uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPw ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
                className="w-full h-12 px-4 pr-11 rounded-xl border border-navy-200 bg-navy-50 text-navy-900 placeholder-navy-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600 transition-colors text-xs font-semibold"
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-xs font-bold text-navy-600 uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type={showPw ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full h-12 px-4 rounded-xl border border-navy-200 bg-navy-50 text-navy-900 placeholder-navy-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-danger-50 border border-danger-200">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-bold tracking-wide shadow-lg shadow-brand-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {loading ? 'Setting password…' : 'Set password and continue'}
          </button>

          {/* Escape hatch: nobody may be trapped here with no way out. */}
          <p className="text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              Sign out
            </button>
          </p>
        </form>
      </div>

      <style>{`
        .sg-login-photo {
          background-image: url('/securegate-login-bg.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: brightness(1.15) contrast(1.12) saturate(1.1);
        }
        @media (dynamic-range: high), (color-gamut: p3) {
          .sg-login-photo { filter: brightness(1.2) contrast(1.18) saturate(1.25); }
        }
      `}</style>
    </div>
  );
}
