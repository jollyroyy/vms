import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function LoginPage(): React.ReactElement {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/[0.07] rounded-full blur-[120px]" />

      <div className="w-full max-w-[380px] relative">
        <div className="bg-white rounded-2xl shadow-elevated p-8 space-y-7">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto h-11 w-11 rounded-lg bg-navy-900 flex items-center justify-center">
              <span className="text-brand-400 font-bold text-base">V</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy-950 tracking-tight">Sign in to VMS</h1>
              <p className="text-sm text-navy-400 mt-1">Visitor & Material Gate Pass</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="you@company.com" autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input" placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-navy-600 mt-5">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
