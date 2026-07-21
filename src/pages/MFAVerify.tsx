/**
 * MFA Verify page — M23-MFA
 * Shown after password login for roles that require MFA.
 * User enters 6-digit TOTP code to complete authentication.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isValidTOTPCode } from '../lib/mfa';

export default function MFAVerifyPage(): React.ReactElement {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [factorId, setFactorId] = useState<string>('');

  useEffect(() => {
    async function loadFactor() {
      const { data } = await supabase.auth.mfa.listFactors();
      const totpFactor = data?.totp?.[0];
      if (totpFactor) setFactorId(totpFactor.id);
    }
    loadFactor();
  }, []);

  const handleVerify = async () => {
    if (!isValidTOTPCode(code)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    if (!factorId) {
      setError('No MFA factor found. Please set up MFA first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr || !challengeData) {
        setError(challengeErr?.message ?? 'Challenge failed');
        setLoading(false);
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyErr) {
        setError('Invalid code. Check your authenticator app and try again.');
        setLoading(false);
        return;
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card-premium max-w-sm w-full p-8 space-y-6 animate-scale-in">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto shadow-glow-mix">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-navy-950 font-display">Two-Factor Authentication</h1>
          <p className="text-sm text-navy-400">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/D/g, '')); setError(''); }}
            placeholder="000000"
            className="input text-center text-3xl tracking-[0.6em] font-mono"
            autoFocus
            autoComplete="one-time-code"
          />

          {error && (
            <div className="alert-error">
              {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Verifying...
              </span>
            ) : 'Verify and Continue'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-4 border-t border-surface-200/60">
          <svg className="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-xs text-navy-400">Two-factor authentication is required for your role</p>
        </div>
      </div>
    </div>
  );
}
