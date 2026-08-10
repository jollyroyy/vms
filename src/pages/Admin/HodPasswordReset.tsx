// Admin-driven password reset, presented inside the HOD edit flow — replaces the
// self-service "Forgot password?" link removed from the login page (the built-in
// Supabase email sender is capped at ~2 mails/hour project-wide, so it kept failing
// for the people who needed it most). See supabase/migrations/064_admin_password_reset.sql.
//
// Deliberately two-step: a one-line "Reset password" affordance that expands into
// the real form, never a single click that silently rewrites someone's credential.
import React, { useId, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { safeErrorMessage } from '../../lib/errors';

const MIN_LENGTH = 6;
const GENERATED_LENGTH = 16;
const GENERATE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

type AdminResetResult = { id: string; email: string; must_change_password: boolean };

// Database['public']['Functions'] is Record<string, never> in src/types/index.ts,
// which types every supabase.rpc(name, args) call as taking `undefined`. Widening
// that shared type would ripple into postgrest-js's relationship inference for
// every other table (verified: it makes an unrelated recurring_visits/departments
// query fail to typecheck elsewhere) — well outside this component's job. Cast
// narrowly, scoped to this one call, instead of touching shared schema typing.
const callAdminResetPassword = supabase.rpc as unknown as (
  fn: 'admin_reset_user_password',
  args: { p_user_id: string; p_password: string },
) => Promise<{ data: AdminResetResult | null; error: { message: string } | null }>;

/** A strong, unambiguous password an admin can read aloud or hand over on paper. */
function generatePassword(): string {
  const bytes = new Uint32Array(GENERATED_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => GENERATE_CHARS[n % GENERATE_CHARS.length]).join('');
}

type Step = 'idle' | 'open' | 'done';

type Props = {
  userId: string;
  userName: string;
};

export default function HodPasswordReset({ userId, userName }: Props): React.ReactElement {
  const [step, setStep] = useState<Step>('idle');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [setPasswordValue, setSetPasswordValue] = useState('');
  const uid = useId();
  const fieldId = `hod-reset-pw-${uid}`;

  const reset = () => {
    setStep('idle');
    setPassword('');
    setSetPasswordValue('');
    setVisible(false);
    setError(null);
    setCopied(false);
    setBusy(false);
  };

  // A plain click handler, not a <form onSubmit>: this component is mounted
  // inside HodForm's own <form>, and a nested <form> is invalid HTML.
  const submit = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`The new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: rpcError } = await callAdminResetPassword('admin_reset_user_password', {
        p_user_id: userId,
        p_password: password,
      });
      if (rpcError) throw rpcError;
      setSetPasswordValue(password);
      setStep('done');
    } catch (err) {
      setError(safeErrorMessage(err, 'Could not reset this password.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(setPasswordValue);
      setCopied(true);
    }
  };

  if (step === 'idle') {
    return (
      <div className="mt-3 pt-3 border-t border-surface-200/60 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={() => setStep('open')}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 text-navy-500 hover:text-brand-600 border border-surface-200 dark:border-white/10 hover:border-brand-500/40 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          Reset password
        </button>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="mt-3 rounded-2xl border border-success-500/25 bg-gradient-to-br from-success-500/[0.06] to-success-500/[0.02] p-4 space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-navy-800">Password reset for {userName}</p>
        <div className="flex items-center gap-2">
          <code className="input !py-2 flex-1 font-mono text-sm select-all">{setPasswordValue}</code>
          <button type="button" onClick={copy} className="btn-secondary !px-3 !py-2 !text-xs shrink-0">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-navy-500 dark:text-navy-400">
          This password will not be shown again — copy it or hand it to {userName} now.
        </p>
        <p className="text-xs text-navy-500 dark:text-navy-400">
          {userName} will be required to choose their own password on their next sign-in, and all
          of their existing sessions have been signed out.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={reset} className="btn-secondary !px-4 !py-2 !text-xs">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-3 rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/[0.06] to-accent-500/[0.03] p-4 space-y-3 animate-fade-in"
    >
      <p className="text-sm font-semibold text-navy-800">Reset password for {userName}</p>
      <p className="text-xs text-navy-500 dark:text-navy-400">
        Sets their password immediately, forces them to choose a new one on their next sign-in, and
        signs them out everywhere else.
      </p>

      <div>
        <label htmlFor={fieldId} className="label">New Password</label>
        <div className="flex items-center gap-2">
          <input
            id={fieldId}
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
            className="input flex-1"
          />
          <button
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            title={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible((v) => !v)}
            className="btn-icon shrink-0"
          >
            {visible ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setPassword(generatePassword()); setVisible(true); setError(null); }}
            className="btn-secondary !px-3 !py-2 !text-xs shrink-0"
          >
            Generate
          </button>
        </div>
        {password.length > 0 && password.length < MIN_LENGTH && !error && (
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1.5">
            {MIN_LENGTH - password.length} more character{MIN_LENGTH - password.length === 1 ? '' : 's'} needed.
          </p>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={reset} className="btn-secondary !px-4 !py-2 !text-xs">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="btn-primary !px-4 !py-2 !text-xs">
          {busy ? 'Setting…' : 'Set Password'}
        </button>
      </div>
    </div>
  );
}
