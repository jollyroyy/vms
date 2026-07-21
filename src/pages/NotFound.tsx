import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="card-premium max-w-md w-full px-8 py-12 text-center animate-scale-in">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow-mix mb-6">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <p className="gradient-text font-display text-7xl font-extrabold tracking-tight leading-none">404</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-navy-400">SecureGate</p>
        <h1 className="mt-2 text-xl font-bold text-navy-950 font-display">Page not found</h1>
        <p className="mt-2 text-sm text-navy-400">The page you are looking for doesn&rsquo;t exist or has been moved.</p>
        <div className="divider my-6" />
        <Link to="/" className="btn-primary inline-flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
