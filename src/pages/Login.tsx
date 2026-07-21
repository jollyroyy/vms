import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getRateLimit, recordFailedAttempt, recordPageLoad } from '../lib/rateLimiter';

export default function LoginPage(): React.ReactElement {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  useEffect(() => {
    recordPageLoad();
    const rl = getRateLimit();
    if (rl.blocked) {
      setRateLimited(true);
      setRateLimitMsg(rl.message);
      setRateLimitCountdown(rl.remainingSeconds);
    }
    const interval = setInterval(() => {
      const r = getRateLimit();
      if (r.blocked) {
        setRateLimited(true);
        setRateLimitMsg(r.message);
        setRateLimitCountdown(r.remainingSeconds);
      } else if (rateLimited) {
        setRateLimited(false);
        setRateLimitMsg('');
        setRateLimitCountdown(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const rl = getRateLimit();
    if (rl.blocked) {
      setRateLimited(true);
      setRateLimitMsg(rl.message);
      setRateLimitCountdown(rl.remainingSeconds);
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { recordFailedAttempt(); setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-navy-950">
      {/* Background layers */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-navy-900 via-navy-950 to-black" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/[0.08] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-400/[0.04] rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="particle bg-brand-400/20 w-2 h-2" style={{ top: '15%', left: '10%', animationDelay: '0s', animationDuration: '7s' }} />
        <div className="particle bg-brand-300/15 w-3 h-3" style={{ top: '25%', left: '80%', animationDelay: '1.5s', animationDuration: '9s' }} />
        <div className="particle bg-white/10 w-1.5 h-1.5" style={{ top: '60%', left: '15%', animationDelay: '3s', animationDuration: '11s' }} />
        <div className="particle bg-brand-500/15 w-2 h-2" style={{ top: '70%', left: '75%', animationDelay: '2s', animationDuration: '8s' }} />
        <div className="particle bg-white/8 w-1 h-1" style={{ top: '40%', left: '50%', animationDelay: '4s', animationDuration: '10s' }} />
        <div className="particle bg-brand-400/10 w-2.5 h-2.5" style={{ top: '85%', left: '30%', animationDelay: '1s', animationDuration: '12s' }} />
        <div className="particle bg-brand-300/10 w-1.5 h-1.5" style={{ top: '10%', left: '60%', animationDelay: '5s', animationDuration: '9s' }} />
        <div className="particle bg-white/5 w-2 h-2" style={{ top: '50%', left: '90%', animationDelay: '2.5s', animationDuration: '10s' }} />
      </div>

      <div className="w-full max-w-[440px] relative animate-fade-in">
        {/* Card */}
        <div className="bg-white/[0.97] backdrop-blur-2xl rounded-3xl shadow-modal p-8 sm:p-10 space-y-8 border border-white/20" style={{ boxShadow: '0 25px 80px -12px rgba(0,0,0,0.35), 0 10px 30px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 0 rgba(255,255,255,0.5)' }}>
          {/* Brand Header */}
          <div className="text-center space-y-5">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow ring-4 ring-brand-500/10 transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(51,150,255,0.35)]">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-navy-950 tracking-tight leading-tight">SecureGate</h1>
              <p className="text-sm text-navy-400 mt-1">Visitor & Material Gate Pass Management</p>
              <p className="text-xs text-navy-300 mt-3">Sign in to your account to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder="you@company.com" autoFocus
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  type={showPw ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10" placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPw((p) => !p)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500 transition-colors">
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {successMsg && (
              <div className="rounded-xl bg-success-50 border border-success-500/20 px-4 py-3 flex items-center gap-2.5 animate-fade-in">
                <svg className="w-4 h-4 text-success-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-success-700">{successMsg}</p>
              </div>
            )}

            {rateLimited && (
              <div className="rounded-xl bg-warning-50 border border-warning-500/20 px-4 py-3 flex items-center gap-2.5 animate-fade-in">
                <svg className="w-4 h-4 text-warning-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning-800">Access Temporarily Restricted</p>
                  <p className="text-xs text-warning-700 mt-0.5">{rateLimitMsg}</p>
                </div>
              </div>
            )}

            {error && !rateLimited && (
              <div className="rounded-xl bg-danger-50 border border-danger-500/20 px-4 py-3 flex items-center gap-2.5 animate-fade-in">
                <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button type="button" onClick={async () => {
                if (!email) { setError('Enter your email address first.'); return; }
                setLoading(true); setError('');
                const { error: pwErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
                if (pwErr) { setError(pwErr.message); setLoading(false); return; }
                setError('');
                setSuccessMsg('Password reset link sent to your email.');
                setLoading(false);
              }} className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading || rateLimited} className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl px-5 py-3 text-sm font-semibold hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-soft hover:shadow-glow transition-all duration-200">
              {rateLimited ? (
                <span>Try again in {rateLimitCountdown}s</span>
              ) : loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Security indicator */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <svg className="w-3.5 h-3.5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <p className="text-xs text-navy-400">Connection secured with TLS encryption</p>
          </div>
        </div>

        <p className="text-center text-xs text-navy-500 mt-6 opacity-70">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
