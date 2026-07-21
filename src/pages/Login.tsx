import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getRateLimit, recordFailedAttempt, recordPageLoad } from '../lib/rateLimiter';
import { safeErrorMessage } from '../lib/errors';

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
    if (err) { recordFailedAttempt(); setError(safeErrorMessage(err, 'Sign-in failed. Please try again.')); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4 relative">
      {/* Card */}
      <div className="w-full max-w-[460px] bg-white rounded-3xl shadow-2xl p-8 sm:p-10 animate-fade-in">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] flex items-center justify-center shadow-glow-sm mb-5">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-navy-900 tracking-tight">SecureGate</h1>
          <p className="text-sm text-navy-500 mt-1.5">Visitor &amp; Material Gate Pass Management</p>
        </div>

        {/* Subtitle */}
        <p className="text-center text-sm text-navy-500 mb-7">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-navy-600 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-[#7C3AED] transition-colors">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-navy-200 bg-navy-50 text-navy-900 placeholder-navy-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED] transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-navy-600 uppercase tracking-wider mb-2">Password</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-[#7C3AED] transition-colors">
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <input
                type={showPw ? 'text' : 'password'} required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-12 pl-11 pr-11 rounded-xl border border-navy-200 bg-navy-50 text-navy-900 placeholder-navy-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED] transition-all"
              />
              <button type="button" onClick={() => setShowPw((p) => !p)} tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600 transition-colors">
                {showPw ? (
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-success-50 border border-success-200">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-success-700">{successMsg}</p>
            </div>
          )}

          {rateLimited && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warning-50 border border-warning-200">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-warning-700">Too many attempts</p>
                <p className="text-xs text-warning-600 mt-0.5">{rateLimitMsg}</p>
              </div>
            </div>
          )}

          {error && !rateLimited && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-danger-50 border border-danger-200">
              <svg className="w-4 h-4 shrink-0 mt-0.5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          {/* Forgot password */}
          <div className="flex items-center justify-end">
            <button type="button" onClick={async () => {
              if (!email) { setError('Enter your email address first.'); return; }
              setLoading(true); setError('');
              const { error: pwErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
              if (pwErr) { setError(safeErrorMessage(pwErr, 'Password reset request failed.')); setLoading(false); return; }
              setError('');
              setSuccessMsg('Password reset link sent to your email.');
              setLoading(false);
            }} className="text-xs font-semibold text-[#7C3AED] hover:text-[#5B21B6] transition-colors">
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || rateLimited}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] hover:from-[#6D28D9] hover:to-[#4C1D95] text-white text-sm font-bold tracking-wide shadow-lg shadow-[#7C3AED]/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
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

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-7">
          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-[11px] text-navy-400">Connection secured with TLS encryption</p>
        </div>
      </div>
    </div>
  );
}
