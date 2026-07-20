import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="empty-state py-32">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 mb-4">
        <span className="text-2xl font-bold text-navy-300">404</span>
      </div>
      <p className="text-lg font-medium text-navy-500">Page not found</p>
      <Link to="/" className="text-sm text-brand-700 hover:text-brand-800 font-medium mt-3 inline-block transition-colors">Go to dashboard</Link>
    </div>
  );
}
