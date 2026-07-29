import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="card-premium max-w-md w-full px-8 py-12 text-center animate-scale-in">
        <Logo size="md" className="mx-auto mb-6 shadow-glow-mix" />
        <p className="gradient-text font-display text-7xl font-extrabold tracking-tight leading-none">404</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-navy-400">Quest Mall Secure Gate</p>
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
