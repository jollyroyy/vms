/**
 * ResetPassword — the landing page for a Supabase password-recovery link.
 *
 * Supabase's recovery link signs the user in with a short-lived recovery session.
 * Without this page the app just dropped them on their dashboard and they never got
 * to choose a new password. App.tsx gates on the PASSWORD_RECOVERY event and routes
 * here, so this is the only screen reachable until a new password is set.
 *
 * On success we sign the recovery session out deliberately: the new credential should
 * be proven at the normal login screen rather than inheriting the emailed session.
 */
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { safeErrorMessage } from '../lib/errors';
import { clearRecoveryPending } from '../lib/passwordRecovery';
import Logo from '../components/Logo';

const MIN_LENGTH = 6;

export default function ResetPassword(): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    if (upErr) {
      setError(safeErrorMessage(upErr, 'Password reset failed. Request a new link and try again.'));
      setLoading(false);
      return;
    }

    // Force a fresh sign-in with the new credential.
    clearRecoveryPending();
    await supabase.auth.signOut();
    setDone(true);
    setLoading(false);
  };

  // Abandoning the reset must not leave a usable session behind, so the escape hatch
  // signs out rather than just navigating away.
  const abandon = async () => {
    clearRecoveryPending();
    await supabase.auth.signOut();
    window.location.assign('/');
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
          <h1 className="font-display text-2xl font-bold text-navy-900 tracking-tight">Set a new password</h1>
          <p className="text-sm text-navy-500 mt-1.5 text-center">Choose a new password for your Secure Gate account</p>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-success-50 border border-success-200">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-success-700">Password updated. Please sign in with your new password.</p>
            </div>
            <a
              href="/"
              className="block w-full h-12 leading-[3rem] text-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-bold tracking-wide shadow-lg shadow-brand-500/25 transition-all"
            >
              Back to sign in
            </a>
          </div>
        ) : (
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
              {loading ? 'Updating…' : 'Update password'}
            </button>

            {/* Escape hatch: an expired or already-used link leaves the form unusable. */}
            <p className="text-center">
              <button type="button" onClick={abandon}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">
                Back to sign in
              </button>
            </p>
          </form>
        )}
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
