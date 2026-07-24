/**
 * MFA Setup page — M23-MFA
 * Guides admin/HOD users through TOTP enrollment.
 * Shown on first login if MFA is not yet configured.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isValidTOTPCode } from '../lib/mfa';

type Step = 'loading' | 'enroll' | 'verify' | 'done' | 'error';

export default function MFASetupPage(): React.ReactElement {
  const [step, setStep] = useState<Step>('loading');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function startEnrollment() {
      try {
        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'SecureGate VMS',
        });
        if (enrollErr || !data) {
          setError(enrollErr?.message ?? 'Failed to start MFA enrollment');
          setStep('error');
          return;
        }
        setFactorId(data.id);
        setQrCodeUrl(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('enroll');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStep('error');
      }
    }
    startEnrollment();
  }, []);

  const handleVerify = async () => {
    if (!isValidTOTPCode(code)) {
      setError('Enter a valid 6-digit code from your authenticator app.');
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
        setError('Invalid code. Please check your authenticator and try again.');
        setLoading(false);
        return;
      }
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-navy-400">Preparing MFA setup...</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center animate-scale-in">
          <div className="w-14 h-14 bg-danger-50 border border-danger-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-navy-950 font-bold font-display mb-2">MFA Setup Error</p>
          <p className="text-danger-600 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary px-6 py-2.5 text-sm">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-premium p-8 max-w-md w-full text-center space-y-4 animate-scale-in">
          <div className="w-16 h-16 bg-success-100 border border-success-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-navy-950 font-display">MFA Enabled</h2>
          <p className="text-navy-400 text-sm">Your account is now protected with two-factor authentication.</p>
          <button onClick={() => { window.location.href = '/'; }} className="btn-primary w-full py-3 text-sm font-semibold">
            Continue to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card-premium max-w-md w-full overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center ring-1 ring-white/25">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg font-display">Set Up Two-Factor Authentication</h1>
              <p className="text-white/75 text-xs mt-0.5">Required for your account role</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-gradient-to-br from-brand-500 to-accent-500 text-white rounded-full text-xs flex items-center justify-center font-bold shadow-glow-sm">1</span>
              <p className="font-semibold text-navy-800 text-sm">Scan with your authenticator app</p>
            </div>
            <p className="text-xs text-navy-400 ml-8">Use Google Authenticator, Authy, or any TOTP app.</p>
            {qrCodeUrl && (
              <div className="flex justify-center">
                <div className="p-3 !bg-white border border-surface-200 rounded-2xl shadow-soft">
                  <img src={qrCodeUrl} alt="QR Code for MFA setup" className="w-40 h-40" />
                </div>
              </div>
            )}
            {secret && (
              <div className="ml-8">
                <p className="text-xs text-navy-400 mb-1">Cannot scan? Enter this key manually:</p>
                <code className="text-xs font-mono bg-surface-100 text-navy-700 px-3 py-2 rounded-lg block border border-surface-200 break-all">{secret}</code>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-gradient-to-br from-brand-500 to-accent-500 text-white rounded-full text-xs flex items-center justify-center font-bold shadow-glow-sm">2</span>
              <p className="font-semibold text-navy-800 text-sm">Enter the 6-digit verification code</p>
            </div>
            <div className="ml-8 space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/D/g, '')); setError(''); }}
                placeholder="000000"
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
              />
              {error && (
                <p className="text-xs text-danger-600">{error}</p>
              )}
              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Verifying...
                  </span>
                ) : 'Activate MFA'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
