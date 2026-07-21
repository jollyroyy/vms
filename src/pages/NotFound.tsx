import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="empty-state py-32">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-4 shadow-glow-sm">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-navy-600">SecureGate</p>
      <p className="text-sm text-navy-400 mt-1 mb-2">Page not found</p>
      <Link to="/" className="text-sm text-brand-700 hover:text-brand-800 font-medium mt-3 inline-block transition-colors">Go to dashboard</Link>
    </div>
  );
}
